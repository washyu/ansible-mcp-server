# Ansible MCP Server

A Model Context Protocol (MCP) server that enables AI assistants to manage infrastructure using Ansible and Terraform.

## Features

- **58 Infrastructure Management Tools**
  - Ansible playbook creation and execution
  - Terraform infrastructure provisioning
  - Hardware discovery and inventory
  - Security scanning and auditing
  - Service deployment from catalog
  - Network device management
  - Environment management (test/staging/production)

- **AI-Optimized Design**
  - Flexible playbook creation accepting YAML strings
  - Comprehensive error handling
  - Context persistence between sessions
  - Dynamic tool loading for services

- **Cross-Platform Support**
  - Linux server deployment
  - Windows client support via SSE proxy
  - Remote server management

## Quick Start

### Prerequisites

- Node.js 16+
- Ansible 2.9+
- Terraform (optional)

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/ansible-mcp-server.git
cd ansible-mcp-server

# Install dependencies
npm install

# Copy and configure environment
cp .env.example .env
# Edit .env with your settings

# Run the server
npm start
```

### For Claude Desktop

Add to your Claude Desktop configuration:

```json
{
  "mcpServers": {
    "ansible": {
      "command": "node",
      "args": ["/path/to/ansible-mcp-server/src/index.js"],
      "env": {
        "PROXMOX_HOST": "your-proxmox-host",
        "PROXMOX_USER": "root@pam",
        "PROXMOX_PASSWORD": "your-password"
      }
    }
  }
}
```

### Windows Users

For Windows Claude Desktop, use the SSE proxy:

1. Deploy the MCP server to a Linux host
2. Run the SSE server on the Linux host
3. Configure Claude Desktop to use the Windows client

See [Windows Setup Guide](docs/windows-claude-desktop-setup.md) for details.

## Available Tools

### Ansible Tools
- `create-playbook-flexible` - Create playbooks with YAML strings or objects
- `ansible-playbook` - Run Ansible playbooks
- `ansible-task` - Run ad-hoc Ansible tasks
- `ansible-role` - Execute Ansible roles
- `validate-playbook` - Validate playbook syntax
- `create-role-structure` - Generate Ansible role directories

### Infrastructure Tools
- `hardware-scan` - Comprehensive hardware discovery
- `storage-analysis` - Storage and SMART health analysis
- `network-interfaces` - Network adapter discovery
- `discover-proxmox` - Discover Proxmox VMs
- `generate-inventory` - Create Ansible inventories

### Security Tools
- `security-quick-scan` - Quick security assessment
- `security-scan-ports` - Port scanning
- `security-check-passwords` - Password policy audit
- `security-audit-accounts` - User account audit
- `security-check-ssh` - SSH configuration audit

### Service Management
- `browse-services` - Browse service catalog
- `deploy-service` - Deploy services from catalog
- `list-environments` - List deployment environments
- `deploy-to-environment` - Deploy with environment protection

## Documentation

- [Integration Guide](docs/integration.md)
- [Hardware Inventory Guide](docs/hardware-inventory-guide.md)
- [Claude Playbook Fix](docs/claude-playbook-fix.md)
- [Modular Tools System](docs/modular-tools.md)

## Testing

Run the comprehensive feature test suite:

```bash
# Run tests in development environment
npm test

# Test specific environments
npm run test:dev      # Development
npm run test:qa       # QA
npm run test:staging  # Staging
npm run test:prod     # Production

# Verbose output for debugging
npm run test:verbose
```

Our feature tests validate complete VM lifecycle workflows including:
- VM creation from Proxmox templates
- Service installation (Jenkins, etc.)
- Service verification and management
- VM deletion and cleanup
- MCP context management

See [Testing Guidelines](tests/TESTING-GUIDELINES.md) for detailed information.

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Built for use with [Claude](https://claude.ai) and other AI assistants
- Uses the [Model Context Protocol](https://modelcontextprotocol.io)
- Powered by [Ansible](https://ansible.com) and [Terraform](https://terraform.io)
