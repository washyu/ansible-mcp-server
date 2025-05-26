# MCP Proxy Server Switching Guide

This guide explains how to use the enhanced MCP proxy client that supports switching between multiple MCP servers.

## Overview

The MCP proxy client now supports connecting to different MCP servers (production, development, local) and switching between them at runtime. This enables:

- Safe testing on development servers before production deployment
- Quick switching between environments without restarting Claude
- Multiple team members working on different server instances

## Server Configuration

The proxy client has three pre-configured servers:

1. **Production** (default): `192.168.10.100:3001`
2. **Development**: `192.168.10.102:3001`
3. **Local**: `localhost:3001`

## Usage

### Command Line

```bash
# Connect to production (default)
./scripts/mcp-proxy.sh

# Connect to dev server
./scripts/mcp-proxy.sh dev

# Connect to local server
./scripts/mcp-proxy.sh local
```

### Windows

```cmd
# Connect to production (default)
mcp-proxy.bat

# Connect to dev server
mcp-proxy.bat dev
```

### Environment Variable

```bash
# Override command line with environment variable
MCP_SERVER=dev ./scripts/mcp-proxy.sh
```

### Claude Desktop Configuration

Update your Claude Desktop config to use the proxy:

```json
{
  "mcpServers": {
    "ansible-mcp": {
      "command": "node",
      "args": [
        "C:\\path\\to\\mcp-proxy-client.js",
        "production"
      ],
      "env": {
        "API_ACCESS_TOKEN": "your-token-here"
      }
    }
  }
}
```

## Runtime Server Switching

The proxy supports switching servers without restarting Claude Desktop. This is done through special proxy commands:

### Switch Server
Send: `__MCP_PROXY_SWITCH_<server_name>`

Example: `__MCP_PROXY_SWITCH_dev`

Response:
```json
{
  "jsonrpc": "2.0",
  "result": {
    "switched": true,
    "server": "dev",
    "available": ["production", "dev", "local"]
  },
  "id": "proxy-switch"
}
```

### List Available Servers
Send: `__MCP_PROXY_LIST_SERVERS`

Response:
```json
{
  "jsonrpc": "2.0",
  "result": {
    "servers": {
      "production": { ... },
      "dev": { ... },
      "local": { ... }
    },
    "current": "production"
  },
  "id": "proxy-list"
}
```

## Testing

The proxy includes comprehensive test suites:

### Integration Tests
```bash
# Run all proxy tests
cd /home/shaun/ansible-mcp-server
node tests/proxy-integration-test.js
```

Tests:
- Connect to production server
- Connect to dev server
- Switch from production to dev
- Environment variable server selection
- Invalid server handling

### Restart Tests
```bash
# Test restart scenarios
node tests/proxy-restart-test.js
```

Tests:
- Graceful shutdown (SIGTERM)
- Crash recovery (SIGKILL)
- Rapid restarts
- Server persistence across restarts

### Jest Feature Tests
```bash
# Run comprehensive feature tests
./tests/run-proxy-tests.sh
```

## Architecture

```
┌─────────────────┐     stdio      ┌──────────────┐
│ Claude Desktop  │ ◄────────────► │  MCP Proxy   │
└─────────────────┘                └──────┬───────┘
                                          │ SSE
                                          ▼
                              ┌───────────────────────┐
                              │   MCP Servers         │
                              ├───────────────────────┤
                              │ • Production (100)    │
                              │ • Development (102)   │
                              │ • Local (localhost)   │
                              └───────────────────────┘
```

## Troubleshooting

### Connection Issues
- Ensure the API_ACCESS_TOKEN is set correctly
- Verify servers are running: `nc -zv <ip> 3001`
- Check proxy output for error messages

### Switching Issues
- Confirm current server with `__MCP_PROXY_LIST_SERVERS`
- Check that target server is available
- Review proxy stderr output for connection errors

### Windows Issues
- Ensure Node.js is in PATH
- Use full paths in batch files
- Check Windows Defender/firewall settings

## Security Notes

- The API token is shared across all servers
- Use different tokens for production vs development
- Never commit tokens to version control
- Consider using environment-specific tokens

## Future Enhancements

- Dynamic server discovery
- Load balancing across multiple servers
- Automatic failover on connection loss
- Server health monitoring
- Custom server configurations