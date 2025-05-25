#!/bin/bash

# Test the MCP server manually with JSON-RPC requests

echo "Testing Ansible MCP Server..."

# Test 1: List tools
echo "Test 1: Listing available tools"
echo '{"jsonrpc":"2.0","method":"tools/list","id":1}' | \
  timeout 5 node src/index.js 2>/dev/null | \
  grep -A20 '"result"' || echo "Failed to list tools"

echo -e "\n---\n"

# Test 2: Get Ansible version
echo "Test 2: Getting Ansible version"
echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"ansible-command","arguments":{"command":"ansible --version"}},"id":2}' | \
  timeout 5 node src/index.js 2>/dev/null | \
  grep -A20 '"result"' || echo "Failed to get ansible version"

echo -e "\n---\n"

# Test 3: Test with invalid command (should fail gracefully)
echo "Test 3: Testing error handling"
echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"ansible-command","arguments":{"command":"invalid-command"}},"id":3}' | \
  timeout 5 node src/index.js 2>/dev/null | \
  grep -A10 '"result"' || echo "Failed to handle error"

echo -e "\nTests complete!"