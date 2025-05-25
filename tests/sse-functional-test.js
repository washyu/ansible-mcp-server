#!/usr/bin/env node
// SSE Functional test suite - tests MCP server through SSE connection
// Simulates what Claude Desktop does through the Windows proxy

import EventSource from 'eventsource';
import http from 'http';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Configuration
const SSE_URL = process.env.MCP_SSE_URL || 'http://localhost:3001/sse';
const API_TOKEN = process.env.API_ACCESS_TOKEN || 'test-token';

// ANSI color codes
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

// Test tracking
let passedTests = 0;
let failedTests = 0;
const testResults = [];

class SSETestClient {
  constructor() {
    this.sessionId = null;
    this.eventSource = null;
    this.responses = new Map();
    this.messageId = 1;
  }

  connect() {
    return new Promise((resolve, reject) => {
      console.log(`${colors.blue}Connecting to SSE server: ${SSE_URL}${colors.reset}`);
      
      this.eventSource = new EventSource(SSE_URL, {
        headers: {
          'Authorization': `Bearer ${API_TOKEN}`
        }
      });

      this.eventSource.onopen = () => {
        console.log(`${colors.green}SSE connection established${colors.reset}`);
      };

      this.eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          switch (data.type) {
            case 'session':
              this.sessionId = data.sessionId;
              console.log(`${colors.blue}Session ID: ${this.sessionId}${colors.reset}`);
              resolve();
              break;
              
            case 'message':
              // Handle MCP response
              if (data.data.id !== undefined) {
                const resolver = this.responses.get(data.data.id);
                if (resolver) {
                  resolver(data.data);
                  this.responses.delete(data.data.id);
                }
              }
              break;
              
            case 'error':
              console.error(`${colors.red}Server error: ${data.error}${colors.reset}`);
              break;
          }
        } catch (e) {
          console.error(`${colors.red}Failed to parse SSE message: ${e}${colors.reset}`);
        }
      };

      this.eventSource.onerror = (error) => {
        console.error(`${colors.red}SSE connection error: ${error}${colors.reset}`);
        reject(error);
      };

      // Timeout if no session received
      setTimeout(() => {
        if (!this.sessionId) {
          reject(new Error('Timeout waiting for session'));
        }
      }, 5000);
    });
  }

  async sendRequest(method, params = {}) {
    const id = this.messageId++;
    const request = {
      jsonrpc: '2.0',
      method,
      params,
      id
    };

    return new Promise((resolve, reject) => {
      // Set up response handler
      this.responses.set(id, resolve);

      // Send request via HTTP POST
      const url = new URL(`/sessions/${this.sessionId}/input`, SSE_URL);
      const data = JSON.stringify(request);

      const options = {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain',
          'Authorization': `Bearer ${API_TOKEN}`,
          'Content-Length': Buffer.byteLength(data)
        }
      };

      const req = http.request(options, (res) => {
        if (res.statusCode !== 200) {
          let body = '';
          res.on('data', chunk => body += chunk);
          res.on('end', () => {
            reject(new Error(`HTTP ${res.statusCode}: ${body}`));
          });
        }
      });

      req.on('error', reject);
      req.write(data);
      req.end();

      // Timeout for response
      setTimeout(() => {
        if (this.responses.has(id)) {
          this.responses.delete(id);
          reject(new Error(`Timeout waiting for response to request ${id}`));
        }
      }, 10000);
    });
  }

  disconnect() {
    if (this.eventSource) {
      this.eventSource.close();
    }
  }
}

// Test runner
async function runTest(name, testFn) {
  process.stdout.write(`${name}... `);
  try {
    await testFn();
    console.log(`${colors.green}✓${colors.reset}`);
    passedTests++;
    testResults.push({ name, status: 'passed' });
  } catch (error) {
    console.log(`${colors.red}✗${colors.reset}`);
    console.error(`  ${colors.red}Error: ${error.message}${colors.reset}`);
    failedTests++;
    testResults.push({ name, status: 'failed', error: error.message });
  }
}

// Main test suite
async function runTests() {
  console.log(`${colors.yellow}Running SSE MCP Functional Tests${colors.reset}\n`);
  
  const client = new SSETestClient();
  
  try {
    // Connect to SSE server
    await runTest('Connect to SSE server', async () => {
      await client.connect();
      if (!client.sessionId) {
        throw new Error('No session ID received');
      }
    });

    // Initialize MCP
    await runTest('Initialize MCP protocol', async () => {
      const response = await client.sendRequest('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'sse-test-client', version: '1.0.0' }
      });
      
      if (!response.result || response.result.protocolVersion !== '2024-11-05') {
        throw new Error('Invalid initialize response');
      }
    });

    // Send initialized notification
    await runTest('Send initialized notification', async () => {
      // This doesn't expect a response
      await client.sendRequest('notifications/initialized');
      // Give it a moment to process
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    // List tools
    await runTest('List available tools', async () => {
      const response = await client.sendRequest('tools/list', {});
      
      if (!response.result || !response.result.tools) {
        throw new Error('No tools returned');
      }
      
      console.log(`  Found ${response.result.tools.length} tools`);
      
      const expectedTools = [
        'ansible-playbook', 'ansible-inventory', 'create-playbook',
        'terraform-plan', 'terraform-apply', 'homelab-deploy'
      ];
      
      const toolNames = response.result.tools.map(t => t.name);
      for (const expected of expectedTools) {
        if (!toolNames.includes(expected)) {
          throw new Error(`Missing expected tool: ${expected}`);
        }
      }
    });

    // Test ansible-command
    await runTest('Execute ansible --version', async () => {
      const response = await client.sendRequest('tools/call', {
        name: 'ansible-command',
        arguments: {
          command: 'ansible',
          args: ['--version']
        }
      });
      
      if (response.error) {
        throw new Error(`Tool call failed: ${response.error.message}`);
      }
      
      if (!response.result?.output?.includes('ansible')) {
        throw new Error('Invalid ansible version output');
      }
    });

    // Test create-playbook
    await runTest('Create test playbook', async () => {
      const response = await client.sendRequest('tools/call', {
        name: 'create-playbook',
        arguments: {
          name: 'sse-test.yml',
          content: '---\n- name: SSE Test Playbook\n  hosts: localhost\n  tasks:\n    - debug:\n        msg: "SSE test successful"',
          directory: '/tmp/sse-test-playbooks'
        }
      });
      
      if (response.error) {
        throw new Error(`Tool call failed: ${response.error.message}`);
      }
    });

    // Test ansible-inventory
    await runTest('List ansible inventory', async () => {
      // First create a test inventory
      const inventoryContent = `
[test]
localhost ansible_connection=local

[test:vars]
test_var=sse_test
`;
      await fs.mkdir('/tmp/sse-test-inventory', { recursive: true });
      await fs.writeFile('/tmp/sse-test-inventory/hosts', inventoryContent);
      
      const response = await client.sendRequest('tools/call', {
        name: 'ansible-inventory',
        arguments: {
          inventory: '/tmp/sse-test-inventory/hosts',
          list: true
        }
      });
      
      if (response.error) {
        throw new Error(`Tool call failed: ${response.error.message}`);
      }
      
      if (!response.result?.output?.includes('test')) {
        throw new Error('Inventory output missing test group');
      }
    });

    // Test network-topology
    await runTest('Generate network topology', async () => {
      const response = await client.sendRequest('tools/call', {
        name: 'network-topology',
        arguments: {
          inventory: '/tmp/sse-test-inventory/hosts',
          format: 'mermaid'
        }
      });
      
      if (response.error) {
        throw new Error(`Tool call failed: ${response.error.message}`);
      }
    });

    // Test capture-state
    await runTest('Capture infrastructure state', async () => {
      const response = await client.sendRequest('tools/call', {
        name: 'capture-state',
        arguments: {
          inventory: '/tmp/sse-test-inventory/hosts',
          name: 'sse-test-state'
        }
      });
      
      if (response.error) {
        throw new Error(`Tool call failed: ${response.error.message}`);
      }
    });

    // Test create-vm-template
    await runTest('Create VM template', async () => {
      const response = await client.sendRequest('tools/call', {
        name: 'create-vm-template',
        arguments: {
          name: 'sse-test-vm',
          type: 'generic',
          outputDir: '/tmp/sse-test-terraform'
        }
      });
      
      if (response.error) {
        throw new Error(`Tool call failed: ${response.error.message}`);
      }
    });

  } finally {
    // Cleanup
    console.log(`\n${colors.blue}Cleaning up...${colors.reset}`);
    client.disconnect();
    
    try {
      await fs.rm('/tmp/sse-test-playbooks', { recursive: true, force: true });
      await fs.rm('/tmp/sse-test-inventory', { recursive: true, force: true });
      await fs.rm('/tmp/sse-test-terraform', { recursive: true, force: true });
    } catch (e) {
      // Ignore cleanup errors
    }
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log(`${colors.yellow}Test Summary:${colors.reset}`);
  console.log(`${colors.green}Passed: ${passedTests}${colors.reset}`);
  console.log(`${colors.red}Failed: ${failedTests}${colors.reset}`);
  console.log('='.repeat(50));
  
  if (failedTests > 0) {
    console.log(`\n${colors.red}Failed Tests:${colors.reset}`);
    testResults.filter(r => r.status === 'failed').forEach(r => {
      console.log(`  ${colors.red}✗ ${r.name}${colors.reset}`);
      console.log(`    ${r.error}`);
    });
  }
  
  process.exit(failedTests > 0 ? 1 : 0);
}

// Check if SSE server is available
async function checkSSEServer() {
  return new Promise((resolve) => {
    const healthUrl = SSE_URL.replace('/sse', '/health');
    
    http.get(healthUrl, (res) => {
      if (res.statusCode === 200) {
        resolve(true);
      } else {
        resolve(false);
      }
    }).on('error', () => {
      resolve(false);
    });
  });
}

// Main
async function main() {
  console.log(`${colors.blue}SSE MCP Functional Test Suite${colors.reset}`);
  console.log(`SSE URL: ${SSE_URL}`);
  console.log(`API Token: ${API_TOKEN.substring(0, 10)}...`);
  console.log();
  
  // Check if SSE server is running
  const serverAvailable = await checkSSEServer();
  if (!serverAvailable) {
    console.error(`${colors.red}Error: SSE server is not available at ${SSE_URL}${colors.reset}`);
    console.error('Make sure the SSE server is running with:');
    console.error('  sudo systemctl start sse-server');
    process.exit(1);
  }
  
  await runTests();
}

// Run
main();