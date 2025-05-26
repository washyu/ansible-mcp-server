#!/usr/bin/env node
// MCP Proxy Client - Bridges stdio (for Claude Desktop) to SSE (remote server)

import { createInterface } from 'readline';
import EventSource from 'eventsource';
import http from 'http';
import https from 'https';

// Server configurations
const MCP_SERVERS = {
  production: {
    url: 'http://192.168.10.100:3001/sse',
    token: process.env.API_ACCESS_TOKEN || 'your-secure-token',
    description: 'Production MCP Server'
  },
  dev: {
    url: 'http://192.168.10.102:3001/sse',
    token: process.env.API_ACCESS_TOKEN || 'your-secure-token',
    description: 'Development MCP Server'
  },
  local: {
    url: 'http://localhost:3001/sse',
    token: process.env.API_ACCESS_TOKEN || 'your-secure-token',
    description: 'Local MCP Server'
  }
};

// Determine which server to use
const serverName = process.env.MCP_SERVER || process.argv[2] || 'production';
const serverConfig = MCP_SERVERS[serverName];

if (!serverConfig) {
  console.error(`Unknown MCP server: ${serverName}`);
  console.error('Available servers:', Object.keys(MCP_SERVERS).join(', '));
  process.exit(1);
}

const SSE_URL = process.env.MCP_SSE_URL || serverConfig.url;
const API_TOKEN = serverConfig.token;

console.error(`Connecting to ${serverConfig.description} at ${SSE_URL}`);

let sessionId = null;
let eventSource = null;
const pendingRequests = new Map();

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

// Switch to a different MCP server
function switchServer(newServerName) {
  const newConfig = MCP_SERVERS[newServerName];
  if (!newConfig) {
    console.error(`Unknown server: ${newServerName}. Available: ${Object.keys(MCP_SERVERS).join(', ')}`);
    return false;
  }
  
  console.error(`Switching to ${newConfig.description}...`);
  
  // Close current connection
  if (eventSource) {
    eventSource.close();
  }
  
  // Update global variables
  Object.assign(global, {
    SSE_URL: newConfig.url,
    API_TOKEN: newConfig.token
  });
  
  sessionId = null;
  connect();
  return true;
}

// Connect to SSE server
function connect() {
  // Close any existing connection
  if (eventSource) {
    console.error('Closing existing SSE connection');
    eventSource.close();
  }
  
  const currentUrl = global.SSE_URL || SSE_URL;
  const currentToken = global.API_TOKEN || API_TOKEN;
  console.error('Connecting to SSE server:', currentUrl);
  
  eventSource = new EventSource(currentUrl, {
    headers: {
      'Authorization': `Bearer ${currentToken}`
    }
  });

  eventSource.onopen = () => {
    console.error('SSE connection established');
    // Mark that we're ready for requests
    global.__sseReady = true;
  };

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      
      switch (data.type) {
        case 'session':
          sessionId = data.sessionId;
          console.error('Session ID:', sessionId);
          
          // Session is now ready
          break;
          
        case 'message':
          // Forward MCP message to stdout for Claude Desktop
          process.stdout.write(JSON.stringify(data.data) + '\n');
          
          // Clear pending request timeout
          if (data.data && data.data.id !== undefined) {
            const timeoutId = pendingRequests.get(data.data.id);
            if (timeoutId) {
              clearTimeout(timeoutId);
              pendingRequests.delete(data.data.id);
              console.error(`Cleared timeout for request ${data.data.id}`);
            }
          }
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

  const currentUrl = global.SSE_URL || SSE_URL;
  const currentToken = global.API_TOKEN || API_TOKEN;
  const url = new URL(`/sessions/${sessionId}/input`, currentUrl);
  const protocol = url.protocol === 'https:' ? https : http;

  return new Promise((resolve, reject) => {
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentToken}`,
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
    // Handle initialize requests with synthetic response
    try {
      const msg = JSON.parse(line);
      if (msg.method === 'initialize' && msg.id !== undefined) {
        console.error('Received initialize request with id:', msg.id);
        
        // Send synthetic response immediately
        const initResponse = {
          result: {
            protocolVersion: '2024-11-05',
            capabilities: { tools: {} },
            serverInfo: { name: 'ansible-mcp-server', version: '1.1.0' }
          },
          jsonrpc: '2.0',
          id: msg.id
        };
        
        console.error('Sending synthetic initialize response immediately');
        process.stdout.write(JSON.stringify(initResponse) + '\n');
        
        // Don't forward initialize to the server since we handled it
        return;
      } else if (msg.method === 'tools/list' && msg.id !== undefined) {
        console.error('Received tools/list request with id:', msg.id);
        
        // Send synthetic tools list response
        const toolsResponse = {
          result: {
            tools: [
              { name: "test-connection", description: "Test connection to a target host", inputSchema: { type: "object", properties: { target: { type: "string" } }, required: ["target"] } },
              { name: "run-playbook", description: "Run an Ansible playbook", inputSchema: { type: "object", properties: { playbook: { type: "string" } }, required: ["playbook"] } },
              { name: "list-hosts", description: "List all hosts in inventory", inputSchema: { type: "object", properties: {} } }
            ]
          },
          jsonrpc: '2.0',
          id: msg.id
        };
        
        console.error('Sending synthetic tools/list response');
        process.stdout.write(JSON.stringify(toolsResponse) + '\n');
        
        // Don't forward to server
        return;
      } else if (msg.method === 'tools/call' && msg.id !== undefined) {
        console.error('Received tools/call request:', msg.params?.name);
        
        // Send error response for all tool calls
        const errorResponse = {
          error: {
            code: -32603,
            message: "MCP server is currently unavailable due to stdout capture issue. See GitHub issue #28."
          },
          jsonrpc: '2.0',
          id: msg.id
        };
        
        console.error('Sending error response for tool call');
        process.stdout.write(JSON.stringify(errorResponse) + '\n');
        
        // Don't forward to server
        return;
      }
    } catch (e) {
      // Not JSON or parse error, continue normally
    }
    
    // Check for special proxy commands
    if (line.startsWith('__MCP_PROXY_')) {
      const command = line.trim();
      if (command.startsWith('__MCP_PROXY_SWITCH_')) {
        const serverName = command.replace('__MCP_PROXY_SWITCH_', '');
        const success = switchServer(serverName);
        const response = {
          jsonrpc: '2.0',
          result: {
            switched: success,
            server: serverName,
            available: Object.keys(MCP_SERVERS)
          },
          id: 'proxy-switch'
        };
        process.stdout.write(JSON.stringify(response) + '\n');
        return;
      } else if (command === '__MCP_PROXY_LIST_SERVERS') {
        const response = {
          jsonrpc: '2.0',
          result: {
            servers: MCP_SERVERS,
            current: serverName
          },
          id: 'proxy-list'
        };
        process.stdout.write(JSON.stringify(response) + '\n');
        return;
      }
    }

    // Wait for session to be established
    let retries = 0;
    while (!sessionId && retries < 50) {
      await new Promise(resolve => setTimeout(resolve, 100));
      retries++;
    }

    if (!sessionId) {
      throw new Error('Failed to establish session');
    }

    // Set a timeout for any other requests
    if (sessionId) {
      try {
        const msg = JSON.parse(line);
        if (msg.id !== undefined && !msg.method?.startsWith('__MCP_PROXY_')) {
          // Set a 5-second timeout for responses
          const timeoutId = setTimeout(() => {
            if (pendingRequests.has(msg.id)) {
              const errorResponse = {
                error: {
                  code: -32001,
                  message: "Request timed out due to SSE server issue"
                },
                jsonrpc: '2.0',
                id: msg.id
              };
              console.error(`Timeout for request ${msg.id}, sending error response`);
              process.stdout.write(JSON.stringify(errorResponse) + '\n');
              pendingRequests.delete(msg.id);
            }
          }, 5000);
          
          pendingRequests.set(msg.id, timeoutId);
        }
      } catch (e) {
        // Not JSON, ignore
      }
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