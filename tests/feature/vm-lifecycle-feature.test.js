#!/usr/bin/env node

/**
 * VM Lifecycle Feature Test Suite
 * 
 * Tests the complete VM lifecycle through MCP SSE proxy:
 * 1. Create VM from template
 * 2. Install Jenkins service
 * 3. Verify Jenkins is running
 * 4. Remove Jenkins service
 * 5. Delete VM
 * 6. Verify cleanup
 * 
 * Supports multiple environments via configuration
 */

import EventSource from 'eventsource';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

class VMLifecycleFeatureTest {
  constructor(environment = 'dev') {
    this.environment = environment;
    this.config = null;
    this.eventSource = null;
    this.sessionId = null;
    this.messageId = 1;
    this.currentStep = 0;
    this.testResults = [];
    this.startTime = Date.now();
    
    // Test configuration
    this.testVM = {
      id: null, // Will be set from config
      name: `test-vm-${Date.now()}`,
      ip: null, // Will be set from config
      service: 'jenkins-test'
    };

    this.steps = [
      { name: 'initialize', description: 'Initialize MCP connection' },
      { name: 'create-vm', description: 'Create VM from template' },
      { name: 'verify-vm', description: 'Verify VM is running' },
      { name: 'install-jenkins', description: 'Install Jenkins service' },
      { name: 'verify-jenkins', description: 'Verify Jenkins is accessible' },
      { name: 'stop-jenkins', description: 'Stop Jenkins service' },
      { name: 'delete-vm', description: 'Delete VM from Proxmox' },
      { name: 'verify-cleanup', description: 'Verify VM is completely removed' },
      { name: 'check-context', description: 'Verify MCP context is updated' }
    ];
  }

  async loadConfig() {
    const configPaths = [
      `./tests/config/environments/${this.environment}.json`,
      `./tests/config/environments/${this.environment}.js`,
      `./config/${this.environment}.json`,
      `./.env.${this.environment}`,
      './.env'
    ];

    // Try to load configuration from various sources
    for (const configPath of configPaths) {
      if (existsSync(configPath)) {
        try {
          if (configPath.endsWith('.json')) {
            const configData = await readFile(configPath, 'utf-8');
            this.config = JSON.parse(configData);
            console.log(`📋 Loaded config from: ${configPath}`);
            break;
          } else if (configPath.endsWith('.js')) {
            const module = await import(path.resolve(configPath));
            this.config = module.default || module;
            console.log(`📋 Loaded config from: ${configPath}`);
            break;
          }
        } catch (error) {
          console.warn(`⚠️  Failed to load config from ${configPath}: ${error.message}`);
        }
      }
    }

    // Fall back to environment variables
    if (!this.config) {
      this.config = this.loadFromEnvironment();
      console.log('📋 Loaded config from environment variables');
    }

    // Validate required configuration
    this.validateConfig();
    
    // Set test VM configuration
    this.testVM.id = this.config.test.vmId;
    this.testVM.ip = this.config.test.vmIP;
  }

  loadFromEnvironment() {
    return {
      environment: this.environment,
      mcp: {
        sseUrl: process.env.MCP_SSE_URL || 'http://192.168.10.100:3001/sse',
        apiToken: process.env.MCP_API_TOKEN || '75bf9cbcf951ed970c96431f77985d7588d1229d5b3f29e0555a177f628f55d5'
      },
      proxmox: {
        host: process.env.PROXMOX_HOST || '192.168.10.200',
        apiTokenId: process.env.PROXMOX_API_TOKEN_ID || 'root@pam!asable-mcp',
        apiTokenSecret: process.env.PROXMOX_API_TOKEN_SECRET || '34772c72-4c3a-4f65-b67d-25620f1cb628',
        node: process.env.PROXMOX_NODE || 'proxmox',
        templateId: parseInt(process.env.PROXMOX_TEMPLATE_ID || '9000')
      },
      test: {
        vmId: parseInt(process.env.TEST_VM_ID || '500'),
        vmIP: process.env.TEST_VM_IP || '192.168.10.200',
        network: {
          gateway: process.env.TEST_GATEWAY || '192.168.10.1',
          subnet: process.env.TEST_SUBNET || '192.168.10.0/24'
        },
        timeout: parseInt(process.env.TEST_TIMEOUT || '600') * 1000, // Convert to ms
        retries: parseInt(process.env.TEST_RETRIES || '3')
      },
      target: {
        sshUser: process.env.TARGET_SSH_USER || 'shaun',
        sshPassword: process.env.TARGET_SSH_PASSWORD || 'Tenchi01!',
        sudoPassword: process.env.TARGET_SUDO_PASSWORD || 'Tenchi01!'
      }
    };
  }

  validateConfig() {
    const required = [
      'mcp.sseUrl',
      'mcp.apiToken',
      'proxmox.host',
      'proxmox.apiTokenId',
      'proxmox.apiTokenSecret',
      'test.vmId',
      'test.vmIP'
    ];

    for (const path of required) {
      const value = this.getNestedValue(this.config, path);
      if (!value) {
        throw new Error(`Missing required configuration: ${path}`);
      }
    }

    console.log(`✅ Configuration validated for environment: ${this.environment}`);
    console.log(`   Proxmox: ${this.config.proxmox.host}`);
    console.log(`   MCP SSE: ${this.config.mcp.sseUrl}`);
    console.log(`   Test VM: ${this.testVM.id} @ ${this.testVM.ip}`);
  }

  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  async start() {
    try {
      console.log('🚀 VM Lifecycle Feature Test Suite');
      console.log(`   Environment: ${this.environment}`);
      console.log(`   Test VM: ${this.testVM.name} (${this.testVM.id})`);
      console.log('');

      await this.loadConfig();
      await this.connectToMCP();
    } catch (error) {
      console.error('❌ Test setup failed:', error.message);
      process.exit(1);
    }
  }

  async connectToMCP() {
    this.eventSource = new EventSource(this.config.mcp.sseUrl, {
      headers: { 'Authorization': `Bearer ${this.config.mcp.apiToken}` }
    });

    this.eventSource.onopen = () => {
      console.log('✅ Connected to MCP SSE server');
    };

    this.eventSource.onerror = (err) => {
      console.error('❌ SSE Connection error:', err);
      this.failTest('SSE connection failed');
    };

    this.eventSource.onmessage = async (event) => {
      await this.handleMessage(event);
    };

    // Set overall test timeout
    setTimeout(() => {
      console.log(`⏰ Test timeout after ${this.config.test.timeout / 1000}s`);
      this.failTest('Test timeout exceeded');
    }, this.config.test.timeout);
  }

  async handleMessage(event) {
    try {
      const data = JSON.parse(event.data);
      
      if (data.type === 'session') {
        this.sessionId = data.sessionId;
        console.log(`📋 MCP Session: ${this.sessionId}\n`);
        await this.executeStep();
      } else if (data.type === 'message') {
        await this.processResponse(data.data);
      }
    } catch (err) {
      console.error('❌ Message processing error:', err);
      this.failTest(`Message processing failed: ${err.message}`);
    }
  }

  async processResponse(response) {
    const step = this.steps[this.currentStep];
    const stepStartTime = Date.now();
    
    if (response.error) {
      console.error(`❌ ${step.name} failed:`, response.error);
      this.recordResult(step.name, false, response.error.message, Date.now() - stepStartTime);
      this.failTest(`Step ${step.name} failed`);
      return;
    }

    if (response.result) {
      console.log(`✅ ${step.name} completed`);
      
      // Log detailed output for certain steps
      if (response.result.output && step.name !== 'initialize') {
        const output = response.result.output.substring(0, 200);
        console.log(`   Output: ${output}${response.result.output.length > 200 ? '...' : ''}`);
      }
      
      this.recordResult(step.name, true, 'Success', Date.now() - stepStartTime);
      
      this.currentStep++;
      if (this.currentStep < this.steps.length) {
        console.log(''); // Add spacing
        await this.executeStep();
      } else {
        this.completeTest();
      }
    }
  }

  async executeStep() {
    const step = this.steps[this.currentStep];
    console.log(`🔄 Step ${this.currentStep + 1}/${this.steps.length}: ${step.description}`);

    switch (step.name) {
      case 'initialize':
        await this.sendMessage({
          jsonrpc: '2.0',
          method: 'initialize',
          params: {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: { 
              name: `vm-lifecycle-test-${this.environment}`, 
              version: '1.0.0' 
            }
          },
          id: this.messageId++
        });
        break;

      case 'create-vm':
        await this.sendMessage({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: {
            name: 'ansible-playbook',
            arguments: {
              playbook: 'playbooks/create-vm.yml',
              inventory: 'localhost,',
              extraVars: {
                vm_id: this.testVM.id,
                vm_name: this.testVM.name,
                vm_ip: this.testVM.ip,
                template_id: this.config.proxmox.templateId,
                cores: 2,
                memory: 4096,
                gateway: this.config.test.network.gateway
              },
              connection: 'local'
            }
          },
          id: this.messageId++
        });
        break;

      case 'verify-vm':
        await this.sendMessage({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: {
            name: 'test-server-connectivity',
            arguments: {
              target: this.testVM.ip,
              methods: ['ping', 'ssh']
            }
          },
          id: this.messageId++
        });
        break;

      case 'install-jenkins':
        await this.sendMessage({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: {
            name: 'ansible-playbook',
            arguments: {
              playbook: 'playbooks/jenkins-install.yml',
              inventory: `${this.testVM.ip},`,
              extraVars: {
                ansible_user: this.config.target.sshUser,
                ansible_password: this.config.target.sshPassword,
                ansible_become_password: this.config.target.sudoPassword
              }
            }
          },
          id: this.messageId++
        });
        break;

      case 'verify-jenkins':
        // Wait a bit for Jenkins to start
        setTimeout(async () => {
          await this.sendMessage({
            jsonrpc: '2.0',
            method: 'tools/call',
            params: {
              name: 'test-server-connectivity',
              arguments: {
                target: this.testVM.ip,
                methods: ['http']
              }
            },
            id: this.messageId++
          });
        }, 30000); // Wait 30 seconds for Jenkins to start
        return; // Don't increment messageId here

      case 'stop-jenkins':
        await this.sendMessage({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: {
            name: 'ansible',
            arguments: {
              inventory: `${this.testVM.ip},`,
              module: 'systemd',
              args: 'name=jenkins state=stopped',
              extraVars: {
                ansible_user: this.config.target.sshUser,
                ansible_password: this.config.target.sshPassword,
                ansible_become_password: this.config.target.sudoPassword
              }
            }
          },
          id: this.messageId++
        });
        break;

      case 'delete-vm':
        await this.sendMessage({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: {
            name: 'ansible-playbook',
            arguments: {
              playbook: 'playbooks/delete-vm-api.yml',
              inventory: 'localhost,',
              extraVars: {
                vm_id: this.testVM.id,
                vm_name: this.testVM.name
              },
              connection: 'local'
            }
          },
          id: this.messageId++
        });
        break;

      case 'verify-cleanup':
        await this.sendMessage({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: {
            name: 'discover-proxmox',
            arguments: {
              proxmoxHost: this.config.proxmox.host,
              includeTemplates: false
            }
          },
          id: this.messageId++
        });
        break;

      case 'check-context':
        await this.sendMessage({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: {
            name: 'get-mcp-context',
            arguments: {
              key: 'infrastructure'
            }
          },
          id: this.messageId++
        });
        break;
    }
  }

  async sendMessage(message) {
    const response = await fetch(`${this.config.mcp.sseUrl.replace('/sse', '')}/sessions/${this.sessionId}/input`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.mcp.apiToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(message)
    });

    if (!response.ok) {
      throw new Error(`Failed to send message: ${response.statusText}`);
    }
  }

  recordResult(stepName, success, message, duration) {
    this.testResults.push({
      step: stepName,
      success,
      message,
      duration,
      timestamp: new Date().toISOString()
    });
  }

  completeTest() {
    const totalDuration = Date.now() - this.startTime;
    const successCount = this.testResults.filter(r => r.success).length;
    
    console.log('\n🎉 VM Lifecycle Feature Test Completed!');
    console.log(`   Environment: ${this.environment}`);
    console.log(`   Total Duration: ${(totalDuration / 1000).toFixed(2)}s`);
    console.log(`   Steps Passed: ${successCount}/${this.testResults.length}`);
    
    console.log('\n📊 Test Results:');
    this.testResults.forEach(result => {
      const status = result.success ? '✅' : '❌';
      const duration = (result.duration / 1000).toFixed(2);
      console.log(`   ${status} ${result.step} (${duration}s)`);
      if (!result.success) {
        console.log(`      Error: ${result.message}`);
      }
    });

    this.generateReport();
    this.cleanup();
    process.exit(successCount === this.testResults.length ? 0 : 1);
  }

  failTest(reason) {
    console.error(`\n❌ Test Failed: ${reason}`);
    console.log('\n📊 Partial Results:');
    this.testResults.forEach(result => {
      const status = result.success ? '✅' : '❌';
      console.log(`   ${status} ${result.step}`);
    });
    
    this.generateReport();
    this.cleanup();
    process.exit(1);
  }

  generateReport() {
    const report = {
      environment: this.environment,
      testVM: this.testVM,
      totalDuration: Date.now() - this.startTime,
      timestamp: new Date().toISOString(),
      results: this.testResults,
      config: {
        proxmoxHost: this.config.proxmox.host,
        mcpSseUrl: this.config.mcp.sseUrl
      }
    };

    // Could write to file, send to reporting system, etc.
    console.log('\n📋 Test Report Generated');
  }

  cleanup() {
    if (this.eventSource) {
      this.eventSource.close();
    }
  }
}

// Command line interface
function printUsage() {
  console.log('Usage: node vm-lifecycle-feature.test.js [environment] [options]');
  console.log('');
  console.log('Environments:');
  console.log('  dev      - Development environment (default)');
  console.log('  qa       - QA environment');
  console.log('  staging  - Staging environment');
  console.log('  prod     - Production environment');
  console.log('');
  console.log('Options:');
  console.log('  --help   - Show this help message');
  console.log('');
  console.log('Environment Variables:');
  console.log('  MCP_SSE_URL              - MCP SSE server URL');
  console.log('  MCP_API_TOKEN            - MCP API token');
  console.log('  PROXMOX_HOST             - Proxmox server IP');
  console.log('  PROXMOX_API_TOKEN_ID     - Proxmox API token ID');
  console.log('  PROXMOX_API_TOKEN_SECRET - Proxmox API token secret');
  console.log('  TEST_VM_ID               - VM ID to use for testing');
  console.log('  TEST_VM_IP               - VM IP address for testing');
  console.log('');
}

// Main execution
if (process.argv.includes('--help')) {
  printUsage();
  process.exit(0);
}

const environment = process.argv[2] || 'dev';
const test = new VMLifecycleFeatureTest(environment);
test.start().catch(console.error);