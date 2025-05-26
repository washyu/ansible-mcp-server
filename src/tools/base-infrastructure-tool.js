// Base Infrastructure Tool Class with Automatic Context Management

import { promises as fs } from 'fs';
import path from 'path';

export class BaseInfrastructureTool {
  constructor(name, description, inputSchema) {
    this.name = name;
    this.description = description;
    this.inputSchema = inputSchema;
    this.contextPath = path.join(process.cwd(), '.mcp-context.json');
  }

  // Abstract method - must be implemented by subclasses
  async executeAction(validatedArgs) {
    throw new Error(`executeAction must be implemented by ${this.constructor.name}`);
  }

  // Abstract method - must be implemented by subclasses  
  getContextUpdates(validatedArgs, actionResult) {
    throw new Error(`getContextUpdates must be implemented by ${this.constructor.name}`);
  }

  // Main handler that orchestrates action + context updates
  async handler(args) {
    try {
      // 1. Validate arguments
      const validatedArgs = this.inputSchema.parse(args);
      
      // 2. Execute the actual action
      const actionResult = await this.executeAction(validatedArgs);
      
      // 3. If action succeeded, update context
      if (actionResult.success) {
        const contextUpdates = this.getContextUpdates(validatedArgs, actionResult);
        await this.updateContext(contextUpdates);
      }
      
      return actionResult;
    } catch (error) {
      return {
        success: false,
        error: error.message,
        output: ''
      };
    }
  }

  // Context management methods
  async loadContext() {
    try {
      const data = await fs.readFile(this.contextPath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      // Return minimal context structure if file doesn't exist
      return {
        infrastructure: {
          lastUpdated: new Date().toISOString(),
          nodes: {},
          services: {},
          ipAllocation: {}
        }
      };
    }
  }

  async saveContext(context) {
    context.infrastructure.lastUpdated = new Date().toISOString();
    await fs.writeFile(this.contextPath, JSON.stringify(context, null, 2));
  }

  async updateContext(updates) {
    const context = await this.loadContext();
    
    for (const update of updates) {
      switch (update.action) {
        case 'set':
          this.setNestedProperty(context, update.path, update.value);
          break;
        case 'remove':
          this.removeNestedProperty(context, update.path);
          break;
        case 'merge':
          this.mergeNestedProperty(context, update.path, update.value);
          break;
        case 'append':
          this.appendToArray(context, update.path, update.value);
          break;
      }
    }
    
    await this.saveContext(context);
  }

  // Helper methods for nested property manipulation
  setNestedProperty(obj, path, value) {
    const keys = path.split('.');
    let current = obj;
    
    for (let i = 0; i < keys.length - 1; i++) {
      if (!(keys[i] in current)) {
        current[keys[i]] = {};
      }
      current = current[keys[i]];
    }
    
    current[keys[keys.length - 1]] = value;
  }

  removeNestedProperty(obj, path) {
    const keys = path.split('.');
    let current = obj;
    
    for (let i = 0; i < keys.length - 1; i++) {
      if (!(keys[i] in current)) {
        return; // Path doesn't exist
      }
      current = current[keys[i]];
    }
    
    delete current[keys[keys.length - 1]];
  }

  mergeNestedProperty(obj, path, value) {
    const existing = this.getNestedProperty(obj, path) || {};
    this.setNestedProperty(obj, path, { ...existing, ...value });
  }

  appendToArray(obj, path, value) {
    const existing = this.getNestedProperty(obj, path) || [];
    if (!Array.isArray(existing)) {
      throw new Error(`Path ${path} is not an array`);
    }
    existing.push(value);
    this.setNestedProperty(obj, path, existing);
  }

  getNestedProperty(obj, path) {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  // Utility methods for common context operations
  static createVMContextUpdate(vmId, vmName, ip, service, status = 'running') {
    return [
      {
        action: 'set',
        path: `infrastructure.ipAllocation.${ip}`,
        value: {
          type: 'vm',
          name: vmName,
          vmid: vmId,
          service: service,
          status: status,
          created: new Date().toISOString()
        }
      },
      {
        action: 'set',
        path: `infrastructure.services.${service}`,
        value: {
          ip: ip,
          vmid: vmId,
          status: status,
          deployed: new Date().toISOString()
        }
      }
    ];
  }

  static createVMDeletionContextUpdate(ip, service) {
    return [
      {
        action: 'remove',
        path: `infrastructure.ipAllocation.${ip}`
      },
      {
        action: 'remove',
        path: `infrastructure.services.${service}`
      },
      {
        action: 'append',
        path: 'infrastructure.deploymentHistory',
        value: {
          timestamp: new Date().toISOString(),
          action: 'vm-deleted',
          ip: ip,
          service: service
        }
      }
    ];
  }

  static createServiceContextUpdate(service, config) {
    return [
      {
        action: 'merge',
        path: `infrastructure.services.${service}`,
        value: {
          ...config,
          lastUpdated: new Date().toISOString()
        }
      }
    ];
  }
}