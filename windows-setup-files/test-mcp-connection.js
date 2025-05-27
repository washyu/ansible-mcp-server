#!/usr/bin/env node
// Test MCP Connection - Verifies tools are available through the proxy

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('=== MCP Connection Test ===\n');

// Spawn the proxy client
const proxy = spawn('node', [path.join(__dirname, 'mcp-proxy-client.js')], {
  stdio: ['pipe', 'pipe', 'pipe']
});

let responseBuffer = '';
let initComplete = false;
let toolsReceived = false;

// Handle stdout
proxy.stdout.on('data', (data) => {
  responseBuffer += data.toString();
  
  // Try to parse complete JSON messages
  const lines = responseBuffer.split('\n');
  responseBuffer = lines.pop() || '';
  
  for (const line of lines) {
    if (line.trim()) {
      try {
        const msg = JSON.parse(line);
        
        if (msg.result && msg.result.serverInfo) {
          console.log('✓ Initialize response received');
          console.log(`  Server: ${msg.result.serverInfo.name} v${msg.result.serverInfo.version}`);
          console.log(`  Protocol: ${msg.result.protocolVersion}\n`);
          initComplete = true;
          
          // Now request tools list
          setTimeout(() => {
            console.log('Requesting tools list...');
            const toolsRequest = {
              jsonrpc: '2.0',
              method: 'tools/list',
              params: {},
              id: 2
            };
            proxy.stdin.write(JSON.stringify(toolsRequest) + '\n');
          }, 500);
        }
        
        if (msg.result && msg.result.tools) {
          console.log(`✓ Tools list received: ${msg.result.tools.length} tools available\n`);
          toolsReceived = true;
          
          // List all tools
          console.log('Available tools:');
          msg.result.tools.forEach((tool, index) => {
            console.log(`  ${index + 1}. ${tool.name} - ${tool.description || 'No description'}`);
          });
          
          // Look for list-hosts specifically
          console.log('\n');
          const listHostsTool = msg.result.tools.find(t => t.name === 'list-hosts');
          if (listHostsTool) {
            console.log('✓ list-hosts tool is available!');
            console.log(`  Description: ${listHostsTool.description}`);
            
            // Test calling list-hosts
            console.log('\nTesting list-hosts tool...');
            const callRequest = {
              jsonrpc: '2.0',
              method: 'tools/call',
              params: {
                name: 'list-hosts',
                arguments: {}
              },
              id: 3
            };
            proxy.stdin.write(JSON.stringify(callRequest) + '\n');
          } else {
            console.log('✗ list-hosts tool NOT found!');
            console.log('  This means the tool is not being exposed by the MCP server');
          }
        }
        
        if (msg.result && msg.id === 3) {
          console.log('\n✓ list-hosts tool response:');
          console.log(JSON.stringify(msg.result, null, 2));
          
          // All done
          setTimeout(() => {
            console.log('\n=== Test Complete ===');
            process.exit(0);
          }, 1000);
        }
        
        if (msg.error) {
          console.error('✗ Error:', msg.error.message);
        }
      } catch (e) {
        // Not valid JSON, ignore
      }
    }
  }
});

// Handle stderr
proxy.stderr.on('data', (data) => {
  const lines = data.toString().split('\n');
  lines.forEach(line => {
    if (line.trim()) {
      console.error('[Debug]', line);
    }
  });
});

// Send initialize request
console.log('Sending initialize request...');
const initRequest = {
  jsonrpc: '2.0',
  method: 'initialize',
  params: {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: {
      name: 'test-client',
      version: '1.0.0'
    }
  },
  id: 1
};

// Wait a bit for connection to establish
setTimeout(() => {
  proxy.stdin.write(JSON.stringify(initRequest) + '\n');
}, 1000);

// Timeout handler
setTimeout(() => {
  if (!initComplete) {
    console.error('\n✗ Timeout: No initialize response received');
  } else if (!toolsReceived) {
    console.error('\n✗ Timeout: No tools list received');
  }
  process.exit(1);
}, 10000);

// Handle exit
process.on('SIGINT', () => {
  proxy.kill();
  process.exit(0);
});