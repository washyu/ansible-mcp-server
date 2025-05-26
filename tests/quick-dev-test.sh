#!/bin/bash
# Quick test of dev server functionality

echo "Quick Dev Server Test"
echo "===================="
echo ""

# Test 1: Direct MCP tool execution
echo "1. Testing direct MCP execution on dev server..."
ssh ubuntu@192.168.10.102 << 'EOF'
cd /home/ubuntu/ansible-mcp-server
echo '{"jsonrpc":"2.0","method":"tools/list","id":"1"}' | timeout 5s node src/index.js 2>/dev/null | grep -q '"result"' && echo "✅ MCP server responds to commands" || echo "❌ MCP server not responding"
EOF

# Test 2: SSE server connectivity
echo ""
echo "2. Testing SSE server on dev..."
curl -s -m 5 -H "Authorization: Bearer 75bf9cbcf951ed970c96431f77985d7588d1229d5b3f29e0555a177f628f55d5" http://192.168.10.102:3001/sse 2>&1 | head -n 5

# Test 3: Service status
echo ""
echo "3. Checking service status..."
ssh ubuntu@192.168.10.102 "sudo systemctl is-active sse-server"

# Test 4: Test a simple tool through proxy
echo ""
echo "4. Testing simple tool execution..."
cd /home/shaun/ansible-mcp-server

# Create a test script that sends a command and exits
cat > /tmp/test-dev-proxy.js << 'EOF'
const { spawn } = require('child_process');
const proxy = spawn('node', ['src/mcp-proxy-client.js', 'dev'], {
  env: { ...process.env, API_ACCESS_TOKEN: '75bf9cbcf951ed970c96431f77985d7588d1229d5b3f29e0555a177f628f55d5' }
});

let gotResponse = false;
proxy.stdout.on('data', (data) => {
  if (data.toString().includes('result')) {
    console.log('✅ Got response from dev server');
    gotResponse = true;
    proxy.kill();
  }
});

proxy.stderr.on('data', (data) => {
  const msg = data.toString();
  if (msg.includes('Session ID:')) {
    // Send test command
    setTimeout(() => {
      proxy.stdin.write('{"jsonrpc":"2.0","method":"tools/list","id":"test"}\n');
    }, 500);
  }
});

setTimeout(() => {
  if (!gotResponse) {
    console.log('❌ No response from dev server');
  }
  proxy.kill();
  process.exit(0);
}, 10000);
EOF

node /tmp/test-dev-proxy.js

echo ""
echo "===================="
echo "Test complete"