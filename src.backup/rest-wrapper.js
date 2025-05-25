#!/usr/bin/env node
import express from 'express';
import { spawn } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(express.json());

// Store active MCP connections
const mcpConnections = new Map();

// CORS middleware for browser-based clients
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Initialize MCP connection
async function initializeMCPConnection(sessionId) {
  return new Promise((resolve, reject) => {
    const mcp = spawn('node', ['src/index.js'], {
      cwd: process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe']
    });

    const connection = {
      process: mcp,
      initialized: false,
      pendingRequests: new Map(),
      buffer: ''
    };

    mcp.stdout.on('data', (data) => {
      connection.buffer += data.toString();
      
      // Try to parse complete JSON messages
      const lines = connection.buffer.split('\n');
      connection.buffer = lines.pop() || '';
      
      for (const line of lines) {
        if (line.trim()) {
          try {
            const response = JSON.parse(line);
            if (response.id !== undefined) {
              const pending = connection.pendingRequests.get(response.id);
              if (pending) {
                pending.resolve(response);
                connection.pendingRequests.delete(response.id);
              }
            }
          } catch (e) {
            console.error('Failed to parse MCP response:', e);
          }
        }
      }
    });

    mcp.stderr.on('data', (data) => {
      console.error('MCP stderr:', data.toString());
    });

    mcp.on('error', (error) => {
      console.error('MCP process error:', error);
      reject(error);
    });

    mcp.on('close', (code) => {
      console.log(`MCP process closed with code ${code}`);
      mcpConnections.delete(sessionId);
    });

    mcpConnections.set(sessionId, connection);

    // Send initialization
    const initRequest = {
      jsonrpc: '2.0',
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: {
          name: 'rest-wrapper',
          version: '1.0.0'
        }
      },
      id: 0
    };

    sendRequest(connection, initRequest)
      .then(response => {
        connection.initialized = true;
        resolve({ sessionId, response });
      })
      .catch(reject);
  });
}

// Send request to MCP
function sendRequest(connection, request) {
  return new Promise((resolve, reject) => {
    const id = request.id ?? Math.floor(Math.random() * 1000000);
    request.id = id;

    connection.pendingRequests.set(id, { resolve, reject });
    
    connection.process.stdin.write(JSON.stringify(request) + '\n');

    // Timeout after 30 seconds
    setTimeout(() => {
      if (connection.pendingRequests.has(id)) {
        connection.pendingRequests.delete(id);
        reject(new Error('Request timeout'));
      }
    }, 30000);
  });
}

// REST API Routes

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    sessions: mcpConnections.size,
    timestamp: new Date().toISOString()
  });
});

// Create new session
app.post('/sessions', async (req, res) => {
  try {
    const sessionId = uuidv4();
    const result = await initializeMCPConnection(sessionId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// List tools
app.get('/sessions/:sessionId/tools', async (req, res) => {
  const connection = mcpConnections.get(req.params.sessionId);
  if (!connection) {
    return res.status(404).json({ error: 'Session not found' });
  }

  try {
    const response = await sendRequest(connection, {
      jsonrpc: '2.0',
      method: 'list_tools',
      params: {}
    });
    res.json(response);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Call tool
app.post('/sessions/:sessionId/tools/:toolName', async (req, res) => {
  const connection = mcpConnections.get(req.params.sessionId);
  if (!connection) {
    return res.status(404).json({ error: 'Session not found' });
  }

  try {
    const response = await sendRequest(connection, {
      jsonrpc: '2.0',
      method: 'call_tool',
      params: {
        name: req.params.toolName,
        arguments: req.body
      }
    });
    res.json(response);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Generic MCP request (for advanced use)
app.post('/sessions/:sessionId/request', async (req, res) => {
  const connection = mcpConnections.get(req.params.sessionId);
  if (!connection) {
    return res.status(404).json({ error: 'Session not found' });
  }

  try {
    const response = await sendRequest(connection, req.body);
    res.json(response);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Close session
app.delete('/sessions/:sessionId', (req, res) => {
  const connection = mcpConnections.get(req.params.sessionId);
  if (!connection) {
    return res.status(404).json({ error: 'Session not found' });
  }

  connection.process.kill();
  mcpConnections.delete(req.params.sessionId);
  res.json({ message: 'Session closed' });
});

// Start server
const PORT = process.env.REST_PORT || 3000;
app.listen(PORT, () => {
  console.log(`MCP REST wrapper listening on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});

// Cleanup on exit
process.on('SIGINT', () => {
  console.log('Shutting down...');
  for (const [sessionId, connection] of mcpConnections) {
    connection.process.kill();
  }
  process.exit(0);
});