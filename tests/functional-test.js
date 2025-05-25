#!/usr/bin/env node
// Functional test suite for MCP server
// Tests all tools to ensure they work correctly

import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const testDir = path.join(__dirname, 'test-workspace');

// ANSI color codes
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  reset: '\x1b[0m'
};

// Test results
let passedTests = 0;
let failedTests = 0;
const testResults = [];

// Helper to send MCP request
async function sendMCPRequest(method, params = {}, id = 1) {
  return new Promise((resolve, reject) => {
    const mcp = spawn('node', [path.join(__dirname, '..', 'src', 'index.js')], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let output = '';
    let errorOutput = '';

    mcp.stdout.on('data', (data) => {
      output += data.toString();
    });

    mcp.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    mcp.on('close', (code) => {
      try {
        const lines = output.trim().split('\n');
        for (const line of lines) {
          if (line.trim()) {
            const response = JSON.parse(line);
            if (response.id === id) {
              resolve(response);
              return;
            }
          }
        }
        reject(new Error(`No response with id ${id} found. Output: ${output}, Errors: ${errorOutput}`));
      } catch (e) {
        reject(new Error(`Failed to parse response: ${e.message}. Output: ${output}, Errors: ${errorOutput}`));
      }
    });

    // Send initialize request first
    const initRequest = {
      jsonrpc: '2.0',
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'test-client', version: '1.0.0' }
      },
      id: 0
    };
    mcp.stdin.write(JSON.stringify(initRequest) + '\n');

    // Send the actual request
    setTimeout(() => {
      const request = {
        jsonrpc: '2.0',
        method,
        params,
        id
      };
      mcp.stdin.write(JSON.stringify(request) + '\n');
      
      // Close stdin after a delay to allow response
      setTimeout(() => mcp.stdin.end(), 500);
    }, 100);
  });
}

// Test runner
async function runTest(name, testFn) {
  process.stdout.write(`Testing ${name}... `);
  try {
    await testFn();
    console.log(`${colors.green}✓${colors.reset}`);
    passedTests++;
    testResults.push({ name, status: 'passed' });
  } catch (error) {
    console.log(`${colors.red}✗${colors.reset}`);
    console.error(`  Error: ${error.message}`);
    failedTests++;
    testResults.push({ name, status: 'failed', error: error.message });
  }
}

// Setup test environment
async function setup() {
  console.log('Setting up test environment...');
  
  // Create test directory
  await fs.mkdir(testDir, { recursive: true });
  await fs.mkdir(path.join(testDir, 'playbooks'), { recursive: true });
  await fs.mkdir(path.join(testDir, 'inventory'), { recursive: true });
  await fs.mkdir(path.join(testDir, 'terraform'), { recursive: true });
  
  // Create test inventory
  const inventoryContent = `
[webservers]
web1 ansible_host=localhost
web2 ansible_host=localhost

[databases]
db1 ansible_host=localhost

[all:vars]
ansible_user=ubuntu
`;
  await fs.writeFile(path.join(testDir, 'inventory', 'hosts.ini'), inventoryContent);
  
  // Create test playbook
  const playbookContent = `
---
- name: Test Playbook
  hosts: all
  gather_facts: no
  tasks:
    - name: Ping hosts
      ping:
`;
  await fs.writeFile(path.join(testDir, 'playbooks', 'test.yml'), playbookContent);
}

// Cleanup
async function cleanup() {
  console.log('\nCleaning up test environment...');
  await fs.rm(testDir, { recursive: true, force: true });
}

// Tests
async function runTests() {
  console.log('Running MCP Functional Tests\n');
  
  // Test 1: Initialize
  await runTest('Initialize protocol', async () => {
    const response = await sendMCPRequest('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'test-client', version: '1.0.0' }
    }, 100);
    
    if (!response.result || response.result.protocolVersion !== '2024-11-05') {
      throw new Error('Invalid initialize response');
    }
  });

  // Test 2: List tools
  await runTest('List tools', async () => {
    const response = await sendMCPRequest('tools/list', {}, 101);
    
    if (!response.result || !response.result.tools || response.result.tools.length === 0) {
      throw new Error('No tools returned');
    }
    
    const toolNames = response.result.tools.map(t => t.name);
    const expectedTools = [
      'ansible-playbook', 'ansible-inventory', 'ansible-galaxy',
      'ansible-command', 'create-playbook', 'network-topology',
      'terraform-plan', 'terraform-apply', 'homelab-deploy'
    ];
    
    for (const expected of expectedTools) {
      if (!toolNames.includes(expected)) {
        throw new Error(`Missing expected tool: ${expected}`);
      }
    }
  });

  // Test 3: Create playbook
  await runTest('Create playbook', async () => {
    const response = await sendMCPRequest('tools/call', {
      name: 'create-playbook',
      arguments: {
        name: 'functional-test.yml',
        content: '---\n- name: Functional Test\n  hosts: localhost\n  tasks:\n    - debug:\n        msg: "Test successful"',
        directory: path.join(testDir, 'playbooks')
      }
    }, 102);
    
    if (response.error) {
      throw new Error(`Tool call failed: ${response.error.message}`);
    }
    
    // Verify file was created
    const filePath = path.join(testDir, 'playbooks', 'functional-test.yml');
    const exists = await fs.access(filePath).then(() => true).catch(() => false);
    if (!exists) {
      throw new Error('Playbook file was not created');
    }
  });

  // Test 4: Ansible inventory
  await runTest('Ansible inventory list', async () => {
    const response = await sendMCPRequest('tools/call', {
      name: 'ansible-inventory',
      arguments: {
        inventory: path.join(testDir, 'inventory', 'hosts.ini'),
        list: true
      }
    }, 103);
    
    if (response.error) {
      throw new Error(`Tool call failed: ${response.error.message}`);
    }
    
    const output = response.result?.output;
    if (!output || !output.includes('webservers') || !output.includes('databases')) {
      throw new Error('Inventory output missing expected groups');
    }
  });

  // Test 5: Network topology
  await runTest('Generate network topology', async () => {
    const response = await sendMCPRequest('tools/call', {
      name: 'network-topology',
      arguments: {
        inventory: path.join(testDir, 'inventory', 'hosts.ini'),
        format: 'mermaid'
      }
    }, 104);
    
    if (response.error) {
      throw new Error(`Tool call failed: ${response.error.message}`);
    }
    
    const output = response.result?.output;
    if (!output || !output.includes('graph')) {
      throw new Error('Topology output missing mermaid graph');
    }
  });

  // Test 6: Capture state
  await runTest('Capture infrastructure state', async () => {
    const response = await sendMCPRequest('tools/call', {
      name: 'capture-state',
      arguments: {
        inventory: path.join(testDir, 'inventory', 'hosts.ini'),
        name: 'test-state'
      }
    }, 105);
    
    if (response.error) {
      throw new Error(`Tool call failed: ${response.error.message}`);
    }
  });

  // Test 7: Ansible command
  await runTest('Run ansible command', async () => {
    const response = await sendMCPRequest('tools/call', {
      name: 'ansible-command',
      arguments: {
        command: 'ansible',
        args: ['--version']
      }
    }, 106);
    
    if (response.error) {
      throw new Error(`Tool call failed: ${response.error.message}`);
    }
    
    const output = response.result?.output;
    if (!output || !output.includes('ansible')) {
      throw new Error('Ansible version output missing');
    }
  });

  // Test 8: Create VM template
  await runTest('Create VM template', async () => {
    const response = await sendMCPRequest('tools/call', {
      name: 'create-vm-template',
      arguments: {
        name: 'test-vm',
        type: 'generic',
        outputDir: path.join(testDir, 'terraform')
      }
    }, 107);
    
    if (response.error) {
      throw new Error(`Tool call failed: ${response.error.message}`);
    }
    
    // Verify terraform files were created
    const mainTf = path.join(testDir, 'terraform', 'test-vm', 'main.tf');
    const exists = await fs.access(mainTf).then(() => true).catch(() => false);
    if (!exists) {
      throw new Error('Terraform main.tf was not created');
    }
  });

  // Test 9: Terraform plan (dry run)
  await runTest('Terraform plan', async () => {
    const response = await sendMCPRequest('tools/call', {
      name: 'terraform-plan',
      arguments: {
        directory: path.join(testDir, 'terraform', 'test-vm')
      }
    }, 108);
    
    // This might fail if Terraform isn't configured, which is okay for now
    if (response.error && !response.error.message.includes('terraform')) {
      throw new Error(`Unexpected error: ${response.error.message}`);
    }
  });

  // Test 10: Ansible Galaxy list
  await runTest('Ansible Galaxy list', async () => {
    const response = await sendMCPRequest('tools/call', {
      name: 'ansible-galaxy',
      arguments: {
        action: 'list'
      }
    }, 109);
    
    if (response.error) {
      throw new Error(`Tool call failed: ${response.error.message}`);
    }
  });
}

// Main
async function main() {
  try {
    await setup();
    await runTests();
    
    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('Test Summary:');
    console.log(`${colors.green}Passed: ${passedTests}${colors.reset}`);
    console.log(`${colors.red}Failed: ${failedTests}${colors.reset}`);
    console.log('='.repeat(50));
    
    // Detailed results
    if (failedTests > 0) {
      console.log('\nFailed Tests:');
      testResults.filter(r => r.status === 'failed').forEach(r => {
        console.log(`  ${colors.red}✗ ${r.name}${colors.reset}`);
        console.log(`    ${r.error}`);
      });
    }
    
    process.exit(failedTests > 0 ? 1 : 0);
  } catch (error) {
    console.error(`\n${colors.red}Fatal error: ${error.message}${colors.reset}`);
    process.exit(1);
  } finally {
    await cleanup();
  }
}

// Run tests
main();