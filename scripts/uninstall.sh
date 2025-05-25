#!/bin/bash

set -e

SERVICE_NAME="ansible-mcp-server"
INSTALL_DIR="/opt/ansible-mcp-server"

echo "Uninstalling Ansible MCP Server..."

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
   echo "Please run as root (use sudo)"
   exit 1
fi

# Stop and disable service if running
if systemctl is-active --quiet "$SERVICE_NAME"; then
    echo "Stopping $SERVICE_NAME service..."
    systemctl stop "$SERVICE_NAME"
fi

if systemctl is-enabled --quiet "$SERVICE_NAME" 2>/dev/null; then
    echo "Disabling $SERVICE_NAME service..."
    systemctl disable "$SERVICE_NAME"
fi

# Remove systemd service file
if [ -f "/etc/systemd/system/${SERVICE_NAME}.service" ]; then
    echo "Removing systemd service..."
    rm -f "/etc/systemd/system/${SERVICE_NAME}.service"
    systemctl daemon-reload
fi

# Remove installation directory
if [ -d "$INSTALL_DIR" ]; then
    echo "Removing installation directory..."
    rm -rf "$INSTALL_DIR"
fi

# Remove wrapper script
if [ -f "/usr/local/bin/ansible-mcp" ]; then
    echo "Removing wrapper script..."
    rm -f "/usr/local/bin/ansible-mcp"
fi

echo "Uninstallation complete!"