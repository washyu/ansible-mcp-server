# Ansible MCP Server for Homelab Automation

A Model Context Protocol (MCP) server that enables Claude Desktop to manage your homelab infrastructure using natural language. Deploy VMs on Proxmox, configure services with Ansible, and visualize your network - all through conversational AI.

## 🚀 Quick Start

```bash
# Clone the repository
git clone https://github.com/yourusername/ansible-mcp-server.git
cd ansible-mcp-server

# Run the setup script
./setup.sh
```

The setup script will guide you through:
1. Creating your `.env` configuration
2. Choosing deployment method (Docker/VM/Local)
3. Configuring Claude Desktop

## 🎯 Features

- **Natural Language Infrastructure Management**: Tell Claude what you want, and it happens
- **Proxmox Integration**: Create and manage VMs with Terraform
- **Ansible Automation**: Configure services automatically
- **Network Visualization**: Generate diagrams of your infrastructure
- **Multi-deployment Options**: Docker, Proxmox VM, or local installation
- **Environment-based Configuration**: Easy setup for any homelab

## 📋 Prerequisites

### For Docker Deployment (Recommended)
- Docker and Docker Compose installed
- SSH key pair for server access

### For Proxmox VM Deployment
- Proxmox server with API access
- Ansible installed locally
- SSH key pair

### For Local Installation
- Node.js 20+
- Ansible
- Terraform (optional)

## 🔧 Configuration

1. **Copy the environment template:**
   ```bash
   cp .env.example .env
   ```

2. **Edit `.env` with your settings:**
   ```env
   # Proxmox Configuration
   PROXMOX_HOST=192.168.1.100
   PROXMOX_USER=root@pam
   PROXMOX_PASSWORD=your-password
   
   # Network Configuration
   DEFAULT_GATEWAY=192.168.1.1
   DEFAULT_NETWORK_CIDR=24
   ```

3. **Add your SSH key** (for server access):
   ```bash
   # Copy your SSH public key to the ssh/ directory
   cp ~/.ssh/id_rsa.pub ssh/
   ```

## 🐳 Docker Deployment

The fastest way to get started:

```bash
# Build and run with Docker Compose
docker-compose up -d

# Check logs
docker logs ansible-mcp-server

# Test the connection
docker exec -it ansible-mcp-server node src/index.js
```

### Connecting Claude Desktop to Docker

1. The MCP server is exposed on port 2222
2. Configure Claude Desktop (`%APPDATA%\Claude\claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "ansible-homelab": {
      "command": "ssh",
      "args": [
        "-i", "C:\\Users\\YourName\\.ssh\\mcp_key",
        "-p", "2222",
        "mcp@your-docker-host-ip",
        "/home/mcp/mcp-ssh-wrapper.sh"
      ]
    }
  }
}
```

## 🖥️ Proxmox VM Deployment

Deploy the MCP server as a dedicated VM:

```bash
# Ensure your .env is configured with Proxmox credentials

# Run the automated deployment
./setup.sh
# Choose option 2 (Proxmox VM)

# Or manually:
ansible-playbook -i inventory/proxmox.yml playbooks/create-ubuntu-template.yml
ansible-playbook -i inventory/proxmox.yml playbooks/create-mcp-vm.yml
ansible-playbook -i inventory/mcp-server.yml playbooks/deploy-mcp-server.yml
```

## 💬 Usage Examples

Once connected to Claude Desktop, you can use natural language commands:

### VM Management
- "Create a new Ubuntu VM with 4 cores and 8GB RAM"
- "Deploy a Nextcloud server on Proxmox"
- "Show me all VMs currently running"

### Service Configuration
- "Set up a mail server with Docker"
- "Configure Nginx reverse proxy for my services"
- "Deploy Keycloak for SSO"

### Network Visualization
- "Show me my network topology"
- "Create a diagram of all services"
- "What changed in my infrastructure since yesterday?"

### Ansible Automation
- "Create a playbook to install Docker on all hosts"
- "Run security updates on all servers"
- "Configure firewall rules for web services"

## 📁 Project Structure

```
ansible-mcp-server/
├── src/                    # MCP server source code
│   └── index.js           # Main server implementation
├── homelab_playbook/      # Ansible playbooks organized by service
│   ├── dns/               # DNS configurations
│   ├── nextcloud/         # Nextcloud deployment
│   ├── mail/              # Mail server setup
│   └── ...                # Other services
├── terraform/             # Terraform configurations
├── docker-compose.yml     # Docker deployment
├── Dockerfile            # Container image
├── setup.sh              # Interactive setup script
└── .env.example          # Environment template
```

## 🔐 Security Considerations

- **Environment Variables**: Never commit `.env` files
- **SSH Keys**: Keep private keys secure
- **API Tokens**: Use Proxmox API tokens instead of passwords when possible
- **Network**: Consider using VPN for remote access

## 🛠️ Customization

### Adding New Services

1. Create a new directory in `homelab_playbook/`
2. Add your Ansible playbooks
3. The MCP server will automatically detect them

### Custom VM Templates

Edit the `vmDefaults` in `.env` or `src/index.js`:

```javascript
vmDefaults: {
  myservice: { cores: 4, memory: 8192, disk: '100G' }
}
```

### Network Diagrams

Customize diagram generation in `src/index.js`:
- Modify `generateMermaidDiagram()` for network layouts
- Add service groupings in `generateServiceDiagram()`

## 🐛 Troubleshooting

### Connection Issues
```bash
# Test MCP server directly
ssh mcp@your-server "/home/mcp/mcp-ssh-wrapper.sh"

# Check Docker logs
docker logs ansible-mcp-server

# Verify SSH key permissions
chmod 600 ~/.ssh/mcp_key
```

### Proxmox API Errors
- Ensure API token has VM.Allocate and VM.Clone permissions
- Check network connectivity to Proxmox host
- Verify SSL certificate or set `PROXMOX_VERIFY_SSL=false`

### Claude Desktop Not Connecting
1. Restart Claude Desktop after config changes
2. Check Windows SSH client is installed
3. Verify firewall allows SSH (port 22 or 2222)

## 📚 Additional Resources

- [Claude Desktop Documentation](https://docs.anthropic.com/claude/docs/claude-desktop)
- [MCP Protocol Specification](https://github.com/anthropics/mcp)
- [Proxmox API Documentation](https://pve.proxmox.com/wiki/Proxmox_VE_API)
- [Ansible Best Practices](https://docs.ansible.com/ansible/latest/user_guide/playbooks_best_practices.html)

## 🤝 Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🙏 Acknowledgments

- Built with [Model Context Protocol SDK](https://github.com/anthropics/mcp)
- Inspired by the homelab community
- Powered by Ansible, Terraform, and Proxmox

---

**Need help?** Open an issue or reach out to the community!