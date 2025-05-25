// Jest setup file - runs before each test file
import { spawn } from 'child_process';
import path from 'path';
import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
import { jest } from '@jest/globals';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Global test utilities
global.testUtils = {
  // Helper to create a test MCP server instance
  createMCPServer: () => {
    const serverPath = path.join(__dirname, '../../src/index.js');
    return spawn('node', [serverPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, NODE_ENV: 'test' }
    });
  },

  // Helper to call MCP tool and get response
  callMCPTool: async (server, toolName, args = {}) => {
    return new Promise((resolve, reject) => {
      const request = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: toolName,
          arguments: args
        },
        id: Date.now()
      };

      let output = '';
      let completed = false;

      const timer = setTimeout(() => {
        if (!completed) {
          completed = true;
          server.kill();
          reject(new Error(`Timeout calling ${toolName}`));
        }
      }, 10000);

      server.stdout.on('data', (data) => {
        output += data.toString();
        
        const lines = output.split('\n');
        for (const line of lines) {
          if (line.trim() && line.includes('"jsonrpc"')) {
            try {
              const response = JSON.parse(line);
              if (response.id === request.id) {
                clearTimeout(timer);
                completed = true;
                
                if (response.error) {
                  reject(new Error(`MCP error: ${JSON.stringify(response.error)}`));
                } else if (response.result) {
                  const result = JSON.parse(response.result.content[0].text);
                  resolve(result);
                }
              }
            } catch (e) {
              // Not complete JSON yet
            }
          }
        }
      });

      server.on('exit', () => {
        if (!completed) {
          clearTimeout(timer);
          reject(new Error('MCP server exited unexpectedly'));
        }
      });

      server.stdin.write(JSON.stringify(request) + '\n');
    });
  },

  // Helper to wait for server initialization
  waitForServer: async (server) => {
    return new Promise((resolve) => {
      server.stderr.on('data', (data) => {
        const output = data.toString();
        if (output.includes('Ansible MCP server running')) {
          resolve();
        }
      });
    });
  }
};

// Clean up test output directory before tests
beforeAll(async () => {
  const testOutputDir = path.join(__dirname, '../test-output');
  try {
    await fs.rm(testOutputDir, { recursive: true, force: true });
  } catch (e) {
    // Directory might not exist
  }
  await fs.mkdir(testOutputDir, { recursive: true });
});

// Mock console.error to reduce noise in tests
const originalConsoleError = console.error;
beforeEach(() => {
  console.error = () => {}; // Silence console.error in tests
});

afterEach(() => {
  console.error = originalConsoleError;
});