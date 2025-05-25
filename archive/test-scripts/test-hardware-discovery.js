#!/usr/bin/env node

// Test hardware discovery tools locally

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function testTool(toolName, args = {}) {
  console.log(`\n=== Testing ${toolName} ===`);
  
  const mcp = spawn('node', [path.join(__dirname, 'src', 'index.js')], {
    stdio: ['pipe', 'pipe', 'pipe']
  });

  const request = {
    jsonrpc: '2.0',
    method: 'tools/call',
    params: {
      name: toolName,
      arguments: args
    },
    id: 1
  };

  mcp.stdin.write(JSON.stringify(request) + '\n');

  return new Promise((resolve) => {
    let output = '';
    
    mcp.stdout.on('data', (data) => {
      output += data.toString();
      
      // Look for complete JSON response
      const lines = output.split('\n');
      for (const line of lines) {
        if (line.trim() && line.includes('"jsonrpc"')) {
          try {
            const response = JSON.parse(line);
            if (response.result) {
              const result = JSON.parse(response.result.content[0].text);
              console.log('Success:', result.success);
              if (result.output) {
                console.log('Output preview:', result.output.substring(0, 500) + '...');
              }
              if (result.error) {
                console.log('Error:', result.error);
              }
              mcp.kill();
              resolve();
            }
          } catch (e) {
            // Not complete JSON yet
          }
        }
      }
    });

    mcp.stderr.on('data', (data) => {
      // Ignore stderr (debug output)
    });

    setTimeout(() => {
      console.log('Timeout - no response');
      mcp.kill();
      resolve();
    }, 10000);
  });
}

async function main() {
  console.log('Testing Hardware Discovery Tools\n');

  // Test hardware scan
  await testTool('hardware-scan', {
    target: 'localhost',
    categories: ['cpu', 'memory'],
    format: 'summary'
  });

  // Test storage analysis
  await testTool('storage-analysis', {
    target: 'localhost',
    includePartitions: true
  });

  // Test network interfaces
  await testTool('network-interfaces', {
    target: 'localhost',
    includeVirtual: false
  });

  // Test hardware inventory
  await testTool('hardware-inventory', {
    action: 'list'
  });

  console.log('\n✅ Hardware discovery tests complete!');
}

main().catch(console.error);