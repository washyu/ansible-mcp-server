#!/bin/bash
# Push SSE server updates to MCP server

set -e

MCP_SERVER_IP="192.168.10.100"
MCP_USER="ubuntu"
MCP_DIR="/opt/ansible-mcp-server"

echo "Pushing SSE server updates to $MCP_SERVER_IP..."
echo "==========================================="

# Files to copy
FILES=(
    "src/sse-server.js"
    "src/mcp-proxy-client.js"
    "deploy-sse-server.sh"
    "sse-server.service"
    "test-sse-server.js"
    "package.json"
    ".env.example"
    "docs/windows-sse-setup.md"
)

# Create docs directory on remote if needed
ssh $MCP_USER@$MCP_SERVER_IP "sudo mkdir -p $MCP_DIR/docs && sudo chown -R mcp:mcp $MCP_DIR"

# Copy each file
for file in "${FILES[@]}"; do
    echo "Copying $file..."
    scp "$file" $MCP_USER@$MCP_SERVER_IP:/tmp/$(basename "$file")
    
    # Move to correct location with sudo
    if [[ "$file" == docs/* ]]; then
        ssh $MCP_USER@$MCP_SERVER_IP "sudo mv /tmp/$(basename "$file") $MCP_DIR/docs/ && sudo chown mcp:mcp $MCP_DIR/docs/$(basename "$file")"
    elif [[ "$file" == src/* ]]; then
        ssh $MCP_USER@$MCP_SERVER_IP "sudo mv /tmp/$(basename "$file") $MCP_DIR/src/ && sudo chown mcp:mcp $MCP_DIR/src/$(basename "$file")"
    else
        ssh $MCP_USER@$MCP_SERVER_IP "sudo mv /tmp/$(basename "$file") $MCP_DIR/ && sudo chown mcp:mcp $MCP_DIR/$(basename "$file")"
    fi
done

# Make scripts executable
ssh $MCP_USER@$MCP_SERVER_IP "sudo chmod +x $MCP_DIR/deploy-sse-server.sh $MCP_DIR/test-sse-server.js"

# Install new dependencies
echo ""
echo "Installing dependencies..."
ssh $MCP_USER@$MCP_SERVER_IP "cd $MCP_DIR && sudo -u mcp npm install"

echo ""
echo "✓ SSE server files deployed!"
echo ""
echo "Next steps on the MCP server ($MCP_SERVER_IP):"
echo "1. SSH into the server: ssh $MCP_USER@$MCP_SERVER_IP"
echo "2. Run: cd $MCP_DIR"
echo "3. Run: sudo ./deploy-sse-server.sh"
echo ""
echo "This will generate an API token and start the SSE server."