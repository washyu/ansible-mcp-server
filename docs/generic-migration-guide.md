# Generic Ansible Controller Migration Guide

## Overview
This guide helps you migrate from an existing Ansible controller to the MCP server, regardless of your specific setup.

## Before You Start

### Typical Infrastructure Discovery
Replace these examples with your actual values:
- **Proxmox Host**: `YOUR_PROXMOX_HOST` (your hypervisor)
- **Existing Controller**: `YOUR_ANSIBLE_CONTROLLER` (current Ansible server)
- **Network Range**: `YOUR_NETWORK_SUBNET` (your subnet)
- **Controller User**: `ansible` or `admin` (your username)

## Migration Steps

### 1. Install Dependencies
```bash
# Install required packages on MCP server
install-dependencies --packages='["sshpass", "ansible"]'
```

### 2. Discover Your Infrastructure
```bash
# Find existing Ansible controllers on your network
discover-ansible-controller --networkRange="YOUR_NETWORK/24"

# Discover all VMs on your Proxmox server
discover-proxmox --host="YOUR_PROXMOX_IP" --user="root@pam"
```

### 3. Set Up SSH Authentication
```bash
# Generate new SSH keys for MCP
manage-ssh-keys --action="generate" --keyType="ed25519"

# Distribute keys to your servers
manage-ssh-keys --action="distribute" --targets='["YOUR_CONTROLLER_IP", "YOUR_PROXMOX_IP"]' --username="YOUR_USERNAME"

# Test connections
manage-ssh-keys --action="test" --targets='["YOUR_CONTROLLER_IP", "YOUR_PROXMOX_IP"]'
```

### 4. Import Existing Configuration
```bash
# Import from your existing controller
import-ansible-config \
  --controllerHost="YOUR_CONTROLLER_IP" \
  --username="YOUR_USERNAME" \
  --authMethod="key"
```

### 5. Add Controller as External Server
```bash
# Add your existing controller to MCP inventory
add-external-server \
  --hostname="YOUR_CONTROLLER_IP" \
  --type="generic" \
  --purpose="Former Ansible controller" \
  --connection='{"method":"ssh","username":"YOUR_USERNAME"}'
```

## Example Network Topology

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   MCP Server    │    │ Existing Ansible│    │  Proxmox Host   │
│  YOUR_GATEWAY_IP0   │───►│   Controller    │───►│  YOUR_PROXMOX_HOST  │
│                 │    │  YOUR_ANSIBLE_CONTROLLER   │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 ▼
                    ┌─────────────────────────┐
                    │     Managed VMs         │
                    │  YOUR_GATEWAY_IP01-199      │
                    └─────────────────────────┘
```

## Migration Strategies

### Option 1: Full Migration
- MCP takes complete control
- Existing controller becomes a regular managed server
- Best for clean slate approach

### Option 2: Gradual Migration
- Both controllers run in parallel
- Migrate hosts one by one
- Safest approach for production

### Option 3: Proxy Mode
- MCP uses existing controller as backend
- Minimal disruption
- Good for testing MCP features

## Generic Examples

### Typical Discovery Results
```json
{
  "controllers": [
    {
      "host": "YOUR_ANSIBLE_CONTROLLER",
      "hostname": "ansible-controller",
      "username": "ansible",
      "ansibleVersion": "2.14.0",
      "managedHosts": 5,
      "configPaths": ["/etc/ansible", "/home/ansible/.ansible"],
      "inventoryPaths": ["/etc/ansible/hosts"],
      "roles": ["common", "webserver", "database"]
    }
  ]
}
```

### Sample External Server Addition
```bash
# NAS Server
add-external-server --hostname="nas-server.local" --type="nas"

# DNS Server  
add-external-server --hostname="dns-server.local" --type="pihole"

# Gateway/Router
add-external-server --hostname="YOUR_GATEWAY_IP" --type="gateway"
```

## Best Practices

### Security
- Always use SSH key authentication
- Test connections before full migration
- Keep backup access to original controller

### Planning
- Document your current inventory
- Plan migration during maintenance window
- Have rollback plan ready

### Testing
- Test with non-production servers first
- Verify all playbooks work through MCP
- Confirm external server management

## Troubleshooting

### Common Issues
```bash
# Can't find existing controller
test-server-connectivity --hostname="YOUR_CONTROLLER_IP" --method="ping"

# SSH authentication fails
manage-ssh-keys --action="test" --targets='["YOUR_CONTROLLER_IP"]'

# Proxmox discovery fails
install-dependencies --packages='["sshpass"]'
```

## Post-Migration

After successful migration:
1. Deploy new services using service catalog
2. Set up network device discovery
3. Configure backup strategies
4. Plan for multi-cloud expansion (if desired)

## Environment Variables

Set these for your specific environment:
```bash
export PROXMOX_HOST="YOUR_PROXMOX_HOST"
export PROXMOX_USER="root@pam"
export DEFAULT_GATEWAY="YOUR_GATEWAY_IP"
export DEFAULT_NETWORK_CIDR="24"
```

This guide provides the framework - adapt the IP addresses, hostnames, and usernames to match your specific infrastructure.