#!/usr/bin/env node
import { createInterface } from 'readline';

const REST_URL = process.env.MCP_REST_URL || 'http://192.168.10.100:3000';
let sessionId = null;

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

async function makeRequest(url, options = {}) {
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    });
    return await response.json();
  } catch (error) {
    console.error('HTTP request failed:', error);
    throw error;
  }
}

async function initialize() {
  try {
    // Create session
    const sessionResponse = await makeRequest(`${REST_URL}/sessions`, {
      method: 'POST'
    });
    
    sessionId = sessionResponse.sessionId;
    
    // Return initialization response
    process.stdout.write(JSON.stringify(sessionResponse.response) + '\n');
  } catch (error) {
    console.error('Failed to initialize:', error);
    process.exit(1);
  }
}

// Handle incoming MCP requests
rl.on('line', async (line) => {
  try {
    const request = JSON.parse(line);
    
    if (request.method === 'initialize') {
      await initialize();
    } else {
      // Forward request to REST API
      const response = await makeRequest(
        `${REST_URL}/sessions/${sessionId}/request`,
        {
          method: 'POST',
          body: JSON.stringify(request)
        }
      );
      
      process.stdout.write(JSON.stringify(response) + '\n');
    }
  } catch (error) {
    console.error('Error processing request:', error);
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
process.on('SIGINT', async () => {
  if (sessionId) {
    try {
      await makeRequest(`${REST_URL}/sessions/${sessionId}`, {
        method: 'DELETE'
      });
    } catch (error) {
      console.error('Failed to close session:', error);
    }
  }
  process.exit(0);
});