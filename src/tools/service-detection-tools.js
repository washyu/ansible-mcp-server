// Service detection and duplicate handling tools

import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

// Schemas
const DetectServiceSchema = z.object({
  serviceName: z.string().describe('Service to search for (e.g., ollama, docker, nginx)'),
  searchMethod: z.enum(['name', 'port', 'both']).optional().default('both'),
  port: z.number().optional().describe('Port number to check if searchMethod includes port')
});

const HandleDuplicateServiceSchema = z.object({
  serviceName: z.string().describe('Service name'),
  existingVm: z.object({
    vmid: z.string(),
    name: z.string(),
    ip: z.string()
  }),
  action: z.enum(['replace', 'update', 'new_instance', 'use_existing', 'cancel']),
  options: z.object({
    models: z.array(z.string()).optional().describe('For Ollama: models to install/update'),
    port: z.number().optional().describe('For new instance: alternative port'),
    suffix: z.string().optional().describe('For new instance: name suffix')
  }).optional()
});

// Helper functions
async function searchForService(inventory, serviceName, port) {
  const matches = [];
  
  if (inventory.vms && Array.isArray(inventory.vms)) {
    inventory.vms.forEach(vm => {
      // Search by name
      if (vm.name && vm.name.toLowerCase().includes(serviceName.toLowerCase())) {
        matches.push({
          vmid: vm.vmid,
          name: vm.name,
          ip: vm.ip || 'unknown',
          status: vm.status,
          matchType: 'name',
          cores: vm.cores,
          memory: vm.memory
        });
      }
    });
  }
  
  // In real implementation, would also check ports via network scan
  // For now, we'll check context for known services
  
  return matches;
}

async function getServiceDetails(vmInfo, serviceName) {
  const details = {
    ...vmInfo,
    serviceStatus: 'unknown',
    version: 'unknown',
    additionalInfo: {}
  };
  
  // Service-specific details
  if (serviceName === 'ollama') {
    details.port = 11434;
    details.endpoint = `http://${vmInfo.ip}:11434`;
    details.additionalInfo = {
      models: ['llama2', 'codellama'], // Would query via API in real implementation
      apiDocs: `${details.endpoint}/docs`
    };
  }
  
  return details;
}

// Tool handlers
const serviceDetectionTools = [
  {
    name: 'detect-existing-service',
    description: 'Detect if a service is already installed in the infrastructure',
    inputSchema: DetectServiceSchema,
    handler: async (args, { registry }) => {
      try {
        const { serviceName, searchMethod, port } = args;
        
        // Load current inventory
        const inventoryPath = require('path').join(process.cwd(), 'inventory', 'proxmox-resources.json');
        let inventory = {};
        try {
          const data = await require('fs').promises.readFile(inventoryPath, 'utf8');
          inventory = JSON.parse(data);
        } catch {
          return {
            success: false,
            output: '',
            error: 'No inventory found. Run proxmox-inventory refresh first.'
          };
        }
        
        // Search for service
        const matches = await searchForService(inventory, serviceName, port);
        
        // Get detailed info for each match
        const detailedMatches = await Promise.all(
          matches.map(match => getServiceDetails(match, serviceName))
        );
        
        const result = {
          serviceName,
          found: matches.length > 0,
          count: matches.length,
          instances: detailedMatches,
          recommendation: matches.length > 0 ? 
            'Service already exists. Use handle-duplicate-service to decide action.' :
            'No existing service found. Safe to create new instance.'
        };
        
        // If service found, prepare prompt
        if (matches.length > 0) {
          const primary = detailedMatches[0];
          result.userPrompt = `Found existing ${serviceName} server:
- VM: ${primary.name} (ID: ${primary.vmid})
- IP: ${primary.ip}
- Status: ${primary.status}
- Resources: ${primary.cores} cores, ${Math.round(primary.memory / 1024 / 1024 / 1024)}GB RAM
${serviceName === 'ollama' ? `- Models: ${primary.additionalInfo.models.join(', ')}` : ''}

Options:
1. replace - Delete this VM and create new one
2. update - Keep VM, update configuration/models
3. new_instance - Create additional instance
4. use_existing - Use as-is
5. cancel - Cancel operation

What would you like to do?`;
        }
        
        return {
          success: true,
          output: JSON.stringify(result, null, 2),
          error: ''
        };
      } catch (error) {
        return {
          success: false,
          output: '',
          error: error.message
        };
      }
    }
  },

  {
    name: 'handle-duplicate-service',
    description: 'Handle user decision for duplicate service',
    inputSchema: HandleDuplicateServiceSchema,
    handler: async (args, { registry }) => {
      try {
        const { serviceName, existingVm, action, options = {} } = args;
        let workflow = [];
        let result = {};
        
        switch (action) {
          case 'replace':
            workflow = [
              `Stop ${serviceName} service on ${existingVm.name}`,
              'Backup any persistent data',
              `Delete VM ${existingVm.vmid}`,
              'Create new VM with updated specifications',
              `Install ${serviceName} fresh`,
              'Restore data if applicable'
            ];
            result.nextCommand = 'delete-vm vmid=' + existingVm.vmid;
            break;
            
          case 'update':
            if (serviceName === 'ollama' && options.models) {
              workflow = [
                `Connect to ${existingVm.name}`,
                'Check current models: ollama list',
                `Pull new models: ${options.models.map(m => `ollama pull ${m}`).join(', ')}`,
                'Verify models loaded',
                'No VM changes needed'
              ];
              result.commands = [
                `ssh ${existingVm.ip} "ollama list"`,
                ...options.models.map(m => `ssh ${existingVm.ip} "ollama pull ${m}"`)
              ];
            } else {
              workflow = [
                `Connect to ${existingVm.name}`,
                `Update ${serviceName} configuration`,
                'Restart service if needed'
              ];
            }
            result.vmAction = 'none';
            break;
            
          case 'new_instance':
            const suffix = options.suffix || '2';
            const newName = `${serviceName}-${suffix}`;
            workflow = [
              `Create new VM named ${newName}`,
              `Install ${serviceName}`,
              options.port ? `Configure on port ${options.port}` : 'Use default port',
              'Set up load balancing if needed'
            ];
            result.newVmName = newName;
            result.port = options.port || (serviceName === 'ollama' ? 11434 : null);
            break;
            
          case 'use_existing':
            workflow = [
              'No changes needed',
              `Using existing ${serviceName} at ${existingVm.ip}`,
              'Test service connectivity'
            ];
            result.endpoint = serviceName === 'ollama' ? 
              `http://${existingVm.ip}:11434` : 
              `http://${existingVm.ip}`;
            result.testCommand = serviceName === 'ollama' ?
              `curl ${result.endpoint}/api/tags` :
              `curl ${result.endpoint}`;
            break;
            
          case 'cancel':
            workflow = ['Operation cancelled by user'];
            result.cancelled = true;
            break;
        }
        
        result.action = action;
        result.workflow = workflow;
        result.serviceName = serviceName;
        result.existingVm = existingVm;
        
        // Update context with decision
        await registry.setContext(`service_decisions.${serviceName}.last_action`, {
          action,
          timestamp: new Date().toISOString(),
          existingVm,
          options
        });
        
        return {
          success: true,
          output: JSON.stringify(result, null, 2),
          error: ''
        };
      } catch (error) {
        return {
          success: false,
          output: '',
          error: error.message
        };
      }
    }
  },

  {
    name: 'update-ollama-models',
    description: 'Update models on existing Ollama server',
    inputSchema: z.object({
      vmIp: z.string().describe('IP address of Ollama VM'),
      action: z.enum(['list', 'pull', 'delete']).describe('Action to perform'),
      models: z.array(z.string()).optional().describe('Models to pull or delete')
    }),
    handler: async (args) => {
      try {
        const { vmIp, action, models = [] } = args;
        let commands = [];
        let result = {};
        
        switch (action) {
          case 'list':
            commands = [`curl -s http://${vmIp}:11434/api/tags | jq '.models[].name'`];
            result.description = 'List current models';
            break;
            
          case 'pull':
            commands = models.map(model => 
              `ssh ubuntu@${vmIp} "ollama pull ${model}"`
            );
            result.description = `Pull models: ${models.join(', ')}`;
            result.estimatedTime = `${models.length * 5} minutes (varies by model size)`;
            break;
            
          case 'delete':
            commands = models.map(model => 
              `ssh ubuntu@${vmIp} "ollama rm ${model}"`
            );
            result.description = `Delete models: ${models.join(', ')}`;
            break;
        }
        
        result.commands = commands;
        result.note = 'Execute these commands to perform the action';
        
        return {
          success: true,
          output: JSON.stringify(result, null, 2),
          error: ''
        };
      } catch (error) {
        return {
          success: false,
          output: '',
          error: error.message
        };
      }
    }
  }
];

// Export tools with proper schema conversion
export const serviceDetectionToolDefinitions = serviceDetectionTools.map(tool => ({
  name: tool.name,
  description: tool.description,
  inputSchema: zodToJsonSchema(tool.inputSchema)
}));

export const serviceDetectionToolHandlers = Object.fromEntries(
  serviceDetectionTools.map(tool => [tool.name, async (args) => {
    const { toolRegistry } = await import('./index.js');
    return tool.handler(args, { registry: toolRegistry });
  }])
);