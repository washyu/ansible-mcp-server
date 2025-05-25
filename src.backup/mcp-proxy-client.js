#!/usr/bin/env node
// MCP Proxy Client - Bridges stdio (for Claude Desktop) to SSE (remote server)

import { createInterface } from 'readline';
import EventSource from 'eventsource';
import http from 'http';
import https from 'https';

const SSE_URL = process.env.MCP_SSE_URL || 'http://192.168.10.100:3001/sse';
const API_TOKEN = process.env.API_ACCESS_TOKEN || 'your-secure-token';

let sessionId = null;
let eventSource = null;

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

// Connect to SSE server
function connect() {
  console.error('Connecting to SSE server:', SSE_URL);
  
  eventSource = new EventSource(SSE_URL, {
    headers: {
      'Authorization': `Bearer ${API_TOKEN}`
    }
  });

  eventSource.onopen = () => {
    console.error('SSE connection established');
  };

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      
      switch (data.type) {
        case 'session':
          sessionId = data.sessionId;
          console.error('Session ID:', sessionId);
          break;
          
        case 'message':
          // Forward MCP message to stdout for Claude Desktop
          process.stdout.write(JSON.stringify(data.data) + '\n');
          break;
          
        case 'error':
          console.error('MCP server error:', data.error);
          break;
          
        case 'close':
          console.error('MCP server closed with code:', data.code);
          process.exit(data.code || 0);
          break;
      }
    } catch (e) {
      console.error('Failed to parse SSE message:', e);
    }
  };

  eventSource.onerror = (error) => {
    console.error('SSE connection error:', error);
    if (eventSource.readyState === EventSource.CLOSED) {
      console.error('Connection closed, exiting...');
      process.exit(1);
    }
  };
}

// Send input to MCP server via HTTP POST
async function sendInput(data) {
  if (!sessionId) {
    console.error('No session ID, waiting for connection...');
    return;
  }

  const url = new URL(`/sessions/${sessionId}/input`, SSE_URL);
  const protocol = url.protocol === 'https:' ? https : http;

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

    const req = protocol.request(options, (res) => {
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

// Handle stdin from Claude Desktop
rl.on('line', async (line) => {
  try {
    // Wait for session to be established
    let retries = 0;
    while (!sessionId && retries < 50) {
      await new Promise(resolve => setTimeout(resolve, 100));
      retries++;
    }

    if (!sessionId) {
      throw new Error('Failed to establish session');
    }

    await sendInput(line);
  } catch (error) {
    console.error('Failed to send input:', error);
    const errorResponse = {
      jsonrpc: '2.0',
      error: {
        code: -32603,
        message: error.message
      },
      id: null
    };
    process.stdout.write(JSON.stringify(errorResponse) + '\n');
  }
});

// Start connection
connect();

// Cleanup on exit
process.on('SIGINT', () => {
  console.error('Shutting down proxy client...');
  if (eventSource) {
    eventSource.close();
  }
  process.exit(0);
});