/**
 * Proxy Server Switching Feature Test
 * 
 * Tests the ability to:
 * 1. Connect to different MCP servers (production, dev, local)
 * 2. Switch between servers at runtime
 * 3. Handle connection failures and recovery
 * 4. Restart proxy with different configurations
 */

import { spawn } from 'child_process';
import { EventEmitter } from 'events';
import { setTimeout } from 'timers/promises';
import readline from 'readline';

class ProxyTester extends EventEmitter {
  constructor() {
    super();
    this.proxy = null;
    this.responses = [];
    this.errors = [];
    this.serverMessages = [];
  }

  async startProxy(server = 'production', env = {}) {
    return new Promise((resolve, reject) => {
      const proxyEnv = {
        ...process.env,
        API_ACCESS_TOKEN: '75bf9cbcf951ed970c96431f77985d7588d1229d5b3f29e0555a177f628f55d5',
        ...env
      };

      this.proxy = spawn('node', [
        'src/mcp-proxy-client.js',
        server
      ], {
        cwd: process.cwd(),
        env: proxyEnv,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      // Create readline interfaces for output streams
      const stdoutReader = readline.createInterface({
        input: this.proxy.stdout,
        crlfDelay: Infinity
      });

      const stderrReader = readline.createInterface({
        input: this.proxy.stderr,
        crlfDelay: Infinity
      });

      // Handle stdout (MCP responses)
      stdoutReader.on('line', (line) => {
        try {
          const response = JSON.parse(line);
          this.responses.push(response);
          this.emit('response', response);
        } catch (e) {
          console.error('Failed to parse response:', line);
        }
      });

      // Handle stderr (debug messages)
      stderrReader.on('line', (line) => {
        this.serverMessages.push(line);
        this.emit('server-message', line);
        
        // Check for connection established
        if (line.includes('SSE connection established')) {
          this.emit('connected', server);
        }
        
        // Check for session ID
        if (line.includes('Session ID:')) {
          const sessionId = line.split('Session ID:')[1].trim();
          this.emit('session', sessionId);
          resolve({ server, sessionId });
        }
      });

      this.proxy.on('error', (error) => {
        this.errors.push(error);
        reject(error);
      });

      this.proxy.on('exit', (code) => {
        this.emit('exit', code);
      });

      // Timeout for connection
      setTimeout(10000).then(() => {
        if (!this.proxy.killed) {
          reject(new Error('Proxy connection timeout'));
        }
      });
    });
  }

  async sendCommand(command) {
    return new Promise((resolve, reject) => {
      if (!this.proxy || this.proxy.killed) {
        reject(new Error('Proxy not running'));
        return;
      }

      const responseHandler = (response) => {
        if (response.id === 'proxy-switch' || response.id === 'proxy-list') {
          this.removeListener('response', responseHandler);
          resolve(response);
        }
      };

      this.on('response', responseHandler);

      // Send command
      this.proxy.stdin.write(command + '\n');

      // Timeout
      setTimeout(5000).then(() => {
        this.removeListener('response', responseHandler);
        reject(new Error('Command timeout'));
      });
    });
  }

  async switchServer(serverName) {
    const command = `__MCP_PROXY_SWITCH_${serverName}`;
    return this.sendCommand(command);
  }

  async listServers() {
    return this.sendCommand('__MCP_PROXY_LIST_SERVERS');
  }

  async stopProxy() {
    if (this.proxy && !this.proxy.killed) {
      this.proxy.kill('SIGTERM');
      await setTimeout(1000);
      if (!this.proxy.killed) {
        this.proxy.kill('SIGKILL');
      }
    }
  }

  clearLogs() {
    this.responses = [];
    this.errors = [];
    this.serverMessages = [];
  }
}

describe('Proxy Server Switching Feature', () => {
  let tester;

  beforeEach(() => {
    tester = new ProxyTester();
  });

  afterEach(async () => {
    await tester.stopProxy();
  });

  test('should connect to production server by default', async () => {
    const result = await tester.startProxy();
    
    expect(result.server).toBe('production');
    expect(result.sessionId).toBeTruthy();
    
    // Check server messages for production URL
    const connectionMessage = tester.serverMessages.find(msg => 
      msg.includes('Connecting to Production MCP Server')
    );
    expect(connectionMessage).toBeTruthy();
    expect(connectionMessage).toContain('192.168.10.100:3001');
  });

  test('should connect to dev server when specified', async () => {
    const result = await tester.startProxy('dev');
    
    expect(result.server).toBe('dev');
    expect(result.sessionId).toBeTruthy();
    
    // Check server messages for dev URL
    const connectionMessage = tester.serverMessages.find(msg => 
      msg.includes('Connecting to Development MCP Server')
    );
    expect(connectionMessage).toBeTruthy();
    expect(connectionMessage).toContain('192.168.10.102:3001');
  });

  test('should list available servers', async () => {
    await tester.startProxy();
    const response = await tester.listServers();
    
    expect(response.result.servers).toBeDefined();
    expect(response.result.servers.production).toBeDefined();
    expect(response.result.servers.dev).toBeDefined();
    expect(response.result.servers.local).toBeDefined();
    expect(response.result.current).toBe('production');
  });

  test('should switch from production to dev server', async () => {
    // Start with production
    await tester.startProxy('production');
    
    // Clear logs before switching
    tester.clearLogs();
    
    // Switch to dev
    const switchResponse = await tester.switchServer('dev');
    
    expect(switchResponse.result.switched).toBe(true);
    expect(switchResponse.result.server).toBe('dev');
    
    // Wait for reconnection
    await new Promise(resolve => {
      tester.once('connected', (server) => {
        expect(server).toBe('dev');
        resolve();
      });
    });
    
    // Verify connected to dev server
    const devConnectionMessage = tester.serverMessages.find(msg =>
      msg.includes('Switching to Development MCP Server')
    );
    expect(devConnectionMessage).toBeTruthy();
  });

  test('should handle invalid server name gracefully', async () => {
    await tester.startProxy();
    
    const response = await tester.switchServer('invalid-server');
    
    expect(response.result.switched).toBe(false);
    expect(response.result.available).toContain('production');
    expect(response.result.available).toContain('dev');
    expect(response.result.available).toContain('local');
  });

  test('should use MCP_SERVER environment variable', async () => {
    const result = await tester.startProxy('production', {
      MCP_SERVER: 'dev'
    });
    
    // Environment variable should override command line argument
    const connectionMessage = tester.serverMessages.find(msg => 
      msg.includes('Connecting to Development MCP Server')
    );
    expect(connectionMessage).toBeTruthy();
  });

  test('should restart proxy with different server', async () => {
    // Start with production
    const firstResult = await tester.startProxy('production');
    expect(firstResult.server).toBe('production');
    
    // Stop proxy
    await tester.stopProxy();
    await setTimeout(1000);
    
    // Clear logs
    tester.clearLogs();
    
    // Restart with dev
    const secondResult = await tester.startProxy('dev');
    expect(secondResult.server).toBe('dev');
    
    // Verify it's connected to dev
    const devConnectionMessage = tester.serverMessages.find(msg => 
      msg.includes('Connecting to Development MCP Server')
    );
    expect(devConnectionMessage).toBeTruthy();
  });

  test('should handle rapid server switching', async () => {
    await tester.startProxy('production');
    
    // Switch servers rapidly
    const switches = ['dev', 'production', 'dev'];
    
    for (const server of switches) {
      tester.clearLogs();
      
      const response = await tester.switchServer(server);
      expect(response.result.switched).toBe(true);
      
      // Wait for connection
      await new Promise(resolve => {
        tester.once('session', () => resolve());
      });
      
      // Small delay to ensure stability
      await setTimeout(500);
    }
    
    // Verify final server
    const listResponse = await tester.listServers();
    expect(listResponse.result.current).toBe('dev');
  });

  test('should maintain session after server switch', async () => {
    await tester.startProxy('production');
    
    // Get initial session
    const initialSession = await new Promise(resolve => {
      tester.once('session', (id) => resolve(id));
    });
    
    // Switch server
    await tester.switchServer('dev');
    
    // Get new session
    const newSession = await new Promise(resolve => {
      tester.once('session', (id) => resolve(id));
    });
    
    // Sessions should be different (new connection)
    expect(newSession).not.toBe(initialSession);
    expect(newSession).toBeTruthy();
  });

  test('should handle connection errors gracefully', async () => {
    // Try to connect to local server (likely not running)
    try {
      await tester.startProxy('local');
    } catch (error) {
      // Should timeout or error
      expect(error).toBeTruthy();
    }
    
    // Check error messages
    const errorMessage = tester.serverMessages.find(msg =>
      msg.includes('SSE connection error') || msg.includes('ECONNREFUSED')
    );
    expect(errorMessage).toBeTruthy();
  });
});

// Additional test suite for proxy restart scenarios
describe('Proxy Restart Feature', () => {
  let tester;

  beforeEach(() => {
    tester = new ProxyTester();
  });

  afterEach(async () => {
    await tester.stopProxy();
  });

  test('should cleanly shutdown on SIGTERM', async () => {
    await tester.startProxy();
    
    const exitPromise = new Promise(resolve => {
      tester.once('exit', (code) => resolve(code));
    });
    
    // Send SIGTERM
    tester.proxy.kill('SIGTERM');
    
    const exitCode = await exitPromise;
    expect(exitCode).toBe(0);
    
    // Check for shutdown message
    const shutdownMessage = tester.serverMessages.find(msg =>
      msg.includes('Shutting down proxy client')
    );
    expect(shutdownMessage).toBeTruthy();
  });

  test('should restart after crash', async () => {
    // Start proxy
    await tester.startProxy();
    
    // Force kill to simulate crash
    tester.proxy.kill('SIGKILL');
    
    // Wait for exit
    await new Promise(resolve => {
      tester.once('exit', () => resolve());
    });
    
    // Clear logs
    tester.clearLogs();
    
    // Restart
    const result = await tester.startProxy();
    expect(result.sessionId).toBeTruthy();
  });

  test('should handle multiple restarts', async () => {
    const restartCount = 3;
    
    for (let i = 0; i < restartCount; i++) {
      tester.clearLogs();
      
      // Start proxy
      const result = await tester.startProxy();
      expect(result.sessionId).toBeTruthy();
      
      // Stop proxy
      await tester.stopProxy();
      await setTimeout(500);
    }
  });

  test('should preserve server selection across restarts', async () => {
    // Start with dev server
    await tester.startProxy('dev');
    
    // Stop
    await tester.stopProxy();
    await setTimeout(1000);
    
    // Clear logs
    tester.clearLogs();
    
    // Restart with same server
    await tester.startProxy('dev');
    
    // Verify still on dev
    const devConnectionMessage = tester.serverMessages.find(msg =>
      msg.includes('Connecting to Development MCP Server')
    );
    expect(devConnectionMessage).toBeTruthy();
  });
});

export { ProxyTester };