#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { ensureDefaultConfig } from './setup-tools.js';
import { toolRegistry, loadServiceTools } from './tools/index.js';

// Force stdout to be unbuffered
if (process.stdout._handle && process.stdout._handle.setBlocking) {
  process.stdout._handle.setBlocking(true);
}

// Ensure default config exists
await ensureDefaultConfig();

// Load environment variables
dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Create MCP server instance
const server = new Server(
  {
    name: 'ansible-mcp-server',
    version: '1.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Load all available tools
async function initializeTools() {
  const loadedServices = toolRegistry.getContext('loadedServices') || [];
  for (const service of loadedServices) {
    await loadServiceTools(service);
  }
  
  console.error(`Initialized with ${toolRegistry.getAllDefinitions().length} tools`);
  console.error(`Loaded service modules: ${loadedServices.join(', ') || 'none'}`);
}

// Register handlers
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: toolRegistry.getAllDefinitions(),
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  try {
    const handler = toolRegistry.getHandler(name);
    if (!handler) {
      throw new Error(`Unknown tool: ${name}`);
    }
    
    const result = await handler(args || {});
    
    return {
      content: [
        {
          type: 'text',
          text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error.message}`,
        },
      ],
    };
  }
});

// Error handler
server.onerror = (error) => {
  console.error('[MCP Error]', error);
};

// Main function
async function main() {
  // Initialize tools
  await initializeTools();
  
  // Connect transport
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  // Force stdout flushing after connection
  const originalStdoutWrite = process.stdout.write.bind(process.stdout);
  process.stdout.write = function(chunk, encoding, callback) {
    const result = originalStdoutWrite(chunk, encoding, callback);
    // Force flush after each write
    if (process.stdout._handle && process.stdout._handle.flush) {
      process.stdout._handle.flush();
    }
    return result;
  };
  
  console.error('Ansible MCP server running on stdio');
  console.error(`Loaded ${toolRegistry.getAllDefinitions().length} tools`);
  
  // Save current infrastructure context
  const infrastructureContext = toolRegistry.getContext('infrastructure') || {};
  infrastructureContext.lastStarted = new Date().toISOString();
  infrastructureContext.version = '1.1.0';
  await toolRegistry.setContext('infrastructure', infrastructureContext);
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});