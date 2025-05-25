#!/usr/bin/env node
/**
 * Automated testing script for all Ansible MCP tools
 * This script runs through a comprehensive test suite for each tool
 */

import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Test configuration
const testConfig = {
  mcpServerPath: path.join(__dirname, 'src', 'index.js'),
  testDataDir: path.join(__dirname, 'test-data'),
  timeout: 30000, // 30 seconds per test
  verbose: process.argv.includes('--verbose')
};

// Color codes for output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

// Test definitions
const testSuite = {
  'ansible-playbook': [
    {
      name: 'Basic playbook execution',
      params: { playbook: 'test.yml' }
    },
    {
      name: 'Check mode',
      params: { playbook: 'test.yml', check: true }
    },
    {
      name: 'With extra variables',
      params: { playbook: 'test.yml', extraVars: { test_var: 'value' } }
    },
    {
      name: 'Invalid playbook path',
      params: { playbook: '../../../etc/passwd' },
      expectError: true
    },
    {
      name: 'Non-existent playbook',
      params: { playbook: 'does-not-exist.yml' },
      expectError: true
    }
  ],
  
  'browse-services': [
    {
      name: 'Browse all services',
      params: { category: 'all' }
    },
    {
      name: 'Browse dev-tools category',
      params: { category: 'dev-tools' }
    },
    {
      name: 'Search for Jenkins',
      params: { search: 'jenkins' }
    }
  ],
  
  'service-details': [
    {
      name: 'Get Jenkins details',
      params: { serviceName: 'Jenkins' }
    },
    {
      name: 'Get non-existent service',
      params: { serviceName: 'NonExistentService' },
      expectError: true
    }
  ],
  
  'deploy-service': [
    {
      name: 'Deploy Jenkins (stub test)',
      params: {
        serviceName: 'Jenkins',
        vmName: 'jenkins-test',
        vmid: 150,
        ipAddress: '192.168.10.50'
      }
    }
  ],
  
  'create-playbook': [
    {
      name: 'Create basic playbook',
      params: {
        name: 'test-playbook',
        hosts: 'all',
        tasks: [
          {
            name: 'Test task',
            module: 'debug',
            args: { msg: 'Hello World' }
          }
        ]
      }
    },
    {
      name: 'Create complex playbook',
      params: {
        name: 'complex-playbook',
        hosts: 'webservers',
        vars: { test_var: 'value' },
        tasks: [
          {
            name: 'Install nginx',
            module: 'package',
            args: { name: 'nginx', state: 'present' },
            become: true
          }
        ]
      }
    }
  ],
  
  'create-vm-template': [
    {
      name: 'Create Jenkins VM template',
      params: {
        name: 'jenkins',
        vmid: 150,
        template: 'ubuntu-cloud',
        cores: 4,
        memory: 4096,
        disk: '50G',
        network: {
          bridge: 'vmbr0',
          ip: '192.168.10.50',
          gateway: '192.168.10.1'
        }
      }
    }
  ],
  
  'discover-proxmox': [
    {
      name: 'Discover all VMs',
      params: { groupBy: 'all' },
      skipIfNoProxmox: true
    }
  ],
  
  'generate-diagram': [
    {
      name: 'Generate Mermaid diagram',
      params: { format: 'mermaid' }
    },
    {
      name: 'Generate ASCII diagram',
      params: { format: 'ascii' }
    }
  ],
  
  'list-loaded-tools': [
    {
      name: 'List all loaded tools',
      params: {}
    }
  ],
  
  'server-health': [
    {
      name: 'Check server health',
      params: {}
    }
  ]
};

// Test runner class
class TestRunner {
  constructor() {
    this.results = {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      errors: []
    };
  }

  async runTests() {
    console.log(`${colors.cyan}🧪 Ansible MCP Tools Test Suite${colors.reset}\n`);
    
    // Ensure test data directory exists
    await fs.mkdir(testConfig.testDataDir, { recursive: true });
    
    // Create test playbook
    await this.createTestPlaybook();
    
    // Run tests for each tool
    for (const [toolName, tests] of Object.entries(testSuite)) {
      console.log(`\n${colors.blue}Testing ${toolName}...${colors.reset}`);
      
      for (const test of tests) {
        await this.runTest(toolName, test);
      }
    }
    
    // Print summary
    this.printSummary();
    
    // Cleanup
    await this.cleanup();
    
    return this.results.failed === 0;
  }

  async createTestPlaybook() {
    const testPlaybook = `---
- name: Test Playbook
  hosts: localhost
  connection: local
  tasks:
    - name: Test task
      debug:
        msg: "This is a test playbook"
`;
    await fs.writeFile(path.join(testConfig.testDataDir, 'test.yml'), testPlaybook);
  }

  async runTest(toolName, test) {
    this.results.total++;
    
    // Check skip conditions
    if (test.skipIfNoProxmox && !process.env.PROXMOX_HOST) {
      console.log(`  ${colors.yellow}⚠ ${test.name} - SKIPPED (No Proxmox config)${colors.reset}`);
      this.results.skipped++;
      return;
    }
    
    try {
      const result = await this.callTool(toolName, test.params);
      
      if (test.expectError) {
        if (!result.success) {
          console.log(`  ${colors.green}✓ ${test.name} - PASSED (expected error)${colors.reset}`);
          this.results.passed++;
        } else {
          console.log(`  ${colors.red}✗ ${test.name} - FAILED (expected error but succeeded)${colors.reset}`);
          this.results.failed++;
          this.results.errors.push({
            tool: toolName,
            test: test.name,
            error: 'Expected error but tool succeeded'
          });
        }
      } else {
        if (result.success) {
          console.log(`  ${colors.green}✓ ${test.name} - PASSED${colors.reset}`);
          if (testConfig.verbose && result.output) {
            console.log(`    Output: ${result.output.substring(0, 100)}...`);
          }
          this.results.passed++;
        } else {
          console.log(`  ${colors.red}✗ ${test.name} - FAILED${colors.reset}`);
          console.log(`    Error: ${result.error}`);
          this.results.failed++;
          this.results.errors.push({
            tool: toolName,
            test: test.name,
            error: result.error
          });
        }
      }
    } catch (error) {
      console.log(`  ${colors.red}✗ ${test.name} - ERROR${colors.reset}`);
      console.log(`    Error: ${error.message}`);
      this.results.failed++;
      this.results.errors.push({
        tool: toolName,
        test: test.name,
        error: error.message
      });
    }
  }

  async callTool(toolName, params) {
    return new Promise((resolve) => {
      const mcp = spawn('node', [testConfig.mcpServerPath], {
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      let stdout = '';
      let stderr = '';
      let responded = false;
      
      // Set timeout
      const timeout = setTimeout(() => {
        if (!responded) {
          responded = true;
          mcp.kill();
          resolve({
            success: false,
            error: 'Test timeout'
          });
        }
      }, testConfig.timeout);
      
      mcp.stdout.on('data', (data) => {
        stdout += data.toString();
        
        // Check if we got a response
        if (stdout.includes('"jsonrpc"') && !responded) {
          try {
            const lines = stdout.split('\n');
            for (const line of lines) {
              if (line.includes('"jsonrpc"')) {
                const response = JSON.parse(line);
                if (response.id === 1 && response.result) {
                  responded = true;
                  clearTimeout(timeout);
                  mcp.kill();
                  
                  const content = response.result.content[0];
                  const result = JSON.parse(content.text);
                  resolve(result);
                }
              }
            }
          } catch (e) {
            // Continue collecting output
          }
        }
      });
      
      mcp.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      mcp.on('error', (err) => {
        if (!responded) {
          responded = true;
          clearTimeout(timeout);
          resolve({
            success: false,
            error: err.message
          });
        }
      });
      
      // Wait for server to initialize
      setTimeout(() => {
        // Send tool call request
        const request = {
          jsonrpc: '2.0',
          method: 'tools/call',
          params: {
            name: toolName,
            arguments: params
          },
          id: 1
        };
        
        mcp.stdin.write(JSON.stringify(request) + '\n');
      }, 1000);
    });
  }

  printSummary() {
    console.log(`\n${colors.cyan}Test Summary:${colors.reset}`);
    console.log(`Total: ${this.results.total}`);
    console.log(`${colors.green}Passed: ${this.results.passed}${colors.reset}`);
    console.log(`${colors.red}Failed: ${this.results.failed}${colors.reset}`);
    console.log(`${colors.yellow}Skipped: ${this.results.skipped}${colors.reset}`);
    
    if (this.results.errors.length > 0) {
      console.log(`\n${colors.red}Errors:${colors.reset}`);
      this.results.errors.forEach((error, index) => {
        console.log(`${index + 1}. ${error.tool} - ${error.test}: ${error.error}`);
      });
    }
  }

  async cleanup() {
    try {
      await fs.rm(testConfig.testDataDir, { recursive: true, force: true });
    } catch (e) {
      // Ignore cleanup errors
    }
  }
}

// Main execution
async function main() {
  const runner = new TestRunner();
  const success = await runner.runTests();
  process.exit(success ? 0 : 1);
}

main().catch(console.error);