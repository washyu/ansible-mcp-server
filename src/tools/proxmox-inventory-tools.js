// Proxmox inventory and context management tools

import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { promises as fs } from 'fs';
import path from 'path';
import https from 'https';

// Schemas
const ProxmoxInventorySchema = z.object({
  action: z.enum(['refresh', 'status', 'list']).describe('Inventory action'),
  force: z.boolean().optional().default(false).describe('Force refresh even if recent'),
  categories: z.array(z.enum(['vms', 'templates', 'isos', 'storage', 'nodes', 'networks'])).optional().describe('Resource categories to scan')
});

const InventoryStatusSchema = z.object({
  detailed: z.boolean().optional().default(false).describe('Show detailed status information')
});

// Helper functions
async function makeProxmoxRequest(endpoint) {
  const apiHost = process.env.PROXMOX_HOST || '192.168.10.200';
  const tokenId = process.env.API_TOKEN_ID || 'root@pam!devvm';
  const tokenSecret = process.env.API_TOKEN_SECRET;
  
  if (!tokenSecret) {
    throw new Error('API_TOKEN_SECRET not configured');
  }

  const url = `https://${apiHost}:8006/api2/json${endpoint}`;
  const token = `${tokenId}:${tokenSecret}`;
  
  return new Promise((resolve, reject) => {
    const options = {
      method: 'GET',
      headers: {
        'Authorization': `PVEAPIToken=${token}`,
        'Content-Type': 'application/json'
      },
      rejectUnauthorized: false // For self-signed certificates
    };

    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.data) {
            resolve(parsed.data);
          } else {
            reject(new Error(`Proxmox API error: ${data}`));
          }
        } catch (error) {
          reject(new Error(`Failed to parse Proxmox response: ${error.message}`));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error('Proxmox API request timeout'));
    });
    req.end();
  });
}

async function discoverVMs() {
  try {
    const vms = await makeProxmoxRequest('/nodes/proxmox/qemu');
    return vms.map(vm => ({
      vmid: vm.vmid,
      name: vm.name,
      status: vm.status,
      cores: vm.cpus,
      memory: vm.maxmem,
      disk: vm.maxdisk,
      uptime: vm.uptime,
      template: vm.template === 1,
      node: 'proxmox'
    }));
  } catch (error) {
    return { error: error.message };
  }
}

async function discoverTemplates() {
  try {
    const vms = await makeProxmoxRequest('/nodes/proxmox/qemu');
    const templates = vms.filter(vm => vm.template === 1);
    return templates.map(template => ({
      vmid: template.vmid,
      name: template.name,
      cores: template.cpus,
      memory: template.maxmem,
      disk: template.maxdisk,
      node: 'proxmox',
      isTemplate: true
    }));
  } catch (error) {
    return { error: error.message };
  }
}

async function discoverISOs() {
  try {
    const isos = await makeProxmoxRequest('/nodes/proxmox/storage/local/content?content=iso');
    return isos.map(iso => ({
      volid: iso.volid,
      name: iso.volid.split('/').pop(),
      size: iso.size,
      format: iso.format,
      storage: 'local'
    }));
  } catch (error) {
    return { error: error.message };
  }
}

async function discoverStorage() {
  try {
    const storage = await makeProxmoxRequest('/storage');
    return storage.map(store => ({
      storage: store.storage,
      type: store.type,
      content: store.content,
      enabled: store.enabled === 1,
      shared: store.shared === 1,
      path: store.path
    }));
  } catch (error) {
    return { error: error.message };
  }
}

async function discoverNodes() {
  try {
    const nodes = await makeProxmoxRequest('/nodes');
    return nodes.map(node => ({
      node: node.node,
      status: node.status,
      cpu: node.cpu,
      maxcpu: node.maxcpu,
      mem: node.mem,
      maxmem: node.maxmem,
      disk: node.disk,
      maxdisk: node.maxdisk,
      uptime: node.uptime
    }));
  } catch (error) {
    return { error: error.message };
  }
}

async function discoverNetworks() {
  try {
    const networks = await makeProxmoxRequest('/nodes/proxmox/network');
    return networks.map(net => ({
      iface: net.iface,
      type: net.type,
      active: net.active,
      address: net.address,
      netmask: net.netmask,
      gateway: net.gateway,
      bridge_ports: net.bridge_ports,
      comments: net.comments
    }));
  } catch (error) {
    return { error: error.message };
  }
}

async function saveInventory(inventory) {
  const inventoryFile = path.join(process.cwd(), 'inventory', 'proxmox-resources.json');
  const lastDiscoveryFile = path.join(process.cwd(), 'inventory', 'last-discovery.json');
  
  const timestamp = new Date().toISOString();
  
  // Save full inventory
  await fs.mkdir(path.dirname(inventoryFile), { recursive: true });
  await fs.writeFile(inventoryFile, JSON.stringify({
    lastUpdated: timestamp,
    ...inventory
  }, null, 2));
  
  // Save discovery metadata
  const discoveryMeta = {
    lastUpdated: timestamp,
    stalenessHours: parseInt(process.env.INVENTORY_STALENESS_HOURS || '10'),
    resourceCounts: {
      vms: inventory.vms?.length || 0,
      templates: inventory.templates?.length || 0,
      isos: inventory.isos?.length || 0,
      storage: inventory.storage?.length || 0,
      nodes: inventory.nodes?.length || 0,
      networks: inventory.networks?.length || 0
    }
  };
  
  await fs.writeFile(lastDiscoveryFile, JSON.stringify(discoveryMeta, null, 2));
  
  return discoveryMeta;
}

async function loadInventory() {
  const inventoryFile = path.join(process.cwd(), 'inventory', 'proxmox-resources.json');
  
  try {
    const data = await fs.readFile(inventoryFile, 'utf8');
    return JSON.parse(data);
  } catch {
    return null; // File doesn't exist
  }
}

async function checkInventoryStaleness() {
  const lastDiscoveryFile = path.join(process.cwd(), 'inventory', 'last-discovery.json');
  
  try {
    const data = await fs.readFile(lastDiscoveryFile, 'utf8');
    const meta = JSON.parse(data);
    
    const lastUpdated = new Date(meta.lastUpdated);
    const now = new Date();
    const hoursSinceUpdate = (now - lastUpdated) / (1000 * 60 * 60);
    const stalenessThreshold = meta.stalenessHours || 10;
    
    return {
      isStale: hoursSinceUpdate > stalenessThreshold,
      hoursSinceUpdate: Math.round(hoursSinceUpdate * 100) / 100,
      stalenessThreshold,
      lastUpdated: meta.lastUpdated,
      resourceCounts: meta.resourceCounts
    };
  } catch {
    return {
      isStale: true,
      hoursSinceUpdate: Infinity,
      stalenessThreshold: 10,
      lastUpdated: null,
      resourceCounts: {}
    };
  }
}

async function isRefreshInProgress() {
  return process.env.INVENTORY_REFRESH_IN_PROGRESS === 'true';
}

async function setRefreshInProgress(inProgress) {
  // In a real implementation, this would update a shared state file
  // For now, we'll use environment variable
  process.env.INVENTORY_REFRESH_IN_PROGRESS = inProgress.toString();
}

// Tool handlers
const proxmoxInventoryTools = [
  {
    name: 'proxmox-inventory',
    description: 'Discover and manage Proxmox infrastructure inventory',
    inputSchema: ProxmoxInventorySchema,
    handler: async (args) => {
      try {
        const { action, force, categories } = args;
        const scanCategories = categories || ['vms', 'templates', 'isos', 'storage', 'nodes', 'networks'];
        
        switch (action) {
          case 'status':
            const status = await checkInventoryStaleness();
            const existing = await loadInventory();
            
            return {
              success: true,
              output: JSON.stringify({
                ...status,
                hasInventory: !!existing,
                refreshInProgress: await isRefreshInProgress()
              }, null, 2),
              error: ''
            };
            
          case 'list':
            const inventory = await loadInventory();
            if (!inventory) {
              return {
                success: false,
                output: '',
                error: 'No inventory found. Run refresh first.'
              };
            }
            
            return {
              success: true,
              output: JSON.stringify(inventory, null, 2),
              error: ''
            };
            
          case 'refresh':
            const staleness = await checkInventoryStaleness();
            
            if (!force && !staleness.isStale) {
              return {
                success: true,
                output: `Inventory is fresh (${staleness.hoursSinceUpdate} hours old, threshold: ${staleness.stalenessThreshold} hours). Use force=true to refresh anyway.`,
                error: ''
              };
            }
            
            if (await isRefreshInProgress()) {
              return {
                success: false,
                output: '',
                error: 'Inventory refresh already in progress'
              };
            }
            
            await setRefreshInProgress(true);
            
            try {
              const newInventory = {};
              
              if (scanCategories.includes('vms')) {
                newInventory.vms = await discoverVMs();
              }
              
              if (scanCategories.includes('templates')) {
                newInventory.templates = await discoverTemplates();
              }
              
              if (scanCategories.includes('isos')) {
                newInventory.isos = await discoverISOs();
              }
              
              if (scanCategories.includes('storage')) {
                newInventory.storage = await discoverStorage();
              }
              
              if (scanCategories.includes('nodes')) {
                newInventory.nodes = await discoverNodes();
              }
              
              if (scanCategories.includes('networks')) {
                newInventory.networks = await discoverNetworks();
              }
              
              const meta = await saveInventory(newInventory);
              
              return {
                success: true,
                output: JSON.stringify({
                  message: 'Inventory refreshed successfully',
                  ...meta,
                  inventory: newInventory
                }, null, 2),
                error: ''
              };
            } finally {
              await setRefreshInProgress(false);
            }
            
          default:
            return {
              success: false,
              output: '',
              error: `Unknown action: ${action}`
            };
        }
      } catch (error) {
        await setRefreshInProgress(false);
        return {
          success: false,
          output: '',
          error: error.message
        };
      }
    }
  },

  {
    name: 'inventory-status',
    description: 'Check inventory status and staleness',
    inputSchema: InventoryStatusSchema,
    handler: async (args) => {
      try {
        const { detailed } = args;
        const status = await checkInventoryStaleness();
        const inventory = await loadInventory();
        
        let output = {
          isStale: status.isStale,
          hoursSinceUpdate: status.hoursSinceUpdate,
          stalenessThreshold: status.stalenessThreshold,
          lastUpdated: status.lastUpdated,
          hasInventory: !!inventory,
          refreshInProgress: await isRefreshInProgress()
        };
        
        if (detailed && inventory) {
          output.resourceCounts = status.resourceCounts;
          output.templates = inventory.templates?.filter(t => !t.error) || [];
          output.availableTemplates = inventory.templates?.filter(t => !t.error).map(t => ({
            id: t.vmid,
            name: t.name,
            cores: t.cores,
            memory: t.memory
          })) || [];
        }
        
        return {
          success: true,
          output: JSON.stringify(output, null, 2),
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
export const proxmoxInventoryToolDefinitions = proxmoxInventoryTools.map(tool => ({
  name: tool.name,
  description: tool.description,
  inputSchema: zodToJsonSchema(tool.inputSchema)
}));

export const proxmoxInventoryToolHandlers = Object.fromEntries(
  proxmoxInventoryTools.map(tool => [tool.name, tool.handler])
);