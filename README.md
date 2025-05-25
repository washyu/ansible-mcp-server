# Ansible MCP Server

A Model Context Protocol (MCP) server that provides Ansible CLI integration, allowing AI models to execute Ansible commands with proper error handling and JSON responses.

## Features

### Core Ansible Integration
- Execute `ansible-playbook` commands with full parameter support
- Manage inventory with `ansible-inventory`
- Handle roles and collections via `ansible-galaxy`
- Run arbitrary Ansible commands safely
- Create and manage Ansible playbooks
- Generate infrastructure diagrams from inventory

### Terraform Integration
- Create and manage VM templates for Proxmox
- Execute terraform plan/apply/output commands
- Full infrastructure-as-code support

### Service Catalog (NEW!)
- Browse 20+ self-hosted services across 9 categories
- View detailed service information including:
  - Resource requirements (CPU, memory, disk)
  - Feature lists and alternatives
  - Links to documentation and GitHub
- Dynamic service deployment with custom configurations
- Services include: Nextcloud, GitLab, Jenkins, Jellyfin, Pi-hole, and more

### Windows Compatibility
- Server-Sent Events (SSE) proxy for Windows Claude Desktop
- Alternative to SSH transport for network communication
- Full MCP functionality on Windows

### Infrastructure Management
- Deploy complete service stacks (VM + configuration)
- Server maintenance tools (updates, cleanup, monitoring)
- Network topology visualization
- Change impact analysis

## Prerequisites

- Node.js 18+ 
- Ansible (will be installed automatically if not present)
- Linux system (for systemd integration)

## Installation

### Local Installation

```bash
cd ansible-mcp-server
npm install
sudo ./scripts/install.sh
```

### Deploy to Remote Server (homelab2)

```bash
# Ensure you have SSH key authentication set up
./scripts/deploy-to-homelab2.sh

# Or with custom username
REMOTE_USER=myuser ./scripts/deploy-to-homelab2.sh
```

## Usage

### As a Systemd Service

```bash
# Start the service
sudo systemctl start ansible-mcp-server

# Enable at boot
sudo systemctl enable ansible-mcp-server

# Check status
sudo systemctl status ansible-mcp-server

# View logs
sudo journalctl -u ansible-mcp-server -f
```

### Manual Execution

```bash
# Run directly
ansible-mcp

# Or from project directory
npm start
```

## MCP Tools

### ansible-playbook
Execute Ansible playbooks with various options:
```json
{
  "playbook": "/path/to/playbook.yml",
  "inventory": "/path/to/inventory",
  "limit": "webservers",
  "tags": "deploy,configure",
  "extraVars": {
    "version": "1.2.3",
    "environment": "production"
  },
  "check": false,
  "verbose": true
}
```

### ansible-inventory
Display or dump configured inventory:
```json
{
  "inventory": "/path/to/inventory",
  "list": true,
  "host": "server1",
  "graph": false
}
```

### ansible-galaxy
Manage Ansible roles and collections:
```json
{
  "action": "install",
  "name": "geerlingguy.docker",
  "source": "https://galaxy.ansible.com",
  "force": false
}
```

### ansible-command
Run arbitrary Ansible commands:
```json
{
  "command": "ansible all -m ping",
  "args": ["-i", "inventory.ini"]
}
```

### browse-services
Browse available services in the catalog:
```json
{
  "category": "dev-tools",
  "search": "git",
  "showAlternatives": true
}
```

### service-details
Get detailed information about a specific service:
```json
{
  "serviceName": "jenkins"
}
```

### deploy-service
Deploy a service from the catalog:
```json
{
  "serviceName": "gitea",
  "vmName": "git-server",
  "ip": "192.168.1.120",
  "customConfig": {
    "GITEA_DOMAIN": "git.example.com"
  }
}
```

## Response Format

All commands return JSON responses:

```json
{
  "success": true,
  "output": "Command output here",
  "error": "Any error output",
  "exitCode": 0
}
```

## Security Considerations

- The service runs with limited privileges (`nobody:nogroup`)
- Restricted to Ansible commands only
- Temporary files are isolated
- System and home directories are protected

## Uninstallation

```bash
sudo ./scripts/uninstall.sh
```

## Development

```bash
# Install dev dependencies
npm install

# Run in development mode with auto-reload
npm run dev

# Run tests
npm test
```

## Windows Users

For Windows users connecting Claude Desktop to a remote MCP server, we provide an SSE (Server-Sent Events) proxy solution that works reliably over HTTP:

### Quick Setup

1. **On your Linux server**:
   ```bash
   sudo ./deploy-sse-server.sh
   ```

2. **On your Windows machine**:
   ```powershell
   # Run in PowerShell as Administrator
   .\windows-setup.ps1
   ```

3. **Restart Claude Desktop**

See [Windows SSE Setup Guide](docs/windows-sse-setup.md) for detailed instructions.

### Alternative Options

1. **Use WSL2**: Run the MCP server locally in WSL2
2. **Use Docker Desktop**: Run the containerized version locally
3. **VPN Access**: Connect to your homelab network via VPN

## Troubleshooting

1. **SSH connection fails during deployment**
   - Ensure SSH key authentication is set up
   - Check hostname resolution for 'homelab2'
   - Verify the remote user has sudo privileges

2. **Ansible commands fail**
   - Ensure Ansible is installed (`ansible --version`)
   - Check inventory file paths are correct
   - Verify playbook syntax

3. **Service won't start**
   - Check logs: `sudo journalctl -u ansible-mcp-server -n 50`
   - Verify Node.js is installed
   - Ensure port is not in use

4. **Windows Claude Desktop connection issues**
   - Check firewall allows port 3001
   - Verify API token matches between client and server
   - Test SSE server health: `curl http://server-ip:3001/health`
   - See [Windows SSE Setup Guide](docs/windows-sse-setup.md)

## License

MIT