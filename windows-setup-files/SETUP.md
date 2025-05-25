# Windows Setup Instructions for Ansible MCP

## Quick Setup

1. **Download all files** from this `windows-setup-files` directory to your Windows machine

2. **Create the proxy directory**:
   ```powershell
   mkdir C:\Users\washy\.mcp-proxy
   ```

3. **Copy files** to the proxy directory:
   - `mcp-proxy-client.js` → `C:\Users\washy\.mcp-proxy\`
   - `mcp-proxy.bat` → `C:\Users\washy\.mcp-proxy\`
   - `package.json` → `C:\Users\washy\.mcp-proxy\`

4. **Install dependencies**:
   ```powershell
   cd C:\Users\washy\.mcp-proxy
   npm install
   ```

5. **Update Claude Desktop config**:
   - Copy the contents of `claude_desktop_config.json`
   - Paste into `%APPDATA%\Claude\claude_desktop_config.json`
   - Or merge with existing config if you have other MCP servers

6. **Restart Claude Desktop**

## Testing

1. **Test the SSE server** (from Windows PowerShell):
   ```powershell
   curl http://192.168.10.100:3001/health
   ```
   You should get a response showing the server is healthy.

2. **Test the proxy client**:
   ```powershell
   cd C:\Users\washy\.mcp-proxy
   node mcp-proxy-client.js
   ```
   You should see:
   - "Using SSE URL: http://192.168.10.100:3001/sse"
   - "Connecting to SSE server..."
   - "SSE connection established"
   - "Session ID: [some-uuid]"

3. **Check Claude Desktop**:
   - Open Claude Desktop
   - Look for "ansible-mcp" in the MCP servers list
   - It should show as connected
   - Try asking: "What Ansible tools are available?"

## Architecture

```
Windows (Your PC)                    Linux (192.168.10.100)
┌─────────────────┐                 ┌──────────────────────┐
│ Claude Desktop  │                 │  SSE Server (:3001)  │
│                 │                 │                      │
│  Runs locally:  │                 │  Manages:            │
│  mcp-proxy.bat  │ ───HTTP/SSE──► │  - Authentication    │
│  which runs:    │                 │  - Session handling  │
│  mcp-proxy-     │                 │  - Spawns MCP procs  │
│  client.js      │                 │                      │
└─────────────────┘                 └──────────────────────┘
                                              │
                                              │ Spawns
                                              ▼
                                    ┌──────────────────────┐
                                    │  MCP Server Process  │
                                    │  (src/index.js)      │
                                    │                      │
                                    │  57 Ansible tools    │
                                    └──────────────────────┘
```

## Troubleshooting

If Claude Desktop shows "Server disconnected":
1. Check if SSE server is running: `curl http://192.168.10.100:3001/health`
2. Verify the API token matches in `mcp-proxy.bat`
3. Check Windows Firewall isn't blocking outbound connections to port 3001
4. Run the proxy client manually to see error messages

## How It Works

1. Claude Desktop starts `mcp-proxy.bat` locally on Windows
2. The batch file sets environment variables and runs `mcp-proxy-client.js`
3. The proxy client connects to the SSE server at `192.168.10.100:3001`
4. SSE server authenticates using the API token
5. SSE server spawns an MCP process and bridges communication
6. All 57 Ansible tools become available in Claude Desktop

This allows the AI agent to restart the MCP service when you push changes!