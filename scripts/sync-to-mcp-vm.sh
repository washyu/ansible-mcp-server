#!/bin/bash
# Sync local files to MCP VM using rsync

set -e

# Configuration
MCP_VM_IP="${MCP_VM_IP:-192.168.10.100}"
MCP_USER="${MCP_USER:-mcp}"
EXCLUDE_FILE="${EXCLUDE_FILE:-.gitignore}"

echo "=== Syncing Ansible MCP Server to VM ==="
echo "VM: $MCP_USER@$MCP_VM_IP"
echo "Source: $(pwd)"
echo

# Create exclude patterns from .gitignore
RSYNC_EXCLUDES="--exclude=.git --exclude=node_modules --exclude=coverage --exclude=.env --exclude=*.log"

# Sync files to VM
echo "Syncing files..."
rsync -avz --delete \
    $RSYNC_EXCLUDES \
    --exclude=tests/test-output \
    --exclude=state-captures \
    --exclude=terraform/*/terraform.tfstate* \
    ./ $MCP_USER@$MCP_VM_IP:/opt/ansible-mcp-server/

# Install dependencies on VM
echo
echo "Installing dependencies on VM..."
ssh -o StrictHostKeyChecking=no $MCP_USER@$MCP_VM_IP << 'EOF'
    cd /opt/ansible-mcp-server
    npm install --production
    
    # Check if services need restart
    if pgrep -f "node.*index.js" > /dev/null; then
        echo "MCP server is running, you may need to restart it manually"
    fi
EOF

echo
echo "=== Sync Complete ==="
echo
echo "Files have been synced to $MCP_VM_IP:/opt/ansible-mcp-server/"
echo
echo "To restart the MCP server:"
echo "  ssh $MCP_USER@$MCP_VM_IP"
echo "  sudo systemctl restart mcp-server  # or"
echo "  sudo systemctl restart sse-server"