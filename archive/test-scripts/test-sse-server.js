#!/usr/bin/env node
// Test script for SSE server

import EventSource from 'eventsource';
import http from 'http';

const SSE_URL = process.env.MCP_SSE_URL || 'http://localhost:3001/sse';
const API_TOKEN = process.env.API_ACCESS_TOKEN || 'your-secure-token';

console.log('Testing SSE Server...');
console.log('SSE URL:', SSE_URL);

// First test health endpoint
const healthUrl = SSE_URL.replace('/sse', '/health');
console.log('\n1. Testing health endpoint:', healthUrl);

http.get(healthUrl, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Health check response:', data);
    
    // Now test SSE connection
    testSSE();
  });
}).on('error', (err) => {
  console.error('Health check failed:', err.message);
  process.exit(1);
});

function testSSE() {
  console.log('\n2. Testing SSE connection...');
  
  const eventSource = new EventSource(SSE_URL, {
    headers: {
      'Authorization': `Bearer ${API_TOKEN}`
    }
  });

  let sessionId = null;

  eventSource.onopen = () => {
    console.log('✓ SSE connection established');
  };

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      console.log('Received:', data.type, data);
      
      if (data.type === 'session') {
        sessionId = data.sessionId;
        console.log('✓ Session created:', sessionId);
        
        // Send a test message
        setTimeout(() => sendTestMessage(sessionId), 1000);
      } else if (data.type === 'message') {
        console.log('✓ MCP response:', JSON.stringify(data.data, null, 2));
        
        // Close connection after receiving response
        setTimeout(() => {
          console.log('\n✓ All tests passed!');
          eventSource.close();
          process.exit(0);
        }, 1000);
      }
    } catch (e) {
      console.error('Failed to parse:', e);
    }
  };

  eventSource.onerror = (error) => {
    console.error('✗ SSE error:', error);
    if (eventSource.readyState === EventSource.CLOSED) {
      console.error('Connection closed');
      process.exit(1);
    }
  };
}

function sendTestMessage(sessionId) {
  console.log('\n3. Sending test MCP message...');
  
  const message = {
    jsonrpc: '2.0',
    method: 'initialize',
    params: {
      protocolVersion: '0.1.0',
      capabilities: {}
    },
    id: 1
  };
  
  const url = new URL(`/sessions/${sessionId}/input`, SSE_URL);
  
  const options = {
    hostname: url.hostname,
    port: url.port,
    path: url.pathname,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_TOKEN}`,
      'Content-Length': Buffer.byteLength(JSON.stringify(message))
    }
  };

  const req = http.request(options, (res) => {
    if (res.statusCode === 200) {
      console.log('✓ Message sent successfully');
    } else {
      console.error('✗ Failed to send message:', res.statusCode);
    }
  });

  req.on('error', (err) => {
    console.error('✗ Request error:', err);
  });

  req.write(JSON.stringify(message));
  req.end();
}