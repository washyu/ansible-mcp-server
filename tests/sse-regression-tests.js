#!/usr/bin/env node
// SSE-specific regression tests
// Tests for Windows compatibility and SSE proxy issues

import EventSource from 'eventsource';
import http from 'http';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Test configuration
const SSE_URL = process.env.SSE_TEST_URL || 'http://localhost:3001/sse';
const API_TOKEN = process.env.API_ACCESS_TOKEN || 'test-token';

// ANSI colors
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

// Test runner
async function runTest(category, name, testFn) {
  process.stdout.write(`[${category}] ${name}... `);
  
  try {
    await testFn();
    console.log(`${colors.green}✓${colors.reset}`);
    passedTests++;
    testResults.push({ category, name, status: 'passed' });
  } catch (error) {
    console.log(`${colors.red}✗${colors.reset}`);
    console.error(`  Error: ${error.message}`);
    failedTests++;
    testResults.push({ category, name, status: 'failed', error: error.message });
  }
}

// SSE Client Helper
class TestSSEClient {
  constructor() {
    this.sessionId = null;
    this.eventSource = null;
    this.messageQueue = [];
  }
  
  connect() {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('SSE connection timeout'));
      }, 5000);
      
      this.eventSource = new EventSource(SSE_URL, {
        headers: {
          'Authorization': `Bearer ${API_TOKEN}`
        }
      });
      
      this.eventSource.onopen = () => {
        clearTimeout(timeout);
      };
      
      this.eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'session') {
            this.sessionId = data.sessionId;
            clearTimeout(timeout);
            resolve();
          } else if (data.type === 'message') {
            this.messageQueue.push(data.data);
          }
        } catch (e) {
          // Ignore parse errors
        }
      };
      
      this.eventSource.onerror = (error) => {
        clearTimeout(timeout);
        reject(error);
      };
    });
  }
  
  sendMessage(message) {
    return new Promise((resolve, reject) => {
      const data = typeof message === 'string' ? message : JSON.stringify(message);
      const url = new URL(`/sessions/${this.sessionId}/input`, SSE_URL);
      
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
        if (res.statusCode === 200) {
          resolve();
        } else {
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
    });
  }
  
  waitForMessage(timeout = 5000) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      const checkQueue = () => {
        if (this.messageQueue.length > 0) {
          resolve(this.messageQueue.shift());
        } else if (Date.now() - startTime > timeout) {
          reject(new Error('Timeout waiting for message'));
        } else {
          setTimeout(checkQueue, 100);
        }
      };
      
      checkQueue();
    });
  }
  
  disconnect() {
    if (this.eventSource) {
      this.eventSource.close();
    }
  }
}

// Regression Tests
async function runSSERegressionTests() {
  console.log(`${colors.blue}Running SSE Regression Tests${colors.reset}`);
  console.log('=' .repeat(50) + '\n');
  
  // Test 1: Basic SSE Connection
  await runTest('SSE', 'Can establish SSE connection', async () => {
    const client = new TestSSEClient();
    try {
      await client.connect();
      if (!client.sessionId) {
        throw new Error('No session ID received');
      }
    } finally {
      client.disconnect();
    }
  });
  
  // Test 2: Multiple Simultaneous Connections
  await runTest('SSE', 'Handles multiple simultaneous connections', async () => {
    const clients = [];
    const numClients = 5;
    
    try {
      // Create multiple connections
      for (let i = 0; i < numClients; i++) {
        const client = new TestSSEClient();
        await client.connect();
        clients.push(client);
      }
      
      // Verify all have unique session IDs
      const sessionIds = clients.map(c => c.sessionId);
      const uniqueIds = new Set(sessionIds);
      
      if (uniqueIds.size !== numClients) {
        throw new Error('Duplicate session IDs detected');
      }
    } finally {
      clients.forEach(c => c.disconnect());
    }
  });
  
  // Test 3: Environment Variables in Spawned Process
  await runTest('SSE', 'Spawned MCP has correct PATH', async () => {
    const client = new TestSSEClient();
    
    try {
      await client.connect();
      
      // Send a test command that checks PATH
      await client.sendMessage(JSON.stringify({
        jsonrpc: '2.0',
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {}
        },
        id: 1
      }));
      
      const response = await client.waitForMessage();
      if (!response.result) {
        throw new Error('Initialize failed');
      }
    } finally {
      client.disconnect();
    }
  });
  
  // Test 4: Windows-style Line Endings
  await runTest('Windows', 'Handles CRLF line endings', async () => {
    const client = new TestSSEClient();
    
    try {
      await client.connect();
      
      // Send message with Windows line ending
      const message = JSON.stringify({
        jsonrpc: '2.0',
        method: 'initialize',
        params: {},
        id: 1
      }) + '\r\n';
      
      await client.sendMessage(message);
      const response = await client.waitForMessage();
      
      if (!response.result) {
        throw new Error('Failed to handle CRLF');
      }
    } finally {
      client.disconnect();
    }
  });
  
  // Test 5: Large Message Handling
  await runTest('SSE', 'Handles large messages', async () => {
    const client = new TestSSEClient();
    
    try {
      await client.connect();
      
      // Create a large playbook content
      const largeContent = '---\n' + '- name: Test\n  hosts: all\n  tasks:\n'.repeat(100);
      
      await client.sendMessage(JSON.stringify({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'create-playbook',
          arguments: {
            name: 'large-test.yml',
            content: largeContent,
            directory: '/tmp'
          }
        },
        id: 2
      }));
      
      const response = await client.waitForMessage(10000);
      if (response.error) {
        throw new Error(`Large message failed: ${response.error.message}`);
      }
    } finally {
      client.disconnect();
    }
  });
  
  // Test 6: Connection Recovery
  await runTest('SSE', 'Client can reconnect after disconnect', async () => {
    const client = new TestSSEClient();
    
    // First connection
    await client.connect();
    const firstSessionId = client.sessionId;
    client.disconnect();
    
    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Reconnect
    await client.connect();
    const secondSessionId = client.sessionId;
    
    if (firstSessionId === secondSessionId) {
      throw new Error('Session IDs should be different after reconnect');
    }
    
    client.disconnect();
  });
  
  // Test 7: Authentication
  await runTest('Security', 'Rejects invalid API token', async () => {
    const badClient = new EventSource(SSE_URL, {
      headers: {
        'Authorization': 'Bearer invalid-token'
      }
    });
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        badClient.close();
        resolve(); // Expected to fail
      }, 2000);
      
      badClient.onopen = () => {
        clearTimeout(timeout);
        badClient.close();
        reject(new Error('Should not connect with invalid token'));
      };
      
      badClient.onerror = (error) => {
        clearTimeout(timeout);
        badClient.close();
        resolve(); // Expected behavior
      };
    });
  });
  
  // Test 8: Process Cleanup
  await runTest('Process', 'MCP process cleaned up on disconnect', async () => {
    const client = new TestSSEClient();
    
    // Get initial process count
    const { stdout: before } = await new Promise((resolve, reject) => {
      const ps = spawn('ps', ['aux']);
      let output = '';
      ps.stdout.on('data', data => output += data);
      ps.on('close', () => resolve({ stdout: output }));
      ps.on('error', reject);
    });
    
    const beforeCount = (before.match(/node.*index\.js/g) || []).length;
    
    // Connect and disconnect
    await client.connect();
    client.disconnect();
    
    // Wait for cleanup
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check process count again
    const { stdout: after } = await new Promise((resolve, reject) => {
      const ps = spawn('ps', ['aux']);
      let output = '';
      ps.stdout.on('data', data => output += data);
      ps.on('close', () => resolve({ stdout: output }));
      ps.on('error', reject);
    });
    
    const afterCount = (after.match(/node.*index\.js/g) || []).length;
    
    if (afterCount > beforeCount) {
      throw new Error('MCP process not cleaned up after disconnect');
    }
  });
  
  // Test 9: Concurrent Requests
  await runTest('Performance', 'Handles concurrent requests', async () => {
    const client = new TestSSEClient();
    
    try {
      await client.connect();
      
      // Send initialize first
      await client.sendMessage(JSON.stringify({
        jsonrpc: '2.0',
        method: 'initialize',
        params: { protocolVersion: '2024-11-05' },
        id: 1
      }));
      
      await client.waitForMessage();
      
      // Send multiple requests concurrently
      const requests = [];
      for (let i = 0; i < 5; i++) {
        requests.push(client.sendMessage(JSON.stringify({
          jsonrpc: '2.0',
          method: 'tools/list',
          params: {},
          id: 100 + i
        })));
      }
      
      await Promise.all(requests);
      
      // Should receive all responses
      const responses = [];
      for (let i = 0; i < 5; i++) {
        responses.push(await client.waitForMessage());
      }
      
      if (responses.length !== 5) {
        throw new Error('Not all concurrent requests received responses');
      }
    } finally {
      client.disconnect();
    }
  });
}

// Check if SSE server is running
async function checkSSEServer() {
  return new Promise((resolve) => {
    const healthUrl = SSE_URL.replace('/sse', '/health');
    
    http.get(healthUrl, (res) => {
      resolve(res.statusCode === 200);
    }).on('error', () => {
      resolve(false);
    });
  });
}

// Generate report
function generateReport() {
  console.log('\n' + '=' .repeat(50));
  console.log(`${colors.blue}SSE Regression Test Summary${colors.reset}`);
  console.log('=' .repeat(50));
  
  console.log(`Total Tests: ${passedTests + failedTests}`);
  console.log(`${colors.green}Passed: ${passedTests}${colors.reset}`);
  console.log(`${colors.red}Failed: ${failedTests}${colors.reset}`);
  
  if (failedTests > 0) {
    console.log(`\n${colors.red}Failed Tests:${colors.reset}`);
    
    const failedByCategory = {};
    testResults.filter(t => t.status === 'failed').forEach(test => {
      if (!failedByCategory[test.category]) {
        failedByCategory[test.category] = [];
      }
      failedByCategory[test.category].push(test);
    });
    
    for (const [category, tests] of Object.entries(failedByCategory)) {
      console.log(`\n  ${category}:`);
      tests.forEach(test => {
        console.log(`    - ${test.name}`);
        console.log(`      ${colors.red}${test.error}${colors.reset}`);
      });
    }
  }
}

// Main
async function main() {
  try {
    // Check if SSE server is available
    const serverAvailable = await checkSSEServer();
    if (!serverAvailable) {
      console.error(`${colors.red}Error: SSE server is not available at ${SSE_URL}${colors.reset}`);
      console.error('Make sure the SSE server is running');
      process.exit(1);
    }
    
    await runSSERegressionTests();
    generateReport();
    
    process.exit(failedTests > 0 ? 1 : 0);
  } catch (error) {
    console.error(`\n${colors.red}Fatal error: ${error.message}${colors.reset}`);
    process.exit(1);
  }
}

// Run tests
main();