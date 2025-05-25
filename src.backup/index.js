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

// Initialize tool registry with previously loaded services
async function initializeTools() {
  const loadedServices = toolRegistry.getContext('loadedServices') || [];
  for (const service of loadedServices) {
    await loadServiceTools(service);
  }
  
  console.error(`Initialized with ${toolRegistry.getAllDefinitions().length} tools`);
  console.error(`Loaded service modules: ${loadedServices.join(', ') || 'none'}`);
}

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  const tools = toolRegistry.getAllDefinitions();
  
  return {
    tools: tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema
    }))
  };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    const handler = toolRegistry.getHandler(name);
    
    if (!handler) {
      throw new Error(`Unknown tool: ${name}`);
    }

    // Execute the tool handler
    const result = await handler(args);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: result.success !== false,
            output: result.output || '',
            error: result.error || '',
            exitCode: result.exitCode || (result.success === false ? 1 : 0)
          }, null, 2)
        }
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: error.message,
            details: error.stack
          }, null, 2)
        }
      ],
      isError: true,
    };
  }
});

async function main() {
  // Initialize tools
  await initializeTools();
  
  // Connect transport
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
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