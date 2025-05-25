#!/bin/bash
# Update MCP Server on VM by cloning from GitHub

set -e

# Configuration
MCP_VM_IP="${MCP_VM_IP:-192.168.10.100}"
MCP_USER="${MCP_USER:-mcp}"
BRANCH="${BRANCH:-development}"

echo "=== Updating MCP Server on VM (Git Clone Method) ==="
echo "VM: $MCP_VM_IP"
echo "Branch: $BRANCH"
echo

# SSH into the VM and update the code
echo "Connecting to MCP VM and updating code..."

ssh -o StrictHostKeyChecking=no $MCP_USER@$MCP_VM_IP << 'EOF'
    set -e
    
    # Backup current directory
    if [ -d /opt/ansible-mcp-server ]; then
        echo "Backing up current installation..."
        sudo mv /opt/ansible-mcp-server /opt/ansible-mcp-server.backup.$(date +%Y%m%d_%H%M%S)
    fi
    
    # Clone fresh from GitHub
    echo "Cloning repository from GitHub..."
    cd /opt
    sudo git clone https://github.com/washyu/ansible-mcp-server.git
    
    # Set ownership
    sudo chown -R mcp:mcp /opt/ansible-mcp-server
    
    # Navigate to directory
    cd /opt/ansible-mcp-server
    
    # Checkout the development branch
    echo "Switching to development branch..."
    git checkout development
    
    # Copy .env if backup exists
    if [ -f /opt/ansible-mcp-server.backup.*/env ]; then
        echo "Restoring .env file..."
        cp /opt/ansible-mcp-server.backup.*/.env /opt/ansible-mcp-server/.env 2>/dev/null || true
    fi
    
    # Install dependencies
    echo "Installing dependencies..."
    npm install
    
    # Restart services
    if systemctl is-active --quiet mcp-server; then
        echo "Restarting MCP server service..."
        sudo systemctl restart mcp-server
        sleep 2
        sudo systemctl status mcp-server --no-pager
    fi
    
    if systemctl is-active --quiet sse-server; then
        echo "Restarting SSE server service..."
        sudo systemctl restart sse-server
        sleep 2
        sudo systemctl status sse-server --no-pager
    fi
    
    echo
    echo "Update complete!"
    echo "Current branch: $(git branch --show-current)"
    echo "Current commit: $(git log -1 --oneline)"
EOF

echo
echo "=== MCP VM Update Complete ==="
echo
echo "The MCP server on $MCP_VM_IP has been updated to the latest $BRANCH branch."
echo
echo "To test the changes:"
echo "1. Restart Claude Desktop"
echo "2. Check that the MCP server connects properly"
echo "3. Verify all tools are available"