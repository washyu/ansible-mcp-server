// External server management tools

import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { exec } from 'child_process';
import { promisify } from 'util';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Schemas
const AddExternalServerSchema = z.object({
  name: z.string().describe('Server name for inventory'),
  ip: z.string().describe('IP address or hostname'),
  type: z.enum(['truenas', 'pihole', 'gateway', 'custom']).describe('Server type'),
  sshPort: z.number().optional().default(22).describe('SSH port'),
  sshUser: z.string().optional().default('root').describe('SSH username'),
  sshKey: z.string().optional().describe('Path to SSH key'),
  groups: z.array(z.string()).optional().describe('Ansible groups to assign'),
  vars: z.record(z.any()).optional().describe('Additional Ansible variables')
});

const NetworkDiscoverySchema = z.object({
  subnet: z.string().default('192.168.1.0/24').describe('Network subnet to scan'),
  knownDevices: z.array(z.object({
    ip: z.string(),
    name: z.string(),
    type: z.string()
  })).optional().describe('Known devices to skip')
});

const RemoveExternalServerSchema = z.object({
  name: z.string().describe('Server name to remove from inventory')
});

const TestServerConnectivitySchema = z.object({
  target: z.string().describe('Server IP or hostname'),
  methods: z.array(z.enum(['ping', 'ssh', 'http', 'https'])).optional().default(['ping', 'ssh']).describe('Methods to test')
});

const DiscoverControllerSchema = z.object({
  subnet: z.string().default('192.168.10.0/24').describe('Subnet to search for controllers')
});

const ImportConfigSchema = z.object({
  controllerHost: z.string().describe('Ansible controller hostname/IP'),
  sshUser: z.string().default('ansible').describe('SSH user for controller'),
  configTypes: z.array(z.enum(['inventory', 'playbooks', 'roles', 'vars'])).default(['inventory']).describe('Types to import')
});

const MigrateSSHKeysSchema = z.object({
  sourceHost: z.string().describe('Source controller host'),
  sshUser: z.string().default('ansible').describe('SSH user'),
  keyTypes: z.array(z.enum(['authorized_keys', 'private_keys'])).default(['authorized_keys']).describe('Key types to migrate')
});

// Helper functions
async function updateExternalServersInventory(servers) {
  const inventoryPath = path.join(__dirname, '../../../inventory/external-servers.yml');
  const inventory = {
    external_servers: {
      hosts: {},
      children: {}
    }
  };
  
  // Group servers by type
  const groups = {};
  servers.forEach(server => {
    // Add to main hosts
    inventory.external_servers.hosts[server.name] = {
      ansible_host: server.ip,
      ansible_port: server.sshPort || 22,
      ansible_user: server.sshUser || 'root',
      ...server.vars
    };
    
    if (server.sshKey) {
      inventory.external_servers.hosts[server.name].ansible_ssh_private_key_file = server.sshKey;
    }
    
    // Add to type-based groups
    if (!groups[server.type]) {
      groups[server.type] = { hosts: {} };
    }
    groups[server.type].hosts[server.name] = {};
    
    // Add to custom groups
    if (server.groups) {
      server.groups.forEach(group => {
        if (!groups[group]) {
          groups[group] = { hosts: {} };
        }
        groups[group].hosts[server.name] = {};
      });
    }
  });
  
  // Add groups to inventory
  Object.entries(groups).forEach(([name, group]) => {
    inventory.external_servers.children[name] = group;
  });
  
  await fs.mkdir(path.dirname(inventoryPath), { recursive: true });
  await fs.writeFile(inventoryPath, JSON.stringify(inventory, null, 2));
}

async function loadExternalServers() {
  const serversFile = path.join(__dirname, '../../../.external-servers.json');
  try {
    const data = await fs.readFile(serversFile, 'utf8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function saveExternalServers(servers) {
  const serversFile = path.join(__dirname, '../../../.external-servers.json');
  await fs.writeFile(serversFile, JSON.stringify(servers, null, 2));
  await updateExternalServersInventory(servers);
}

// Tool handlers
const externalServerTools = [
  {
    name: 'add-external-server',
    description: 'Add an external server to the Ansible inventory',
    inputSchema: AddExternalServerSchema,
    handler: async (args) => {
      try {
        const servers = await loadExternalServers();
        
        // Check if server already exists
        if (servers.find(s => s.name === args.name)) {
          return {
            success: false,
            output: '',
            error: `Server ${args.name} already exists in inventory`
          };
        }
        
        // Add new server
        servers.push(args);
        await saveExternalServers(servers);
        
        return {
          success: true,
          output: `Added ${args.name} (${args.ip}) to external servers inventory`,
          error: ''
        };
      } catch (error) {
        return {
          success: false,
          output: '',
          error: `Failed to add server: ${error.message}`
        };
      }
    }
  },

  {
    name: 'discover-network-devices',
    description: 'Discover devices on the network and classify them',
    inputSchema: NetworkDiscoverySchema,
    handler: async (args) => {
      try {
        const { subnet, knownDevices = [] } = args;
        
        // Use nmap for discovery
        const { stdout: nmapOutput } = await execAsync(
          `nmap -sn ${subnet} | grep -E "Nmap scan report|MAC Address" | paste - -`,
          { timeout: 120000 }
        );
        
        const devices = [];
        const lines = nmapOutput.split('\n').filter(l => l.trim());
        
        for (const line of lines) {
          const ipMatch = line.match(/Nmap scan report for (?:(\S+) \()?(\d+\.\d+\.\d+\.\d+)\)?/);
          const macMatch = line.match(/MAC Address: ([0-9A-F:]+)/i);
          
          if (ipMatch) {
            const hostname = ipMatch[1] || '';
            const ip = ipMatch[2];
            
            // Skip known devices
            if (knownDevices.find(d => d.ip === ip)) continue;
            
            // Try to classify device
            let type = 'unknown';
            let name = hostname || `device-${ip.replace(/\./g, '-')}`;
            
            // Classification based on hostname or services
            if (hostname.includes('pihole')) type = 'pihole';
            else if (hostname.includes('truenas') || hostname.includes('nas')) type = 'truenas';
            else if (hostname.includes('gateway') || hostname.includes('router')) type = 'gateway';
            else if (hostname.includes('proxmox') || hostname.includes('pve')) type = 'hypervisor';
            
            devices.push({ ip, name, type, hostname });
          }
        }
        
        return {
          success: true,
          output: JSON.stringify({
            discovered: devices.length,
            devices
          }, null, 2),
          error: ''
        };
      } catch (error) {
        return {
          success: false,
          output: '',
          error: `Discovery failed: ${error.message}`
        };
      }
    }
  },

  {
    name: 'remove-external-server',
    description: 'Remove an external server from inventory',
    inputSchema: RemoveExternalServerSchema,
    handler: async (args) => {
      try {
        const servers = await loadExternalServers();
        const filtered = servers.filter(s => s.name !== args.name);
        
        if (filtered.length === servers.length) {
          return {
            success: false,
            output: '',
            error: `Server ${args.name} not found in inventory`
          };
        }
        
        await saveExternalServers(filtered);
        
        return {
          success: true,
          output: `Removed ${args.name} from external servers inventory`,
          error: ''
        };
      } catch (error) {
        return {
          success: false,
          output: '',
          error: `Failed to remove server: ${error.message}`
        };
      }
    }
  },

  {
    name: 'test-server-connectivity',
    description: 'Test connectivity to a server using various methods',
    inputSchema: TestServerConnectivitySchema,
    handler: async (args) => {
      try {
        const { target, methods } = args;
        const results = {};
        
        for (const method of methods) {
          switch (method) {
            case 'ping':
              try {
                await execAsync(`ping -c 3 -W 2 ${target}`);
                results.ping = { success: true, message: 'Ping successful' };
              } catch {
                results.ping = { success: false, message: 'Ping failed' };
              }
              break;
              
            case 'ssh':
              try {
                await execAsync(`nc -z -w 2 ${target} 22`);
                results.ssh = { success: true, message: 'SSH port open' };
              } catch {
                results.ssh = { success: false, message: 'SSH port closed' };
              }
              break;
              
            case 'http':
              try {
                await execAsync(`nc -z -w 2 ${target} 80`);
                results.http = { success: true, message: 'HTTP port open' };
              } catch {
                results.http = { success: false, message: 'HTTP port closed' };
              }
              break;
              
            case 'https':
              try {
                await execAsync(`nc -z -w 2 ${target} 443`);
                results.https = { success: true, message: 'HTTPS port open' };
              } catch {
                results.https = { success: false, message: 'HTTPS port closed' };
              }
              break;
          }
        }
        
        const allSuccess = Object.values(results).every(r => r.success);
        
        return {
          success: allSuccess,
          output: JSON.stringify(results, null, 2),
          error: allSuccess ? '' : 'Some connectivity tests failed'
        };
      } catch (error) {
        return {
          success: false,
          output: '',
          error: `Connectivity test failed: ${error.message}`
        };
      }
    }
  },

  {
    name: 'discover-ansible-controller',
    description: 'Discover existing Ansible controllers on the network',
    inputSchema: DiscoverControllerSchema,
    handler: async (args) => {
      try {
        const { subnet } = args;
        
        // Look for common Ansible indicators
        const { stdout } = await execAsync(
          `nmap -p 22 --open ${subnet} -oG - | grep "22/open" | cut -d' ' -f2`,
          { timeout: 60000 }
        );
        
        const potentialControllers = [];
        const hosts = stdout.split('\n').filter(h => h.trim());
        
        for (const host of hosts) {
          try {
            // Check for ansible user
            await execAsync(`ssh -o ConnectTimeout=2 -o StrictHostKeyChecking=no ansible@${host} 'which ansible' 2>/dev/null`);
            potentialControllers.push({
              host,
              type: 'confirmed',
              hasAnsible: true
            });
          } catch {
            // Check for common Ansible paths
            try {
              await execAsync(`ssh -o ConnectTimeout=2 -o StrictHostKeyChecking=no root@${host} 'ls /etc/ansible' 2>/dev/null`);
              potentialControllers.push({
                host,
                type: 'possible',
                hasAnsibleConfig: true
              });
            } catch {
              // Not an Ansible controller
            }
          }
        }
        
        return {
          success: true,
          output: JSON.stringify({
            found: potentialControllers.length,
            controllers: potentialControllers
          }, null, 2),
          error: ''
        };
      } catch (error) {
        return {
          success: false,
          output: '',
          error: `Discovery failed: ${error.message}`
        };
      }
    }
  },

  {
    name: 'import-ansible-config',
    description: 'Import configuration from existing Ansible controller',
    inputSchema: ImportConfigSchema,
    handler: async (args) => {
      try {
        const { controllerHost, sshUser, configTypes } = args;
        const imported = {};
        
        for (const type of configTypes) {
          switch (type) {
            case 'inventory':
              try {
                const { stdout } = await execAsync(
                  `ssh ${sshUser}@${controllerHost} 'find /etc/ansible -name "*.yml" -o -name "*.yaml" -o -name "hosts" | head -20'`
                );
                imported.inventory = stdout.split('\n').filter(f => f.trim());
              } catch {
                imported.inventory = [];
              }
              break;
              
            case 'playbooks':
              try {
                const { stdout } = await execAsync(
                  `ssh ${sshUser}@${controllerHost} 'find /home -name "*.yml" -path "*/playbooks/*" | head -20'`
                );
                imported.playbooks = stdout.split('\n').filter(f => f.trim());
              } catch {
                imported.playbooks = [];
              }
              break;
              
            case 'roles':
              try {
                const { stdout } = await execAsync(
                  `ssh ${sshUser}@${controllerHost} 'find /etc/ansible/roles /home -type d -name "tasks" | grep -v ".git" | head -20'`
                );
                imported.roles = stdout.split('\n').filter(f => f.trim()).map(f => f.replace('/tasks', ''));
              } catch {
                imported.roles = [];
              }
              break;
          }
        }
        
        return {
          success: true,
          output: JSON.stringify({
            controller: controllerHost,
            imported
          }, null, 2),
          error: ''
        };
      } catch (error) {
        return {
          success: false,
          output: '',
          error: `Import failed: ${error.message}`
        };
      }
    }
  },

  {
    name: 'migrate-ssh-keys',
    description: 'Migrate SSH keys from existing controller',
    inputSchema: MigrateSSHKeysSchema,
    handler: async (args) => {
      try {
        const { sourceHost, sshUser, keyTypes } = args;
        const migrated = {};
        
        for (const type of keyTypes) {
          switch (type) {
            case 'authorized_keys':
              try {
                const { stdout } = await execAsync(
                  `ssh ${sshUser}@${sourceHost} 'cat ~/.ssh/authorized_keys'`
                );
                
                // Save to local authorized_keys
                const localPath = path.join(process.env.HOME, '.ssh', 'migrated_authorized_keys');
                await fs.writeFile(localPath, stdout);
                migrated.authorized_keys = localPath;
              } catch (e) {
                migrated.authorized_keys = `Failed: ${e.message}`;
              }
              break;
              
            case 'private_keys':
              try {
                const { stdout } = await execAsync(
                  `ssh ${sshUser}@${sourceHost} 'ls ~/.ssh/id_* | grep -v ".pub"'`
                );
                const keyFiles = stdout.split('\n').filter(f => f.trim());
                migrated.private_keys = keyFiles;
              } catch (e) {
                migrated.private_keys = `Failed: ${e.message}`;
              }
              break;
          }
        }
        
        return {
          success: true,
          output: JSON.stringify({
            source: sourceHost,
            migrated
          }, null, 2),
          error: ''
        };
      } catch (error) {
        return {
          success: false,
          output: '',
          error: `Migration failed: ${error.message}`
        };
      }
    }
  }
];

// Export tools with proper schema conversion
export const externalServerToolDefinitions = externalServerTools.map(tool => ({
  name: tool.name,
  description: tool.description,
  inputSchema: zodToJsonSchema(tool.inputSchema)
}));

export const externalServerToolHandlers = Object.fromEntries(
  externalServerTools.map(tool => [tool.name, tool.handler])
);