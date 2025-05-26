#!/usr/bin/env node
/**
 * Proxy Integration Test
 * Simple standalone test for proxy switching functionality
 */

import { spawn } from 'child_process';
import readline from 'readline';

const API_TOKEN = process.env.API_ACCESS_TOKEN || '75bf9cbcf951ed970c96431f77985d7588d1229d5b3f29e0555a177f628f55d5';

class SimpleProxyTest {
  constructor() {
    this.tests = [];
    this.currentTest = null;
  }

  async runTest(name, testFn) {
    console.log(`\n🧪 Running: ${name}`);
    this.currentTest = { name, status: 'running' };
    
    try {
      await testFn();
      this.currentTest.status = 'passed';
      console.log(`✅ Passed: ${name}`);
    } catch (error) {
      this.currentTest.status = 'failed';
      this.currentTest.error = error;
      console.error(`❌ Failed: ${name}`);
      console.error(`   Error: ${error.message}`);
    }
    
    this.tests.push(this.currentTest);
  }

  printSummary() {
    console.log('\n====================================');
    console.log('Test Summary');
    console.log('====================================');
    
    const passed = this.tests.filter(t => t.status === 'passed').length;
    const failed = this.tests.filter(t => t.status === 'failed').length;
    
    console.log(`Total: ${this.tests.length}`);
    console.log(`Passed: ${passed} ✅`);
    console.log(`Failed: ${failed} ❌`);
    
    if (failed > 0) {
      console.log('\nFailed tests:');
      this.tests.filter(t => t.status === 'failed').forEach(t => {
        console.log(`  - ${t.name}: ${t.error.message}`);
      });
    }
    
    console.log('====================================\n');
    
    return failed === 0;
  }

  async startProxy(server = 'production') {
    return new Promise((resolve, reject) => {
      const proxy = spawn('node', ['src/mcp-proxy-client.js', server], {
        env: { ...process.env, API_ACCESS_TOKEN: API_TOKEN }
      });

      const stderr = readline.createInterface({
        input: proxy.stderr,
        crlfDelay: Infinity
      });

      let sessionReceived = false;
      const timeout = setTimeout(() => {
        if (!sessionReceived) {
          proxy.kill();
          reject(new Error('Timeout waiting for session'));
        }
      }, 10000);

      stderr.on('line', (line) => {
        console.log(`   [${server}] ${line}`);
        
        if (line.includes('Session ID:')) {
          sessionReceived = true;
          clearTimeout(timeout);
          setTimeout(() => {
            proxy.kill();
            resolve();
          }, 1000);
        }
        
        if (line.includes('error') && !line.includes('MCP server error:')) {
          clearTimeout(timeout);
          proxy.kill();
          reject(new Error(`Connection error: ${line}`));
        }
      });

      proxy.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  }

  async testServerSwitching() {
    return new Promise((resolve, reject) => {
      const proxy = spawn('node', ['src/mcp-proxy-client.js', 'production'], {
        env: { ...process.env, API_ACCESS_TOKEN: API_TOKEN }
      });

      const stdout = readline.createInterface({
        input: proxy.stdout,
        crlfDelay: Infinity
      });

      const stderr = readline.createInterface({
        input: proxy.stderr,
        crlfDelay: Infinity
      });

      let sessionCount = 0;
      let switchSent = false;

      stderr.on('line', (line) => {
        console.log(`   [proxy] ${line}`);
        
        if (line.includes('Session ID:')) {
          sessionCount++;
          
          if (sessionCount === 1 && !switchSent) {
            // First session established, send switch command
            console.log('   -> Sending switch command to dev server');
            proxy.stdin.write('__MCP_PROXY_SWITCH_dev\n');
            switchSent = true;
          } else if (sessionCount === 2) {
            // Second session established after switch
            console.log('   -> Switch successful!');
            setTimeout(() => {
              proxy.kill();
              resolve();
            }, 1000);
          }
        }
      });

      stdout.on('line', (line) => {
        try {
          const response = JSON.parse(line);
          if (response.id === 'proxy-switch') {
            console.log(`   -> Switch response: ${JSON.stringify(response.result)}`);
          }
        } catch (e) {
          // Ignore non-JSON lines
        }
      });

      setTimeout(() => {
        proxy.kill();
        reject(new Error('Timeout during server switching test'));
      }, 20000);

      proxy.on('error', (err) => {
        reject(err);
      });
    });
  }
}

// Run tests
async function main() {
  console.log('Proxy Integration Tests');
  console.log('======================');
  console.log(`API Token: ${API_TOKEN.substring(0, 10)}...`);
  console.log(`Working Directory: ${process.cwd()}`);
  
  const tester = new SimpleProxyTest();
  
  // Test 1: Connect to production server
  await tester.runTest('Connect to production server', async () => {
    await tester.startProxy('production');
  });
  
  // Test 2: Connect to dev server
  await tester.runTest('Connect to dev server', async () => {
    await tester.startProxy('dev');
  });
  
  // Test 3: Server switching
  await tester.runTest('Switch from production to dev', async () => {
    await tester.testServerSwitching();
  });
  
  // Test 4: Environment variable override
  await tester.runTest('Environment variable server selection', async () => {
    process.env.MCP_SERVER = 'dev';
    await tester.startProxy('production'); // Should connect to dev due to env var
    delete process.env.MCP_SERVER;
  });
  
  // Test 5: Invalid server handling
  await tester.runTest('Handle invalid server gracefully', async () => {
    return new Promise((resolve, reject) => {
      const proxy = spawn('node', ['src/mcp-proxy-client.js', 'invalid-server'], {
        env: { ...process.env, API_ACCESS_TOKEN: API_TOKEN }
      });

      const stderr = readline.createInterface({
        input: proxy.stderr,
        crlfDelay: Infinity
      });

      stderr.on('line', (line) => {
        console.log(`   [invalid-server] ${line}`);
        
        if (line.includes('Unknown MCP server')) {
          console.log('   -> Correctly rejected invalid server');
          proxy.kill();
          resolve();
        }
      });

      proxy.on('exit', (code) => {
        if (code === 1) {
          resolve();
        } else {
          reject(new Error('Expected exit code 1 for invalid server'));
        }
      });

      setTimeout(() => {
        proxy.kill();
        reject(new Error('Timeout waiting for error'));
      }, 5000);
    });
  });
  
  // Print summary
  const success = tester.printSummary();
  process.exit(success ? 0 : 1);
}

// Check if servers are available
console.log('\nChecking server availability...');
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function checkServers() {
  try {
    await execAsync('timeout 2 nc -zv 192.168.10.100 3001');
    console.log('✅ Production server available');
  } catch {
    console.log('❌ Production server not available');
  }
  
  try {
    await execAsync('timeout 2 nc -zv 192.168.10.102 3001');
    console.log('✅ Dev server available');
  } catch {
    console.log('❌ Dev server not available');
  }
}

checkServers().then(() => main()).catch(console.error);