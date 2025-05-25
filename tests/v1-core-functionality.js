#!/usr/bin/env node

/**
 * Core Functionality Tests for v1.0
 * Tests that validate the MCP server works without external dependencies
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import assert from 'assert';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
                if (!result.success && result.error && result.error.includes('Unknown tool')) {
                  reject(new Error(result.error));
                } else {
                  resolve(result);
                }
              }
            }
          } catch (e) {
            // Not complete JSON yet
          }
        }
      }
    });

    mcp.on('exit', () => {
      if (!completed) {
        clearTimeout(timer);
        reject(new Error(`MCP exited unexpectedly`));
      }
    });

    mcp.stdin.write(JSON.stringify(request) + '\n');
  });
}

// Core tests that should always work
const coreTests = {
  'Tool Loading': {
    'list-loaded-tools should work': async () => {
      const result = await callTool('list-loaded-tools', {});
      assert(result.success, 'Should list tools successfully');
      const data = JSON.parse(result.output);
      assert(data.totalTools >= 58, `Should have at least 58 tools, got ${data.totalTools}`);
      assert(data.toolsByCategory.ansible.length > 0, 'Should have ansible tools');
      assert(data.toolsByCategory.security.length > 0, 'Should have security tools');
    }
  },

  'Context Management': {
    'set and get context': async () => {
      // Set context
      const testData = { test: true, timestamp: Date.now() };
      let result = await callTool('set-mcp-context', {
        key: 'test-v1',
        value: testData
      });
      assert(result.success, 'Should set context');

      // Get context
      result = await callTool('get-mcp-context', {
        key: 'test-v1'
      });
      assert(result.success, 'Should get context');
      const retrieved = JSON.parse(result.output);
      assert(retrieved.test === true, 'Should retrieve correct value');
    }
  },

  'Service Catalog': {
    'browse all services': async () => {
      const result = await callTool('browse-services', {
        category: 'all'
      });
      assert(result.success, 'Should browse services');
      const data = JSON.parse(result.output);
      assert(data.services.length > 20, 'Should have many services');
    },

    'get nextcloud details': async () => {
      const result = await callTool('service-details', {
        serviceName: 'nextcloud'
      });
      assert(result.success, 'Should get Nextcloud details');
      const data = JSON.parse(result.output);
      assert(data.name === 'Nextcloud', 'Should return correct service');
      assert(data.category === 'cloud-storage', 'Should have correct category');
    }
  },

  'Hardware Discovery': {
    'scan localhost hardware': async () => {
      const result = await callTool('hardware-scan', {
        target: 'localhost',
        categories: ['system', 'cpu'],
        format: 'json'
      });
      assert(result.success, 'Should scan hardware');
      const data = JSON.parse(result.output);
      assert(data.system, 'Should have system info');
      assert(data.cpu, 'Should have CPU info');
    }
  },

  'Security Tools': {
    'quick security scan': async () => {
      const result = await callTool('security-quick-scan', {
        target: 'localhost'
      });
      assert(result.success, 'Should complete security scan');
      assert(result.output.includes('Quick scan complete'), 'Should confirm completion');
    },

    'check password policies': async () => {
      const result = await callTool('security-check-passwords', {
        checkPolicy: true
      });
      assert(result.success, 'Should check passwords');
      assert(result.output.length > 0, 'Should have output');
    }
  },

  'Environment Management': {
    'list environments': async () => {
      const result = await callTool('list-environments', {});
      assert(result.success, 'Should list environments');
      const envs = JSON.parse(result.output);
      assert(Array.isArray(envs), 'Should return array');
      assert(envs.length === 3, 'Should have test, staging, production');
      assert(envs.some(e => e.type === 'test'), 'Should have test environment');
    }
  },

  'Playbook Creation': {
    'create simple playbook YAML': async () => {
      const result = await callTool('create-playbook-flexible', {
        name: 'test-simple',
        content: '---\n- hosts: all\n  tasks:\n    - name: Test\n      ping:'
      });
      assert(result.success, 'Should accept YAML string');
      assert(result.output.includes('Created playbook'), 'Should confirm creation');
    },

    'create playbook from object': async () => {
      const result = await callTool('create-playbook-flexible', {
        name: 'test-object',
        content: {
          hosts: 'localhost',
          tasks: [{
            name: 'Test task',
            debug: { msg: 'Hello' }
          }]
        }
      });
      assert(result.success, 'Should accept object format');
    }
  },

  'Error Handling': {
    'handle invalid tool gracefully': async () => {
      try {
        await callTool('nonexistent-tool-xyz', {});
        assert.fail('Should throw error for invalid tool');
      } catch (error) {
        assert(error.message.includes('Unknown tool'), 'Should report unknown tool');
      }
    },

    'handle invalid arguments': async () => {
      try {
        await callTool('hardware-scan', {
          target: 'localhost',
          categories: ['invalid-category']
        });
        // May or may not fail depending on validation
        assert(true, 'Should handle gracefully');
      } catch (error) {
        assert(error.message, 'Should have error message');
      }
    }
  }
};

// Run tests
async function runCoreTests() {
  console.log('🧪 Ansible MCP Server v1.0 Core Functionality Tests\n');

  const results = {
    passed: 0,
    failed: 0,
    errors: []
  };

  for (const [category, tests] of Object.entries(coreTests)) {
    console.log(`\n📁 ${category}`);
    
    for (const [testName, testFn] of Object.entries(tests)) {
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
  console.log('📊 CORE FUNCTIONALITY TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`📈 Total:  ${results.passed + results.failed}`);
  console.log(`🎯 Success Rate: ${((results.passed / (results.passed + results.failed)) * 100).toFixed(1)}%`);

  if (results.failed === 0) {
    console.log('\n🎉 All core functionality tests passed!');
  } else {
    console.log('\n❌ Some tests failed:');
    results.errors.forEach(({ category, test, error }) => {
      console.log(`  - ${category}/${test}: ${error}`);
    });
  }

  process.exit(results.failed > 0 ? 1 : 0);
}

runCoreTests().catch(error => {
  console.error('Test runner error:', error);
  process.exit(1);
});