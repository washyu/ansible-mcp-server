import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('MCP Proxy Client Forwarding', () => {
  let proxyProcess;
  
  beforeAll(() => {
    // Start the proxy client in test mode
    const proxyPath = path.join(__dirname, '../../src/mcp-proxy-client.js');
    proxyProcess = spawn('node', [proxyPath], {
      env: {
        ...process.env,
        MCP_SERVER: 'local',
        MCP_SSE_URL: 'http://localhost:3001/sse',
        API_ACCESS_TOKEN: 'test-token'
      }
    });
    
    // Give it time to connect
    return new Promise(resolve => setTimeout(resolve, 2000));
  });
  
  afterAll(() => {
    if (proxyProcess) {
      proxyProcess.kill();
    }
  });
  
  it('should forward tools/list request to MCP server', (done) => {
    const testRequest = {
      jsonrpc: '2.0',
      method: 'tools/list',
      params: {},
      id: 'test-tools-list-1'
    };
    
    let responseReceived = false;
    
    proxyProcess.stdout.on('data', (data) => {
      const lines = data.toString().split('\n').filter(line => line.trim());
      lines.forEach(line => {
        try {
          const response = JSON.parse(line);
          if (response.id === 'test-tools-list-1') {
            responseReceived = true;
            
            // Should get actual tools list, not hardcoded one
            expect(response.result).toBeDefined();
            expect(response.result.tools).toBeDefined();
            expect(Array.isArray(response.result.tools)).toBe(true);
            
            // Should include our list-hosts tool
            const listHostsTool = response.result.tools.find(t => t.name === 'list-hosts');
            expect(listHostsTool).toBeDefined();
            
            // Should have many more tools than the hardcoded 3
            expect(response.result.tools.length).toBeGreaterThan(10);
            
            done();
          }
        } catch (e) {
          // Ignore non-JSON output
        }
      });
    });
    
    proxyProcess.stderr.on('data', (data) => {
      console.error('Proxy error:', data.toString());
    });
    
    // Send the request
    proxyProcess.stdin.write(JSON.stringify(testRequest) + '\n');
    
    // Timeout if no response
    setTimeout(() => {
      if (!responseReceived) {
        done(new Error('No response received for tools/list request'));
      }
    }, 5000);
  });
  
  it('should forward tools/call request to MCP server', (done) => {
    const testRequest = {
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'list-hosts',
        arguments: {}
      },
      id: 'test-tools-call-1'
    };
    
    let responseReceived = false;
    
    proxyProcess.stdout.on('data', (data) => {
      const lines = data.toString().split('\n').filter(line => line.trim());
      lines.forEach(line => {
        try {
          const response = JSON.parse(line);
          if (response.id === 'test-tools-call-1') {
            responseReceived = true;
            
            // Should get actual response from MCP server
            if (response.error) {
              // If there's an error, it should be from the actual tool execution
              // not the hardcoded "MCP server is currently unavailable" message
              expect(response.error.message).not.toContain('MCP server is currently unavailable');
            } else {
              expect(response.result).toBeDefined();
            }
            
            done();
          }
        } catch (e) {
          // Ignore non-JSON output
        }
      });
    });
    
    // Send the request
    proxyProcess.stdin.write(JSON.stringify(testRequest) + '\n');
    
    // Timeout if no response
    setTimeout(() => {
      if (!responseReceived) {
        done(new Error('No response received for tools/call request'));
      }
    }, 5000);
  });
});