// Central tool loader and manager

import { z } from 'zod';
import { ansibleToolDefinitions, ansibleToolHandlers } from './ansible-tools.js';
import { ansibleEnhancedToolDefinitions, ansibleEnhancedToolHandlers } from './ansible-enhanced-tools.js';
import { terraformToolDefinitions, terraformToolHandlers } from './terraform-tools.js';
import { infrastructureToolDefinitions, infrastructureToolHandlers } from './infrastructure-tools.js';
import { serviceToolDefinitions, serviceToolHandlers } from './service-tools.js';
import { environmentToolDefinitions, environmentToolHandlers } from './environment-tools.js';
import { externalServerToolDefinitions, externalServerToolHandlers } from './external-server-tools.js';
import { hardwareToolDefinitions, hardwareToolHandlers } from './hardware-discovery-tools.js';
import { securityTools } from '../security-tools.js';
import { serverManagementTools } from '../server-management-tools.js';
import { setupTools } from '../setup-tools.js';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Tool registry for dynamic loading/unloading
class ToolRegistry {
  constructor() {
    this.tools = new Map();
    this.handlers = new Map();
    this.serviceTools = new Map(); // Tools specific to services
    this.contextStore = new Map(); // Persistent context storage
    this.contextFile = path.join(__dirname, '../../.mcp-context.json');
    
    // Load persistent context
    this.loadContext();
  }

  async loadContext() {
    try {
      const data = await fs.readFile(this.contextFile, 'utf8');
      const context = JSON.parse(data);
      this.contextStore = new Map(Object.entries(context));
    } catch (error) {
      // Context file doesn't exist yet, that's okay
      this.contextStore = new Map();
    }
  }

  async saveContext() {
    const context = Object.fromEntries(this.contextStore);
    await fs.writeFile(this.contextFile, JSON.stringify(context, null, 2));
  }

  async setContext(key, value) {
    this.contextStore.set(key, value);
    await this.saveContext();
  }

  getContext(key) {
    return this.contextStore.get(key);
  }

  getAllContext() {
    return Object.fromEntries(this.contextStore);
  }

  // Register a set of tools
  registerTools(definitions, handlers) {
    definitions.forEach(def => {
      this.tools.set(def.name, def);
    });
    
    Object.entries(handlers).forEach(([name, handler]) => {
      this.handlers.set(name, handler);
    });
  }

  // Register service-specific tools
  registerServiceTools(serviceName, definitions, handlers) {
    if (!this.serviceTools.has(serviceName)) {
      this.serviceTools.set(serviceName, {
        definitions: [],
        handlers: new Map()
      });
    }
    
    const service = this.serviceTools.get(serviceName);
    service.definitions.push(...definitions);
    
    Object.entries(handlers).forEach(([name, handler]) => {
      service.handlers.set(name, handler);
    });
    
    // Also register in main registry
    this.registerTools(definitions, handlers);
  }

  // Unload service-specific tools
  unloadServiceTools(serviceName) {
    const service = this.serviceTools.get(serviceName);
    if (!service) return;
    
    // Remove from main registry
    service.definitions.forEach(def => {
      this.tools.delete(def.name);
      this.handlers.delete(def.name);
    });
    
    this.serviceTools.delete(serviceName);
  }

  // Load tools from a file dynamically
  async loadToolModule(modulePath) {
    try {
      const module = await import(modulePath);
      if (module.toolDefinitions && module.toolHandlers) {
        this.registerTools(module.toolDefinitions, module.toolHandlers);
        return true;
      }
      return false;
    } catch (error) {
      console.error(`Failed to load tool module ${modulePath}:`, error);
      return false;
    }
  }

  // Get all registered tool definitions
  getAllDefinitions() {
    return Array.from(this.tools.values());
  }

  // Get handler for a specific tool
  getHandler(toolName) {
    return this.handlers.get(toolName);
  }

  // Check if a tool exists
  hasTool(toolName) {
    return this.tools.has(toolName);
  }

  // List loaded service modules
  getLoadedServices() {
    return Array.from(this.serviceTools.keys());
  }
}

// Create singleton instance
const toolRegistry = new ToolRegistry();

// Register core tools
toolRegistry.registerTools(ansibleToolDefinitions, ansibleToolHandlers);
toolRegistry.registerTools(ansibleEnhancedToolDefinitions, ansibleEnhancedToolHandlers);
toolRegistry.registerTools(terraformToolDefinitions, terraformToolHandlers);
toolRegistry.registerTools(infrastructureToolDefinitions, infrastructureToolHandlers);
toolRegistry.registerTools(serviceToolDefinitions, serviceToolHandlers);
toolRegistry.registerTools(environmentToolDefinitions, environmentToolHandlers);
toolRegistry.registerTools(externalServerToolDefinitions, externalServerToolHandlers);
toolRegistry.registerTools(hardwareToolDefinitions, hardwareToolHandlers);

// Register legacy tools (already have JSON Schema format)
const legacySecurityTools = securityTools.map(tool => ({
  name: tool.name,
  description: tool.description,
  inputSchema: tool.inputSchema // Already JSON Schema
}));

const legacySecurityHandlers = Object.fromEntries(
  securityTools.map(tool => [tool.name, tool.handler])
);

toolRegistry.registerTools(legacySecurityTools, legacySecurityHandlers);

// Register server management tools (already have JSON Schema format)
const legacyServerTools = serverManagementTools.map(tool => ({
  name: tool.name,
  description: tool.description,
  inputSchema: tool.inputSchema // Already JSON Schema
}));

const legacyServerHandlers = Object.fromEntries(
  serverManagementTools.map(tool => [tool.name, tool.handler])
);

toolRegistry.registerTools(legacyServerTools, legacyServerHandlers);

// Register setup tools (already have JSON Schema format)
const legacySetupTools = setupTools.map(tool => ({
  name: tool.name,
  description: tool.description,
  inputSchema: tool.inputSchema // Already JSON Schema
}));

const legacySetupHandlers = Object.fromEntries(
  setupTools.map(tool => [tool.name, tool.handler])
);

toolRegistry.registerTools(legacySetupTools, legacySetupHandlers);

// Export registry and helper functions
export { toolRegistry };

// Helper function to load service-specific tools
export async function loadServiceTools(serviceName) {
  const toolsPath = path.join(__dirname, 'services', `${serviceName}-tools.js`);
  
  try {
    const module = await import(toolsPath);
    if (module.toolDefinitions && module.toolHandlers) {
      toolRegistry.registerServiceTools(serviceName, module.toolDefinitions, module.toolHandlers);
      
      // Store in context that this service has tools loaded
      const loadedServices = toolRegistry.getContext('loadedServices') || [];
      if (!loadedServices.includes(serviceName)) {
        loadedServices.push(serviceName);
        await toolRegistry.setContext('loadedServices', loadedServices);
      }
      
      return true;
    }
  } catch (error) {
    // Service-specific tools don't exist yet
    return false;
  }
}

// Context management tools
export const contextTools = [
  {
    name: 'get-mcp-context',
    description: 'Get stored context information from MCP',
    inputSchema: zodToJsonSchema(z.object({
      key: z.string().optional().describe('Specific key to retrieve, or omit for all context')
    })),
    handler: async ({ key }) => {
      const context = key ? toolRegistry.getContext(key) : toolRegistry.getAllContext();
      return {
        success: true,
        output: JSON.stringify(context, null, 2),
        error: ''
      };
    }
  },
  {
    name: 'set-mcp-context',
    description: 'Store context information in MCP for future sessions',
    inputSchema: zodToJsonSchema(z.object({
      key: z.string().describe('Context key'),
      value: z.any().describe('Value to store')
    })),
    handler: async ({ key, value }) => {
      await toolRegistry.setContext(key, value);
      return {
        success: true,
        output: `Stored context: ${key}`,
        error: ''
      };
    }
  },
  {
    name: 'load-service-tools',
    description: 'Load tools specific to a service',
    inputSchema: zodToJsonSchema(z.object({
      serviceName: z.string().describe('Name of the service (e.g., pihole, nextcloud)')
    })),
    handler: async ({ serviceName }) => {
      const loaded = await loadServiceTools(serviceName);
      if (loaded) {
        return {
          success: true,
          output: `Loaded tools for ${serviceName}`,
          error: ''
        };
      } else {
        return {
          success: false,
          output: '',
          error: `No tools found for service: ${serviceName}`
        };
      }
    }
  },
  {
    name: 'unload-service-tools',
    description: 'Unload tools specific to a service',
    inputSchema: zodToJsonSchema(z.object({
      serviceName: z.string().describe('Name of the service')
    })),
    handler: async ({ serviceName }) => {
      toolRegistry.unloadServiceTools(serviceName);
      
      // Update context
      const loadedServices = toolRegistry.getContext('loadedServices') || [];
      const filtered = loadedServices.filter(s => s !== serviceName);
      await toolRegistry.setContext('loadedServices', filtered);
      
      return {
        success: true,
        output: `Unloaded tools for ${serviceName}`,
        error: ''
      };
    }
  },
  {
    name: 'list-loaded-tools',
    description: 'List all currently loaded tools and services',
    inputSchema: zodToJsonSchema(z.object({})),
    handler: async () => {
      const allTools = toolRegistry.getAllDefinitions();
      const loadedServices = toolRegistry.getLoadedServices();
      
      const output = {
        totalTools: allTools.length,
        loadedServices,
        toolsByCategory: {
          ansible: allTools.filter(t => t.name.startsWith('ansible-')).map(t => t.name),
          terraform: allTools.filter(t => t.name.startsWith('terraform-')).map(t => t.name),
          security: allTools.filter(t => t.name.startsWith('security-')).map(t => t.name),
          infrastructure: allTools.filter(t => t.name.includes('discover') || t.name.includes('inventory')).map(t => t.name),
          service: allTools.filter(t => t.name.includes('service') || t.name.includes('deploy')).map(t => t.name),
          other: allTools.filter(t => 
            !t.name.startsWith('ansible-') && 
            !t.name.startsWith('terraform-') && 
            !t.name.startsWith('security-') &&
            !t.name.includes('discover') &&
            !t.name.includes('inventory') &&
            !t.name.includes('service') &&
            !t.name.includes('deploy')
          ).map(t => t.name)
        }
      };
      
      return {
        success: true,
        output: JSON.stringify(output, null, 2),
        error: ''
      };
    }
  }
];

// Register context tools
const contextToolDefinitions = contextTools.map(tool => ({
  name: tool.name,
  description: tool.description,
  inputSchema: tool.inputSchema
}));

const contextToolHandlers = Object.fromEntries(
  contextTools.map(tool => [tool.name, tool.handler])
);

toolRegistry.registerTools(contextToolDefinitions, contextToolHandlers);