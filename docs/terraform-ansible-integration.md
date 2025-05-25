# Terraform + Ansible Integration in MCP Server

This MCP server now provides a unified interface for provisioning VMs with Terraform and configuring them with Ansible.

## Available Tools

### Infrastructure Provisioning (Terraform)

1. **create-vm-template** - Generate Terraform configurations for Proxmox VMs
   ```json
   {
     "name": "nextcloud-vm",
     "type": "nextcloud",
     "cores": 4,
     "memory": 8192,
     "disk": "100G",
     "ip": "192.168.10.50"
   }
   ```

2. **terraform-plan** - Preview infrastructure changes
   ```json
   {
     "directory": "terraform/nextcloud",
     "vars": {
       "proxmox_api_token_id": "root@pam!ansible",
       "proxmox_api_token_secret": "your-secret"
     }
   }
   ```

3. **terraform-apply** - Create/update infrastructure
   ```json
   {
     "directory": "terraform/nextcloud",
     "autoApprove": true,
     "vars": {
       "proxmox_api_token_id": "root@pam!ansible",
       "proxmox_api_token_secret": "your-secret"
     }
   }
   ```

4. **terraform-output** - Get infrastructure details
   ```json
   {
     "directory": "terraform/nextcloud",
     "json": true
   }
   ```

### Full Stack Deployment

**homelab-deploy** - Complete VM creation and service configuration
```json
{
  "service": "nextcloud",
  "vmConfig": {
    "cores": 4,
    "memory": 8192,
    "disk": "100G",
    "ip": "192.168.10.50"
  },
  "ansibleVars": {
    "nextcloud_domain": "cloud.example.com",
    "admin_password": "secure-password"
  }
}
```

## Example Workflows

### Deploy Nextcloud
```bash
# AI agent can use these commands:

# 1. Create and deploy VM + configure Nextcloud
homelab-deploy {
  "service": "nextcloud",
  "vmConfig": {
    "ip": "192.168.10.50"
  }
}

# 2. Or step by step:
# Create VM template
create-vm-template {
  "name": "nextcloud",
  "type": "nextcloud",
  "ip": "192.168.10.50"
}

# Apply infrastructure
terraform-apply {
  "directory": "terraform/nextcloud",
  "autoApprove": true
}

# Configure with Ansible
ansible-playbook {
  "playbook": "homelab_playbook/nextcloud/deploy-nextcloud.yml",
  "extraVars": {
    "target_host": "192.168.10.50"
  }
}
```

### Destroy Infrastructure
```bash
terraform-apply {
  "directory": "terraform/nextcloud",
  "destroy": true,
  "autoApprove": true
}
```

## Network Visualization

After deployment, visualize your infrastructure:
```bash
# Capture current state
capture-state {
  "name": "after-nextcloud-deploy"
}

# Generate network diagram
network-topology {
  "format": "mermaid"
}

# Compare before/after
generate-diagram {
  "type": "change-impact",
  "beforeState": "states/before-deploy.json",
  "afterState": "states/after-nextcloud-deploy.json"
}
```

## Setup Requirements

1. **Terraform** must be installed
2. **Proxmox API Token** with VM creation permissions
3. **Ubuntu Cloud Image** template on Proxmox
4. **SSH Key** for VM access

## Environment Variables

Set these for easier usage:
```bash
export PROXMOX_API_URL="https://192.168.10.10:8006/api2/json"
export PROXMOX_API_TOKEN_ID="root@pam!ansible"
export PROXMOX_API_TOKEN_SECRET="your-secret"
```