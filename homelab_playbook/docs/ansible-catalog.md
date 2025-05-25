# Ansible Homelab Catalog
Generated: May 23, 2025

## Current Infrastructure Status

### ✅ Working Hosts
1. **homelab2** (192.168.10.108)
   - OS: Ubuntu 24.04
   - Connection: Local (no SSH needed)
   - Status: Fully operational
   - MCP Server: Installed and running

2. **linuxrwifi** (192.168.10.1)
   - OS: Ubuntu 24.04
   - Connection: SSH working
   - Status: Fully operational
   - Note: Has sudo password set as "your_sudo_password" in inventory

### ❌ Hosts Needing Attention
1. **amdaiserver** (192.168.10.200)
   - OS: Debian 12.10 (per old report)
   - Issue: SSH authentication failing
   - Status: Host is reachable (ping works)
   - Action needed: Set up SSH key authentication or create shaun user

2. **truenas** (192.168.10.164)
   - OS: Debian 12.9 (per old report)
   - Issue: SSH connection refused on port 22
   - Status: Host is reachable (ping works)
   - Action needed: Check if SSH is on different port or needs to be enabled

## Available Playbooks

### System Discovery & Monitoring
- `discover.yml` - Basic system discovery (hostname, OS, services, ports)
- `detailed_discover.yml` - Extended discovery with more details
- `absolute_discover.yml` - Complete system discovery

### Monitoring Setup
- `monitoring.yml` - Basic monitoring setup
- `setup_monitoring_fixed.yml` - Complete monitoring stack setup
- `node_exporter.yml` - Install Prometheus node exporter
- `install_node_exporters.yml` - Deploy node exporters to multiple hosts
- `update_prometheus_working.yml` - Update Prometheus configuration

### TrueNAS Specific
- `truenas_exporter.yml` - TrueNAS metrics exporter
- `truenas_exporter_alt.yml` - Alternative TrueNAS exporter
- `truenas_exporter_corrected.yml` - Fixed version
- `truenas_exporter_final.yml` - Final working version

### System Management
- `setup_management.yml` - Management tools setup
- `update_systems.yml` - System updates
- `backup.yml` - Backup configuration

## Ansible Configuration
- **Inventory**: `/home/shaun/ansible/inventory/hosts`
- **Playbooks**: `/home/shaun/ansible/playbooks/`
- **Reports**: `/home/shaun/ansible/reports/`
- **Vault**: `/home/shaun/ansible/vault.yml` (encrypted secrets)

## MCP Server Status
- **Location**: `/opt/ansible-mcp-server` on homelab2
- **Service**: `ansible-mcp-server.service`
- **Status**: Installed and ready (requires client connection)
- **Tools Available**:
  - `ansible-playbook` - Run playbooks
  - `ansible-inventory` - List inventory
  - `ansible-galaxy` - Manage roles/collections
  - `ansible-command` - Run arbitrary ansible commands

## Next Steps
1. Fix SSH access to amdaiserver:
   - Create shaun user with sudo access
   - Or set up SSH key for existing user

2. Fix TrueNAS SSH access:
   - Check if SSH is on different port
   - Or enable SSH service if disabled

3. Update sudo password for linuxrwifi in inventory

4. Test monitoring playbooks on working hosts

5. Consider setting up ansible-vault for sensitive data