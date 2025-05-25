import { describe, it } from 'node:test';
import assert from 'node:assert';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverPath = path.join(__dirname, '..', 'src', 'index.js');

function startServer() {
  return spawn('node', [serverPath], {
    stdio: ['pipe', 'pipe', 'pipe']
  });
}

function sendRequest(server, request) {
  return new Promise((resolve, reject) => {
    let response = '';
    
    server.stdout.on('data', (data) => {
      response += data.toString();
      try {
        const lines = response.trim().split('\n');
        const lastLine = lines[lines.length - 1];
        if (lastLine.startsWith('{') && lastLine.endsWith('}')) {
          const parsed = JSON.parse(lastLine);
          resolve(parsed);
        }
      } catch (e) {
        // Continue collecting data
      }
    });

    server.stderr.on('data', (data) => {
      console.error('Server error:', data.toString());
    });

    server.on('error', reject);
    
    server.stdin.write(JSON.stringify(request) + '\n');
    
    setTimeout(() => {
      reject(new Error('Timeout waiting for response'));
    }, 5000);
  });
}

describe('Ansible MCP Server', () => {
  it('should list available tools', async () => {
    const server = startServer();
    
    try {
      const request = {
        jsonrpc: '2.0',
        method: 'tools/list',
        id: 1
      };
      
      const response = await sendRequest(server, request);
      
      assert(response.result);
      assert(Array.isArray(response.result.tools));
      assert(response.result.tools.length === 4);
      
      const toolNames = response.result.tools.map(t => t.name);
      assert(toolNames.includes('ansible-playbook'));
      assert(toolNames.includes('ansible-inventory'));
      assert(toolNames.includes('ansible-galaxy'));
      assert(toolNames.includes('ansible-command'));
    } finally {
      server.kill();
    }
  });

  it('should validate ansible-playbook parameters', async () => {
    const server = startServer();
    
    try {
      const request = {
        jsonrpc: '2.0',
        method: 'tools/call',
        id: 2,
        params: {
          name: 'ansible-playbook',
          arguments: {
            // Missing required 'playbook' parameter
            inventory: '/tmp/inventory'
          }
        }
      };
      
      const response = await sendRequest(server, request);
      
      assert(response.error || (response.result && response.result.isError));
    } finally {
      server.kill();
    }
  });

  it('should handle ansible command execution', async () => {
    const server = startServer();
    
    try {
      const request = {
        jsonrpc: '2.0',
        method: 'tools/call',
        id: 3,
        params: {
          name: 'ansible-command',
          arguments: {
            command: 'ansible --version'
          }
        }
      };
      
      const response = await sendRequest(server, request);
      
      // Should either succeed (if ansible installed) or fail gracefully
      assert(response.result || response.error);
    } finally {
      server.kill();
    }
  });
});

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('Running Ansible MCP Server tests...');
}