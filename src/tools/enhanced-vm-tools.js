// Enhanced VM Tools with Automatic Context Management

import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { spawnCommand } from '../command-utils.js';
import { BaseInfrastructureTool } from './base-infrastructure-tool.js';

// Schemas
const DeleteVMSchema = z.object({
  vmId: z.number().describe('Proxmox VM ID to delete'),
  vmName: z.string().optional().describe('VM name for logging'),
  serviceName: z.string().describe('Service name to remove from context'),
  vmIP: z.string().describe('VM IP address to remove from context'),
  proxmoxHost: z.string().optional().default('192.168.10.200').describe('Proxmox host'),
  proxmoxNode: z.string().optional().default('proxmox').describe('Proxmox node name')
});

const CreateVMSchema = z.object({
  vmId: z.number().describe('Proxmox VM ID'),
  vmName: z.string().describe('VM name'),
  serviceName: z.string().describe('Service name'),
  vmIP: z.string().describe('Static IP address'),
  template: z.string().default('ubuntu-cloud').describe('VM template to use'),
  cores: z.number().default(2).describe('CPU cores'),
  memory: z.number().default(4096).describe('Memory in MB'),
  proxmoxHost: z.string().optional().default('192.168.10.200').describe('Proxmox host'),
  proxmoxNode: z.string().optional().default('proxmox').describe('Proxmox node name')
});

// Enhanced Delete VM Tool
class DeleteVMTool extends BaseInfrastructureTool {
  constructor() {
    super(
      'delete-vm-enhanced',
      'Delete VM from Proxmox and automatically update infrastructure context',
      DeleteVMSchema
    );
  }

  async executeAction(validatedArgs) {
    try {
      // Execute the ansible playbook to delete the VM
      const result = await spawnCommand('ansible-playbook', [
        '-i', 'localhost,',
        'playbooks/delete-vm-api.yml',
        '-e', `vm_id=${validatedArgs.vmId}`,
        '-e', `vm_name=${validatedArgs.vmName || 'unknown'}`,
        '-c', 'local'
      ], {
        cwd: process.cwd(),
        timeout: 300000 // 5 minutes
      });

      if (result.exitCode === 0) {
        return {
          success: true,
          output: `VM ${validatedArgs.vmId} (${validatedArgs.vmName}) deleted successfully`,
          error: ''
        };
      } else {
        return {
          success: false,
          output: result.stdout,
          error: result.stderr
        };
      }
    } catch (error) {
      return {
        success: false,
        output: '',
        error: error.message
      };
    }
  }

  getContextUpdates(validatedArgs, actionResult) {
    // Return context updates for successful VM deletion
    return BaseInfrastructureTool.createVMDeletionContextUpdate(
      validatedArgs.vmIP,
      validatedArgs.serviceName
    );
  }
}

// Enhanced Create VM Tool  
class CreateVMTool extends BaseInfrastructureTool {
  constructor() {
    super(
      'create-vm-enhanced',
      'Create VM in Proxmox and automatically update infrastructure context',
      CreateVMSchema
    );
  }

  async executeAction(validatedArgs) {
    try {
      // This would execute VM creation logic
      // For now, simulating with a placeholder
      const result = await spawnCommand('ansible-playbook', [
        '-i', 'localhost,',
        'playbooks/create-vm.yml', // Would need to create this
        '-e', `vm_id=${validatedArgs.vmId}`,
        '-e', `vm_name=${validatedArgs.vmName}`,
        '-e', `vm_ip=${validatedArgs.vmIP}`,
        '-e', `cores=${validatedArgs.cores}`,
        '-e', `memory=${validatedArgs.memory}`,
        '-c', 'local'
      ], {
        cwd: process.cwd(),
        timeout: 600000 // 10 minutes
      });

      if (result.exitCode === 0) {
        return {
          success: true,
          output: `VM ${validatedArgs.vmId} (${validatedArgs.vmName}) created successfully`,
          error: '',
          vmData: {
            vmId: validatedArgs.vmId,
            vmName: validatedArgs.vmName,
            ip: validatedArgs.vmIP,
            status: 'running'
          }
        };
      } else {
        return {
          success: false,
          output: result.stdout,
          error: result.stderr
        };
      }
    } catch (error) {
      return {
        success: false,
        output: '',
        error: error.message
      };
    }
  }

  getContextUpdates(validatedArgs, actionResult) {
    // Return context updates for successful VM creation
    return BaseInfrastructureTool.createVMContextUpdate(
      validatedArgs.vmId,
      validatedArgs.vmName,
      validatedArgs.vmIP,
      validatedArgs.serviceName,
      'running'
    );
  }
}

// Service Management Tool
const ServiceManagementSchema = z.object({
  serviceName: z.string().describe('Service name'),
  action: z.enum(['start', 'stop', 'restart', 'status']).describe('Action to perform'),
  vmIP: z.string().describe('VM IP address where service runs')
});

class ServiceManagementTool extends BaseInfrastructureTool {
  constructor() {
    super(
      'manage-service-enhanced',
      'Manage services and automatically update their status in context',
      ServiceManagementSchema
    );
  }

  async executeAction(validatedArgs) {
    try {
      // Execute service management via ansible
      const result = await spawnCommand('ansible', [
        validatedArgs.vmIP,
        '-m', 'systemd',
        '-a', `name=${validatedArgs.serviceName} state=${validatedArgs.action}`,
        '-i', `${validatedArgs.vmIP},`
      ], {
        cwd: process.cwd(),
        timeout: 60000
      });

      if (result.exitCode === 0) {
        return {
          success: true,
          output: `Service ${validatedArgs.serviceName} ${validatedArgs.action} completed`,
          error: '',
          serviceStatus: validatedArgs.action === 'stop' ? 'stopped' : 'running'
        };
      } else {
        return {
          success: false,
          output: result.stdout,
          error: result.stderr
        };
      }
    } catch (error) {
      return {
        success: false,
        output: '',
        error: error.message
      };
    }
  }

  getContextUpdates(validatedArgs, actionResult) {
    // Update service status in context
    return BaseInfrastructureTool.createServiceContextUpdate(
      validatedArgs.serviceName,
      {
        status: actionResult.serviceStatus,
        lastAction: validatedArgs.action,
        actionTimestamp: new Date().toISOString()
      }
    );
  }
}

// Create tool instances
const deleteVMTool = new DeleteVMTool();
const createVMTool = new CreateVMTool();
const serviceManagementTool = new ServiceManagementTool();

// Export tool definitions and handlers
export const enhancedVMToolDefinitions = [
  {
    name: deleteVMTool.name,
    description: deleteVMTool.description,
    inputSchema: zodToJsonSchema(deleteVMTool.inputSchema)
  },
  {
    name: createVMTool.name,
    description: createVMTool.description,
    inputSchema: zodToJsonSchema(createVMTool.inputSchema)
  },
  {
    name: serviceManagementTool.name,
    description: serviceManagementTool.description,
    inputSchema: zodToJsonSchema(serviceManagementTool.inputSchema)
  }
];

export const enhancedVMToolHandlers = {
  [deleteVMTool.name]: deleteVMTool.handler.bind(deleteVMTool),
  [createVMTool.name]: createVMTool.handler.bind(createVMTool),
  [serviceManagementTool.name]: serviceManagementTool.handler.bind(serviceManagementTool)
};