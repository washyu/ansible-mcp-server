#!/bin/bash

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
INSTALL_DIR="/opt/ansible-mcp-server"
SERVICE_NAME="ansible-mcp-server"

echo "Installing Ansible MCP Server..."

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
   echo "Please run as root (use sudo)"
   exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check if Ansible is installed
if ! command -v ansible &> /dev/null; then
    echo "Ansible is not installed. Installing ansible-core..."
    if command -v apt-get &> /dev/null; then
        apt-get update && apt-get install -y ansible-core
    elif command -v yum &> /dev/null; then
        yum install -y ansible-core
    elif command -v dnf &> /dev/null; then
        dnf install -y ansible-core
    else
        echo "Unable to install Ansible automatically. Please install it manually."
        exit 1
    fi
fi

# Create installation directory
echo "Creating installation directory..."
mkdir -p "$INSTALL_DIR"

# Copy project files
echo "Copying project files..."
cp -r "$PROJECT_DIR"/* "$INSTALL_DIR/"

# Install npm dependencies
echo "Installing npm dependencies..."
cd "$INSTALL_DIR"
npm install --production

# Make the server executable
chmod +x "$INSTALL_DIR/src/index.js"

# Create systemd service file
echo "Creating systemd service..."
cat > "/etc/systemd/system/${SERVICE_NAME}.service" << EOF
[Unit]
Description=Ansible MCP Server
After=network.target

[Service]
Type=simple
User=nobody
Group=nogroup
WorkingDirectory=$INSTALL_DIR
ExecStart=/usr/bin/node $INSTALL_DIR/src/index.js
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=$SERVICE_NAME

# Security settings
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/tmp

[Install]
WantedBy=multi-user.target
EOF

# Create a wrapper script for easier command-line usage
echo "Creating wrapper script..."
cat > "/usr/local/bin/ansible-mcp" << EOF
#!/bin/bash
exec /usr/bin/node $INSTALL_DIR/src/index.js "\$@"
EOF
chmod +x /usr/local/bin/ansible-mcp

# Reload systemd
systemctl daemon-reload

echo "Installation complete!"
echo ""
echo "To start the service:"
echo "  systemctl start $SERVICE_NAME"
echo ""
echo "To enable at boot:"
echo "  systemctl enable $SERVICE_NAME"
echo ""
echo "To run manually:"
echo "  ansible-mcp"
echo ""
echo "To view logs:"
echo "  journalctl -u $SERVICE_NAME -f"