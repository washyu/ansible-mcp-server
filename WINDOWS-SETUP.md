# Running Ansible MCP Server on Windows

Since SSH from Claude Desktop on Windows has issues, here's how to run the MCP server locally on Windows.

## Quick Setup

1. **Install Prerequisites on Windows**
   - Install [Node.js 20+](https://nodejs.org/)
   - Install [Git for Windows](https://git-scm.com/download/win)

2. **Clone the Repository**
   ```powershell
   cd C:\Users\washy\Documents
   git clone https://github.com/yourusername/ansible-mcp-server.git
   cd ansible-mcp-server
   ```

3. **Install Dependencies**
   ```powershell
   npm install
   ```

4. **Configure Environment**
   ```powershell
   # Copy the example file
   copy .env.example .env
   
   # Edit with notepad (or your preferred editor)
   notepad .env
   ```

   Make sure your `.env` file has:
   ```
   PROXMOX_HOST=192.168.10.200
   PROXMOX_USER=root@pam
   PROXMOX_PASSWORD=Tenchi01!
   PROXMOX_API_URL=https://192.168.10.200:8006/api2/json
   DEFAULT_GATEWAY=192.168.10.1
   ```

5. **Configure Claude Desktop**
   
   Edit `%APPDATA%\Claude\claude_desktop_config.json`:
   ```json
   {
     "mcpServers": {
       "ansible-homelab": {
         "command": "node",
         "args": ["C:\\Users\\washy\\Documents\\ansible-mcp-server\\src\\index.js"],
         "cwd": "C:\\Users\\washy\\Documents\\ansible-mcp-server"
       }
     }
   }
   ```

6. **Restart Claude Desktop**

## Alternative: Use npx

If you don't want to clone the repo, you can use npx:

```json
{
  "mcpServers": {
    "ansible-homelab": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-stdio", "node", "C:\\Users\\washy\\Documents\\ansible-mcp-server\\src\\index.js"],
      "env": {
        "PROXMOX_HOST": "192.168.10.200",
        "PROXMOX_USER": "root@pam",
        "PROXMOX_PASSWORD": "Tenchi01!",
        "PROXMOX_API_URL": "https://192.168.10.200:8006/api2/json",
        "PROXMOX_NODE": "proxmox",
        "DEFAULT_GATEWAY": "192.168.10.1",
        "DEFAULT_STORAGE": "local-lvm",
        "DEFAULT_BRIDGE": "vmbr0"
      }
    }
  }
}
```

## SSH Key Setup for Ansible

Since the MCP server will run on Windows but needs to SSH to Linux servers:

1. **Copy your existing SSH key** from the Linux machine:
   ```powershell
   # Create .ssh directory if it doesn't exist
   mkdir $HOME\.ssh
   
   # Copy your private key from the MCP VM
   scp ubuntu@192.168.10.100:/home/ubuntu/.ssh/id_rsa $HOME\.ssh\id_rsa_homelab
   ```

2. **Set permissions** (Windows):
   ```powershell
   icacls $HOME\.ssh\id_rsa_homelab /inheritance:r /grant:r "$env:USERNAME:R"
   ```

3. **Update SSH config** (`C:\Users\washy\.ssh\config`):
   ```
   Host proxmox
       HostName 192.168.10.200
       User root
       IdentityFile ~/.ssh/id_rsa_homelab
       StrictHostKeyChecking no
   
   Host homelab-*
       User ubuntu
       IdentityFile ~/.ssh/id_rsa_homelab
       StrictHostKeyChecking no
   ```

## Testing

1. **Test Node.js installation**:
   ```powershell
   node --version
   ```

2. **Test MCP server locally**:
   ```powershell
   cd C:\Users\washy\Documents\ansible-mcp-server
   node src\index.js
   ```
   You should see: "Ansible MCP server running on stdio"

3. **Test in Claude Desktop**: 
   - Restart Claude after updating config
   - Type: "What tools do you have available?"
   - You should see the list of Ansible and Terraform tools

## Troubleshooting

### "Cannot find module" errors
Make sure you ran `npm install` in the ansible-mcp-server directory.

### "ENOENT .env" errors
Make sure you created the `.env` file from `.env.example`.

### SSH errors when running Ansible
1. Install OpenSSH client on Windows:
   ```powershell
   Add-WindowsCapability -Online -Name OpenSSH.Client*
   ```

2. Test SSH connection:
   ```powershell
   ssh root@192.168.10.200 "echo 'SSH works!'"
   ```

### Permission errors
Run PowerShell as Administrator if you get permission errors.

## Benefits of Local Setup

1. **No SSH issues** - Direct execution on Windows
2. **Better performance** - No network overhead
3. **Easier debugging** - See errors directly in PowerShell
4. **Full access** - Can modify and test immediately

## Next Steps

Now you can use Claude Desktop to:
- "Create a new VM for Nextcloud on Proxmox"
- "Show me the network topology"
- "Deploy a mail server"
- "Create an Ansible playbook for Docker installation"

The MCP server running on Windows will SSH to your Proxmox server and other Linux machines as needed.