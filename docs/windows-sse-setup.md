# Windows Claude Desktop Setup Guide (SSE Proxy Method)

This guide explains how to connect Claude Desktop on Windows to a remote MCP server running on Linux, using Server-Sent Events (SSE) as the transport mechanism.

## Why SSE Proxy?

The standard MCP stdio transport assumes local process communication and doesn't work well over SSH from Windows. The SSE proxy provides a stable HTTP-based transport that works reliably across networks.

## Architecture

```
Windows Machine                    Linux Server
┌─────────────┐                   ┌──────────────┐
│   Claude    │                   │ MCP Server   │
│   Desktop   │                   │ (index.js)   │
└──────┬──────┘                   └──────▲───────┘
       │ stdio                            │ stdio
┌──────▼──────┐                   ┌──────┴───────┐
│ MCP Proxy   │  HTTP/SSE         │ SSE Server   │
│ Client      ├──────────────────►│ (port 3001)  │
└─────────────┘                   └──────────────┘
```

## Prerequisites

### On Windows:
- Node.js 18+ installed
- PowerShell (for setup script)
- Claude Desktop installed

### On Linux Server:
- MCP server deployed (via Docker or VM)
- Port 3001 accessible from Windows machine
- Firewall allows incoming connections on port 3001

## Setup Instructions

### 1. Server Setup (Linux)

1. **Deploy the SSE server** (if not already running):
   ```bash
   # SSH into your MCP server
   ssh ubuntu@192.168.10.100
   
   # Navigate to MCP directory
   cd /opt/ansible-mcp-server
   
   # Start SSE server
   sudo systemctl start sse-server
   sudo systemctl enable sse-server
   
   # Check status
   sudo systemctl status sse-server
   ```

2. **Configure firewall** (if needed):
   ```bash
   # Allow SSE port
   sudo ufw allow 3001/tcp
   ```

3. **Verify SSE server is running**:
   ```bash
   curl http://localhost:3001/health
   ```

### 2. Windows Client Setup

1. **Download and run the setup script**:
   - Open PowerShell as Administrator
   - Run:
   ```powershell
   # Download setup script
   Invoke-WebRequest -Uri "https://raw.githubusercontent.com/yourusername/ansible-mcp-server/main/windows-setup.ps1" -OutFile "windows-setup.ps1"
   
   # Run setup
   .\windows-setup.ps1
   ```

2. **Enter configuration when prompted**:
   - MCP server IP: `192.168.10.100` (your server's IP)
   - SSE port: `3001` (press Enter for default)
   - API token: Enter the token from your server's `.env` file

3. **Restart Claude Desktop** to load the new configuration

### 3. Manual Setup (Alternative)

If you prefer manual setup:

1. **Create proxy directory**:
   ```powershell
   mkdir $env:USERPROFILE\.mcp-proxy
   cd $env:USERPROFILE\.mcp-proxy
   ```

2. **Create package.json**:
   ```json
   {
     "name": "mcp-proxy-client",
     "version": "1.0.0",
     "type": "module",
     "dependencies": {
       "eventsource": "^2.0.2"
     }
   }
   ```

3. **Copy mcp-proxy-client.js** from the repository

4. **Install dependencies**:
   ```powershell
   npm install
   ```

5. **Create batch wrapper** (`mcp-proxy.bat`):
   ```batch
   @echo off
   set MCP_SSE_URL=http://192.168.10.100:3001/sse
   set API_ACCESS_TOKEN=your-secure-token
   node "%~dp0mcp-proxy-client.js" %*
   ```

6. **Configure Claude Desktop**:
   Create/edit `%APPDATA%\Claude\claude_desktop_config.json`:
   ```json
   {
     "mcpServers": {
       "ansible-mcp": {
         "command": "cmd",
         "args": ["/c", "C:\\Users\\YourName\\.mcp-proxy\\mcp-proxy.bat"]
       }
     }
   }
   ```

## Testing the Connection

1. **Test SSE server directly**:
   ```powershell
   # From Windows, test if you can reach the server
   curl http://192.168.10.100:3001/health
   ```

2. **Test proxy client**:
   ```powershell
   # Run the proxy manually
   cd $env:USERPROFILE\.mcp-proxy
   node mcp-proxy-client.js
   
   # You should see "Connecting to SSE server" message
   # Press Ctrl+C to exit
   ```

3. **Check Claude Desktop**:
   - Open Claude Desktop
   - The MCP indicator should show as connected
   - Try running a command like "list playbooks"

## Troubleshooting

### Connection Failed

1. **Check firewall**:
   ```bash
   # On Linux server
   sudo ufw status
   netstat -tlnp | grep 3001
   ```

2. **Check SSE server logs**:
   ```bash
   sudo journalctl -u sse-server -f
   ```

3. **Test network connectivity**:
   ```powershell
   # From Windows
   Test-NetConnection -ComputerName 192.168.10.100 -Port 3001
   ```

### Authentication Errors

1. **Verify API token matches** between:
   - Server: `/opt/ansible-mcp-server/.env`
   - Client: `%USERPROFILE%\.mcp-proxy\mcp-proxy.bat`

2. **Check token format** (no extra spaces or quotes)

### Claude Desktop Not Detecting MCP

1. **Verify config path**: `%APPDATA%\Claude\claude_desktop_config.json`
2. **Check JSON syntax** (use a JSON validator)
3. **Ensure full path** to mcp-proxy.bat is correct
4. **Restart Claude Desktop** after config changes

### Performance Issues

1. **Check server resources**:
   ```bash
   # On server
   htop
   docker stats  # if using Docker
   ```

2. **Monitor SSE connections**:
   ```bash
   curl http://localhost:3001/health
   ```

## Security Considerations

1. **Use strong API tokens** (generate with `openssl rand -hex 32`)
2. **Use HTTPS in production** (configure nginx reverse proxy with SSL)
3. **Restrict firewall** to only allow connections from trusted IPs
4. **Rotate tokens regularly**

## Advanced Configuration

### Using HTTPS

1. **Setup nginx reverse proxy** on the server:
   ```nginx
   server {
       listen 443 ssl;
       server_name mcp.yourdomain.com;
       
       ssl_certificate /path/to/cert.pem;
       ssl_certificate_key /path/to/key.pem;
       
       location / {
           proxy_pass http://localhost:3001;
           proxy_http_version 1.1;
           proxy_set_header Connection '';
           proxy_buffering off;
           proxy_cache off;
       }
   }
   ```

2. **Update Windows client**:
   ```batch
   set MCP_SSE_URL=https://mcp.yourdomain.com/sse
   ```

### Multiple MCP Servers

You can configure multiple MCP servers in Claude Desktop:

```json
{
  "mcpServers": {
    "ansible-mcp": {
      "command": "cmd",
      "args": ["/c", "C:\\mcp-proxies\\ansible\\mcp-proxy.bat"]
    },
    "terraform-mcp": {
      "command": "cmd",
      "args": ["/c", "C:\\mcp-proxies\\terraform\\mcp-proxy.bat"]
    }
  }
}
```

## Support

- Check server logs: `sudo journalctl -u sse-server -f`
- Test health endpoint: `curl http://server-ip:3001/health`
- Verify Windows firewall isn't blocking outbound connections
- Ensure Node.js version 18+ on both client and server