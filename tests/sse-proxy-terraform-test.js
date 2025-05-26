#!/usr/bin/env node
// Test Terraform tools through SSE proxy

import pkg from 'eventsource';
const { EventSource } = pkg;
import http from 'http';

const SSE_URL = 'http://192.168.10.100:3001/sse';
const API_TOKEN = process.env.API_ACCESS_TOKEN || 'your-secure-token';

let sessionId = null;
let eventSource = null;

console.log('Testing Terraform tools through SSE proxy...');

// Connect to SSE server
eventSource = new EventSource(SSE_URL, {
  headers: {
    'Authorization': `Bearer ${API_TOKEN}`
  }
});

eventSource.onopen = () => {
  console.log('SSE connection established');
};

eventSource.onmessage = (event) => {
  try {
    const data = JSON.parse(event.data);
    
    switch (data.type) {
      case 'session':
        sessionId = data.sessionId;
        console.log('Session ID:', sessionId);
        
        // Once we have a session, send our test requests
        testTerraformTools();
        break;
        
      case 'message':
        // Handle MCP responses
        console.log('\nMCP Response:', JSON.stringify(data.data, null, 2));
        
        // Check if this is our tools/call response
        if (data.data && data.data.id === 'terraform-test-1') {
          console.log('\nTerraform create-vm-template result:');
          if (data.data.result && data.data.result.content) {
            const content = JSON.parse(data.data.result.content[0].text);
            console.log('Success:', content.success);
            console.log('Output:', content.output);
            if (content.error) console.log('Error:', content.error);
          }
          
          // Exit after test
          setTimeout(() => {
            console.log('\nTest completed!');
            eventSource.close();
            process.exit(0);
          }, 1000);
        }
        break;
        
      case 'error':
        console.error('SSE error:', data.error);
        break;
    }
  } catch (e) {
    console.error('Failed to parse SSE message:', e);
  }
};

eventSource.onerror = (error) => {
  console.error('SSE connection error:', error);
  process.exit(1);
};

// Send request to MCP server via HTTP POST
async function sendRequest(request) {
  if (!sessionId) {
    console.error('No session ID');
    return;
  }

  const url = new URL(`/sessions/${sessionId}/input`, SSE_URL);
  
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(request);
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

async function testTerraformTools() {
  console.log('\nSending create-vm-template request...');
  
  // Test create-vm-template tool
  const terraformRequest = {
    jsonrpc: '2.0',
    method: 'tools/call',
    params: {
      name: 'create-vm-template',
      arguments: {
        name: 'jenkins-server',
        vmid: 151,
        template: 'ubuntu-cloud',
        cores: 4,
        memory: 8192,
        disk: '50G',
        network: {
          bridge: 'vmbr0',
          ip: '192.168.10.151',
          gateway: '192.168.10.1',
          nameserver: '8.8.8.8'
        },
        outputDir: '/tmp/terraform-jenkins'
      }
    },
    id: 'terraform-test-1'
  };
  
  try {
    await sendRequest(terraformRequest);
    console.log('Request sent successfully');
  } catch (error) {
    console.error('Failed to send request:', error);
  }
}