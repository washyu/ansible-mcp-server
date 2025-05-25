#!/bin/bash
# Update MCP Server on VM with latest code from GitHub

set -e

# Configuration
MCP_VM_IP="${MCP_VM_IP:-192.168.10.100}"
MCP_USER="${MCP_USER:-mcp}"
BRANCH="${BRANCH:-development}"

echo "=== Updating MCP Server on VM ==="
echo "VM: $MCP_VM_IP"
echo "Branch: $BRANCH"
echo

# SSH into the VM and update the code
echo "Connecting to MCP VM and updating code..."

ssh -o StrictHostKeyChecking=no $MCP_USER@$MCP_VM_IP << EOF
    set -e
    
    echo "Current directory: \$(pwd)"
    
    # Navigate to MCP server directory
    cd /opt/ansible-mcp-server || exit 1
    
    echo "Current branch: \$(git branch --show-current)"
    
    # Stash any local changes
    echo "Stashing local changes..."
    sudo git stash
    
    # Fetch latest changes
    echo "Fetching latest changes..."
    sudo git fetch origin
    
    # Checkout and update the branch
    echo "Switching to $BRANCH branch..."
    sudo git checkout $BRANCH
    sudo git pull origin $BRANCH
    
    # Install/update dependencies
    echo "Updating dependencies..."
    sudo npm install
    
    # Restart the MCP service if it exists
    if systemctl is-active --quiet mcp-server; then
        echo "Restarting MCP server service..."
        sudo systemctl restart mcp-server
        sleep 2
        sudo systemctl status mcp-server --no-pager
    fi
    
    # Restart SSE server if it exists
    if systemctl is-active --quiet sse-server; then
        echo "Restarting SSE server service..."
        sudo systemctl restart sse-server
        sleep 2
        sudo systemctl status sse-server --no-pager
    fi
    
    echo
    echo "Update complete!"
    echo "Current commit: \$(git log -1 --oneline)"
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