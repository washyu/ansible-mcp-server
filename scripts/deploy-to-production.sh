#!/bin/bash
# Deploy latest code to production MCP server

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
PRODUCTION_SERVER="192.168.10.100"

echo "Deploying to Production MCP Server"
echo "=================================="
echo ""

# Create temp directory on production
echo "1. Preparing production server..."
ssh ubuntu@$PRODUCTION_SERVER "sudo mkdir -p /tmp/mcp-deploy"

# Sync files to temp directory
echo "2. Syncing files..."
rsync -avz --exclude=node_modules --exclude=.git --exclude=.env --exclude=tests \
  "$PROJECT_DIR/" ubuntu@$PRODUCTION_SERVER:/tmp/mcp-deploy/

# Backup current installation
echo "3. Backing up current installation..."
ssh ubuntu@$PRODUCTION_SERVER << 'EOF'
sudo systemctl stop sse-server
sudo cp -r /opt/ansible-mcp-server /opt/ansible-mcp-server.backup.$(date +%Y%m%d-%H%M%S)
EOF

# Update production files
echo "4. Updating production files..."
ssh ubuntu@$PRODUCTION_SERVER << 'EOF'
# Copy new files
sudo rsync -av --exclude=.env /tmp/mcp-deploy/ /opt/ansible-mcp-server/

# Fix permissions
sudo chown -R mcp:mcp /opt/ansible-mcp-server
sudo chmod +x /opt/ansible-mcp-server/scripts/*.sh

# Install any new dependencies
cd /opt/ansible-mcp-server
sudo -u mcp npm install --production

# Clean up
sudo rm -rf /tmp/mcp-deploy
EOF

# Restart services
echo "5. Restarting services..."
ssh ubuntu@$PRODUCTION_SERVER << 'EOF'
sudo systemctl restart sse-server
sudo systemctl status sse-server --no-pager
EOF

echo ""
echo "=================================="
echo "✅ Deployment complete!"
echo ""
echo "Test the production server:"
echo "  curl -H 'Authorization: Bearer YOUR_TOKEN' http://$PRODUCTION_SERVER:3001/sse"