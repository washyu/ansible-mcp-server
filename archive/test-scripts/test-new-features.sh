#!/bin/bash

echo "Testing new MCP server features..."

# Test create-playbook
echo -e "\n1. Testing create-playbook command:"
cat << 'EOF' | node test-client.js
{
  "method": "call_tool",
  "params": {
    "name": "create-playbook",
    "arguments": {
      "name": "test-playbook",
      "content": "---\n- name: Test playbook\n  hosts: all\n  tasks:\n    - name: Ping hosts\n      ping:\n"
    }
  }
}
EOF

# Test network-topology with different formats
echo -e "\n2. Testing network-topology (Mermaid format):"
cat << 'EOF' | node test-client.js
{
  "method": "call_tool",
  "params": {
    "name": "network-topology",
    "arguments": {
      "inventory": "./inventory/proxmox-hosts.yml",
      "format": "mermaid"
    }
  }
}
EOF

echo -e "\n3. Testing network-topology (JSON format):"
cat << 'EOF' | node test-client.js
{
  "method": "call_tool",
  "params": {
    "name": "network-topology",
    "arguments": {
      "inventory": "./inventory/proxmox-hosts.yml",
      "format": "json"
    }
  }
}
EOF

# Test generate-diagram
echo -e "\n4. Testing generate-diagram (network type):"
cat << 'EOF' | node test-client.js
{
  "method": "call_tool",
  "params": {
    "name": "generate-diagram",
    "arguments": {
      "type": "network",
      "inventory": "./inventory/proxmox-hosts.yml"
    }
  }
}
EOF

echo -e "\n5. Testing generate-diagram (service type):"
cat << 'EOF' | node test-client.js
{
  "method": "call_tool",
  "params": {
    "name": "generate-diagram",
    "arguments": {
      "type": "service",
      "inventory": "./inventory/proxmox-hosts.yml"
    }
  }
}
EOF

echo -e "\nAll tests completed!"