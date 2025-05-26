#!/bin/bash
# Test Terraform tools through SSE proxy using curl

API_TOKEN=${API_ACCESS_TOKEN:-"your-secure-token"}
SSE_URL="http://192.168.10.100:3001"

echo "Testing Terraform tools through SSE proxy..."

# First, establish SSE connection and get session ID
echo "Connecting to SSE server..."
SESSION_RESPONSE=$(curl -s -N -H "Authorization: Bearer $API_TOKEN" "$SSE_URL/sse" 2>&1 | head -n 20)
echo "SSE Response: $SESSION_RESPONSE"

# Extract session ID (this is a simplified approach)
SESSION_ID=$(echo "$SESSION_RESPONSE" | grep -o '"sessionId":"[^"]*"' | cut -d'"' -f4)

if [ -z "$SESSION_ID" ]; then
  echo "Failed to get session ID. Trying alternative approach..."
  # For testing, let's use a direct MCP call instead
  echo "Testing create-vm-template tool directly..."
  
  cd /opt/ansible-mcp-server 2>/dev/null || cd /home/shaun/ansible-mcp-server
  
  node -e "
    import('./src/tools/index.js').then(async module => {
      const handler = module.toolRegistry.getHandler('create-vm-template');
      
      console.log('Testing create-vm-template tool for Jenkins VM...');
      
      const params = {
        name: 'jenkins-server',
        vmid: 152,
        template: 'ubuntu-cloud',
        cores: 4,
        memory: 8192,
        disk: '50G',
        network: {
          bridge: 'vmbr0',
          ip: '192.168.10.152',
          gateway: '192.168.10.1',
          nameserver: '8.8.8.8'
        },
        outputDir: '/tmp/terraform-jenkins-via-proxy'
      };
      
      try {
        const result = await handler(params);
        console.log('Result:', JSON.stringify(result, null, 2));
        
        // Check generated files
        const fs = await import('fs');
        const path = await import('path');
        const tfPath = path.join(params.outputDir, params.name, 'main.tf');
        const content = await fs.promises.readFile(tfPath, 'utf8');
        console.log('\\nGenerated main.tf preview:');
        console.log(content.split('\\n').slice(0, 20).join('\\n'));
        console.log('...');
        
        // Check for the hyphen fix
        if (content.includes('jenkins_server')) {
          console.log('\\n✅ Resource name correctly converted from jenkins-server to jenkins_server');
        } else {
          console.log('\\n❌ Resource name still contains hyphens');
        }
      } catch (error) {
        console.error('Error:', error.message);
      }
    });
  "
else
  echo "Got session ID: $SESSION_ID"
  
  # Send tools/call request
  REQUEST_JSON='{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "create-vm-template",
      "arguments": {
        "name": "jenkins-server",
        "vmid": 152,
        "template": "ubuntu-cloud",
        "cores": 4,
        "memory": 8192,
        "disk": "50G",
        "network": {
          "bridge": "vmbr0",
          "ip": "192.168.10.152",
          "gateway": "192.168.10.1",
          "nameserver": "8.8.8.8"
        },
        "outputDir": "/tmp/terraform-jenkins-via-proxy"
      }
    },
    "id": "terraform-test-1"
  }'
  
  echo "Sending create-vm-template request..."
  curl -X POST \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $API_TOKEN" \
    -d "$REQUEST_JSON" \
    "$SSE_URL/sessions/$SESSION_ID/input"
    
  echo -e "\n\nWaiting for response..."
  sleep 3
  
  # Check if files were created
  if [ -d "/tmp/terraform-jenkins-via-proxy/jenkins-server" ]; then
    echo "✅ Terraform files created successfully!"
    ls -la /tmp/terraform-jenkins-via-proxy/jenkins-server/
  else
    echo "❌ Terraform files not found"
  fi
fi