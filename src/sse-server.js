#!/usr/bin/env node
// SSE (Server-Sent Events) server for MCP
// This provides a stable network transport for Claude Desktop via mcp-proxy

import express from 'express';
import { spawn } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(express.json());

// Store active MCP processes
const mcpSessions = new Map();

// CORS for SSE
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Cache-Control', 'no-cache');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Simple auth middleware
const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token !== process.env.API_ACCESS_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

// SSE endpoint for MCP communication
app.get('/sse', authenticate, (req, res) => {
  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no' // Disable Nginx buffering
  });

  const sessionId = uuidv4();
  console.log(`New SSE connection: ${sessionId}`);

  // Spawn MCP server with proper PATH
  const mcpEnv = {
    ...process.env,
    MCP_SESSION_ID: sessionId,
    // Ensure PATH includes common binary locations
    PATH: `/usr/local/bin:/usr/bin:/bin:${process.env.PATH || ''}`,
    // Ensure we can find Python for Ansible
    PYTHONPATH: '/usr/local/lib/python3.10/dist-packages'
  };
  
  const mcp = spawn('node', ['src/index.js'], {
    cwd: process.cwd(),
    stdio: ['pipe', 'pipe', 'pipe'],
    env: mcpEnv
  });

  const session = {
    process: mcp,
    response: res,
    buffer: ''
  };

  mcpSessions.set(sessionId, session);

  // Send session ID to client
  res.write(`data: ${JSON.stringify({ type: 'session', sessionId })}\n\n`);

  // Handle MCP stdout
  mcp.stdout.on('data', (data) => {
    const chunk = data.toString();
    console.log(`MCP stdout [${sessionId}]:`, chunk);
    session.buffer += chunk;
    
    // Parse complete JSON messages
    const lines = session.buffer.split('\n');
    session.buffer = lines.pop() || '';
    
    for (const line of lines) {
      if (line.trim()) {
        try {
          const message = JSON.parse(line);
          console.log(`Sending to client [${sessionId}]:`, message);
          res.write(`data: ${JSON.stringify({ type: 'message', data: message })}\n\n`);
        } catch (e) {
          console.error('Failed to parse MCP output:', e, 'Line:', line);
        }
      }
    }
  });

  // Handle MCP stderr
  mcp.stderr.on('data', (data) => {
    const error = data.toString();
    console.error(`MCP stderr [${sessionId}]:`, error);
    res.write(`data: ${JSON.stringify({ type: 'error', error })}\n\n`);
  });

  // Handle MCP exit
  mcp.on('close', (code) => {
    console.log(`MCP process closed [${sessionId}] with code ${code}`);
    res.write(`data: ${JSON.stringify({ type: 'close', code })}\n\n`);
    res.end();
    mcpSessions.delete(sessionId);
  });

  // Handle client disconnect
  req.on('close', () => {
    console.log(`Client disconnected [${sessionId}]`);
    mcp.kill();
    mcpSessions.delete(sessionId);
  });

  // Keep connection alive
  const keepAlive = setInterval(() => {
    res.write(':keepalive\n\n');
  }, 30000);

  req.on('close', () => clearInterval(keepAlive));
});

// POST endpoint to send data to MCP
app.post('/sessions/:sessionId/input', authenticate, express.text({ type: '*/*' }), (req, res) => {
  const session = mcpSessions.get(req.params.sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  try {
    console.log(`Received input for session ${req.params.sessionId}:`, req.body);
    session.process.stdin.write(req.body + '\n');
    res.json({ success: true });
  } catch (error) {
    console.error(`Error writing to stdin [${req.params.sessionId}]:`, error);
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    sessions: mcpSessions.size,
    uptime: process.uptime()
  });
});

const PORT = process.env.SSE_PORT || 3001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`MCP SSE server listening on port ${PORT}`);
  console.log(`SSE endpoint: http://0.0.0.0:${PORT}/sse`);
  console.log(`Health check: http://0.0.0.0:${PORT}/health`);
});

// Cleanup on exit
process.on('SIGINT', () => {
  console.log('Shutting down SSE server...');
  for (const [id, session] of mcpSessions) {
    session.process.kill();
  }
  process.exit(0);
});