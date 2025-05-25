# Claude Desktop Setup Guide

## Local Development Setup

For local development and testing with Claude Desktop, use this configuration:

### 1. Create Claude Desktop Config

**Location**: 
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Linux: `~/.config/Claude/claude_desktop_config.json`

**Configuration for Local Development**:
```json
{
  "mcpServers": {
    "ansible-mcp-local": {
      "command": "node",
      "args": ["/path/to/ansible-mcp-server/src/index.js"],
      "env": {
        "NODE_ENV": "production"
      }
    }
  }
}
```

Replace `/path/to/ansible-mcp-server` with the actual path to your project.

### 2. Remote Server Setup (via SSH)

If connecting to a remote MCP server:

```json
{
  "mcpServers": {
    "ansible-mcp-remote": {
      "command": "ssh",
      "args": [
        "-i", "/path/to/ssh/key",
        "-o", "StrictHostKeyChecking=no",
        "-o", "LogLevel=ERROR",
        "user@remote-host",
        "node /path/to/ansible-mcp-server/src/index.js"
      ],
      "env": {
        "NODE_ENV": "production"
      }
    }
  }
}
```

### 3. Environment Variables

You can pass environment variables for configuration:

```json
{
  "mcpServers": {
    "ansible-mcp": {
      "command": "node",
      "args": ["/path/to/ansible-mcp-server/src/index.js"],
      "env": {
        "NODE_ENV": "production",
        "PROXMOX_HOST": "192.168.1.100",
        "PROXMOX_USER": "root@pam",
        "PROXMOX_PASSWORD": "your-password"
      }
    }
  }
}
```

## Troubleshooting

### Tools Not Appearing

If tools don't appear in Claude Desktop:

1. **Check stderr output** - The MCP server should not output to stderr in production
2. **Verify JSON-RPC communication** - Test with:
   ```bash
   echo '{"jsonrpc":"2.0","method":"tools/list","params":{},"id":1}' | node src/index.js
   ```
3. **Check for proxy interference** - Ensure you're not going through an SSE proxy
4. **Enable debug mode** - Set `NODE_ENV=development` to see server logs

### Common Issues

1. **"MCP server error" messages**
   - These are console.error outputs that interfere with stdio
   - Fixed by setting `NODE_ENV=production`

2. **Tool count mismatch**
   - Verify with: `node debug-tools.js`
   - Should show exactly 57 tools

3. **SSE Proxy Interference**
   - Make sure you're using direct stdio connection
   - Not going through http-mcp-bridge or sse-server

## Testing Your Setup

1. Restart Claude Desktop after changing configuration
2. Look for "ansible-mcp" in the available MCP servers
3. Check that all 57 tools are listed
4. Test a simple tool like `list-loaded-tools`

## Production Deployment

For production use, consider:

1. Using systemd service for the MCP server
2. Setting up proper logging (not to stderr)
3. Configuring authentication for SSH access
4. Using environment variables for sensitive data