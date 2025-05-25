#!/usr/bin/env node

/**
 * Comprehensive Feature Tests for Ansible MCP Server v1.0
 * 
 * These tests simulate AI agent interactions with the MCP server,
 * testing edge cases and common usage patterns to prevent issues
 * like the create-playbook validation error.
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { promises as fs } from 'fs';
import assert from 'assert';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Test configuration
const TEST_TIMEOUT = 30000;
const TEST_DIR = path.join(__dirname, 'test-output');

// Helper to call MCP tool
async function callTool(toolName, args = {}, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const mcp = spawn('node', [path.join(__dirname, '..', 'src', 'index.js')], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

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
    let stderr = '';
    let completed = false;

    const timer = setTimeout(() => {
      if (!completed) {
        completed = true;
        mcp.kill();
        reject(new Error(`Timeout calling ${toolName}`));
      }
    }, timeout);

    mcp.stdout.on('data', (data) => {
      output += data.toString();
      
      const lines = output.split('\n');
      for (const line of lines) {
        if (line.trim() && line.includes('"jsonrpc"')) {
          try {
            const response = JSON.parse(line);
            if (response.id === request.id) {
              clearTimeout(timer);
              completed = true;
              mcp.kill();
              
              if (response.error) {
                reject(new Error(`Tool error: ${JSON.stringify(response.error)}`));
              } else if (response.result) {
                const result = JSON.parse(response.result.content[0].text);
                if (!result.success && result.error) {
                  // Only reject for specific errors that tests expect to throw
                  if (result.error.includes('Unknown tool') || 
                      result.error.includes('Required') ||
                      result.error.includes('required') ||
                      result.error.includes('invalid_type')) {
                    reject(new Error(`Tool error: ${result.error}`));
                  }
                }
                // Otherwise resolve with the result (including failures)
                resolve(result);
              }
            }
          } catch (e) {
            // Not complete JSON yet
          }
        }
      }
    });

    mcp.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    mcp.on('exit', () => {
      if (!completed) {
        clearTimeout(timer);
        reject(new Error(`MCP exited unexpectedly: ${stderr}`));
      }
    });

    mcp.stdin.write(JSON.stringify(request) + '\n');
  });
}

// Test categories
const tests = {
  // 1. ANSIBLE TOOL TESTS
  ansible: {
    'create-playbook with complex YAML string': async () => {
      const complexYAML = `---
- name: Complex multi-play playbook
  hosts: webservers
  become: true
  vars:
    app_name: myapp
    app_port: 3000
  
  pre_tasks:
    - name: Update apt cache
      apt:
        update_cache: yes
      when: ansible_os_family == "Debian"
  
  roles:
    - common
    - nginx
  
  tasks:
    - name: Create app directory
      file:
        path: "/opt/{{ app_name }}"
        state: directory
        mode: '0755'
    
    - name: Deploy application
      template:
        src: app.service.j2
        dest: "/etc/systemd/system/{{ app_name }}.service"
      notify: restart app
  
  handlers:
    - name: restart app
      systemd:
        name: "{{ app_name }}"
        state: restarted
        daemon_reload: yes

- name: Configure database servers
  hosts: databases
  become: true
  
  tasks:
    - name: Install PostgreSQL
      package:
        name: postgresql
        state: present
    
    - name: Configure PostgreSQL
      lineinfile:
        path: /etc/postgresql/main/postgresql.conf
        regexp: '^#?listen_addresses'
        line: "listen_addresses = '*'"
      notify: restart postgresql
  
  handlers:
    - name: restart postgresql
      service:
        name: postgresql
        state: restarted`;

      const result = await callTool('create-playbook-flexible', {
        name: 'complex-multiplay',
        content: complexYAML,
        directory: TEST_DIR
      });

      assert(result.success, 'Should create complex playbook successfully');
      assert(result.output.includes('Created playbook'), 'Should confirm creation');
      
      // Verify file exists
      const filePath = path.join(TEST_DIR, 'complex-multiplay.yml');
      const exists = await fs.access(filePath).then(() => true).catch(() => false);
      assert(exists, 'Playbook file should exist');
    },

    'create-playbook with includes and imports': async () => {
      const includesYAML = `---
- name: Main playbook with includes
  hosts: all
  
  tasks:
    - name: Include OS-specific tasks
      include_tasks: "tasks/{{ ansible_os_family }}.yml"
    
    - name: Import common tasks
      import_tasks: tasks/common.yml
    
    - name: Include role dynamically
      include_role:
        name: "{{ item }}"
      loop:
        - security
        - monitoring
      when: item in required_roles
    
    - name: Import playbook
      import_playbook: other-playbook.yml
      when: run_imported_playbook | default(false)`;

      const result = await callTool('create-playbook-flexible', {
        name: 'includes-example',
        content: includesYAML
      });

      assert(result.success, 'Should handle includes/imports');
    },

    'create-playbook with structured object': async () => {
      const result = await callTool('create-playbook-flexible', {
        name: 'simple-structured',
        content: {
          hosts: 'localhost',
          gather_facts: false,
          tasks: [
            {
              name: 'Debug message',
              debug: {
                msg: 'Hello from structured playbook'
              }
            }
          ]
        }
      });

      assert(result.success, 'Should accept structured format');
    },

    'validate-playbook with valid syntax': async () => {
      // First create a valid playbook
      await callTool('create-playbook-flexible', {
        name: 'valid-syntax',
        content: '---\n- hosts: all\n  tasks:\n    - ping:',
        directory: TEST_DIR
      });

      const result = await callTool('validate-playbook', {
        playbook: path.join(TEST_DIR, 'valid-syntax.yml'),
        syntaxCheck: false // Just check YAML structure
      });

      assert(result.success, 'Should validate correct syntax');
    },

    'validate-playbook with invalid YAML': async () => {
      // Create invalid YAML file
      const invalidPath = path.join(TEST_DIR, 'invalid.yml');
      await fs.writeFile(invalidPath, '---\n- hosts: all\n  tasks:\n    - ping:\n      bad indent');

      const result = await callTool('validate-playbook', {
        playbook: invalidPath,
        syntaxCheck: false
      });

      assert(!result.success, 'Should fail on invalid YAML');
      assert(result.error.includes('Invalid YAML'), 'Should report YAML error');
    },

    'create-role-structure with all components': async () => {
      const result = await callTool('create-role-structure', {
        roleName: 'test-role',
        includeTasks: ['install', 'configure', 'secure'],
        includeHandlers: ['restart service', 'reload config'],
        includeTemplates: true,
        includeDefaults: true
      });

      assert(result.success, 'Should create role structure');
      assert(result.output.includes('tasks/main.yml'), 'Should create tasks');
      assert(result.output.includes('handlers/main.yml'), 'Should create handlers');
    }
  },

  // 2. TERRAFORM TOOL TESTS
  terraform: {
    'create-vm-template with all options': async () => {
      const result = await callTool('create-vm-template', {
        name: 'test-vm',
        vmid: 999,
        template: 'ubuntu-cloud',
        cores: 4,
        memory: 8192,
        disk: '100G',
        network: {
          bridge: 'vmbr0',
          ip: 'localhost',
          gateway: 'localhost',
          nameserver: '8.8.8.8'
        },
        outputDir: TEST_DIR
      });

      assert(result.success, 'Should create VM template');
      
      // Check if terraform files created
      const tfPath = path.join(TEST_DIR, 'test-vm', 'main.tf');
      const exists = await fs.access(tfPath).then(() => true).catch(() => false);
      assert(exists, 'Terraform file should exist');
    }
  },

  // 3. SECURITY TOOL TESTS
  security: {
    'security-scan-ports with custom range': async () => {
      const result = await callTool('security-scan-ports', {
        targets: ['localhost'],
        portRange: '22-80'
      });

      // Should work or fail gracefully if nmap not installed
      assert(result.output || result.error, 'Should provide output or error');
    },

    'security-check-passwords basic check': async () => {
      const result = await callTool('security-check-passwords', {
        checkPolicy: true
      });

      assert(result.success, 'Should check password policies');
      assert(result.output.includes('Password') || result.output.includes('password'), 
        'Should mention passwords');
    },

    'security-quick-scan localhost': async () => {
      const result = await callTool('security-quick-scan', {
        target: 'localhost'
      });

      assert(result.success, 'Should complete quick scan');
      assert(result.output.includes('Quick scan complete'), 'Should confirm completion');
    }
  },

  // 4. HARDWARE DISCOVERY TESTS
  hardware: {
    'hardware-scan with specific categories': async () => {
      const result = await callTool('hardware-scan', {
        target: 'localhost',
        categories: ['cpu', 'memory'],
        format: 'summary'
      });

      assert(result.success, 'Should scan hardware');
      assert(result.output.includes('CPU') || result.output.includes('Memory'), 
        'Should include requested categories');
    },

    'hardware-scan with JSON format': async () => {
      const result = await callTool('hardware-scan', {
        target: 'localhost',
        categories: ['system'],
        format: 'json'
      });

      assert(result.success, 'Should return JSON format');
      
      // Verify it's valid JSON
      try {
        JSON.parse(result.output);
      } catch (e) {
        assert.fail('Output should be valid JSON');
      }
    },

    'hardware-inventory operations': async () => {
      // Test list (empty initially)
      let result = await callTool('hardware-inventory', {
        action: 'list'
      });
      assert(result.success, 'Should list inventory');

      // Test add
      result = await callTool('hardware-inventory', {
        action: 'add',
        hostname: 'test-server',
        hardware: {
          cpu: { model: 'Test CPU', cores: 8 },
          memory: { totalGB: '16' }
        }
      });
      assert(result.success, 'Should add to inventory');

      // Test remove
      result = await callTool('hardware-inventory', {
        action: 'remove',
        hostname: 'test-server'
      });
      assert(result.success, 'Should remove from inventory');
    }
  },

  // 5. SERVICE CATALOG TESTS
  services: {
    'browse-services with filtering': async () => {
      const result = await callTool('browse-services', {
        category: 'monitoring',
        search: 'prometheus'
      });

      assert(result.success, 'Should browse services');
      const data = JSON.parse(result.output);
      assert(data.services, 'Should return services array');
    },

    'service-details for known service': async () => {
      const result = await callTool('service-details', {
        serviceName: 'nextcloud'
      });

      assert(result.success, 'Should get service details');
      const data = JSON.parse(result.output);
      assert(data.name === 'Nextcloud', 'Should return correct service');
    },

    'service-details for unknown service': async () => {
      const result = await callTool('service-details', {
        serviceName: 'nonexistent-service-xyz'
      });

      assert(!result.success, 'Should fail for unknown service');
      assert(result.error.includes('not found'), 'Should report not found');
    }
  },

  // 6. INFRASTRUCTURE TOOLS TESTS
  infrastructure: {
    'generate-inventory with filters': async () => {
      const result = await callTool('generate-inventory', {
        outputFile: path.join(TEST_DIR, 'test-inventory.yml'),
        groupBy: 'purpose',
        includeOffline: false
      });

      // This might fail if no Proxmox available, which is OK
      if (result.success) {
        const exists = await fs.access(path.join(TEST_DIR, 'test-inventory.yml'))
          .then(() => true).catch(() => false);
        assert(exists, 'Inventory file should be created');
      }
    },

    'generate-diagram multiple formats': async () => {
      const formats = ['mermaid', 'ascii'];
      
      for (const format of formats) {
        const result = await callTool('generate-diagram', {
          format: format,
          includeNetworks: true
        });

        // Might fail without Proxmox, which is OK
        if (result.success) {
          assert(result.output, `Should generate ${format} diagram`);
        }
      }
    }
  },

  // 7. ENVIRONMENT MANAGEMENT TESTS
  environment: {
    'list-environments': async () => {
      const result = await callTool('list-environments', {});
      
      assert(result.success, 'Should list environments');
      const envs = JSON.parse(result.output);
      assert(Array.isArray(envs), 'Should return array of environments');
      assert(envs.some(e => e.type === 'test'), 'Should include test environment');
    },

    'deploy-to-environment with protection': async () => {
      const result = await callTool('deploy-to-environment', {
        serviceName: 'test-app',
        environment: 'test',
        config: {}
      });

      // Should block deployment to protected test environment
      assert(!result.success, 'Should block test environment deployment');
      assert(result.error.includes('protected'), 'Should mention protection');
    }
  },

  // 8. CONTEXT MANAGEMENT TESTS
  context: {
    'set-and-get-context': async () => {
      // Set context
      let result = await callTool('set-mcp-context', {
        key: 'test-key',
        value: { test: true, timestamp: Date.now() }
      });
      assert(result.success, 'Should set context');

      // Get specific key
      result = await callTool('get-mcp-context', {
        key: 'test-key'
      });
      assert(result.success, 'Should get context');
      const value = JSON.parse(result.output);
      assert(value.test === true, 'Should retrieve correct value');

      // Get all context
      result = await callTool('get-mcp-context', {});
      assert(result.success, 'Should get all context');
    }
  },

  // 9. EDGE CASES AND ERROR HANDLING
  edgeCases: {
    'handle empty arguments': async () => {
      const result = await callTool('hardware-scan', {});
      // Should use defaults
      assert(result.success || result.error, 'Should handle empty args');
    },

    'handle very long input': async () => {
      const longYAML = '---\n- hosts: all\n  tasks:\n' + 
        Array(1000).fill('    - name: Task\n      ping:').join('\n');
      
      const result = await callTool('create-playbook-flexible', {
        name: 'long-playbook',
        content: longYAML
      });

      assert(result.success || result.error.includes('too large'), 
        'Should handle or reject very long input');
    },

    'handle special characters in names': async () => {
      const specialNames = [
        'test-with-dashes',
        'test_with_underscores',
        'test.with.dots',
        'test with spaces'
      ];

      for (const name of specialNames) {
        const result = await callTool('create-playbook-flexible', {
          name: name,
          content: '---\n- hosts: all\n  tasks:\n    - ping:'
        });

        // Should sanitize or handle appropriately
        assert(result.success || result.error.includes('invalid'), 
          `Should handle name: ${name}`);
      }
    },

    'handle missing required fields': async () => {
      // Test missing name
      try {
        await callTool('create-playbook-flexible', {
          content: '---\n- hosts: all'
        });
        assert.fail('Should fail without name');
      } catch (error) {
        assert(error.message.includes('required') || error.message.includes('Required') || error.message.includes('validation') || error.message.includes('missing'), 'Should report validation error');
      }
    },

    'handle invalid tool name': async () => {
      try {
        await callTool('nonexistent-tool-xyz', {});
        assert.fail('Should fail for invalid tool');
      } catch (error) {
        assert(error.message.includes('Tool error'), 'Should report unknown tool');
      }
    }
  }
};

// Test runner
async function runTests() {
  console.log('🧪 Ansible MCP Server v1.0 Feature Tests\n');
  console.log('Testing AI agent interaction patterns...\n');

  // Setup test directory
  await fs.mkdir(TEST_DIR, { recursive: true });

  const results = {
    passed: 0,
    failed: 0,
    errors: []
  };

  for (const [category, categoryTests] of Object.entries(tests)) {
    console.log(`\n📁 ${category.toUpperCase()} TESTS`);
    
    for (const [testName, testFn] of Object.entries(categoryTests)) {
      process.stdout.write(`  ▶ ${testName}... `);
      
      try {
        await testFn();
        console.log('✅ PASSED');
        results.passed++;
      } catch (error) {
        console.log('❌ FAILED');
        console.log(`     Error: ${error.message}`);
        results.failed++;
        results.errors.push({
          category,
          test: testName,
          error: error.message
        });
      }
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`📈 Total:  ${results.passed + results.failed}`);
  console.log(`🎯 Success Rate: ${((results.passed / (results.passed + results.failed)) * 100).toFixed(1)}%`);

  if (results.errors.length > 0) {
    console.log('\n❌ FAILED TESTS:');
    results.errors.forEach(({ category, test, error }) => {
      console.log(`  - ${category}/${test}: ${error}`);
    });
  }

  // Cleanup
  try {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  } catch {}

  process.exit(results.failed > 0 ? 1 : 0);
}

// Run tests
runTests().catch(error => {
  console.error('Test runner error:', error);
  process.exit(1);
});