#!/usr/bin/env node
/**
 * Quick test to verify dev server functionality
 */

import { spawn } from 'child_process';
import readline from 'readline';

const API_TOKEN = '75bf9cbcf951ed970c96431f77985d7588d1229d5b3f29e0555a177f628f55d5';

async function testDevServer() {
  console.log('Testing Dev MCP Server (192.168.10.102)');
  console.log('==========================================\n');

  const proxy = spawn('node', ['src/mcp-proxy-client.js', 'dev'], {
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

  let sessionId = null;
  let toolsInitialized = false;

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      proxy.kill();
      reject(new Error('Timeout waiting for session'));
    }, 10000);

    stderr.on('line', (line) => {
      console.log(`[dev] ${line}`);
      
      if (line.includes('Session ID:')) {
        sessionId = line.split('Session ID:')[1].trim();
        console.log(`\n✅ Session established: ${sessionId}`);
      }
      
      if (line.includes('Loaded 60 tools')) {
        toolsInitialized = true;
        console.log('✅ Tools loaded successfully');
        
        // Send a test command to list tools
        console.log('\n📋 Sending tools/list request...');
        const request = {
          jsonrpc: '2.0',
          method: 'tools/list',
          id: 'test-1'
        };
        proxy.stdin.write(JSON.stringify(request) + '\n');
      }
    });

    stdout.on('line', (line) => {
      try {
        const response = JSON.parse(line);
        console.log('\n📥 Response received:');
        
        if (response.result && response.result.tools) {
          console.log(`✅ Found ${response.result.tools.length} tools`);
          
          // List first 5 tools
          console.log('\nFirst 5 tools:');
          response.result.tools.slice(0, 5).forEach(tool => {
            console.log(`  - ${tool.name}: ${tool.description}`);
          });
          
          // Test a specific tool
          console.log('\n📋 Testing test-connection tool...');
          const testRequest = {
            jsonrpc: '2.0',
            method: 'tools/call',
            params: {
              name: 'test-connection',
              arguments: {
                target: '192.168.10.102'
              }
            },
            id: 'test-2'
          };
          proxy.stdin.write(JSON.stringify(testRequest) + '\n');
        } else if (response.id === 'test-2') {
          console.log('\n✅ test-connection response:');
          console.log(JSON.stringify(response.result, null, 2));
          
          clearTimeout(timeout);
          proxy.kill();
          resolve();
        }
      } catch (e) {
        // Ignore non-JSON output
      }
    });

    proxy.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

// Run test
testDevServer()
  .then(() => {
    console.log('\n✅ Dev server test completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Dev server test failed:', error.message);
    process.exit(1);
  });