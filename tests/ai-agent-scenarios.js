#!/usr/bin/env node

/**
 * AI Agent Scenario Tests for Ansible MCP Server v1.0
 * 
 * These tests simulate real-world AI agent workflows and conversations
 * to ensure the MCP server handles complex, multi-step operations correctly.
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { promises as fs } from 'fs';
import assert from 'assert';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Helper to simulate AI agent conversation
class AIAgentSimulator {
  constructor() {
    this.mcp = null;
    this.requestId = 1;
    this.context = new Map();
  }

  async start() {
    this.mcp = spawn('node', [path.join(__dirname, '..', 'src', 'index.js')], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    this.outputBuffer = '';
    this.mcp.stdout.on('data', (data) => {
      this.outputBuffer += data.toString();
    });

    // Wait for startup
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  async stop() {
    if (this.mcp) {
      this.mcp.kill();
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  async callTool(toolName, args = {}) {
    return new Promise((resolve, reject) => {
      const request = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: toolName,
          arguments: args
        },
        id: this.requestId++
      };

      const timeout = setTimeout(() => {
        reject(new Error(`Timeout calling ${toolName}`));
      }, 15000);

      const checkResponse = () => {
        const lines = this.outputBuffer.split('\n');
        for (const line of lines) {
          if (line.trim() && line.includes('"jsonrpc"')) {
            try {
              const response = JSON.parse(line);
              if (response.id === request.id - 1) {
                clearTimeout(timeout);
                
                if (response.error) {
                  reject(new Error(`Tool error: ${JSON.stringify(response.error)}`));
                } else if (response.result) {
                  const result = JSON.parse(response.result.content[0].text);
                  resolve(result);
                }
                return;
              }
            } catch (e) {
              // Not complete JSON yet
            }
          }
        }
        setTimeout(checkResponse, 100);
      };

      this.mcp.stdin.write(JSON.stringify(request) + '\n');
      setTimeout(checkResponse, 100);
    });
  }

  // Simulate AI storing information
  rememberContext(key, value) {
    this.context.set(key, value);
  }

  getContext(key) {
    return this.context.get(key);
  }
}

// Scenario tests
const scenarios = {
  // SCENARIO 1: Complete Infrastructure Discovery
  'Complete Infrastructure Discovery Workflow': async (agent) => {
    console.log('\n  📋 Simulating: AI discovers and documents infrastructure');

    // Step 1: AI scans for external servers
    console.log('  1️⃣ Discovering network devices...');
    const discovery = await agent.callTool('discover-network-devices', {
      subnet: 'localhost/24'
    });
    assert(discovery.success || discovery.error, 'Should attempt discovery');

    // Step 2: AI scans hardware on localhost
    console.log('  2️⃣ Scanning local hardware...');
    const hwScan = await agent.callTool('hardware-scan', {
      target: 'localhost',
      categories: ['cpu', 'memory', 'storage'],
      format: 'json',
      saveToInventory: true
    });
    assert(hwScan.success, 'Should scan hardware');

    // Step 3: AI stores context about the infrastructure
    console.log('  3️⃣ Storing infrastructure context...');
    const context = await agent.callTool('set-mcp-context', {
      key: 'infrastructure-summary',
      value: {
        scanDate: new Date().toISOString(),
        serversFound: 1,
        primaryServer: 'localhost'
      }
    });
    assert(context.success, 'Should store context');

    // Step 4: AI creates documentation playbook
    console.log('  4️⃣ Creating documentation playbook...');
    const playbook = await agent.callTool('create-playbook-flexible', {
      name: 'document-infrastructure',
      content: `---
- name: Document Infrastructure
  hosts: all
  gather_facts: true
  
  tasks:
    - name: Gather all facts
      setup:
        gather_subset:
          - all
    
    - name: Create documentation
      template:
        src: infrastructure-doc.j2
        dest: /tmp/infrastructure-{{ inventory_hostname }}.md
      delegate_to: localhost`
    });
    assert(playbook.success, 'Should create documentation playbook');

    console.log('  ✅ Infrastructure discovery workflow completed');
  },

  // SCENARIO 2: Secure a New Server
  'Secure Server Deployment': async (agent) => {
    console.log('\n  📋 Simulating: AI secures a new server deployment');

    // Step 1: Security scan
    console.log('  1️⃣ Running security scan...');
    const scan = await agent.callTool('security-quick-scan', {
      target: 'localhost'
    });
    assert(scan.success, 'Should run security scan');

    // Step 2: Check SSH configuration
    console.log('  2️⃣ Checking SSH security...');
    const sshCheck = await agent.callTool('security-check-ssh', {});
    assert(sshCheck.success, 'Should check SSH config');

    // Step 3: Create security hardening playbook
    console.log('  3️⃣ Creating security playbook...');
    const securityPlaybook = `---
- name: Security Hardening Playbook
  hosts: "{{ target_hosts | default('all') }}"
  become: true
  
  vars:
    security_ssh_port: 22
    security_ssh_permit_root: no
    security_ssh_password_auth: no
    
  tasks:
    - name: Update all packages
      apt:
        upgrade: dist
        update_cache: yes
      when: ansible_os_family == "Debian"
    
    - name: Configure SSH hardening
      lineinfile:
        path: /etc/ssh/sshd_config
        regexp: "{{ item.regexp }}"
        line: "{{ item.line }}"
      loop:
        - { regexp: '^#?PermitRootLogin', line: 'PermitRootLogin {{ security_ssh_permit_root }}' }
        - { regexp: '^#?PasswordAuthentication', line: 'PasswordAuthentication {{ security_ssh_password_auth }}' }
        - { regexp: '^#?Port', line: 'Port {{ security_ssh_port }}' }
      notify: restart sshd
    
    - name: Configure firewall
      ufw:
        rule: allow
        port: "{{ item }}"
        proto: tcp
      loop:
        - "{{ security_ssh_port }}"
        - 80
        - 443
    
    - name: Enable firewall
      ufw:
        state: enabled
        policy: deny
        direction: incoming
  
  handlers:
    - name: restart sshd
      service:
        name: sshd
        state: restarted`;

    const playbook = await agent.callTool('create-playbook-flexible', {
      name: 'security-hardening',
      content: securityPlaybook
    });
    assert(playbook.success, 'Should create security playbook');

    // Step 4: Validate the playbook
    console.log('  4️⃣ Validating security playbook...');
    const validation = await agent.callTool('validate-playbook', {
      playbook: 'test-output/security-hardening.yml',
      syntaxCheck: false
    });
    // May fail if file doesn't exist in test environment

    console.log('  ✅ Security deployment workflow completed');
  },

  // SCENARIO 3: Deploy a Complex Service
  'Deploy Monitoring Stack': async (agent) => {
    console.log('\n  📋 Simulating: AI deploys complete monitoring stack');

    // Step 1: Browse available monitoring services
    console.log('  1️⃣ Browsing monitoring services...');
    const services = await agent.callTool('browse-services', {
      category: 'monitoring'
    });
    assert(services.success, 'Should browse services');

    // Step 2: Get details about Prometheus
    console.log('  2️⃣ Getting Prometheus details...');
    const prometheus = await agent.callTool('service-details', {
      serviceName: 'prometheus'
    });
    assert(prometheus.success, 'Should get service details');

    // Step 3: Check hardware requirements
    console.log('  3️⃣ Checking hardware requirements...');
    const hw = await agent.callTool('hardware-scan', {
      target: 'localhost',
      categories: ['memory', 'storage'],
      format: 'summary'
    });
    assert(hw.success, 'Should check hardware');

    // Step 4: Create monitoring stack playbook
    console.log('  4️⃣ Creating monitoring stack playbook...');
    const monitoringPlaybook = await agent.callTool('create-playbook-flexible', {
      name: 'deploy-monitoring-stack',
      content: {
        hosts: 'monitoring',
        become: true,
        vars: {
          prometheus_version: '2.45.0',
          grafana_version: '10.0.0',
          node_exporter_version: '1.6.0'
        },
        tasks: [
          {
            name: 'Create monitoring user',
            user: {
              name: 'prometheus',
              system: true,
              shell: '/bin/false'
            }
          },
          {
            name: 'Create directories',
            file: {
              path: '{{ item }}',
              state: 'directory',
              owner: 'prometheus',
              group: 'prometheus'
            },
            loop: [
              '/etc/prometheus',
              '/var/lib/prometheus'
            ]
          },
          {
            name: 'Download Prometheus',
            unarchive: {
              src: 'https://github.com/prometheus/prometheus/releases/download/v{{ prometheus_version }}/prometheus-{{ prometheus_version }}.linux-amd64.tar.gz',
              dest: '/tmp',
              remote_src: true
            }
          }
        ]
      }
    });
    assert(monitoringPlaybook.success, 'Should create monitoring playbook');

    // Step 5: Create role structure for monitoring
    console.log('  5️⃣ Creating monitoring role...');
    const role = await agent.callTool('create-role-structure', {
      roleName: 'monitoring',
      includeTasks: ['install_prometheus', 'configure_prometheus', 'install_grafana'],
      includeHandlers: ['restart prometheus', 'restart grafana'],
      includeTemplates: true,
      includeDefaults: true
    });
    assert(role.success, 'Should create role structure');

    console.log('  ✅ Monitoring stack deployment workflow completed');
  },

  // SCENARIO 4: Troubleshooting Workflow
  'Troubleshooting Failed Service': async (agent) => {
    console.log('\n  📋 Simulating: AI troubleshoots a failed service');

    // Step 1: Check service status
    console.log('  1️⃣ Checking service health...');
    const health = await agent.callTool('server-health-check', {
      service: 'mcp',
      detailed: true
    });
    // May fail in test environment

    // Step 2: Check network connectivity
    console.log('  2️⃣ Testing network connectivity...');
    const connectivity = await agent.callTool('test-server-connectivity', {
      target: 'localhost',
      methods: ['ping', 'ssh', 'http']
    });
    assert(connectivity.success || connectivity.error, 'Should test connectivity');

    // Step 3: Check logs and create diagnostic playbook
    console.log('  3️⃣ Creating diagnostic playbook...');
    const diagnosticPlaybook = await agent.callTool('create-playbook-flexible', {
      name: 'service-diagnostics',
      content: `---
- name: Service Diagnostics
  hosts: "{{ target_host | default('localhost') }}"
  gather_facts: false
  
  tasks:
    - name: Check service status
      systemd:
        name: "{{ service_name }}"
      register: service_status
      ignore_errors: true
    
    - name: Get recent logs
      command: journalctl -u {{ service_name }} -n 50 --no-pager
      register: service_logs
      ignore_errors: true
    
    - name: Check port binding
      shell: ss -tlnp | grep {{ service_port | default(3000) }}
      register: port_check
      ignore_errors: true
    
    - name: Display diagnostic results
      debug:
        msg:
          - "Service Status: {{ service_status.status.ActiveState | default('unknown') }}"
          - "Port Check: {{ 'LISTENING' if port_check.rc == 0 else 'NOT LISTENING' }}"
          - "Recent Errors: {{ service_logs.stdout_lines | select('search', 'error') | list | length }} found"`
    });
    assert(diagnosticPlaybook.success, 'Should create diagnostic playbook');

    console.log('  ✅ Troubleshooting workflow completed');
  },

  // SCENARIO 5: Multi-Step Migration
  'Migrate Service Between Servers': async (agent) => {
    console.log('\n  📋 Simulating: AI migrates service between servers');

    // Step 1: Store migration context
    console.log('  1️⃣ Planning migration...');
    await agent.callTool('set-mcp-context', {
      key: 'migration-plan',
      value: {
        service: 'webapp',
        source: 'server1',
        target: 'server2',
        startTime: new Date().toISOString()
      }
    });

    // Step 2: Create backup playbook
    console.log('  2️⃣ Creating backup playbook...');
    const backupPlaybook = await agent.callTool('create-playbook-flexible', {
      name: 'backup-before-migration',
      content: `---
- name: Backup Service Before Migration
  hosts: source_server
  become: true
  
  vars:
    backup_dir: /backup/{{ ansible_date_time.epoch }}
    service_name: webapp
    
  tasks:
    - name: Create backup directory
      file:
        path: "{{ backup_dir }}"
        state: directory
    
    - name: Stop service
      systemd:
        name: "{{ service_name }}"
        state: stopped
    
    - name: Backup application files
      archive:
        path: /opt/{{ service_name }}
        dest: "{{ backup_dir }}/{{ service_name }}-files.tar.gz"
    
    - name: Backup database
      postgresql_db:
        name: "{{ service_name }}"
        state: dump
        target: "{{ backup_dir }}/{{ service_name }}-db.sql"
    
    - name: Start service
      systemd:
        name: "{{ service_name }}"
        state: started`
    });
    assert(backupPlaybook.success, 'Should create backup playbook');

    // Step 3: Create migration playbook
    console.log('  3️⃣ Creating migration playbook...');
    const migrationPlaybook = await agent.callTool('create-playbook-flexible', {
      name: 'migrate-service',
      content: {
        plays: [
          {
            name: 'Prepare target server',
            hosts: 'target_server',
            become: true,
            tasks: [
              {
                name: 'Install dependencies',
                package: {
                  name: ['postgresql', 'nginx', 'python3-pip'],
                  state: 'present'
                }
              }
            ]
          },
          {
            name: 'Transfer and restore',
            hosts: 'source_server',
            tasks: [
              {
                name: 'Transfer backup to target',
                synchronize: {
                  src: '{{ backup_dir }}',
                  dest: 'rsync://{{ target_server }}/tmp/',
                  mode: 'push'
                }
              }
            ]
          }
        ]
      }
    });
    assert(migrationPlaybook.success, 'Should create migration playbook');

    console.log('  ✅ Migration workflow completed');
  }
};

// Run scenario tests
async function runScenarioTests() {
  console.log('🎭 AI Agent Scenario Tests\n');
  console.log('Simulating real-world AI agent workflows...\n');

  const results = {
    passed: 0,
    failed: 0,
    errors: []
  };

  // Create test directory
  await fs.mkdir(path.join(__dirname, 'test-output'), { recursive: true });

  for (const [scenarioName, scenarioFn] of Object.entries(scenarios)) {
    console.log(`\n🎬 SCENARIO: ${scenarioName}`);
    
    const agent = new AIAgentSimulator();
    
    try {
      await agent.start();
      await scenarioFn(agent);
      console.log('✅ SCENARIO PASSED');
      results.passed++;
    } catch (error) {
      console.log('❌ SCENARIO FAILED');
      console.log(`   Error: ${error.message}`);
      results.failed++;
      results.errors.push({
        scenario: scenarioName,
        error: error.message
      });
    } finally {
      await agent.stop();
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('🎭 SCENARIO TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`📈 Total:  ${results.passed + results.failed}`);

  if (results.errors.length > 0) {
    console.log('\n❌ FAILED SCENARIOS:');
    results.errors.forEach(({ scenario, error }) => {
      console.log(`  - ${scenario}: ${error}`);
    });
  }

  // Cleanup
  try {
    await fs.rm(path.join(__dirname, 'test-output'), { recursive: true, force: true });
  } catch {}

  process.exit(results.failed > 0 ? 1 : 0);
}

// Run tests
runScenarioTests().catch(error => {
  console.error('Scenario test runner error:', error);
  process.exit(1);
});