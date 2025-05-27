# Troubleshooting Guide: list-hosts Tool Not Appearing

## Quick Tests

### 1. Test Direct SSE Connection
```bash
cd C:\ansible-mcp
node test-sse-direct.js
```

This will:
- Connect directly to the SSE server
- Request the tools list
- Show if list-hosts is available on the server

### 2. Test Proxy Connection
```bash
cd C:\ansible-mcp
node test-mcp-connection.js
```

This will:
- Test the proxy client
- Show all tools received through the proxy
- Specifically check for list-hosts

### 3. Debug Claude Desktop
```powershell
cd C:\ansible-mcp
powershell -ExecutionPolicy Bypass .\debug-claude-desktop.ps1
```

This will:
- Check your Claude Desktop config
- Restart Claude Desktop
- Show next steps

## Common Issues and Solutions

### Issue 1: Tool exists on server but not in Claude Desktop

**Symptoms:**
- test-sse-direct.js shows list-hosts tool ✓
- test-mcp-connection.js shows list-hosts tool ✓  
- Claude Desktop doesn't show list-hosts ✗

**Solutions:**

1. **Force Claude Desktop to refresh:**
   - Close Claude Desktop completely (check Task Manager)
   - Rename the server in config (e.g., "ansible-mcp-server" → "ansible-mcp-server-v2")
   - Start Claude Desktop
   - The renamed server forces a fresh connection

2. **Use the refresh config:**
   ```powershell
   # Backup current config
   Copy-Item "$env:APPDATA\Claude\claude_desktop_config.json" "$env:APPDATA\Claude\claude_desktop_config.backup.json"
   
   # Use refresh config
   Copy-Item "C:\ansible-mcp\claude_desktop_config_refresh.json" "$env:APPDATA\Claude\claude_desktop_config.json"
   
   # Restart Claude Desktop
   ```

3. **Clear Claude Desktop cache:**
   ```powershell
   # Stop Claude Desktop
   Get-Process | Where-Object { $_.Name -like "*claude*" } | Stop-Process -Force
   
   # Clear cache (location may vary)
   Remove-Item "$env:APPDATA\Claude\Cache\*" -Recurse -Force -ErrorAction SilentlyContinue
   Remove-Item "$env:LOCALAPPDATA\Claude\Cache\*" -Recurse -Force -ErrorAction SilentlyContinue
   
   # Start Claude Desktop
   ```

### Issue 2: Proxy timeout errors

**Symptoms:**
- Logs show "Request timed out due to SSE server issue"
- Tools work intermittently

**Solution:**
The proxy client already has timeout handling. Check server logs:
```bash
# On the Linux server
sudo journalctl -u sse-server -f
```

### Issue 3: Tools not forwarding from server

**Symptoms:**
- test-sse-direct.js shows no list-hosts tool ✗
- Server logs show tools being registered

**Solution:**
Restart the SSE server:
```bash
# On the Linux server
sudo systemctl restart sse-server
sudo systemctl restart mcp-server
```

## Manual Testing

### Test the exact MCP protocol flow:

1. Create a file `manual-test.js`:
```javascript
import { spawn } from 'child_process';

const proxy = spawn('node', ['mcp-proxy-client.js'], {
  stdio: ['pipe', 'pipe', 'inherit']
});

// Send initialize
proxy.stdin.write(JSON.stringify({
  jsonrpc: '2.0',
  method: 'initialize',
  params: {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'test', version: '1.0.0' }
  },
  id: 1
}) + '\n');

// Wait and send tools/list
setTimeout(() => {
  proxy.stdin.write(JSON.stringify({
    jsonrpc: '2.0',
    method: 'tools/list',
    params: {},
    id: 2
  }) + '\n');
}, 2000);

// Print all responses
proxy.stdout.on('data', (data) => {
  console.log('Response:', data.toString());
});
```

2. Run it:
```bash
node manual-test.js
```

## If All Else Fails

1. **Check server-side tool registration:**
   ```bash
   # On Linux server
   cd /home/shaun/ansible-mcp-server
   grep -n "list-hosts" src/tools/ansible-tools.js
   ```

2. **Verify the tool is in the exports:**
   ```bash
   # Should show list-hosts in the ansibleTools array
   grep -B 10 -A 10 "ansibleTools = \[" src/tools/ansible-tools.js
   ```

3. **Test with a minimal config:**
   Create `minimal-config.json`:
   ```json
   {
     "mcpServers": {
       "test": {
         "command": "node",
         "args": ["C:\\ansible-mcp\\mcp-proxy-client.js"]
       }
     }
   }
   ```

4. **Enable debug logging:**
   Set environment variable in Claude Desktop config:
   ```json
   {
     "mcpServers": {
       "ansible-mcp-server": {
         "command": "node",
         "args": ["C:\\ansible-mcp\\mcp-proxy-client.js"],
         "env": {
           "DEBUG": "1",
           "NODE_ENV": "development"
         }
       }
     }
   }
   ```

## Contact for Help

If none of these solutions work:
1. Run all test scripts and save the output
2. Check server logs: `sudo journalctl -u sse-server -n 100`
3. Share the results for further debugging