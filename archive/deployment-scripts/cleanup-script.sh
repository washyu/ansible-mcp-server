#!/bin/bash

# Cleanup script to remove PII and make repository generic
# Run this before publishing to GitHub

echo "🧹 Cleaning up PII and making repository generic..."

# Create backup directory
mkdir -p .cleanup-backup
timestamp=$(date +%Y%m%d_%H%M%S)

# Backup files that contain PII
echo "📦 Creating backups..."
cp homelab2-migration-guide.md .cleanup-backup/homelab2-migration-guide-${timestamp}.md 2>/dev/null || true
cp deploy-v1.1-features.md .cleanup-backup/deploy-v1.1-features-${timestamp}.md 2>/dev/null || true

# Remove files with specific PII
echo "🗑️  Removing PII-specific files..."
rm -f homelab2-migration-guide.md
rm -f deploy-v1.1-features.md

# Replace specific content in documentation
echo "📝 Updating documentation..."

# Update test files to use generic examples
if [ -f test-external-servers.js ]; then
  sed -i 's/192\.168\.10\./192\.168\.1\./g' test-external-servers.js
  sed -i 's/homelab2/ansible-controller/g' test-external-servers.js
  sed -i 's/truenas\.local/nas-server.local/g' test-external-servers.js
  sed -i 's/pihole\.local/dns-server.local/g' test-external-servers.js
fi

# Update any remaining documentation
find . -name "*.md" -not -path "./.cleanup-backup/*" -not -path "./node_modules/*" | xargs sed -i 's/192\.168\.10\./192\.168\.1\./g'
find . -name "*.md" -not -path "./.cleanup-backup/*" -not -path "./node_modules/*" | xargs sed -i 's/homelab2/ansible-controller/g'

# Update test scripts
if [ -f test-mcp-commands.sh ]; then
  sed -i 's/192\.168\.10\./192\.168\.1\./g' test-mcp-commands.sh
  sed -i 's/homelab2/test-controller/g' test-mcp-commands.sh
fi

# Clean up any remaining specific references in shell scripts
find . -name "*.sh" -not -path "./.cleanup-backup/*" -not -path "./node_modules/*" | xargs sed -i 's/shaun@homelab2/ansible@controller/g'

# Create generic example files
echo "📋 Creating generic example configurations..."

# Create generic .env.example
cat > .env.example << 'EOF'
# Proxmox Configuration
PROXMOX_HOST=192.168.1.100
PROXMOX_USER=root@pam
PROXMOX_PASSWORD=your_proxmox_password
PROXMOX_NODE=pve
PROXMOX_VERIFY_SSL=false

# Network Configuration
DEFAULT_GATEWAY=192.168.1.1
DEFAULT_NAMESERVER=8.8.8.8
DEFAULT_NETWORK_CIDR=24

# Storage Configuration
DEFAULT_STORAGE=local-lvm
DEFAULT_BRIDGE=vmbr0

# VM Defaults
NEXTCLOUD_CORES=4
NEXTCLOUD_MEMORY=8192
NEXTCLOUD_DISK=100G

MAILSERVER_CORES=2
MAILSERVER_MEMORY=4096
MAILSERVER_DISK=50G
EOF

# Create generic inventory example
mkdir -p inventory/examples
cat > inventory/examples/example-inventory.yml << 'EOF'
all:
  children:
    proxmox_vms:
      hosts:
        web-server-01:
          ansible_host: 192.168.1.110
          vmid: 101
          purpose: web_frontend
        db-server-01:
          ansible_host: 192.168.1.111
          vmid: 102
          purpose: database
    
    external_servers:
      hosts:
        nas-server:
          ansible_host: nas-server.local
          server_type: nas
          managed_externally: true
        dns-server:
          ansible_host: dns-server.local
          server_type: pihole
          managed_externally: true
    
    web_servers:
      hosts:
        web-server-01: {}
    
    databases:
      hosts:
        db-server-01: {}
    
    storage_servers:
      hosts:
        nas-server: {}
EOF

# Update README with generic examples
echo "📖 Updating README with generic examples..."

# Create a clean, generic README section
cat >> README.md << 'EOF'

## Quick Start Examples

### Discover Your Infrastructure
```bash
# Find existing Ansible controllers
discover-ansible-controller --networkRange="192.168.1.0/24"

# Discover Proxmox VMs  
discover-proxmox --host="192.168.1.100" --user="root@pam"

# Scan network for devices
discover-network-devices --networkRange="192.168.1.0/24" --classify=true
```

### Set Up SSH Authentication
```bash
# Generate SSH keys
manage-ssh-keys --action="generate" --keyType="ed25519"

# Distribute to servers
manage-ssh-keys --action="distribute" --targets='["192.168.1.50", "192.168.1.100"]' --username="ansible"
```

### Deploy Services
```bash
# Deploy a Git server
deploy-service --serviceName="gitea" --vmName="git-server" --ip="192.168.1.120"

# Deploy monitoring stack
deploy-service --serviceName="prometheus" --vmName="monitoring" --ip="192.168.1.130"
```

### Manage External Servers
```bash
# Add NAS server
add-external-server --hostname="nas-server.local" --type="nas"

# Add DNS server
add-external-server --hostname="dns-server.local" --type="pihole"
```

For more examples, see the [example configurations](docs/example-configurations.md).
EOF

echo "✅ Cleanup complete!"
echo ""
echo "📁 Backups saved in: .cleanup-backup/"
echo "📋 Generic examples created in: inventory/examples/"
echo "🔧 Environment template: .env.example"
echo "📖 Documentation updated with generic examples"
echo ""
echo "🚀 Repository is now ready for public release!"
echo ""
echo "Next steps:"
echo "1. Review all changes"
echo "2. Test with generic configurations"  
echo "3. Commit changes"
echo "4. Create GitHub release"