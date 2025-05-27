// Inventory deviation detection and management tools

import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { promises as fs } from 'fs';
import path from 'path';

// Schemas
const CompareInventorySchema = z.object({
  autoAlert: z.boolean().optional().default(true).describe('Automatically send alerts for deviations'),
  updateContext: z.boolean().optional().default(false).describe('Update context with findings')
});

const ProcessDeviationSchema = z.object({
  deviationType: z.enum(['new_vm', 'missing_vm', 'resource_change']).describe('Type of deviation'),
  vmId: z.string().describe('VM ID involved in deviation'),
  action: z.enum(['accept', 'reject', 'investigate', 'restore']).describe('Action to take'),
  details: z.object({
    purpose: z.string().optional(),
    owner: z.string().optional(),
    credentials: z.object({
      sshUser: z.string().optional(),
      sshKeyName: z.string().optional()
    }).optional(),
    recoveryMethod: z.enum(['backup', 'terraform', 'ansible', 'manual']).optional()
  }).optional()
});

const CheckNodeCapacitySchema = z.object({
  nodeName: z.string().describe('Node to check capacity for'),
  requestedResources: z.object({
    cores: z.number().describe('Number of CPU cores needed'),
    memoryMb: z.number().describe('Memory in MB needed'),
    diskGb: z.number().describe('Disk space in GB needed')
  })
});

const FindBestNodeSchema = z.object({
  requiredResources: z.object({
    cores: z.number(),
    memoryMb: z.number(),
    diskGb: z.number()
  }),
  preferences: z.object({
    preferredNode: z.string().optional(),
    avoidNodes: z.array(z.string()).optional(),
    requireGpu: z.boolean().optional().default(false)
  }).optional()
});

// Helper functions
async function loadInfrastructureState(registry) {
  const state = registry.getContext('infrastructure_state');
  if (!state) {
    return {
      vms: {},
      nodes: {},
      templates: {},
      lastUpdated: null
    };
  }
  return state;
}

async function loadCurrentInventory() {
  try {
    const inventoryPath = path.join(process.cwd(), 'inventory', 'proxmox-resources.json');
    const data = await fs.readFile(inventoryPath, 'utf8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

function compareInventories(contextState, liveInventory) {
  const deviations = {
    newVms: [],
    missingVms: [],
    resourceChanges: [],
    newTemplates: [],
    missingTemplates: [],
    unknownTemplates: []
  };

  // Check for new VMs in live inventory
  if (liveInventory.vms && Array.isArray(liveInventory.vms)) {
    liveInventory.vms.forEach(vm => {
      if (!vm.template && !contextState.vms[vm.vmid]) {
        deviations.newVms.push({
          vmid: vm.vmid,
          name: vm.name,
          node: vm.node,
          status: vm.status,
          cores: vm.cores,
          memory: vm.memory,
          disk: vm.disk
        });
      }
    });
  }

  // Check for missing VMs
  Object.entries(contextState.vms).forEach(([vmid, vmData]) => {
    const found = liveInventory.vms?.find(vm => vm.vmid == vmid);
    if (!found) {
      deviations.missingVms.push({
        vmid,
        ...vmData
      });
    } else {
      // Check for resource changes
      if (found.cores !== vmData.resources?.cores ||
          found.memory !== vmData.resources?.memory_mb) {
        deviations.resourceChanges.push({
          vmid,
          name: vmData.name,
          changes: {
            cores: { old: vmData.resources?.cores, new: found.cores },
            memory: { old: vmData.resources?.memory_mb, new: found.memory }
          }
        });
      }
    }
  });

  // Check templates
  if (liveInventory.templates && Array.isArray(liveInventory.templates)) {
    liveInventory.templates.forEach(template => {
      if (!contextState.templates || !contextState.templates[template.vmid]) {
        // Check if it has MCP metadata
        const metadata = contextState.templates?.[template.vmid]?.metadata;
        if (!metadata || metadata.mcp_compliant === undefined) {
          deviations.unknownTemplates.push({
            ...template,
            needs_validation: true,
            message: 'Unknown template found - needs validation for MCP compliance'
          });
        } else {
          deviations.newTemplates.push(template);
        }
      }
    });
  }

  // Check for missing templates
  if (contextState.templates) {
    Object.entries(contextState.templates).forEach(([templateId, templateData]) => {
      const found = liveInventory.templates?.find(t => t.vmid == templateId);
      if (!found && templateData.mcp_compliant) {
        deviations.missingTemplates.push({
          vmid: templateId,
          ...templateData
        });
      }
    });
  }

  return deviations;
}

function calculateNodeResources(node, vms) {
  let usedCores = 0;
  let usedMemory = 0;
  let usedStorage = 0;
  let vmCount = 0;

  vms.forEach(vm => {
    if (vm.node === node.node && vm.status === 'running') {
      usedCores += vm.cores || 0;
      usedMemory += vm.memory || 0;
      usedStorage += vm.disk || 0;
      vmCount++;
    }
  });

  const totalCores = node.maxcpu || 0;
  const totalMemory = node.maxmem || 0;
  const totalStorage = node.maxdisk || 0;

  return {
    total_cores: totalCores,
    total_memory_mb: Math.floor(totalMemory / 1024 / 1024),
    total_storage_gb: Math.floor(totalStorage / 1024 / 1024 / 1024),
    used_cores: usedCores,
    used_memory_mb: Math.floor(usedMemory / 1024 / 1024),
    used_storage_gb: Math.floor(usedStorage / 1024 / 1024 / 1024),
    available_cores: Math.max(0, totalCores - usedCores),
    available_memory_mb: Math.max(0, Math.floor((totalMemory - usedMemory) / 1024 / 1024)),
    available_storage_gb: Math.max(0, Math.floor((totalStorage - usedStorage) / 1024 / 1024 / 1024)),
    current_vms: vmCount,
    max_vms: 100, // Typical Proxmox limit
    resource_alerts: {
      cpu_warning: (usedCores / totalCores) > 0.8,
      cpu_critical: (usedCores / totalCores) > 0.9,
      memory_warning: (usedMemory / totalMemory) > 0.85,
      memory_critical: (usedMemory / totalMemory) > 0.95,
      storage_warning: (usedStorage / totalStorage) > 0.8,
      storage_critical: (usedStorage / totalStorage) > 0.9
    }
  };
}

// Tool handlers
const inventoryDeviationTools = [
  {
    name: 'compare-inventory-state',
    description: 'Compare context inventory with live Proxmox inventory and detect deviations',
    inputSchema: CompareInventorySchema,
    handler: async (args, { registry }) => {
      try {
        const { autoAlert, updateContext } = args;
        
        // Load context state
        const contextState = await loadInfrastructureState(registry);
        
        // Load current inventory
        const liveInventory = await loadCurrentInventory();
        if (!liveInventory) {
          return {
            success: false,
            output: '',
            error: 'No live inventory found. Run proxmox-inventory refresh first.'
          };
        }
        
        // Compare inventories
        const deviations = compareInventories(contextState, liveInventory);
        
        // Generate alerts if needed
        const alerts = [];
        if (autoAlert) {
          deviations.newVms.forEach(vm => {
            alerts.push({
              type: 'new_vm_detected',
              severity: 'warning',
              vm,
              message: `New VM detected: ${vm.name} (ID: ${vm.vmid}) on node ${vm.node}`
            });
          });
          
          deviations.missingVms.forEach(vm => {
            alerts.push({
              type: 'vm_missing',
              severity: 'critical',
              vm,
              message: `VM missing: ${vm.name} (ID: ${vm.vmid}) last seen ${vm.last_seen}`
            });
          });
        }
        
        // Update node resources
        const nodeResources = {};
        if (liveInventory.nodes && liveInventory.vms) {
          liveInventory.nodes.forEach(node => {
            nodeResources[node.node] = calculateNodeResources(node, liveInventory.vms);
          });
        }
        
        const result = {
          deviations,
          alerts,
          nodeResources,
          summary: {
            newVms: deviations.newVms.length,
            missingVms: deviations.missingVms.length,
            resourceChanges: deviations.resourceChanges.length,
            newTemplates: deviations.newTemplates.length
          }
        };
        
        if (updateContext) {
          await registry.setContext('last_deviation_check', {
            timestamp: new Date().toISOString(),
            deviations: result.deviations
          });
          await registry.setContext('node_resources', nodeResources);
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
    name: 'process-deviation',
    description: 'Process a specific inventory deviation with user decision',
    inputSchema: ProcessDeviationSchema,
    handler: async (args, { registry }) => {
      try {
        const { deviationType, vmId, action, details } = args;
        const contextState = await loadInfrastructureState(registry);
        
        let result = {};
        
        switch (deviationType) {
          case 'new_vm':
            if (action === 'accept') {
              // Add VM to context
              const liveInventory = await loadCurrentInventory();
              const vm = liveInventory.vms?.find(v => v.vmid == vmId);
              
              if (vm) {
                contextState.vms[vmId] = {
                  name: vm.name,
                  node: vm.node,
                  status: vm.status,
                  purpose: details?.purpose || 'Unknown',
                  owner: details?.owner || 'Unknown',
                  created_date: new Date().toISOString(),
                  last_seen: new Date().toISOString(),
                  resources: {
                    cores: vm.cores,
                    memory_mb: vm.memory,
                    disk_gb: Math.floor(vm.disk / 1024 / 1024 / 1024)
                  },
                  credentials: details?.credentials || {},
                  verified: true
                };
                
                await registry.setContext('infrastructure_state', contextState);
                result.message = `VM ${vm.name} added to tracked inventory`;
              }
            } else if (action === 'reject') {
              result.message = `VM ${vmId} flagged as unauthorized`;
              result.recommendation = 'Investigate and potentially remove VM';
            }
            break;
            
          case 'missing_vm':
            if (action === 'accept') {
              // Remove from context
              delete contextState.vms[vmId];
              await registry.setContext('infrastructure_state', contextState);
              result.message = `VM ${vmId} removed from tracking`;
            } else if (action === 'restore') {
              result.message = `Initiating restore for VM ${vmId}`;
              result.recoveryMethod = details?.recoveryMethod || 'manual';
              result.nextSteps = [
                'Locate backup or infrastructure code',
                'Execute recovery procedure',
                'Verify VM functionality'
              ];
            }
            break;
            
          case 'resource_change':
            // Update resources in context
            const liveInventory = await loadCurrentInventory();
            const vm = liveInventory.vms?.find(v => v.vmid == vmId);
            if (vm && contextState.vms[vmId]) {
              contextState.vms[vmId].resources = {
                cores: vm.cores,
                memory_mb: vm.memory,
                disk_gb: Math.floor(vm.disk / 1024 / 1024 / 1024)
              };
              contextState.vms[vmId].last_seen = new Date().toISOString();
              await registry.setContext('infrastructure_state', contextState);
              result.message = `Updated resources for VM ${vmId}`;
            }
            break;
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
    name: 'check-node-capacity',
    description: 'Check if a node has capacity for requested resources',
    inputSchema: CheckNodeCapacitySchema,
    handler: async (args, { registry }) => {
      try {
        const { nodeName, requestedResources } = args;
        const nodeResources = registry.getContext('node_resources') || {};
        
        const node = nodeResources[nodeName];
        if (!node) {
          return {
            success: false,
            output: '',
            error: `Node ${nodeName} not found in resource tracking`
          };
        }
        
        const canPlace = 
          requestedResources.cores <= node.available_cores &&
          requestedResources.memoryMb <= node.available_memory_mb &&
          requestedResources.diskGb <= node.available_storage_gb &&
          node.current_vms < node.max_vms;
          
        const result = {
          canPlace,
          node: nodeName,
          requested: requestedResources,
          available: {
            cores: node.available_cores,
            memoryMb: node.available_memory_mb,
            diskGb: node.available_storage_gb,
            vmSlots: node.max_vms - node.current_vms
          },
          utilization: {
            cpu: Math.round((node.used_cores / node.total_cores) * 100),
            memory: Math.round((node.used_memory_mb / node.total_memory_mb) * 100),
            storage: Math.round((node.used_storage_gb / node.total_storage_gb) * 100)
          },
          alerts: node.resource_alerts
        };
        
        if (!canPlace) {
          result.reason = [];
          if (requestedResources.cores > node.available_cores) {
            result.reason.push(`Insufficient CPU: need ${requestedResources.cores}, have ${node.available_cores}`);
          }
          if (requestedResources.memoryMb > node.available_memory_mb) {
            result.reason.push(`Insufficient memory: need ${requestedResources.memoryMb}MB, have ${node.available_memory_mb}MB`);
          }
          if (requestedResources.diskGb > node.available_storage_gb) {
            result.reason.push(`Insufficient storage: need ${requestedResources.diskGb}GB, have ${node.available_storage_gb}GB`);
          }
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
    name: 'find-best-node',
    description: 'Find the best node for VM placement based on resources and preferences',
    inputSchema: FindBestNodeSchema,
    handler: async (args, { registry }) => {
      try {
        const { requiredResources, preferences = {} } = args;
        const nodeResources = registry.getContext('node_resources') || {};
        
        // Score each node
        const scoredNodes = [];
        
        Object.entries(nodeResources).forEach(([nodeName, node]) => {
          // Skip if preferences exclude this node
          if (preferences.avoidNodes?.includes(nodeName)) {
            return;
          }
          
          // Check if node has capacity
          const hasCapacity = 
            requiredResources.cores <= node.available_cores &&
            requiredResources.memoryMb <= node.available_memory_mb &&
            requiredResources.diskGb <= node.available_storage_gb &&
            node.current_vms < node.max_vms;
            
          if (!hasCapacity) {
            return;
          }
          
          // Calculate score (higher is better)
          let score = 100;
          
          // Prefer balanced utilization
          const cpuUtil = node.used_cores / node.total_cores;
          const memUtil = node.used_memory_mb / node.total_memory_mb;
          const avgUtil = (cpuUtil + memUtil) / 2;
          score -= Math.abs(avgUtil - 0.5) * 50; // Penalize both over and under utilization
          
          // Prefer preferred node
          if (preferences.preferredNode === nodeName) {
            score += 20;
          }
          
          // Penalize nodes with alerts
          if (node.resource_alerts.cpu_warning) score -= 10;
          if (node.resource_alerts.cpu_critical) score -= 20;
          if (node.resource_alerts.memory_warning) score -= 10;
          if (node.resource_alerts.memory_critical) score -= 20;
          
          scoredNodes.push({
            node: nodeName,
            score,
            available: {
              cores: node.available_cores,
              memoryMb: node.available_memory_mb,
              diskGb: node.available_storage_gb
            },
            utilization: {
              cpu: Math.round(cpuUtil * 100),
              memory: Math.round(memUtil * 100)
            },
            alerts: node.resource_alerts
          });
        });
        
        // Sort by score
        scoredNodes.sort((a, b) => b.score - a.score);
        
        const result = {
          bestNode: scoredNodes[0]?.node || null,
          alternatives: scoredNodes.slice(1, 3).map(n => n.node),
          allCandidates: scoredNodes,
          recommendation: scoredNodes[0] ? 
            `Use node ${scoredNodes[0].node} (score: ${scoredNodes[0].score})` :
            'No suitable nodes found'
        };
        
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
export const inventoryDeviationToolDefinitions = inventoryDeviationTools.map(tool => ({
  name: tool.name,
  description: tool.description,
  inputSchema: zodToJsonSchema(tool.inputSchema)
}));

export const inventoryDeviationToolHandlers = Object.fromEntries(
  inventoryDeviationTools.map(tool => [tool.name, async (args) => {
    const { toolRegistry } = await import('./index.js');
    return tool.handler(args, { registry: toolRegistry });
  }])
);