#!/bin/bash

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
REMOTE_HOST="homelab2"
REMOTE_USER="${REMOTE_USER:-shaun}"
REMOTE_DIR="/tmp/ansible-mcp-server"

echo "Deploying Ansible MCP Server to $REMOTE_HOST..."

# Check SSH connectivity
echo "Checking SSH connectivity to $REMOTE_HOST..."
if ! ssh -o ConnectTimeout=5 "$REMOTE_USER@$REMOTE_HOST" "echo 'SSH connection successful'" &>/dev/null; then
    echo "Error: Cannot connect to $REMOTE_HOST via SSH"
    echo "Please ensure:"
    echo "  1. The host '$REMOTE_HOST' is reachable"
    echo "  2. SSH key authentication is set up for user '$REMOTE_USER'"
    echo "  3. Or set REMOTE_USER environment variable if using different username"
    exit 1
fi

# Create tarball of the project
echo "Creating deployment package..."
cd "$PROJECT_DIR"
tar -czf /tmp/ansible-mcp-server.tar.gz \
    --exclude='node_modules' \
    --exclude='.git' \
    --exclude='*.log' \
    .

# Copy to remote host
echo "Copying files to $REMOTE_HOST..."
scp /tmp/ansible-mcp-server.tar.gz "$REMOTE_USER@$REMOTE_HOST:/tmp/"

# Extract and install on remote host
echo "Installing on $REMOTE_HOST..."
ssh "$REMOTE_USER@$REMOTE_HOST" << 'REMOTE_SCRIPT'
set -e

# Extract files
echo "Extracting files..."
rm -rf /tmp/ansible-mcp-server
mkdir -p /tmp/ansible-mcp-server
cd /tmp/ansible-mcp-server
tar -xzf /tmp/ansible-mcp-server.tar.gz

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo "Error: Node.js is not installed on the remote system"
    echo "Please install Node.js 18+ first"
    exit 1
fi

# Check for Ansible
if ! command -v ansible &> /dev/null; then
    echo "Warning: Ansible is not installed on the remote system"
    echo "The installation script will attempt to install it"
fi

# Run the installation script
echo "Running installation script (will require sudo)..."
chmod +x scripts/install.sh
sudo scripts/install.sh

# Clean up
rm -f /tmp/ansible-mcp-server.tar.gz
rm -rf /tmp/ansible-mcp-server

echo "Installation complete on remote host!"
REMOTE_SCRIPT

# Clean up local temp file
rm -f /tmp/ansible-mcp-server.tar.gz

echo ""
echo "Deployment to $REMOTE_HOST completed successfully!"
echo ""
echo "On $REMOTE_HOST, you can now:"
echo "  - Start the service: sudo systemctl start ansible-mcp-server"
echo "  - Enable at boot: sudo systemctl enable ansible-mcp-server"
echo "  - Check status: sudo systemctl status ansible-mcp-server"
echo "  - View logs: sudo journalctl -u ansible-mcp-server -f"