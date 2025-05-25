// Infrastructure management tools module

import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import https from 'https';
import { promises as fs } from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Schemas
const DiscoverProxmoxSchema = z.object({
  proxmoxHost: z.string().optional().describe('Proxmox host (defaults to env var)'),
  proxmoxUser: z.string().optional().describe('Proxmox user (defaults to env var)'),
  proxmoxPassword: z.string().optional().describe('Proxmox password (defaults to env var)'),
  includeTemplates: z.boolean().optional().default(false).describe('Include VM templates in discovery'),
  groupBy: z.enum(['status', 'ostype', 'purpose', 'all']).optional().default('all').describe('How to group VMs in output')
});

const GenerateInventorySchema = z.object({
  outputFile: z.string().default('inventory/discovered-hosts.yml').describe('Output file for inventory'),
  groupBy: z.enum(['status', 'ostype', 'purpose', 'all']).optional().default('purpose').describe('How to group hosts'),
  includeOffline: z.boolean().optional().default(false).describe('Include offline VMs')
});

const DiagramGeneratorSchema = z.object({
  format: z.enum(['mermaid', 'graphviz', 'ascii']).default('mermaid').describe('Output format for diagram'),
  includeNetworks: z.boolean().default(true).describe('Include network connections'),
  includeStorage: z.boolean().default(false).describe('Include storage information')
});

const CaptureStateSchema = z.object({
  outputDir: z.string().default('state-captures').describe('Directory to store state captures'),
  includeDiagrams: z.boolean().default(true).describe('Generate infrastructure diagrams'),
  captureConfigs: z.boolean().default(true).describe('Capture service configurations')
});

const HomelabDeploySchema = z.object({
  service: z.string().describe('Service to deploy (e.g., nextcloud, grafana)'),
  vmName: z.string().describe('Name for the VM'),
  vmid: z.number().describe('Proxmox VM ID'),
  ipAddress: z.string().optional().describe('Static IP address'),
  deploy: z.boolean().default(true).describe('Auto-deploy after VM creation'),
  terraformDir: z.string().default('terraform').describe('Directory for Terraform files'),
  ansibleDir: z.string().default('playbooks').describe('Directory for Ansible playbooks')
});

// Helper functions
async function makeProxmoxRequest(path, options) {
  const config = {
    host: options.proxmoxHost || process.env.PROXMOX_HOST || 'YOUR_PROXMOX_HOST',
    user: options.proxmoxUser || process.env.PROXMOX_USER || 'root@pam',
    password: options.proxmoxPassword || process.env.PROXMOX_PASSWORD
  };

  if (!config.password) {
    throw new Error('Proxmox password not provided');
  }

  // First, get authentication ticket
  const authData = `username=${encodeURIComponent(config.user)}&password=${encodeURIComponent(config.password)}`;
  
  const authOptions = {
    hostname: config.host,
    port: 8006,
    path: '/api2/json/access/ticket',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': authData.length
    },
    rejectUnauthorized: false
  };

  const authResponse = await new Promise((resolve, reject) => {
    const req = https.request(authOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Failed to parse auth response: ${e.message}`));
        }
      });
    });
    req.on('error', reject);
    req.write(authData);
    req.end();
  });

  if (!authResponse.data || !authResponse.data.ticket) {
    throw new Error('Failed to authenticate with Proxmox');
  }

  // Now make the actual request
  const requestOptions = {
    hostname: config.host,
    port: 8006,
    path: `/api2/json${path}`,
    method: 'GET',
    headers: {
      'Cookie': `PVEAuthCookie=${authResponse.data.ticket}`,
      'CSRFPreventionToken': authResponse.data.CSRFPreventionToken
    },
    rejectUnauthorized: false
  };

  return new Promise((resolve, reject) => {
    const req = https.request(requestOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (result.data) {
            resolve(result.data);
          } else {
            reject(new Error(`Proxmox API error: ${JSON.stringify(result)}`));
          }
        } catch (e) {
          reject(new Error(`Failed to parse response: ${e.message}`));
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function generateAnsibleInventory(vms, groupBy = 'all') {
  const inventory = {
    all: {
      hosts: {},
      children: {}
    }
  };
  
  // Group VMs based on groupBy parameter
  const groups = {};
  
  vms.forEach(vm => {
    const hostEntry = {
      ansible_host: vm.ip || vm.name,
      vmid: vm.vmid,
      cores: vm.cores,
      memory: vm.memory,
      disk: vm.disk,
      status: vm.status,
      ostype: vm.ostype,
      purpose: vm.purpose
    };
    
    // Add to all hosts
    inventory.all.hosts[vm.name] = hostEntry;
    
    // Group by specified criteria
    let groupName = 'discovered';
    switch (groupBy) {
      case 'status':
        groupName = vm.status;
        break;
      case 'ostype':
        groupName = vm.ostype || 'unknown';
        break;
      case 'purpose':
        groupName = vm.purpose || 'general';
        break;
    }
    
    if (!groups[groupName]) {
      groups[groupName] = { hosts: {} };
    }
    groups[groupName].hosts[vm.name] = {};
  });
  
  // Add groups to inventory
  Object.entries(groups).forEach(([name, group]) => {
    inventory.all.children[name] = group;
  });
  
  return inventory;
}

// Tool handlers
const infrastructureTools = [
  {
    name: 'discover-proxmox',
    description: 'Discover all VMs on a Proxmox server and extract their configuration',
    inputSchema: DiscoverProxmoxSchema,
    handler: async (args) => {
      try {
        const validatedArgs = DiscoverProxmoxSchema.parse(args);
        
        // Get nodes
        const nodes = await makeProxmoxRequest('/nodes', validatedArgs);
        
        const allVMs = [];
        
        for (const node of nodes) {
          // Get VMs for this node
          const vms = await makeProxmoxRequest(`/nodes/${node.node}/qemu`, validatedArgs);
          
          for (const vm of vms) {
            if (!validatedArgs.includeTemplates && vm.template) {
              continue;
            }
            
            // Get detailed VM config
            const config = await makeProxmoxRequest(`/nodes/${node.node}/qemu/${vm.vmid}/config`, validatedArgs);
            
            // Try to determine purpose from name or tags
            let purpose = 'general';
            const name = vm.name.toLowerCase();
            if (name.includes('nextcloud')) purpose = 'storage';
            else if (name.includes('proxy') || name.includes('nginx')) purpose = 'proxy';
            else if (name.includes('db') || name.includes('database')) purpose = 'database';
            else if (name.includes('monitor') || name.includes('grafana')) purpose = 'monitoring';
            else if (name.includes('mail')) purpose = 'email';
            
            allVMs.push({
              vmid: vm.vmid,
              name: vm.name,
              status: vm.status,
              cores: config.cores || 1,
              memory: config.memory || 512,
              disk: config.bootdisk || 'unknown',
              ostype: config.ostype,
              ip: config.ipconfig0 ? config.ipconfig0.split(',')[0].split('=')[1].split('/')[0] : null,
              node: node.node,
              purpose: purpose,
              tags: config.tags || ''
            });
          }
        }
        
        // Group VMs
        const grouped = {};
        const groupBy = validatedArgs.groupBy;
        
        allVMs.forEach(vm => {
          let key = 'all';
          if (groupBy === 'status') key = vm.status;
          else if (groupBy === 'ostype') key = vm.ostype || 'unknown';
          else if (groupBy === 'purpose') key = vm.purpose;
          
          if (!grouped[key]) grouped[key] = [];
          grouped[key].push(vm);
        });
        
        return {
          success: true,
          output: JSON.stringify({ 
            total: allVMs.length, 
            vms: grouped,
            raw: allVMs 
          }, null, 2),
          error: ''
        };
      } catch (error) {
        return {
          success: false,
          error: error.message,
          output: ''
        };
      }
    }
  },

  {
    name: 'generate-inventory',
    description: 'Generate an Ansible inventory file from discovered Proxmox VMs',
    inputSchema: GenerateInventorySchema,
    handler: async (args) => {
      try {
        const validatedArgs = GenerateInventorySchema.parse(args);
        
        // First discover VMs
        const discovery = await infrastructureTools[0].handler({
          includeTemplates: false,
          groupBy: 'all'
        });
        
        if (!discovery.success) {
          throw new Error(`Discovery failed: ${discovery.error}`);
        }
        
        const discoveryData = JSON.parse(discovery.output);
        let vms = discoveryData.raw;
        
        // Filter offline VMs if requested
        if (!validatedArgs.includeOffline) {
          vms = vms.filter(vm => vm.status === 'running');
        }
        
        // Generate inventory
        const inventory = generateAnsibleInventory(vms, validatedArgs.groupBy);
        
        // Convert to YAML format
        const yamlContent = JSON.stringify(inventory, null, 2);
        
        // Ensure output directory exists
        const outputPath = path.isAbsolute(validatedArgs.outputFile)
          ? validatedArgs.outputFile
          : path.join(process.cwd(), validatedArgs.outputFile);
        await fs.mkdir(path.dirname(outputPath), { recursive: true });
        
        // Write inventory file
        await fs.writeFile(outputPath, yamlContent);
        
        return {
          success: true,
          output: `Generated inventory with ${vms.length} hosts at ${outputPath}`,
          error: ''
        };
      } catch (error) {
        return {
          success: false,
          error: error.message,
          output: ''
        };
      }
    }
  },

  {
    name: 'generate-diagram',
    description: 'Generate infrastructure diagram from current state',
    inputSchema: DiagramGeneratorSchema,
    handler: async (args) => {
      try {
        const validatedArgs = DiagramGeneratorSchema.parse(args);
        
        // Discover infrastructure
        const discovery = await infrastructureTools[0].handler({
          includeTemplates: false,
          groupBy: 'purpose'
        });
        
        if (!discovery.success) {
          throw new Error(`Discovery failed: ${discovery.error}`);
        }
        
        const data = JSON.parse(discovery.output);
        const vms = data.raw;
        
        let diagram = '';
        
        if (validatedArgs.format === 'mermaid') {
          diagram = 'graph TB\n';
          diagram += '    subgraph "Proxmox Cluster"\n';
          
          // Add VMs by purpose
          const purposes = [...new Set(vms.map(vm => vm.purpose))];
          purposes.forEach(purpose => {
            diagram += `        subgraph "${purpose}"\n`;
            vms.filter(vm => vm.purpose === purpose).forEach(vm => {
              const status = vm.status === 'running' ? '✓' : '✗';
              diagram += `            ${vm.vmid}["${vm.name} ${status}<br/>`;
              diagram += `            IP: ${vm.ip || 'DHCP'}<br/>`;
              diagram += `            ${vm.cores} cores, ${vm.memory}MB"]\n`;
            });
            diagram += '        end\n';
          });
          
          diagram += '    end\n';
          
          // Add network connections if requested
          if (validatedArgs.includeNetworks) {
            diagram += '\n    Internet[("Internet")]\n';
            diagram += '    Router["Router/Gateway"]\n';
            diagram += '    Internet --> Router\n';
            vms.filter(vm => vm.status === 'running').forEach(vm => {
              diagram += `    Router --> ${vm.vmid}\n`;
            });
          }
        } else if (validatedArgs.format === 'ascii') {
          diagram = 'Infrastructure Overview\n';
          diagram += '======================\n\n';
          
          const purposes = [...new Set(vms.map(vm => vm.purpose))];
          purposes.forEach(purpose => {
            diagram += `[${purpose.toUpperCase()}]\n`;
            vms.filter(vm => vm.purpose === purpose).forEach(vm => {
              const status = vm.status === 'running' ? '[ON]' : '[OFF]';
              diagram += `  ├─ ${vm.name} ${status}\n`;
              diagram += `  │  ├─ VMID: ${vm.vmid}\n`;
              diagram += `  │  ├─ IP: ${vm.ip || 'DHCP'}\n`;
              diagram += `  │  └─ Specs: ${vm.cores} cores, ${vm.memory}MB RAM\n`;
            });
            diagram += '\n';
          });
        }
        
        return {
          success: true,
          output: diagram,
          error: ''
        };
      } catch (error) {
        return {
          success: false,
          error: error.message,
          output: ''
        };
      }
    }
  },

  {
    name: 'capture-state',
    description: 'Capture current infrastructure state for change tracking',
    inputSchema: CaptureStateSchema,
    handler: async (args) => {
      try {
        const validatedArgs = CaptureStateSchema.parse(args);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const baseDir = path.isAbsolute(validatedArgs.outputDir)
          ? validatedArgs.outputDir
          : path.join(process.cwd(), validatedArgs.outputDir);
        const captureDir = path.join(baseDir, timestamp);
        
        await fs.mkdir(captureDir, { recursive: true });
        
        const results = [];
        
        // 1. Capture VM inventory
        const discovery = await infrastructureTools[0].handler({
          includeTemplates: false,
          groupBy: 'all'
        });
        
        if (discovery.success) {
          await fs.writeFile(
            path.join(captureDir, 'vms.json'),
            discovery.output
          );
          results.push('✓ Captured VM inventory');
        }
        
        // 2. Generate diagrams if requested
        if (validatedArgs.includeDiagrams) {
          const diagram = await infrastructureTools[2].handler({
            format: 'mermaid',
            includeNetworks: true
          });
          
          if (diagram.success) {
            await fs.writeFile(
              path.join(captureDir, 'infrastructure.mmd'),
              diagram.output
            );
            results.push('✓ Generated infrastructure diagram');
          }
        }
        
        // 3. Capture configurations if requested
        if (validatedArgs.captureConfigs) {
          try {
            // Capture running services
            const { stdout: services } = await execAsync(
              'systemctl list-units --type=service --state=running --no-pager --plain | grep -E "(docker|nginx|mysql|postgres)" || true'
            );
            await fs.writeFile(
              path.join(captureDir, 'services.txt'),
              services
            );
            results.push('✓ Captured running services');
          } catch (e) {
            results.push('✗ Failed to capture services');
          }
        }
        
        // 4. Create summary
        const summary = {
          timestamp,
          captureDir,
          results
        };
        
        await fs.writeFile(
          path.join(captureDir, 'summary.json'),
          JSON.stringify(summary, null, 2)
        );
        
        return {
          success: true,
          output: `State captured to ${captureDir}\n${results.join('\n')}`,
          error: ''
        };
      } catch (error) {
        return {
          success: false,
          error: error.message,
          output: ''
        };
      }
    }
  },

  // COMMENTED OUT: homelab-deploy - This is a stub implementation
  // TODO: Implement actual VM creation with Terraform and Ansible configuration
  // {
  //   name: 'homelab-deploy',
  //   description: 'Full stack deployment: create VM with Terraform and configure with Ansible',
  //   inputSchema: HomelabDeploySchema,
  //   handler: async (args) => {
  //     try {
  //       const validatedArgs = HomelabDeploySchema.parse(args);
  //       const results = [];
  //       
  //       // This is a placeholder - the actual implementation would:
  //       // 1. Create Terraform configuration for the VM
  //       // 2. Run terraform apply
  //       // 3. Wait for VM to be ready
  //       // 4. Run appropriate Ansible playbook
  //       
  //       results.push(`Would deploy ${validatedArgs.service} as ${validatedArgs.vmName}`);
  //       results.push(`VM ID: ${validatedArgs.vmid}`);
  //       if (validatedArgs.ipAddress) {
  //         results.push(`Static IP: ${validatedArgs.ipAddress}`);
  //       }
  //       results.push(`Auto-deploy: ${validatedArgs.deploy}`);
  //       
  //       return {
  //         success: true,
  //         output: results.join('\n'),
  //         error: ''
  //       };
  //     } catch (error) {
  //       return {
  //         success: false,
  //         error: error.message,
  //         output: ''
  //       };
  //     }
  //   }
  // }
];

// Export tools with proper schema conversion
export const infrastructureToolDefinitions = infrastructureTools.map(tool => ({
  name: tool.name,
  description: tool.description,
  inputSchema: zodToJsonSchema(tool.inputSchema)
}));

export const infrastructureToolHandlers = Object.fromEntries(
  infrastructureTools.map(tool => [tool.name, tool.handler])
);