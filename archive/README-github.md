# Ansible MCP Server

A Model Context Protocol (MCP) server that provides comprehensive infrastructure automation through Ansible, Terraform, and Proxmox integration. This server enables AI assistants like Claude to manage and deploy infrastructure using natural language commands.

## Features

### 🔧 Core Capabilities
- **Ansible Integration**: Execute playbooks, manage inventory, install roles/collections
- **Terraform Support**: Plan, apply, and manage infrastructure as code
- **Proxmox Automation**: Create and manage VMs, deploy services
- **Interactive Setup**: Configure your environment through conversation
- **Self-Management**: Health checks, log access, service restart capabilities

### 🚀 Deployment Options
- **Docker**: Fully containerized with all dependencies
- **Proxmox VM**: Direct VM deployment with automated setup
- **Local Installation**: Run on any Linux system
- **Windows Support**: Connect via SSE proxy from Windows Claude Desktop

### 🛠️ Available Tools

#### Ansible Tools
- `ansible-playbook` - Run Ansible playbooks
- `ansible-inventory` - Display or dump configured inventory
- `ansible-galaxy` - Manage roles and collections
- `ansible-command` - Execute arbitrary Ansible commands
- `create-playbook` - Create new playbooks from content

#### Infrastructure Visualization
- `network-topology` - Generate network diagrams from inventory
- `generate-diagram` - Create infrastructure diagrams
- `capture-state` - Snapshot current infrastructure state

#### Terraform Tools
- `terraform-plan` - Create execution plans
- `terraform-apply` - Apply infrastructure changes
- `terraform-output` - Get outputs from state
- `create-vm-template` - Generate Terraform configurations

#### Homelab Automation
- `homelab-deploy` - Full stack deployment (VM + configuration)

#### Server Management
- `server-restart` - Restart MCP or SSE services
- `server-logs` - Retrieve service logs
- `server-health` - Check dependencies and service status
- `server-debug` - Run diagnostic commands

#### Interactive Setup
- `setup-wizard` - Interactive configuration guide
- `setup-proxmox` - Configure Proxmox connection
- `setup-network` - Set network parameters
- `setup-services` - Configure service IPs
- `get-config` - View current configuration
- `test-connection` - Test service connectivity

## Quick Start

### Option 1: Docker (Recommended)

```bash
# Clone the repository
git clone https://github.com/yourusername/ansible-mcp-server.git
cd ansible-mcp-server

# Run setup script
./setup.sh

# Choose Docker installation and follow prompts
```

### Option 2: Direct Installation

```bash
# Install dependencies
sudo ./scripts/install-dependencies.sh

# Install MCP server
sudo ./scripts/install.sh

# Start the service
sudo systemctl start ansible-mcp-server
```

### Option 3: Windows Claude Desktop

See [Windows SSE Setup Guide](docs/windows-sse-setup.md) for detailed instructions.

1. Deploy MCP server on Linux (Docker or VM)
2. Run Windows setup script on your PC
3. Configure Claude Desktop to use the proxy

## Configuration

The MCP server can be configured interactively through Claude:

```
"Run setup wizard"
```

Or manually by editing `.env`:

```bash
cp .env.example .env
# Edit .env with your settings
```

### Required Configuration

- **Proxmox**: Host, user, password/token
- **Network**: Gateway, DNS, CIDR
- **Storage**: Default storage and bridge

### Optional Configuration

- Service IPs for automated deployment
- VM resource defaults
- Ansible settings

## Usage Examples

### Deploy a Service

```
"Deploy Nextcloud to my homelab"
```

Claude will:
1. Create a VM using Terraform
2. Configure it with Ansible
3. Set up the service

### Check Infrastructure

```
"Show me the network topology of my homelab"
```

### Manage Services

```
"Check the health of all services"
"Restart the MCP server"
"Show me the last 50 lines of logs"
```

### Configure Environment

```
"Set up Proxmox connection"
"Configure network settings for 10.0.0.0/24"
```

## Development

### Running Tests

```bash
# Unit tests
npm test

# Functional tests
node tests/complete-functional-test.js

# All tests
./run-tests.sh
```

### CI/CD Pipeline

The project includes GitHub Actions workflows for:
- Automated testing on multiple Node versions
- Security scanning for sensitive data
- Docker image building
- Automated releases

## Architecture

```
┌─────────────────┐     ┌──────────────┐     ┌───────────────┐
│ Claude Desktop  │────►│  MCP Server  │────►│   Ansible     │
└─────────────────┘     └──────┬───────┘     └───────────────┘
                               │
                               ├──────────────►┌───────────────┐
                               │               │   Terraform   │
                               │               └───────────────┘
                               │
                               └──────────────►┌───────────────┐
                                              │   Proxmox     │
                                              └───────────────┘
```

## Security Considerations

- API tokens are required for SSE connections
- Sensitive data is never logged
- Configuration supports both password and token authentication
- All examples use private RFC1918 IP ranges

## Contributing

1. Fork the repository
2. Create a feature branch
3. Run tests and ensure they pass
4. Submit a pull request

Please ensure:
- No sensitive data in commits
- Tests pass for new features
- Documentation is updated

## License

MIT License - see [LICENSE](LICENSE) file for details

## Acknowledgments

Built with:
- [Model Context Protocol SDK](https://github.com/modelcontextprotocol/sdk)
- [Ansible](https://www.ansible.com/)
- [Terraform](https://www.terraform.io/)
- [Proxmox VE](https://www.proxmox.com/)

## Support

- Create an issue for bugs or feature requests
- See [docs/](docs/) for detailed documentation
- Check [tests/](tests/) for usage examples