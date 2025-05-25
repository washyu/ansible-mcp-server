#!/bin/bash

# Sanitize code for v1.0 release - remove PII and prepare for GitHub

echo "🧹 Sanitizing code for v1.0 release..."

# Backup current state
echo "Creating backup..."
cp -r src src.backup

# Replace specific IPs with generic examples
echo "Replacing hardcoded IPs..."

# Replace specific IPs in source files
find src docs -type f \( -name "*.js" -o -name "*.json" -o -name "*.md" \) -exec sed -i \
    -e 's/192\.168\.10\.100/YOUR_MCP_SERVER_IP/g' \
    -e 's/192\.168\.10\.20/YOUR_TEST_SERVER_IP/g' \
    -e 's/192\.168\.10\.21/YOUR_STAGING_SERVER_IP/g' \
    -e 's/192\.168\.10\.22/YOUR_PRODUCTION_SERVER_IP/g' \
    -e 's/192\.168\.1\.100/YOUR_PROXMOX_HOST/g' \
    -e 's/192\.168\.1\.50/YOUR_ANSIBLE_CONTROLLER/g' \
    -e 's/192\.168\.1\.1/YOUR_GATEWAY_IP/g' \
    -e 's/192\.168\.1\.0\/24/YOUR_NETWORK_SUBNET/g' \
    {} \;

# Remove personal references
echo "Removing personal references..."
find . -type f \( -name "*.js" -o -name "*.json" -o -name "*.md" \) -exec sed -i \
    -e 's/shaun@example\.com/user@example.com/g' \
    -e 's/Shaun/User/g' \
    -e 's/shaun/user/g' \
    -e 's/homelab2/test-server/g' \
    {} \;

# Update environment examples
echo "Updating environment examples..."
cat > .env.example << 'EOF'
# Proxmox Configuration
PROXMOX_HOST=YOUR_PROXMOX_HOST
PROXMOX_USER=root@pam
PROXMOX_PASSWORD=your-proxmox-password
PROXMOX_NODE=pve

# Network Configuration
DEFAULT_GATEWAY=YOUR_GATEWAY_IP
DEFAULT_NAMESERVER=8.8.8.8
DEFAULT_NETWORK_CIDR=24

# SSE Server Configuration (for Windows clients)
SSE_PORT=3001
API_ACCESS_TOKEN=your-secure-token

# MCP Configuration
MCP_USER=mcp
MCP_HOME=/home/mcp
EOF

# Update test configurations
echo "Updating test configurations..."
find tests -type f -name "*.js" -exec sed -i \
    -e "s/'192\.168\.[0-9.]*'/'localhost'/g" \
    -e "s/192\.168\.[0-9.]*/localhost/g" \
    {} \;

# Remove windows-hardware-tools.js (postponed feature)
echo "Removing postponed features..."
rm -f src/tools/windows-hardware-tools.js

# Update TODO files
echo "Cleaning TODO files..."
rm -f TODO-*.md

# Create clean README for GitHub
echo "Creating clean README..."
cat > README.md << 'EOF'
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

Run the comprehensive test suite:

```bash
./run-v1-tests.sh
```

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
EOF

echo "✅ Sanitization complete!"
echo ""
echo "⚠️  Please review the changes before committing:"
echo "   - Check src/ for any remaining PII"
echo "   - Verify .env.example has generic values"
echo "   - Test that core functionality still works"
echo ""
echo "To restore original files: cp -r src.backup/* src/"