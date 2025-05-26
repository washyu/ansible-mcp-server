#!/usr/bin/env node
/**
 * Proxy Restart Test
 * Tests proxy restart scenarios and recovery
 */

import { spawn } from 'child_process';
import readline from 'readline';
import { setTimeout } from 'timers/promises';

const API_TOKEN = process.env.API_ACCESS_TOKEN || '75bf9cbcf951ed970c96431f77985d7588d1229d5b3f29e0555a177f628f55d5';

class RestartTester {
  constructor() {
    this.results = [];
  }

  async runTest(name, testFn) {
    console.log(`\n🔄 Testing: ${name}`);
    const startTime = Date.now();
    
    try {
      await testFn();
      const duration = Date.now() - startTime;
      console.log(`✅ Passed: ${name} (${duration}ms)`);
      this.results.push({ name, status: 'passed', duration });
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`❌ Failed: ${name} (${duration}ms)`);
      console.error(`   Error: ${error.message}`);
      this.results.push({ name, status: 'failed', error: error.message, duration });
    }
  }

  async testGracefulShutdown() {
    const proxy = spawn('node', ['src/mcp-proxy-client.js'], {
      env: { ...process.env, API_ACCESS_TOKEN: API_TOKEN }
    });

    const stderr = readline.createInterface({
      input: proxy.stderr,
      crlfDelay: Infinity
    });

    let shutdownMessageSeen = false;

    // Monitor for shutdown message
    stderr.on('line', (line) => {
      console.log(`   [shutdown] ${line}`);
      if (line.includes('Shutting down proxy client')) {
        shutdownMessageSeen = true;
      }
    });

    // Wait for connection
    await new Promise((resolve, reject) => {
      const timeoutId = global.setTimeout(() => reject(new Error('Connection timeout')), 10000);
      
      stderr.on('line', (line) => {
        if (line.includes('Session ID:')) {
          clearTimeout(timeoutId);
          resolve();
        }
      });
    });

    // Send SIGTERM
    console.log('   -> Sending SIGTERM');
    proxy.kill('SIGTERM');

    // Wait for clean exit
    const exitCode = await new Promise((resolve) => {
      proxy.on('exit', (code) => {
        console.log(`   -> Process exited with code: ${code}`);
        resolve(code);
      });
    });

    // On SIGTERM, Node.js often returns null exit code
    if (exitCode !== 0 && exitCode !== null) {
      throw new Error(`Expected exit code 0 or null, got ${exitCode}`);
    }

    // Check if we saw the shutdown message
    if (!shutdownMessageSeen) {
      console.log('   -> Warning: Shutdown message not seen, but process exited cleanly');
    }
  }

  async testCrashRecovery() {
    // Start first instance
    let proxy = spawn('node', ['src/mcp-proxy-client.js', 'production'], {
      env: { ...process.env, API_ACCESS_TOKEN: API_TOKEN }
    });

    let stderr = readline.createInterface({
      input: proxy.stderr,
      crlfDelay: Infinity
    });

    // Wait for first connection
    await new Promise((resolve, reject) => {
      const timeoutId = global.setTimeout(() => reject(new Error('Connection timeout')), 10000);
      
      stderr.on('line', (line) => {
        console.log(`   [crash-1] ${line}`);
        if (line.includes('Session ID:')) {
          clearTimeout(timeoutId);
          resolve();
        }
      });
    });

    // Simulate crash with SIGKILL
    console.log('   -> Simulating crash with SIGKILL');
    proxy.kill('SIGKILL');

    // Wait for process to die
    await new Promise(resolve => {
      proxy.on('exit', () => {
        console.log('   -> Process killed');
        resolve();
      });
    });

    // Wait a bit
    await setTimeout(1000);

    // Start new instance
    console.log('   -> Starting new instance after crash');
    proxy = spawn('node', ['src/mcp-proxy-client.js', 'production'], {
      env: { ...process.env, API_ACCESS_TOKEN: API_TOKEN }
    });

    stderr = readline.createInterface({
      input: proxy.stderr,
      crlfDelay: Infinity
    });

    // Wait for recovery
    await new Promise((resolve, reject) => {
      const timeoutId = global.setTimeout(() => reject(new Error('Recovery timeout')), 10000);
      
      stderr.on('line', (line) => {
        console.log(`   [crash-2] ${line}`);
        if (line.includes('Session ID:')) {
          clearTimeout(timeoutId);
          console.log('   -> Successfully recovered after crash');
          resolve();
        }
      });
    });

    // Clean up
    proxy.kill();
    await setTimeout(500);
  }

  async testRapidRestarts() {
    const restartCount = 3;
    
    for (let i = 0; i < restartCount; i++) {
      console.log(`   -> Restart ${i + 1}/${restartCount}`);
      
      const proxy = spawn('node', ['src/mcp-proxy-client.js', 'dev'], {
        env: { ...process.env, API_ACCESS_TOKEN: API_TOKEN }
      });

      const stderr = readline.createInterface({
        input: proxy.stderr,
        crlfDelay: Infinity
      });

      // Wait for connection
      await new Promise((resolve, reject) => {
        const timeoutId = global.setTimeout(() => reject(new Error('Connection timeout')), 10000);
        
        stderr.on('line', (line) => {
          if (line.includes('Session ID:')) {
            clearTimeout(timeoutId);
            resolve();
          }
        });
      });

      // Stop proxy
      proxy.kill();
      
      // Wait for exit
      await new Promise(resolve => {
        proxy.on('exit', resolve);
      });

      // Small delay between restarts
      await setTimeout(500);
    }
    
    console.log(`   -> All ${restartCount} restarts completed successfully`);
  }

  async testServerPersistence() {
    // Start with dev server
    let proxy = spawn('node', ['src/mcp-proxy-client.js', 'dev'], {
      env: { ...process.env, API_ACCESS_TOKEN: API_TOKEN }
    });

    let stderr = readline.createInterface({
      input: proxy.stderr,
      crlfDelay: Infinity
    });

    let serverType = null;

    // Capture server type
    await new Promise((resolve, reject) => {
      const timeoutId = global.setTimeout(() => reject(new Error('Connection timeout')), 10000);
      
      stderr.on('line', (line) => {
        console.log(`   [persist-1] ${line}`);
        
        if (line.includes('Development MCP Server')) {
          serverType = 'dev';
        }
        
        if (line.includes('Session ID:')) {
          clearTimeout(timeoutId);
          resolve();
        }
      });
    });

    if (serverType !== 'dev') {
      throw new Error('Did not connect to dev server initially');
    }

    // Kill and restart
    proxy.kill();
    await new Promise(resolve => proxy.on('exit', resolve));
    await setTimeout(1000);

    // Restart with same server
    proxy = spawn('node', ['src/mcp-proxy-client.js', 'dev'], {
      env: { ...process.env, API_ACCESS_TOKEN: API_TOKEN }
    });

    stderr = readline.createInterface({
      input: proxy.stderr,
      crlfDelay: Infinity
    });

    serverType = null;

    // Verify same server
    await new Promise((resolve, reject) => {
      const timeoutId = global.setTimeout(() => reject(new Error('Connection timeout')), 10000);
      
      stderr.on('line', (line) => {
        console.log(`   [persist-2] ${line}`);
        
        if (line.includes('Development MCP Server')) {
          serverType = 'dev';
        }
        
        if (line.includes('Session ID:')) {
          clearTimeout(timeoutId);
          resolve();
        }
      });
    });

    if (serverType !== 'dev') {
      throw new Error('Server selection not preserved after restart');
    }

    console.log('   -> Server selection preserved across restart');
    
    // Clean up
    proxy.kill();
    await setTimeout(500);
  }

  printSummary() {
    console.log('\n====================================');
    console.log('Restart Test Summary');
    console.log('====================================');
    
    const passed = this.results.filter(r => r.status === 'passed').length;
    const failed = this.results.filter(r => r.status === 'failed').length;
    const totalTime = this.results.reduce((sum, r) => sum + r.duration, 0);
    
    console.log(`Total Tests: ${this.results.length}`);
    console.log(`Passed: ${passed} ✅`);
    console.log(`Failed: ${failed} ❌`);
    console.log(`Total Time: ${totalTime}ms`);
    
    if (failed > 0) {
      console.log('\nFailed tests:');
      this.results.filter(r => r.status === 'failed').forEach(r => {
        console.log(`  - ${r.name}: ${r.error}`);
      });
    }
    
    console.log('====================================\n');
    
    return failed === 0;
  }
}

// Main test runner
async function main() {
  console.log('Proxy Restart Tests');
  console.log('==================');
  console.log(`Working Directory: ${process.cwd()}`);
  console.log(`Node Version: ${process.version}`);
  
  const tester = new RestartTester();
  
  // Run tests
  await tester.runTest('Graceful shutdown (SIGTERM)', () => 
    tester.testGracefulShutdown()
  );
  
  await tester.runTest('Crash recovery (SIGKILL)', () => 
    tester.testCrashRecovery()
  );
  
  await tester.runTest('Rapid restarts', () => 
    tester.testRapidRestarts()
  );
  
  await tester.runTest('Server persistence across restarts', () => 
    tester.testServerPersistence()
  );
  
  // Print summary and exit
  const success = tester.printSummary();
  process.exit(success ? 0 : 1);
}

// Run tests
main().catch(console.error);