#!/usr/bin/env node
// This runs locally on Windows and bridges stdio to HTTP

import { createInterface } from 'readline';
import http from 'http';

const MCP_SERVER_URL = process.env.MCP_SERVER_URL || 'http://YOUR_MCP_SERVER_IP:3000';

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

let sessionId = null;

async function httpRequest(path, method = 'GET', data = null) {
  const url = new URL(path, MCP_SERVER_URL);
  
  return new Promise((resolve, reject) => {
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          resolve(body);
        }
      });
    });

    req.on('error', reject);
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

// Initialize session on first request
async function ensureSession() {
  if (!sessionId) {
    const response = await httpRequest('/sessions', 'POST');
    sessionId = response.sessionId;
    return response.response;
  }
  return null;
}

// Handle stdin input from Claude
rl.on('line', async (line) => {
  try {
    const request = JSON.parse(line);
    
    // Initialize session if needed
    if (request.method === 'initialize') {
      const initResponse = await ensureSession();
      process.stdout.write(JSON.stringify(initResponse) + '\n');
      return;
    }

    // Ensure we have a session
    await ensureSession();

    // Forward request to REST server
    const response = await httpRequest(
      `/sessions/${sessionId}/request`,
      'POST',
      request
    );
    
    process.stdout.write(JSON.stringify(response) + '\n');
  } catch (error) {
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

// Cleanup on exit
process.on('exit', async () => {
  if (sessionId) {
    try {
      await httpRequest(`/sessions/${sessionId}`, 'DELETE');
    } catch (e) {
      // Ignore cleanup errors
    }
  }
});