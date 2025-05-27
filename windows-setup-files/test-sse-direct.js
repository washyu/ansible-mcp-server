#!/usr/bin/env node
// Direct SSE Server Test - Tests the SSE server without the proxy

import EventSource from 'eventsource';
import http from 'http';

const SSE_URL = 'http://192.168.10.100:3001/sse';
const API_TOKEN = process.env.API_ACCESS_TOKEN || 'your-secure-token';

console.log('=== Direct SSE Server Test ===\n');
console.log(`Testing SSE server at: ${SSE_URL}\n`);

let sessionId = null;
let eventSource = null;

// Connect to SSE server
console.log('Connecting to SSE server...');
eventSource = new EventSource(SSE_URL, {
  headers: {
    'Authorization': `Bearer ${API_TOKEN}`
  }
});

eventSource.onopen = () => {
  console.log('✓ SSE connection established');
};

eventSource.onmessage = (event) => {
  try {
    const data = JSON.parse(event.data);
    
    switch (data.type) {
      case 'session':
        sessionId = data.sessionId;
        console.log(`✓ Session established: ${sessionId}\n`);
        
        // Send initialize request
        sendInitialize();
        break;
        
      case 'message':
        const msg = data.data;
        
        // Handle initialize response
        if (msg.result && msg.result.serverInfo) {
          console.log('✓ Initialize response received');
          console.log(`  Server: ${msg.result.serverInfo.name} v${msg.result.serverInfo.version}`);
          console.log(`  Protocol: ${msg.result.protocolVersion}\n`);
          
          // Request tools list
          setTimeout(sendToolsList, 500);
        }
        
        // Handle tools list response
        if (msg.result && msg.result.tools) {
          console.log(`✓ Tools list received: ${msg.result.tools.length} tools available\n`);
          
          // Show first 10 tools
          console.log('First 10 tools:');
          msg.result.tools.slice(0, 10).forEach((tool, index) => {
            console.log(`  ${index + 1}. ${tool.name}`);
          });
          
          if (msg.result.tools.length > 10) {
            console.log(`  ... and ${msg.result.tools.length - 10} more\n`);
          }
          
          // Look for list-hosts
          const listHostsTool = msg.result.tools.find(t => t.name === 'list-hosts');
          if (listHostsTool) {
            console.log('✓ list-hosts tool found!');
            console.log(`  Description: ${listHostsTool.description}\n`);
            
            // Test it
            setTimeout(sendListHostsCall, 500);
          } else {
            console.log('✗ list-hosts tool NOT found!\n');
            
            // Show all ansible-related tools
            const ansibleTools = msg.result.tools.filter(t => 
              t.name.includes('ansible') || 
              t.name.includes('host') || 
              t.name.includes('inventory')
            );
            
            if (ansibleTools.length > 0) {
              console.log('Ansible-related tools found:');
              ansibleTools.forEach(tool => {
                console.log(`  - ${tool.name}`);
              });
            }
            
            process.exit(1);
          }
        }
        
        // Handle list-hosts response
        if (msg.id === 3 && msg.result) {
          console.log('✓ list-hosts response:');
          console.log(JSON.stringify(msg.result, null, 2));
          console.log('\n=== Test Complete ===');
          process.exit(0);
        }
        
        if (msg.error) {
          console.error('✗ Error:', msg.error);
        }
        break;
        
      case 'error':
        console.error('✗ SSE error:', data.error);
        break;
    }
  } catch (e) {
    console.error('Failed to parse SSE message:', e);
  }
};

eventSource.onerror = (error) => {
  console.error('✗ SSE connection error:', error.message || error);
  if (eventSource.readyState === EventSource.CLOSED) {
    console.error('Connection closed');
    process.exit(1);
  }
};

// Send a message to the MCP server
async function sendInput(data) {
  if (!sessionId) {
    console.error('No session ID yet');
    return;
  }

  const url = new URL(`/sessions/${sessionId}/input`, SSE_URL);
  
  return new Promise((resolve, reject) => {
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_TOKEN}`,
        'Content-Length': Buffer.byteLength(data)
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve();
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${body}`));
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// Send initialize request
async function sendInitialize() {
  console.log('Sending initialize request...');
  const request = {
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
  
  try {
    await sendInput(JSON.stringify(request));
  } catch (error) {
    console.error('Failed to send initialize:', error);
  }
}

// Send tools list request
async function sendToolsList() {
  console.log('Requesting tools list...');
  const request = {
    jsonrpc: '2.0',
    method: 'tools/list',
    params: {},
    id: 2
  };
  
  try {
    await sendInput(JSON.stringify(request));
  } catch (error) {
    console.error('Failed to send tools/list:', error);
  }
}

// Send list-hosts call
async function sendListHostsCall() {
  console.log('Testing list-hosts tool...');
  const request = {
    jsonrpc: '2.0',
    method: 'tools/call',
    params: {
      name: 'list-hosts',
      arguments: {}
    },
    id: 3
  };
  
  try {
    await sendInput(JSON.stringify(request));
  } catch (error) {
    console.error('Failed to call list-hosts:', error);
  }
}

// Timeout
setTimeout(() => {
  console.error('\n✗ Test timed out');
  process.exit(1);
}, 15000);

// Handle exit
process.on('SIGINT', () => {
  if (eventSource) {
    eventSource.close();
  }
  process.exit(0);
});