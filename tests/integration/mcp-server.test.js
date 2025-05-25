import { spawn } from 'child_process';
import path from 'path';
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

describe('MCP Server Integration', () => {
  let server;

  beforeEach(async () => {
    server = global.testUtils.createMCPServer();
    await global.testUtils.waitForServer(server);
  });

  afterEach(() => {
    if (server) {
      server.kill();
    }
  });

  describe('Server Initialization', () => {
    it('should start successfully and load all tools', async () => {
      // Send list tools request
      const request = {
        jsonrpc: '2.0',
        method: 'tools/list',
        params: {},
        id: 1
      };

      const response = await new Promise((resolve, reject) => {
        let output = '';
        
        server.stdout.on('data', (data) => {
          output += data.toString();
          const lines = output.split('\n');
          
          for (const line of lines) {
            if (line.trim() && line.includes('"jsonrpc"')) {
              try {
                const parsed = JSON.parse(line);
                if (parsed.id === 1) {
                  resolve(parsed);
                }
              } catch (e) {
                // Not complete JSON yet
              }
            }
          }
        });

        server.stdin.write(JSON.stringify(request) + '\n');
        
        setTimeout(() => reject(new Error('Timeout')), 5000);
      });

      expect(response.result).toBeDefined();
      expect(response.result.tools).toBeDefined();
      expect(response.result.tools.length).toBeGreaterThan(50); // Should have 58+ tools
      
      // Verify essential tools are present
      const toolNames = response.result.tools.map(t => t.name);
      expect(toolNames).toContain('ansible-playbook');
      expect(toolNames).toContain('create-playbook-flexible');
      expect(toolNames).toContain('terraform-plan');
      expect(toolNames).toContain('setup-wizard');
    });
  });

  describe('Error Handling', () => {
    it('should handle unknown tool gracefully', async () => {
      const result = await global.testUtils.callMCPTool(server, 'nonexistent-tool', {});
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown tool');
    });

    it('should handle invalid JSON-RPC requests', async () => {
      const response = await new Promise((resolve, reject) => {
        let output = '';
        const timeout = setTimeout(() => {
          reject(new Error('Timeout waiting for response'));
        }, 5000);
        
        server.stdout.on('data', (data) => {
          output += data.toString();
          const lines = output.split('\n');
          
          for (const line of lines) {
            if (line.trim() && line.includes('"jsonrpc"')) {
              try {
                const parsed = JSON.parse(line);
                clearTimeout(timeout);
                resolve(parsed);
              } catch (e) {
                // Not complete JSON yet
              }
            }
          }
        });

        // Send invalid request (missing method)
        server.stdin.write(JSON.stringify({
          jsonrpc: '2.0',
          params: {},
          id: 2
        }) + '\n');
      });

      expect(response.error).toBeDefined();
    });
  });

  describe('Context Persistence', () => {
    it('should persist context between calls', async () => {
      const testData = { test: true, timestamp: Date.now() };
      
      // Set context
      let result = await global.testUtils.callMCPTool(server, 'set-mcp-context', {
        key: 'jest-test',
        value: testData
      });
      
      expect(result.success).toBe(true);
      
      // Get context
      result = await global.testUtils.callMCPTool(server, 'get-mcp-context', {
        key: 'jest-test'
      });
      
      expect(result.success).toBe(true);
      const retrieved = JSON.parse(result.output);
      expect(retrieved).toEqual(testData);
    });
  });

  describe('Tool Categories', () => {
    it('should have tools in all expected categories', async () => {
      const toolTests = [
        { tool: 'create-playbook', category: 'ansible' },
        { tool: 'terraform-plan', category: 'terraform' },
        { tool: 'security-quick-scan', category: 'security' },
        { tool: 'hardware-scan', category: 'hardware' },
        { tool: 'browse-services', category: 'services' },
        { tool: 'network-topology', category: 'infrastructure' }
      ];

      for (const { tool, category } of toolTests) {
        const request = {
          jsonrpc: '2.0',
          method: 'tools/list',
          params: {},
          id: Date.now()
        };

        const response = await new Promise((resolve, reject) => {
          let output = '';
          
          server.stdout.on('data', (data) => {
            output += data.toString();
            const lines = output.split('\n');
            
            for (const line of lines) {
              if (line.trim() && line.includes('"jsonrpc"')) {
                try {
                  const parsed = JSON.parse(line);
                  if (parsed.id === request.id) {
                    resolve(parsed);
                  }
                } catch (e) {
                  // Not complete JSON yet
                }
              }
            }
          });

          server.stdin.write(JSON.stringify(request) + '\n');
          setTimeout(() => reject(new Error('Timeout')), 5000);
        });

        const toolExists = response.result.tools.some(t => t.name === tool);
        expect(toolExists).toBe(true);
      }
    });
  });
});