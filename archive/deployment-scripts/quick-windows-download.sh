#!/bin/bash
# Quick script to serve Windows files

echo "Starting temporary web server on port 8080..."
echo "Files will be available at:"
echo "  http://$(hostname -I | awk '{print $1}'):8080/"
echo ""
echo "Download these files to your Windows machine:"
echo "  - windows-setup.ps1"
echo "  - src/mcp-proxy-client.js (save as mcp-proxy-client.js)"
echo ""
echo "Press Ctrl+C to stop the server"

cd /home/shaun/ansible-mcp-server
python3 -m http.server 8080