# Connecting Claude Desktop (Windows) to MCP Server on Proxmox

This guide explains how to connect Claude Desktop on Windows to your Ansible MCP Server running on a Proxmox VM.

## Prerequisites

1. MCP Server VM deployed on Proxmox (using `deploy-mcp-server.yml`)
2. SSH client on Windows (built-in OpenSSH or PuTTY)
3. Claude Desktop installed on Windows

## Method 1: Direct SSH Connection (Recommended)

### Step 1: Generate SSH Key on Windows

```powershell
# Open PowerShell as regular user
ssh-keygen -t rsa -b 4096 -f $HOME\.ssh\mcp_key
```

### Step 2: Add Public Key to MCP Server

Copy the content of `C:\Users\YourName\.ssh\mcp_key.pub` and add it to the MCP server:

```bash
# On the MCP server VM
echo "your-public-key-content" >> /home/mcp/.ssh/authorized_keys
```

### Step 3: Configure Claude Desktop

Edit Claude Desktop configuration file:
`%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "ansible-homelab": {
      "command": "ssh",
      "args": [
        "-i", "C:\\Users\\YourName\\.ssh\\mcp_key",
        "-o", "StrictHostKeyChecking=no",
        "mcp@192.168.10.100",
        "/home/mcp/mcp-ssh-wrapper.sh"
      ],
      "env": {}
    }
  }
}
```

## Method 2: Using SSH Config File

### Step 1: Create SSH Config

Create/edit `C:\Users\YourName\.ssh\config`:

```
Host mcp-server
    HostName 192.168.10.100
    User mcp
    IdentityFile ~/.ssh/mcp_key
    StrictHostKeyChecking no
```

### Step 2: Configure Claude Desktop

```json
{
  "mcpServers": {
    "ansible-homelab": {
      "command": "ssh",
      "args": ["mcp-server", "/home/mcp/mcp-ssh-wrapper.sh"],
      "env": {}
    }
  }
}
```

## Method 3: Using Plink (PuTTY)

### Step 1: Configure PuTTY Session

1. Open PuTTY
2. Create a new session named "mcp-server"
3. Set hostname: `192.168.10.100`
4. Set username: `mcp`
5. Add your private key in Connection > SSH > Auth
6. Save the session

### Step 2: Configure Claude Desktop

```json
{
  "mcpServers": {
    "ansible-homelab": {
      "command": "C:\\Program Files\\PuTTY\\plink.exe",
      "args": [
        "-load", "mcp-server",
        "/home/mcp/mcp-ssh-wrapper.sh"
      ],
      "env": {}
    }
  }
}
```

## Testing the Connection

1. Restart Claude Desktop after configuration changes
2. Open Claude Desktop developer tools (Ctrl+Shift+I)
3. Check the console for MCP connection status
4. You should see "Ansible MCP server running on stdio"

## Troubleshooting

### Connection Failed

1. Test SSH connection manually:
   ```powershell
   ssh mcp@192.168.10.100 "/home/mcp/mcp-ssh-wrapper.sh"
   ```

2. Check firewall on MCP server:
   ```bash
   sudo ufw allow 22/tcp
   ```

3. Verify MCP server is running:
   ```bash
   ssh mcp@192.168.10.100 "ps aux | grep node"
   ```

### Permission Denied

1. Check SSH key permissions on Windows:
   ```powershell
   icacls $HOME\.ssh\mcp_key /inheritance:r /grant:r "$env:USERNAME:R"
   ```

2. Verify authorized_keys on server:
   ```bash
   ssh mcp@192.168.10.100 "cat ~/.ssh/authorized_keys"
   ```

### MCP Commands Not Working

1. Test MCP server directly:
   ```bash
   ssh mcp@192.168.10.100 "cd /opt/ansible-mcp-server && node src/index.js"
   ```

2. Check Node.js installation:
   ```bash
   ssh mcp@192.168.10.100 "node --version"
   ```

## Using the MCP Server

Once connected, you can use commands like:

- "Deploy Nextcloud on Proxmox"
- "Show me the network topology"
- "Create a new Ansible playbook for nginx"
- "Set up a mail server with Terraform and Ansible"

The MCP server has access to:
- Ansible playbooks in `/opt/ansible-mcp-server/homelab_playbook/`
- Terraform configurations
- Full Proxmox API access
- Network visualization tools