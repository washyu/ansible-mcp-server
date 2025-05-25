# TODO: External Server Management

## Overview
Add capability to manage external servers (TrueNAS, Pi-hole, gateway servers, etc.) in the Ansible inventory for complete network infrastructure visibility and control.

## Current Limitation
- **VM-centric**: Only manages VMs created by the MCP server
- **Limited scope**: Missing critical network infrastructure devices
- **Incomplete view**: No visibility into existing network services
- **Manual inventory**: Users must manually manage external devices

## Target External Servers

### 1. Network Infrastructure
- **Gateway/Router**: pfSense, OPNsense, OpenWrt
- **DNS Servers**: Pi-hole, AdGuard Home, Unbound
- **DHCP Servers**: ISC DHCP, Dnsmasq
- **VPN Servers**: WireGuard, OpenVPN, Tailscale
- **Proxy Servers**: Squid, HAProxy, Nginx

### 2. Storage Systems
- **NAS Devices**: TrueNAS, FreeNAS, Synology, QNAP
- **File Servers**: Samba, NFS servers
- **Backup Servers**: Bacula, Amanda, Duplicati
- **Object Storage**: MinIO, Ceph

### 3. Monitoring & Security
- **Monitoring**: Zabbix, Nagios, PRTG nodes
- **Security**: Firewalls, IDS/IPS systems
- **Log Servers**: Syslog servers, ELK stack nodes
- **Certificate Authorities**: Internal CA servers

### 4. IoT & Smart Home
- **Home Automation**: Home Assistant, OpenHAB
- **IoT Gateways**: Zigbee coordinators, Z-Wave controllers
- **Media Servers**: Existing Plex/Jellyfin instances
- **Smart Devices**: Managed switches, APs, cameras

### 5. Legacy Systems
- **Physical Servers**: Bare metal Linux/Windows servers
- **Old VMs**: VMs on other hypervisors (VMware, Hyper-V)
- **Appliances**: Hardware appliances with SSH access
- **Embedded Systems**: Raspberry Pi, Arduino with network access

## New MCP Tools

### Core External Server Management
- `add-external-server`: Add external server to inventory
- `discover-network-devices`: Auto-discover devices on network
- `remove-external-server`: Remove server from management
- `update-server-info`: Update server details and capabilities
- `test-server-connectivity`: Test SSH/API connectivity
- `classify-server-type`: Auto-detect server type and purpose

### Discovery and Scanning
- `network-scan`: Scan network range for responsive devices
- `port-scan-server`: Identify services running on a server
- `detect-server-os`: Identify operating system and version
- `discover-services`: Find running services and their purposes
- `map-network-topology`: Create network device relationship map

### Inventory Management
- `generate-external-inventory`: Create inventory from external servers
- `merge-inventories`: Combine discovered and external inventories
- `validate-inventory`: Check inventory for issues
- `optimize-inventory-groups`: Suggest better grouping strategies
- `export-inventory`: Export to different formats (YAML, JSON, INI)

### Server Interaction
- `execute-on-external`: Run commands on external servers
- `deploy-to-external`: Deploy configurations to external servers
- `backup-external-config`: Backup external server configurations
- `monitor-external-health`: Check health of external servers

## Implementation Details

### 1. Add External Server Schema
```javascript
const AddExternalServerSchema = z.object({
  hostname: z.string().describe('Server hostname or IP address'),
  alias: z.string().optional().describe('Friendly name for the server'),
  type: z.enum([
    'truenas', 'pihole', 'gateway', 'nas', 'monitoring', 
    'backup', 'media', 'iot', 'security', 'generic'
  ]).describe('Type of server'),
  purpose: z.string().optional().describe('Server purpose description'),
  connection: z.object({
    method: z.enum(['ssh', 'api', 'snmp', 'web']).describe('Connection method'),
    port: z.number().optional().describe('Connection port'),
    username: z.string().optional().describe('Username for authentication'),
    keyPath: z.string().optional().describe('SSH key path'),
    apiToken: z.string().optional().describe('API token for web APIs')
  }),
  groups: z.array(z.string()).optional().describe('Ansible groups to add server to'),
  variables: z.record(z.any()).optional().describe('Ansible host variables'),
  monitoring: z.object({
    enabled: z.boolean().optional().default(true),
    checks: z.array(z.string()).optional().describe('Health checks to perform')
  }).optional()
});
```

### 2. Network Discovery Schema
```javascript
const NetworkDiscoverySchema = z.object({
  networkRange: z.string().describe('Network range to scan (e.g., 192.168.1.0/24)'),
  methods: z.array(z.enum(['ping', 'arp', 'nmap', 'mdns'])).optional().default(['ping', 'arp']),
  ports: z.array(z.number()).optional().describe('Specific ports to check'),
  timeout: z.number().optional().default(5).describe('Timeout in seconds'),
  resolve: z.boolean().optional().default(true).describe('Resolve hostnames'),
  classify: z.boolean().optional().default(true).describe('Attempt to classify device types')
});
```

### 3. Server Classification Logic
```javascript
const serverClassification = {
  truenas: {
    ports: [80, 443],
    services: ['freenas-ui', 'truenas-ui'],
    patterns: ['TrueNAS', 'FreeNAS'],
    api: '/api/v2.0/system/info'
  },
  pihole: {
    ports: [80, 443, 53],
    services: ['lighttpd', 'dnsmasq'],
    patterns: ['Pi-hole', 'dnsmasq'],
    api: '/admin/api.php'
  },
  pfsense: {
    ports: [80, 443],
    services: ['nginx', 'lighttpd'],
    patterns: ['pfSense', 'OPNsense'],
    api: '/api/v1/system/info'
  },
  homeassistant: {
    ports: [8123],
    services: ['hass'],
    patterns: ['Home Assistant'],
    api: '/api/'
  }
};
```

## External Server Types Configuration

### 1. TrueNAS Integration
```yaml
# TrueNAS server configuration
truenas-main:
  hostname: truenas.local
  type: truenas
  purpose: Primary NAS storage
  connection:
    method: api
    port: 443
    api_token: "{{ truenas_api_token }}"
  capabilities:
    - storage_management
    - snapshot_management
    - share_management
    - backup_destination
  ansible_groups:
    - storage_servers
    - backup_targets
  variables:
    truenas_version: "13.0"
    storage_pools: ["tank", "backup"]
```

### 2. Pi-hole Integration
```yaml
# Pi-hole DNS server
pihole-dns:
  hostname: pihole.local
  type: pihole
  purpose: Network-wide ad blocking
  connection:
    method: api
    port: 80
    api_token: "{{ pihole_api_token }}"
  capabilities:
    - dns_management
    - blocklist_management
    - query_logging
    - dhcp_management
  ansible_groups:
    - dns_servers
    - network_services
  variables:
    pihole_version: "5.17"
    blocked_domains: 2000000
```

### 3. Gateway/Router Integration
```yaml
# pfSense gateway
gateway-main:
  hostname: 192.168.1.1
  type: gateway
  purpose: Main network gateway
  connection:
    method: ssh
    port: 22
    username: admin
    key_path: "~/.ssh/pfsense_key"
  capabilities:
    - firewall_management
    - vpn_management
    - traffic_monitoring
    - port_forwarding
  ansible_groups:
    - network_infrastructure
    - security_devices
  variables:
    gateway_type: "pfsense"
    wan_interface: "em0"
    lan_interface: "em1"
```

## Discovery and Auto-Configuration

### 1. Network Scanning
```bash
# Discover all devices on network
discover-network-devices --network="192.168.1.0/24" --classify=true

# Output example:
# Found 15 devices:
# 192.168.1.1    - Gateway (pfSense detected)
# 192.168.1.10   - TrueNAS (API available on :443)
# 192.168.1.15   - Pi-hole (DNS server detected)
# 192.168.1.20   - Home Assistant (Port 8123 open)
# 192.168.1.100  - Generic Linux server
```

### 2. Automatic Classification
```javascript
async function classifyDevice(ip, openPorts, services) {
  const classifications = [];
  
  // Check for TrueNAS
  if (openPorts.includes(443)) {
    try {
      const response = await fetch(`https://${ip}/api/v2.0/system/info`);
      if (response.ok) {
        const data = await response.json();
        if (data.version && data.version.includes('TrueNAS')) {
          classifications.push({
            type: 'truenas',
            confidence: 0.95,
            version: data.version
          });
        }
      }
    } catch {}
  }
  
  // Check for Pi-hole
  if (openPorts.includes(80) && openPorts.includes(53)) {
    try {
      const response = await fetch(`http://${ip}/admin/api.php?summary`);
      if (response.ok) {
        classifications.push({
          type: 'pihole',
          confidence: 0.90
        });
      }
    } catch {}
  }
  
  return classifications;
}
```

### 3. Guided Setup
```bash
# Interactive server addition
add-external-server --interactive

# Prompts:
# Server IP/hostname: truenas.local
# Detected: TrueNAS Core 13.0
# Purpose [Primary NAS]: 
# SSH access available: Yes
# API access available: Yes (requires token)
# Add to groups [storage_servers]: storage_servers,backup_targets
# Enable monitoring [Y/n]: Y
```

## Integration with Existing Infrastructure

### 1. Unified Inventory
```yaml
# Combined inventory with VMs and external servers
all:
  children:
    proxmox_vms:
      hosts:
        nextcloud-vm:
          ansible_host: 192.168.1.50
          vm_id: 101
          created_by: mcp_server
        gitlab-vm:
          ansible_host: 192.168.1.51
          vm_id: 102
          created_by: mcp_server
    
    external_servers:
      hosts:
        truenas-main:
          ansible_host: truenas.local
          server_type: truenas
          managed_externally: true
        pihole-dns:
          ansible_host: pihole.local
          server_type: pihole
          managed_externally: true
    
    storage_servers:
      hosts:
        truenas-main:
        backup-vm:  # MCP-created backup server
    
    dns_servers:
      hosts:
        pihole-dns:
        secondary-dns-vm:  # MCP-created DNS server
```

### 2. Cross-Service Dependencies
```yaml
# Service dependencies across managed and external servers
nextcloud:
  dependencies:
    storage:
      - truenas-main  # External NAS for file storage
      - backup-vm     # MCP-managed backup server
    dns:
      - pihole-dns    # External DNS server
    gateway:
      - pfsense-main  # External gateway for port forwarding
```

### 3. Unified Monitoring
```bash
# Monitor all infrastructure (VMs + external)
check-all-servers --include-external=true

# Output:
# MCP-Managed VMs:
#   ✓ nextcloud-vm (192.168.1.50) - Healthy
#   ✓ gitlab-vm (192.168.1.51) - Healthy
# 
# External Servers:
#   ✓ truenas-main (truenas.local) - Healthy
#   ✓ pihole-dns (pihole.local) - Healthy
#   ⚠ gateway-main (192.168.1.1) - High CPU usage
```

## Playbook Integration

### 1. External Server Playbooks
```yaml
# Deploy configuration to external TrueNAS
- name: Configure TrueNAS shares
  hosts: truenas_servers
  tasks:
    - name: Create dataset for Nextcloud
      truenas_dataset:
        name: "tank/nextcloud"
        quota: "500G"
        api_token: "{{ truenas_api_token }}"
    
    - name: Configure SMB share
      truenas_share:
        name: "nextcloud"
        path: "/mnt/tank/nextcloud"
        type: "smb"
        enabled: true
```

### 2. Cross-Infrastructure Orchestration
```yaml
# Deploy service with external dependencies
- name: Deploy Nextcloud with external storage
  hosts: localhost
  tasks:
    # 1. Prepare storage on external TrueNAS
    - name: Setup NAS storage
      include_tasks: setup-truenas-storage.yml
      delegate_to: truenas-main
    
    # 2. Configure DNS on external Pi-hole
    - name: Add DNS record
      pihole_dns:
        hostname: "nextcloud.local"
        ip: "{{ nextcloud_vm_ip }}"
      delegate_to: pihole-dns
    
    # 3. Deploy VM and configure service
    - name: Deploy Nextcloud VM
      include_tasks: deploy-nextcloud-vm.yml
    
    # 4. Configure port forwarding on gateway
    - name: Setup port forwarding
      pfsense_rule:
        interface: "wan"
        destination_port: 443
        redirect_target: "{{ nextcloud_vm_ip }}"
      delegate_to: gateway-main
```

## Use Cases

### 1. Complete Homelab Management
```bash
# Discover and add all homelab devices
discover-network-devices --network="192.168.1.0/24"
add-external-server --hostname="truenas.local" --type="truenas"
add-external-server --hostname="pihole.local" --type="pihole"
add-external-server --hostname="192.168.1.1" --type="gateway"

# Deploy new service with external integrations
deploy-service --service="nextcloud" --vm-name="nextcloud-prod" \
  --storage-backend="truenas-main" \
  --dns-server="pihole-dns" \
  --gateway="pfsense-main"
```

### 2. Network Infrastructure Updates
```bash
# Update all DNS servers (including external Pi-hole)
ansible-playbook update-dns-config.yml --limit="dns_servers"

# Update firewall rules across all security devices
ansible-playbook update-firewall.yml --limit="security_devices"
```

### 3. Backup Orchestration
```bash
# Backup to external TrueNAS
create-backup --type="full" --destination="truenas://truenas-main/backups"

# Backup external server configs
backup-external-config --servers="pihole-dns,gateway-main"
```

## Implementation Priority

### Phase 1: Core External Server Support (v1.1)
- [ ] Add external server registration
- [ ] Basic SSH connectivity testing
- [ ] Simple inventory integration
- [ ] Manual server addition

### Phase 2: Discovery and Classification (v1.2)
- [ ] Network device discovery
- [ ] Automatic server type detection
- [ ] Guided setup wizard
- [ ] Common device templates (TrueNAS, Pi-hole, pfSense)

### Phase 3: Advanced Integration (v1.3)
- [ ] Cross-infrastructure playbooks
- [ ] Dependency management
- [ ] Unified monitoring
- [ ] External server APIs integration

### Phase 4: Complete Ecosystem (v1.4)
- [ ] Advanced orchestration
- [ ] External backup integration
- [ ] Network topology mapping
- [ ] Compliance and reporting

## Benefits

### 1. Complete Infrastructure Visibility
- **Unified view**: All network devices in one inventory
- **Centralized management**: Single tool for all infrastructure
- **Relationship mapping**: Understand service dependencies
- **Comprehensive monitoring**: Health status of entire network

### 2. Enhanced Automation
- **Cross-platform orchestration**: Coordinate between different systems
- **Dependency-aware deployments**: Ensure prerequisites are met
- **Integrated backup strategies**: Include external storage systems
- **Network-wide configuration management**: Consistent settings across all devices

### 3. Simplified Operations
- **Reduced complexity**: One tool instead of many
- **Consistent workflows**: Same processes for all servers
- **Unified documentation**: Single source of truth for infrastructure
- **Streamlined troubleshooting**: Centralized logging and monitoring

This enhancement transforms the MCP server from a VM management tool into a comprehensive network infrastructure automation platform, providing complete visibility and control over the entire technology stack.