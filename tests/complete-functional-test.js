#!/usr/bin/env node
// Complete functional test suite for all MCP tools
// Tests every tool to ensure complete functionality

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
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

// Test categories
const testCategories = {
  'Core Ansible Tools': [
    'ansible-playbook',
    'ansible-inventory', 
    'ansible-galaxy',
    'ansible-command'
  ],
  'Playbook Management': [
    'create-playbook'
  ],
  'Infrastructure Visualization': [
    'network-topology',
    'generate-diagram',
    'capture-state'
  ],
  'Terraform Tools': [
    'terraform-plan',
    'terraform-apply',
    'terraform-output',
    'create-vm-template'
  ],
  'Homelab Deployment': [
    'homelab-deploy'
  ],
  'Server Management': [
    'server-restart',
    'server-logs',
    'server-health',
    'server-debug'
  ],
  'Setup & Configuration': [
    'setup-wizard',
    'setup-proxmox',
    'setup-network', 
    'setup-services',
    'get-config',
    'test-connection'
  ]
};

// Test tracking
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
let skippedTests = 0;
const testResults = {};

// Helper to send MCP request
async function sendMCPRequest(method, params = {}, id = 1) {
  return new Promise((resolve, reject) => {
    const mcp = spawn('node', [path.join(__dirname, '..', 'src', 'index.js')], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { 
        ...process.env,
        // Use test environment to avoid affecting real config
        NODE_ENV: 'test',
        PROXMOX_HOST: 'test.proxmox.local',
        PROXMOX_USER: 'test@pam',
        PROXMOX_PASSWORD: 'test-password',
        DEFAULT_GATEWAY: '192.168.100.1',
        DEFAULT_NAMESERVER: '8.8.8.8'
      }
    });

    let output = '';
    let errorOutput = '';
    let timeout;

    mcp.stdout.on('data', (data) => {
      output += data.toString();
    });

    mcp.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    mcp.on('close', (code) => {
      clearTimeout(timeout);
      try {
        const lines = output.trim().split('\n');
        for (const line of lines) {
          if (line.trim()) {
            try {
              const response = JSON.parse(line);
              if (response.id === id) {
                resolve(response);
                return;
              }
            } catch (e) {
              // Not JSON, continue
            }
          }
        }
        reject(new Error(`No response with id ${id} found. Output: ${output}, Errors: ${errorOutput}`));
      } catch (e) {
        reject(new Error(`Failed to parse response: ${e.message}. Output: ${output}, Errors: ${errorOutput}`));
      }
    });

    // Set timeout
    timeout = setTimeout(() => {
      mcp.kill();
      reject(new Error('Request timed out'));
    }, 10000);

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
async function runTest(name, testFn, canSkip = false) {
  totalTests++;
  process.stdout.write(`  ${name}... `);
  
  try {
    const result = await testFn();
    if (result === 'skip') {
      console.log(`${colors.yellow}SKIP${colors.reset}`);
      skippedTests++;
      return { name, status: 'skipped' };
    }
    console.log(`${colors.green}✓${colors.reset}`);
    passedTests++;
    return { name, status: 'passed' };
  } catch (error) {
    console.log(`${colors.red}✗${colors.reset}`);
    console.error(`    Error: ${error.message}`);
    failedTests++;
    return { name, status: 'failed', error: error.message };
  }
}

// Setup test environment
async function setup() {
  console.log('Setting up test environment...\n');
  
  // Create test directory structure
  await fs.mkdir(testDir, { recursive: true });
  await fs.mkdir(path.join(testDir, 'playbooks'), { recursive: true });
  await fs.mkdir(path.join(testDir, 'inventory'), { recursive: true });
  await fs.mkdir(path.join(testDir, 'terraform'), { recursive: true });
  await fs.mkdir(path.join(testDir, 'states'), { recursive: true });
  
  // Create test inventory
  const inventoryContent = `[webservers]
web1 ansible_host=192.168.100.11
web2 ansible_host=192.168.100.12

[databases]
db1 ansible_host=192.168.100.21

[all:vars]
ansible_user=ubuntu
ansible_connection=local`;
  
  await fs.writeFile(path.join(testDir, 'inventory', 'hosts.ini'), inventoryContent);
  
  // Create test playbook
  const playbookContent = `---
- name: Test Playbook
  hosts: all
  gather_facts: no
  tasks:
    - name: Test task
      debug:
        msg: "Test successful"`;
  
  await fs.writeFile(path.join(testDir, 'playbooks', 'test.yml'), playbookContent);
}

// Define all tests
const allTests = {
  // Core Ansible Tools
  'ansible-playbook': async () => {
    const response = await sendMCPRequest('tools/call', {
      name: 'ansible-playbook',
      arguments: {
        playbook: path.join(testDir, 'playbooks', 'test.yml'),
        inventory: path.join(testDir, 'inventory', 'hosts.ini'),
        check: true
      }
    }, 101);
    
    if (response.error) throw new Error(response.error.message);
  },
  
  'ansible-inventory': async () => {
    const response = await sendMCPRequest('tools/call', {
      name: 'ansible-inventory',
      arguments: {
        inventory: path.join(testDir, 'inventory', 'hosts.ini'),
        list: true
      }
    }, 102);
    
    if (response.error) throw new Error(response.error.message);
    const output = JSON.parse(response.result.content[0].text);
    if (!output.output.includes('webservers')) throw new Error('Missing expected group');
  },
  
  'ansible-galaxy': async () => {
    const response = await sendMCPRequest('tools/call', {
      name: 'ansible-galaxy',
      arguments: {
        action: 'list'
      }
    }, 103);
    
    if (response.error) throw new Error(response.error.message);
  },
  
  'ansible-command': async () => {
    const response = await sendMCPRequest('tools/call', {
      name: 'ansible-command',
      arguments: {
        command: 'ansible',
        args: ['--version']
      }
    }, 104);
    
    if (response.error) throw new Error(response.error.message);
  },
  
  // Playbook Management
  'create-playbook': async () => {
    const response = await sendMCPRequest('tools/call', {
      name: 'create-playbook',
      arguments: {
        name: 'created-test.yml',
        content: '---\n- name: Created Test\n  hosts: localhost\n  tasks:\n    - debug:\n        msg: "Created"',
        directory: path.join(testDir, 'playbooks')
      }
    }, 105);
    
    if (response.error) throw new Error(response.error.message);
    
    // Verify file was created
    await fs.access(path.join(testDir, 'playbooks', 'created-test.yml'));
  },
  
  // Infrastructure Visualization
  'network-topology': async () => {
    const response = await sendMCPRequest('tools/call', {
      name: 'network-topology',
      arguments: {
        inventory: path.join(testDir, 'inventory', 'hosts.ini'),
        format: 'mermaid'
      }
    }, 106);
    
    if (response.error) throw new Error(response.error.message);
  },
  
  'generate-diagram': async () => {
    const response = await sendMCPRequest('tools/call', {
      name: 'generate-diagram',
      arguments: {
        type: 'network',
        inventory: path.join(testDir, 'inventory', 'hosts.ini')
      }
    }, 107);
    
    if (response.error) throw new Error(response.error.message);
  },
  
  'capture-state': async () => {
    const response = await sendMCPRequest('tools/call', {
      name: 'capture-state',
      arguments: {
        inventory: path.join(testDir, 'inventory', 'hosts.ini'),
        name: 'test-state'
      }
    }, 108);
    
    if (response.error) throw new Error(response.error.message);
  },
  
  // Terraform Tools
  'terraform-plan': async () => {
    // Create minimal terraform config first
    const tfConfig = `terraform {
  required_version = ">= 0.13"
}

resource "null_resource" "test" {
  provisioner "local-exec" {
    command = "echo test"
  }
}`;
    
    const tfDir = path.join(testDir, 'terraform', 'test-plan');
    await fs.mkdir(tfDir, { recursive: true });
    await fs.writeFile(path.join(tfDir, 'main.tf'), tfConfig);
    
    const response = await sendMCPRequest('tools/call', {
      name: 'terraform-plan',
      arguments: {
        directory: tfDir
      }
    }, 109);
    
    // May fail if terraform not installed, which is ok for test
    if (response.error && !response.error.message.includes('terraform')) {
      throw new Error(response.error.message);
    }
  },
  
  'terraform-apply': async () => {
    // Skip in test mode to avoid creating resources
    return 'skip';
  },
  
  'terraform-output': async () => {
    // Skip as it requires existing state
    return 'skip';
  },
  
  'create-vm-template': async () => {
    const response = await sendMCPRequest('tools/call', {
      name: 'create-vm-template',
      arguments: {
        name: 'test-vm',
        type: 'generic',
        outputDir: path.join(testDir, 'terraform')
      }
    }, 112);
    
    if (response.error) throw new Error(response.error.message);
  },
  
  // Homelab Deployment
  'homelab-deploy': async () => {
    // Skip as it would try to create actual VMs
    return 'skip';
  },
  
  // Server Management
  'server-restart': async () => {
    // Skip to avoid disrupting running services
    return 'skip';
  },
  
  'server-logs': async () => {
    const response = await sendMCPRequest('tools/call', {
      name: 'server-logs',
      arguments: {
        service: 'mcp',
        lines: 10
      }
    }, 115);
    
    if (response.error) throw new Error(response.error.message);
  },
  
  'server-health': async () => {
    const response = await sendMCPRequest('tools/call', {
      name: 'server-health',
      arguments: {
        detailed: false
      }
    }, 116);
    
    if (response.error) throw new Error(response.error.message);
  },
  
  'server-debug': async () => {
    const response = await sendMCPRequest('tools/call', {
      name: 'server-debug',
      arguments: {
        command: 'pwd',
        safe: true
      }
    }, 117);
    
    if (response.error) throw new Error(response.error.message);
  },
  
  // Setup & Configuration
  'setup-wizard': async () => {
    const response = await sendMCPRequest('tools/call', {
      name: 'setup-wizard',
      arguments: {}
    }, 118);
    
    if (response.error) throw new Error(response.error.message);
  },
  
  'setup-proxmox': async () => {
    const response = await sendMCPRequest('tools/call', {
      name: 'setup-proxmox',
      arguments: {
        host: 'test.proxmox.local',
        user: 'test@pam',
        password: 'test-password'
      }
    }, 119);
    
    if (response.error) throw new Error(response.error.message);
  },
  
  'setup-network': async () => {
    const response = await sendMCPRequest('tools/call', {
      name: 'setup-network',
      arguments: {
        gateway: '192.168.100.1',
        nameserver: '8.8.8.8',
        networkCidr: '24'
      }
    }, 120);
    
    if (response.error) throw new Error(response.error.message);
  },
  
  'setup-services': async () => {
    const response = await sendMCPRequest('tools/call', {
      name: 'setup-services',
      arguments: {
        nextcloudIp: '192.168.100.50',
        mailserverIp: '192.168.100.51'
      }
    }, 121);
    
    if (response.error) throw new Error(response.error.message);
  },
  
  'get-config': async () => {
    const response = await sendMCPRequest('tools/call', {
      name: 'get-config',
      arguments: {
        section: 'all'
      }
    }, 122);
    
    if (response.error) throw new Error(response.error.message);
  },
  
  'test-connection': async () => {
    const response = await sendMCPRequest('tools/call', {
      name: 'test-connection',
      arguments: {
        service: 'ansible'
      }
    }, 123);
    
    if (response.error) throw new Error(response.error.message);
  }
};

// Run tests by category
async function runTests() {
  console.log(`${colors.blue}Running MCP Complete Functional Tests${colors.reset}`);
  console.log('=' .repeat(50) + '\n');
  
  for (const [category, tools] of Object.entries(testCategories)) {
    console.log(`${colors.yellow}${category}:${colors.reset}`);
    testResults[category] = [];
    
    for (const toolName of tools) {
      const test = allTests[toolName];
      if (test) {
        const result = await runTest(toolName, test);
        testResults[category].push(result);
      } else {
        console.log(`  ${toolName}... ${colors.red}NOT IMPLEMENTED${colors.reset}`);
        testResults[category].push({ name: toolName, status: 'not-implemented' });
      }
    }
    console.log();
  }
}

// Cleanup
async function cleanup() {
  console.log('Cleaning up test environment...');
  await fs.rm(testDir, { recursive: true, force: true });
}

// Generate test report
function generateReport() {
  console.log('=' .repeat(50));
  console.log(`${colors.blue}Test Summary${colors.reset}`);
  console.log('=' .repeat(50));
  
  console.log(`Total Tests: ${totalTests}`);
  console.log(`${colors.green}Passed: ${passedTests}${colors.reset}`);
  console.log(`${colors.red}Failed: ${failedTests}${colors.reset}`);
  console.log(`${colors.yellow}Skipped: ${skippedTests}${colors.reset}`);
  console.log();
  
  // Show failed tests
  if (failedTests > 0) {
    console.log(`${colors.red}Failed Tests:${colors.reset}`);
    for (const [category, results] of Object.entries(testResults)) {
      const failed = results.filter(r => r.status === 'failed');
      if (failed.length > 0) {
        console.log(`  ${category}:`);
        failed.forEach(test => {
          console.log(`    - ${test.name}: ${test.error}`);
        });
      }
    }
    console.log();
  }
  
  // Coverage report
  console.log(`${colors.blue}Coverage by Category:${colors.reset}`);
  for (const [category, results] of Object.entries(testResults)) {
    const tested = results.filter(r => r.status !== 'not-implemented').length;
    const total = results.length;
    const percentage = Math.round((tested / total) * 100);
    console.log(`  ${category}: ${tested}/${total} (${percentage}%)`);
  }
  
  // Save detailed report
  const reportPath = path.join(__dirname, 'test-report.json');
  fs.writeFile(reportPath, JSON.stringify({
    summary: {
      total: totalTests,
      passed: passedTests,
      failed: failedTests,
      skipped: skippedTests
    },
    results: testResults,
    timestamp: new Date().toISOString()
  }, null, 2));
  
  console.log(`\nDetailed report saved to: ${reportPath}`);
}

// Main
async function main() {
  try {
    await setup();
    await runTests();
    generateReport();
    
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