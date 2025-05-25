#!/bin/bash
# Deploy SSE Server for MCP

set -e

echo "Deploying MCP SSE Server..."
echo "=========================="

# Check if running as root or with sudo
if [ "$EUID" -ne 0 ]; then 
    echo "Please run with sudo: sudo $0"
    exit 1
fi

# Configuration
MCP_DIR="/opt/ansible-mcp-server"
MCP_USER="mcp"
SERVICE_FILE="/etc/systemd/system/sse-server.service"

# Check if MCP server is installed
if [ ! -d "$MCP_DIR" ]; then
    echo "Error: MCP server not found at $MCP_DIR"
    echo "Please deploy the MCP server first."
    exit 1
fi

# Check if .env file exists
if [ ! -f "$MCP_DIR/.env" ]; then
    echo "Error: .env file not found at $MCP_DIR/.env"
    echo "Please configure the MCP server first."
    exit 1
fi

# Generate API token if not set
if ! grep -q "API_ACCESS_TOKEN=" "$MCP_DIR/.env" || grep -q "API_ACCESS_TOKEN=your-secure-token" "$MCP_DIR/.env"; then
    echo "Generating secure API token..."
    TOKEN=$(openssl rand -hex 32)
    
    # Add or update API_ACCESS_TOKEN in .env
    if grep -q "API_ACCESS_TOKEN=" "$MCP_DIR/.env"; then
        sed -i "s/API_ACCESS_TOKEN=.*/API_ACCESS_TOKEN=$TOKEN/" "$MCP_DIR/.env"
    else
        echo "" >> "$MCP_DIR/.env"
        echo "# SSE Server Configuration" >> "$MCP_DIR/.env"
        echo "SSE_PORT=3001" >> "$MCP_DIR/.env"
        echo "API_ACCESS_TOKEN=$TOKEN" >> "$MCP_DIR/.env"
    fi
    
    echo "API Token generated: $TOKEN"
    echo "Save this token for Windows client configuration!"
    echo ""
fi

# Install systemd service
echo "Installing systemd service..."
cp "$MCP_DIR/sse-server.service" "$SERVICE_FILE"

# Fix permissions
chown -R $MCP_USER:$MCP_USER "$MCP_DIR"
chmod 600 "$MCP_DIR/.env"

# Reload systemd
systemctl daemon-reload

# Enable and start service
echo "Starting SSE server..."
systemctl enable sse-server
systemctl restart sse-server

# Wait for service to start
sleep 2

# Check status
if systemctl is-active --quiet sse-server; then
    echo "✓ SSE server is running"
else
    echo "✗ SSE server failed to start"
    echo "Check logs with: journalctl -u sse-server -n 50"
    exit 1
fi

# Configure firewall if ufw is installed
if command -v ufw &> /dev/null; then
    echo "Configuring firewall..."
    ufw allow 3001/tcp
    echo "✓ Firewall configured"
fi

# Get server info
SERVER_IP=$(hostname -I | awk '{print $1}')
API_TOKEN=$(grep API_ACCESS_TOKEN "$MCP_DIR/.env" | cut -d'=' -f2)

# Test health endpoint
echo ""
echo "Testing SSE server..."
if curl -s http://localhost:3001/health > /dev/null; then
    echo "✓ Health check passed"
else
    echo "✗ Health check failed"
    exit 1
fi

# Display configuration info
echo ""
echo "==========================================="
echo "SSE Server deployed successfully!"
echo "==========================================="
echo ""
echo "Server Information:"
echo "  IP Address: $SERVER_IP"
echo "  SSE Port: 3001"
echo "  SSE URL: http://$SERVER_IP:3001/sse"
echo ""
echo "API Token: $API_TOKEN"
echo ""
echo "Windows Client Configuration:"
echo "  MCP_SSE_URL=http://$SERVER_IP:3001/sse"
echo "  API_ACCESS_TOKEN=$API_TOKEN"
echo ""
echo "To check logs: journalctl -u sse-server -f"
echo "To check status: systemctl status sse-server"
echo ""
echo "Next steps:"
echo "1. Note down the API token above"
echo "2. Run windows-setup.ps1 on your Windows machine"
echo "3. Enter the server IP and API token when prompted"