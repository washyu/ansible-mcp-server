# TODO: Ansible Controller Migration and SSH Key Management

## Overview
Add tools to migrate from existing Ansible controllers (like homelab2) to the MCP server, with options for direct control or proxy mode.

## Current Situation
- **Existing Controller**: homelab2 (192.168.10.20) with existing Ansible configurations
- **MCP Server**: Needs to either take over control or work through existing controller
- **SSH Authentication**: Need to establish secure key-based authentication

## Migration Options

### Option 1: Direct Migration (Recommended)
- Import existing inventory and playbooks from homelab2
- Generate new SSH keys for MCP server
- Distribute keys to all managed hosts
- Retire homelab2 as controller (repurpose for other uses)

### Option 2: Proxy Mode
- MCP server delegates to existing controller
- Keep homelab2 as the actual Ansible controller
- MCP server acts as an interface layer
- Useful for gradual migration

### Option 3: Hybrid Mode
- Some hosts managed directly by MCP
- Some hosts still managed through homelab2
- Allows selective migration over time

## New MCP Tools to Implement

### Migration Tools
- `discover-ansible-controller`: Find existing Ansible controllers on network
- `import-ansible-config`: Import inventory, playbooks, and configurations
- `migrate-controller`: Guided migration process
- `compare-inventories`: Compare current vs imported inventories

### SSH Key Management
- `generate-ssh-keys`: Create new SSH keypair for MCP server
- `distribute-ssh-keys`: Push public key to managed hosts
- `test-ssh-access`: Verify SSH key authentication
- `remove-ssh-keys`: Clean up old keys from hosts

### Authentication Setup
- `setup-proxmox-auth`: Configure Proxmox API tokens
- `setup-passwordless-sudo`: Configure sudo without passwords
- `install-dependencies`: Install required packages (sshpass, etc.)

## Implementation Details

### 1. Controller Discovery Schema
```javascript
const DiscoverControllerSchema = z.object({
  networkRange: z.string().describe('Network range to scan for controllers'),
  checkPaths: z.array(z.string()).optional().default([
    '/etc/ansible',
    '~/.ansible',
    '/opt/ansible',
    '/home/*/ansible'
  ]).describe('Paths to check for Ansible installations'),
  checkUsers: z.array(z.string()).optional().default([
    'ansible', 'shaun', 'ubuntu', 'debian'
  ]).describe('Users to check for Ansible configurations')
});
```

### 2. Import Configuration Schema
```javascript
const ImportConfigSchema = z.object({
  controllerHost: z.string().describe('Existing Ansible controller hostname/IP'),
  username: z.string().describe('Username on controller'),
  authMethod: z.enum(['password', 'key', 'agent']).describe('Authentication method'),
  password: z.string().optional().describe('Password (if using password auth)'),
  keyPath: z.string().optional().describe('SSH key path (if using key auth)'),
  importPaths: z.object({
    inventory: z.string().optional().default('/etc/ansible/hosts').describe('Inventory file path'),
    playbooks: z.string().optional().default('/etc/ansible/playbooks').describe('Playbooks directory'),
    roles: z.string().optional().default('/etc/ansible/roles').describe('Roles directory'),
    groupVars: z.string().optional().default('/etc/ansible/group_vars').describe('Group vars directory'),
    hostVars: z.string().optional().default('/etc/ansible/host_vars').describe('Host vars directory')
  }),
  backupOriginal: z.boolean().optional().default(true).describe('Backup original files'),
  mergeStrategy: z.enum(['replace', 'merge', 'prompt']).optional().default('prompt').describe('How to handle conflicts')
});
```

### 3. Migration Strategy Schema
```javascript
const MigrationStrategySchema = z.object({
  strategy: z.enum(['direct', 'proxy', 'hybrid']).describe('Migration strategy'),
  controllerHost: z.string().describe('Existing controller to migrate from'),
  newControllerRole: z.enum(['primary', 'secondary', 'retire']).describe('Role for existing controller'),
  hostsToMigrate: z.array(z.string()).optional().describe('Specific hosts to migrate (for hybrid)'),
  preserveController: z.boolean().optional().default(false).describe('Keep existing controller running'),
  generateNewKeys: z.boolean().optional().default(true).describe('Generate new SSH keys'),
  testConnections: z.boolean().optional().default(true).describe('Test all connections after migration')
});
```

### 4. SSH Key Management Schema
```javascript
const SSHKeyManagementSchema = z.object({
  action: z.enum(['generate', 'distribute', 'test', 'remove']).describe('SSH key action'),
  keyType: z.enum(['rsa', 'ed25519']).optional().default('ed25519').describe('SSH key type'),
  keySize: z.number().optional().default(4096).describe('Key size for RSA keys'),
  targets: z.array(z.string()).optional().describe('Target hosts for key distribution'),
  username: z.string().optional().default('root').describe('Username for SSH access'),
  forceOverwrite: z.boolean().optional().default(false).describe('Overwrite existing keys'),
  testAfterDistribution: z.boolean().optional().default(true).describe('Test SSH access after distribution')
});
```

## Discovery and Import Process

### Step 1: Discover Existing Controllers
```bash
# Scan network for Ansible controllers
discover-ansible-controller --networkRange="192.168.10.0/24"

# Expected output:
# Found Ansible controller: homelab2 (192.168.10.20)
#   User: shaun
#   Ansible version: 2.14.0
#   Inventory: /home/shaun/ansible/inventory
#   Playbooks: /home/shaun/ansible/playbooks
#   Managed hosts: 5 hosts found
```

### Step 2: Import Configuration
```bash
# Import from discovered controller
import-ansible-config \
  --controllerHost="192.168.10.20" \
  --username="shaun" \
  --authMethod="key" \
  --mergeStrategy="prompt"

# Interactive prompts:
# Found inventory with 5 hosts. Import? [y/N]
# Found 12 playbooks. Import all? [y/N]
# Found custom roles. Import? [y/N]
# Conflicts detected in group_vars. How to resolve? [replace/merge/skip]
```

### Step 3: Choose Migration Strategy
```bash
# Guided migration with options
migrate-controller \
  --strategy="direct" \
  --controllerHost="192.168.10.20" \
  --newControllerRole="retire" \
  --generateNewKeys=true

# Interactive process:
# 1. Import configurations ✓
# 2. Generate new SSH keys ✓
# 3. Distribute keys to managed hosts ✓
# 4. Test connections ✓
# 5. Update inventories ✓
# 6. Migrate playbook execution ✓
# 7. Retire old controller (optional) ?
```

## Implementation Functions

### Controller Discovery
```javascript
async function discoverAnsibleControllers(networkRange, options = {}) {
  const controllers = [];
  const devices = await discoverNetworkDevices(networkRange);
  
  for (const device of devices) {
    if (device.classification.openPorts.includes(22)) {
      // Test for Ansible installation
      const ansibleCheck = await testForAnsible(device.ip);
      if (ansibleCheck.hasAnsible) {
        controllers.push({
          host: device.ip,
          hostname: device.hostname,
          ansibleVersion: ansibleCheck.version,
          configPaths: ansibleCheck.configPaths,
          inventoryPaths: ansibleCheck.inventoryPaths,
          managedHosts: ansibleCheck.managedHosts
        });
      }
    }
  }
  
  return controllers;
}

async function testForAnsible(host) {
  // SSH into host and check for Ansible
  // Check common paths, versions, configurations
  // Return detailed information about Ansible setup
}
```

### Configuration Import
```javascript
async function importAnsibleConfig(config) {
  const results = {
    inventory: null,
    playbooks: [],
    roles: [],
    variables: {},
    conflicts: []
  };
  
  // Connect to existing controller
  const connection = await establishSSHConnection(config);
  
  // Import inventory
  if (config.importPaths.inventory) {
    results.inventory = await importInventoryFile(connection, config.importPaths.inventory);
  }
  
  // Import playbooks
  if (config.importPaths.playbooks) {
    results.playbooks = await importPlaybooks(connection, config.importPaths.playbooks);
  }
  
  // Import roles
  if (config.importPaths.roles) {
    results.roles = await importRoles(connection, config.importPaths.roles);
  }
  
  // Handle conflicts based on merge strategy
  if (config.mergeStrategy === 'prompt') {
    results.conflicts = await detectConflicts(results);
  }
  
  return results;
}
```

### SSH Key Management
```javascript
async function manageSSHKeys(config) {
  switch (config.action) {
    case 'generate':
      return await generateSSHKeyPair(config.keyType, config.keySize);
    
    case 'distribute':
      return await distributeSSHKeys(config.targets, config.username);
    
    case 'test':
      return await testSSHConnections(config.targets);
    
    case 'remove':
      return await removeSSHKeys(config.targets, config.username);
  }
}

async function generateSSHKeyPair(keyType = 'ed25519', keySize = 4096) {
  const keyPath = path.join(os.homedir(), '.ssh', 'mcp_ansible_key');
  
  let command;
  if (keyType === 'ed25519') {
    command = `ssh-keygen -t ed25519 -f ${keyPath} -N "" -C "mcp-ansible-controller"`;
  } else {
    command = `ssh-keygen -t rsa -b ${keySize} -f ${keyPath} -N "" -C "mcp-ansible-controller"`;
  }
  
  await execAsync(command);
  
  return {
    privateKey: `${keyPath}`,
    publicKey: `${keyPath}.pub`,
    keyType,
    keySize: keyType === 'ed25519' ? 256 : keySize
  };
}
```

## Migration Workflows

### Workflow 1: Full Migration (homelab2 → MCP)
1. **Discovery**: Find homelab2 and inventory its Ansible setup
2. **Import**: Copy all configurations to MCP server
3. **Key Generation**: Create new SSH keypair for MCP
4. **Key Distribution**: Push new keys to all managed hosts
5. **Testing**: Verify MCP can control all hosts
6. **Cutover**: Switch from homelab2 to MCP
7. **Cleanup**: Optional retirement of homelab2

### Workflow 2: Gradual Migration
1. **Import**: Copy configurations but keep homelab2 active
2. **Parallel Setup**: MCP manages new hosts, homelab2 keeps existing
3. **Selective Migration**: Move hosts one by one to MCP control
4. **Final Cutover**: Complete migration when confident

### Workflow 3: Proxy Mode
1. **Interface Setup**: MCP becomes front-end for homelab2
2. **Command Delegation**: MCP forwards commands to homelab2
3. **Gradual Enhancement**: Add MCP-specific features over time
4. **Optional Migration**: Eventually migrate if desired

## Benefits

### For Your Situation
- **Preserve Existing Work**: Don't lose current Ansible setup
- **Smooth Transition**: Choose migration pace and method
- **Flexible Options**: Keep, migrate, or retire homelab2
- **Enhanced Capabilities**: Gain MCP features while keeping existing automation

### Security Improvements
- **Key-based Authentication**: No more password dependencies
- **Centralized Key Management**: Single point for SSH key distribution
- **Secure Migration**: Encrypted transfer of configurations
- **Access Control**: Granular control over host access

## Implementation Priority

### Phase 1: Discovery and Import (Immediate)
- `discover-ansible-controller`
- `import-ansible-config`
- `generate-ssh-keys`
- `distribute-ssh-keys`

### Phase 2: Migration Tools (Short-term)
- `migrate-controller`
- `test-ssh-access`
- `compare-inventories`

### Phase 3: Advanced Features (Medium-term)
- Conflict resolution UI
- Rollback capabilities
- Hybrid management modes
- Configuration synchronization

This approach gives you complete flexibility to transition from homelab2 to the MCP server at your own pace while preserving all your existing work!