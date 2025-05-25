#!/bin/bash

# Quick test commands for the Ansible MCP server

echo "=== Testing Ansible MCP Server on homelab2 ==="
echo ""

# Test 1: List inventory graph
echo "1. Showing inventory graph:"
ssh shaun@homelab2 "cd /opt/ansible-mcp-server && echo '{\"jsonrpc\":\"2.0\",\"method\":\"tools/call\",\"params\":{\"name\":\"ansible-inventory\",\"arguments\":{\"inventory\":\"/home/shaun/ansible/inventory/hosts\",\"graph\":true}},\"id\":1}' | timeout 5 sudo /usr/bin/node src/index.js 2>/dev/null | jq -r '.result.content[0].text' | jq -r '.output'"

echo ""
echo "2. Testing connection to working hosts:"
ssh shaun@homelab2 "cd /home/shaun/ansible && ansible homelab2,linuxrwifi -i inventory/hosts -m setup -a 'filter=ansible_hostname' --one-line"

echo ""
echo "=== MCP Server is ready for use ==="
echo "To use with Claude Desktop, configure it to connect to the server on homelab2"