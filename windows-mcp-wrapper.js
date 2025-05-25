#!/usr/bin/env node
// Wrapper script that sets environment variables before launching the proxy

process.env.MCP_SSE_URL = 'http://192.168.10.100:3001/sse';
process.env.API_ACCESS_TOKEN = '75bf9cbcf951ed970c96431f77985d7588d1229d5b3f29e0555a177f628f55d5';

// Import and run the proxy client
import('./mcp-proxy-client.js');