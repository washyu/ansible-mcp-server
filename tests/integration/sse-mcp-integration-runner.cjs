#!/usr/bin/env node
// Integration test runner for SSE-MCP interaction
// Run directly with node to avoid Jest ESM issues

const { spawn } = require('child_process');
const http = require('http');
const EventSourceModule = require('eventsource');
const path = require('path');

// Handle both named and default exports
const EventSource = EventSourceModule.EventSource || EventSourceModule;

const rootDir = path.join(__dirname, '../..');
const TEST_PORT = 3002;
// Use the actual token from .env or a test token
const API_TOKEN = process.env.API_ACCESS_TOKEN || '75bf9cbcf951ed970c96431f77985d7588d1229d5b3f29e0555a177f628f55d5';

let sseServer;
let testsPassed = 0;
let testsFailed = 0;

function log(message) {
  console.log(`[TEST] ${message}`);
}

function pass(testName) {
  console.log(`✅ ${testName}`);
  testsPassed++;
}

function fail(testName, error) {
  console.error(`❌ ${testName}`);
  console.error(`   Error: ${error.message || error}`);
  testsFailed++;
}

async function startSSEServer() {
  return new Promise((resolve, reject) => {
    const env = {
      ...process.env,
      SSE_PORT: TEST_PORT.toString(),
      API_ACCESS_TOKEN: API_TOKEN, // Make sure both server and client use same token
      NODE_ENV: 'test'
    };
    
    sseServer = spawn('node', ['src/sse-server.js'], {
      cwd: rootDir,
      env,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    let serverStarted = false;
    
    const checkOutput = (data) => {
      const output = data.toString();
      console.log('[SSE Server]', output.trim());
      if (!serverStarted && (output.includes(`listening on port ${TEST_PORT}`) || output.includes('SSE endpoint'))) {
        serverStarted = true;
        setTimeout(resolve, 500);
      }
    };
    
    sseServer.stdout.on('data', checkOutput);
    sseServer.stderr.on('data', checkOutput);
    
    sseServer.on('error', reject);
    
    setTimeout(() => {
      if (!serverStarted) {
        reject(new Error('SSE server failed to start'));
      }
    }, 5000);
  });
}

async function sendRequest(sessionId, request) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(request);
    const options = {
      hostname: 'localhost',
      port: TEST_PORT,
      path: `/sessions/${sessionId}/input`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_TOKEN}`,
        'Content-Length': Buffer.byteLength(data)
      }
    };
    
    const req = http.request(options, (res) => {
      if (res.statusCode === 200) {
        resolve();
      } else {
        reject(new Error(`HTTP ${res.statusCode}`));
      }
    });
    
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function testSSEConnection() {
  return new Promise((resolve, reject) => {
    console.log(`[DEBUG] Connecting to http://localhost:${TEST_PORT}/sse with token: ${API_TOKEN.substring(0, 10)}...`);
    const eventSource = new EventSource(`http://localhost:${TEST_PORT}/sse`, {
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`
      }
    });
    
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'session' && data.sessionId) {
        eventSource.close();
        resolve();
      }
    };
    
    eventSource.onerror = (error) => {
      console.log('[DEBUG] EventSource error:', error);
      if (error.status) {
        console.log('[DEBUG] Status:', error.status);
      }
      eventSource.close();
      reject(new Error(`EventSource error: ${error.status || error.message || 'Unknown'}`));
    };
    
    setTimeout(() => {
      eventSource.close();
      reject(new Error('Timeout waiting for session'));
    }, 5000);
  });
}

async function testInitializeRequest() {
  return new Promise((resolve, reject) => {
    let sessionId = null;
    const eventSource = new EventSource(`http://localhost:${TEST_PORT}/sse`, {
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`
      }
    });
    
    eventSource.onmessage = async (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === 'session') {
        sessionId = data.sessionId;
        
        const initRequest = {
          method: 'initialize',
          params: {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: { name: 'test', version: '0.1.0' }
          },
          jsonrpc: '2.0',
          id: 0
        };
        
        await sendRequest(sessionId, initRequest);
      } else if (data.type === 'message') {
        if (data.data.result && 
            data.data.result.protocolVersion === '2024-11-05' &&
            data.data.id === 0) {
          eventSource.close();
          resolve();
        } else {
          eventSource.close();
          reject(new Error('Invalid initialize response'));
        }
      }
    };
    
    eventSource.onerror = (error) => {
      console.log('[DEBUG] EventSource error:', error);
      if (error.status) {
        console.log('[DEBUG] Status:', error.status);
      }
      eventSource.close();
      reject(new Error(`EventSource error: ${error.status || error.message || 'Unknown'}`));
    };
    
    setTimeout(() => {
      eventSource.close();
      reject(new Error('Timeout waiting for initialize response'));
    }, 5000);
  });
}

async function testToolsList() {
  return new Promise((resolve, reject) => {
    let sessionId = null;
    let initialized = false;
    
    const eventSource = new EventSource(`http://localhost:${TEST_PORT}/sse`, {
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`
      }
    });
    
    eventSource.onmessage = async (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === 'session') {
        sessionId = data.sessionId;
        
        const initRequest = {
          method: 'initialize',
          params: {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: { name: 'test', version: '0.1.0' }
          },
          jsonrpc: '2.0',
          id: 0
        };
        
        await sendRequest(sessionId, initRequest);
      } else if (data.type === 'message' && !initialized) {
        initialized = true;
        
        const toolsRequest = {
          method: 'tools/list',
          jsonrpc: '2.0',
          id: 1
        };
        
        await sendRequest(sessionId, toolsRequest);
      } else if (data.type === 'message' && initialized && data.data.id === 1) {
        if (data.data.result && 
            Array.isArray(data.data.result.tools) &&
            data.data.result.tools.length > 0) {
          eventSource.close();
          resolve();
        } else {
          eventSource.close();
          reject(new Error('Invalid tools list response'));
        }
      }
    };
    
    eventSource.onerror = (error) => {
      console.log('[DEBUG] EventSource error:', error);
      if (error.status) {
        console.log('[DEBUG] Status:', error.status);
      }
      eventSource.close();
      reject(new Error(`EventSource error: ${error.status || error.message || 'Unknown'}`));
    };
    
    setTimeout(() => {
      eventSource.close();
      reject(new Error('Timeout waiting for tools list'));
    }, 5000);
  });
}

async function testResponseTime() {
  return new Promise((resolve, reject) => {
    let sessionId = null;
    let requestSentTime = null;
    
    const eventSource = new EventSource(`http://localhost:${TEST_PORT}/sse`, {
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`
      }
    });
    
    eventSource.onmessage = async (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === 'session') {
        sessionId = data.sessionId;
        requestSentTime = Date.now();
        
        const initRequest = {
          method: 'initialize',
          params: {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: { name: 'test', version: '0.1.0' }
          },
          jsonrpc: '2.0',
          id: 'timing-test'
        };
        
        await sendRequest(sessionId, initRequest);
      } else if (data.type === 'message' && data.data.id === 'timing-test') {
        const responseTime = Date.now() - requestSentTime;
        
        if (responseTime < 2000) {
          eventSource.close();
          resolve();
        } else {
          eventSource.close();
          reject(new Error(`Response too slow: ${responseTime}ms`));
        }
      }
    };
    
    eventSource.onerror = (error) => {
      console.log('[DEBUG] EventSource error:', error);
      if (error.status) {
        console.log('[DEBUG] Status:', error.status);
      }
      eventSource.close();
      reject(new Error(`EventSource error: ${error.status || error.message || 'Unknown'}`));
    };
    
    setTimeout(() => {
      eventSource.close();
      reject(new Error('Timeout - response never received'));
    }, 5000);
  });
}

async function runTests() {
  console.log('================================================');
  console.log('SSE-MCP Integration Tests');
  console.log('================================================');
  console.log('');
  
  try {
    // Start SSE server
    log('Starting SSE server...');
    await startSSEServer();
    log(`SSE server started on port ${TEST_PORT}`);
    console.log('');
    
    // Run tests
    try {
      await testSSEConnection();
      pass('SSE connection established');
    } catch (e) {
      fail('SSE connection', e);
    }
    
    try {
      await testInitializeRequest();
      pass('Initialize request handled correctly');
    } catch (e) {
      fail('Initialize request', e);
    }
    
    try {
      await testToolsList();
      pass('Tools list request handled correctly');
    } catch (e) {
      fail('Tools list request', e);
    }
    
    try {
      await testResponseTime();
      pass('Response time within acceptable range');
    } catch (e) {
      fail('Response time', e);
    }
    
  } catch (error) {
    console.error('Failed to start SSE server:', error);
    process.exit(1);
  } finally {
    // Cleanup
    if (sseServer) {
      log('Stopping SSE server...');
      sseServer.kill();
    }
  }
  
  console.log('');
  console.log('================================================');
  console.log(`Tests completed: ${testsPassed} passed, ${testsFailed} failed`);
  console.log('================================================');
  
  process.exit(testsFailed > 0 ? 1 : 0);
}

// Run tests
runTests().catch(console.error);