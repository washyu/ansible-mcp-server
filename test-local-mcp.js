#!/usr/bin/env node
import { spawn } from 'child_process';
import { createInterface } from 'readline';

console.log('Testing local MCP server...');

const mcp = spawn('node', ['src/index.js'], {
  cwd: '/home/shaun/ansible-mcp-server',
  stdio: ['pipe', 'pipe', 'pipe']
});

const rl = createInterface({
  input: process.stdin,
  output: process.stdout
});

mcp.stdout.on('data', (data) => {
  console.log('MCP OUT:', data.toString());
});

mcp.stderr.on('data', (data) => {
  console.error('MCP ERR:', data.toString());
});

mcp.on('close', (code) => {
  console.log(`MCP process exited with code ${code}`);
  process.exit(code);
});

// Send initialization
const initMsg = JSON.stringify({
  "method": "initialize",
  "params": {
    "protocolVersion": "2024-11-05",
    "capabilities": {},
    "clientInfo": {
      "name": "claude-ai",
      "version": "0.1.0"
    }
  },
  "jsonrpc": "2.0",
  "id": 0
});

setTimeout(() => {
  console.log('Sending:', initMsg);
  mcp.stdin.write(initMsg + '\n');
}, 100);

// Keep process alive
setTimeout(() => {
  console.log('Test complete');
  process.exit(0);
}, 2000);