# Setting up Proxmox API Token for Terraform

## Quick Setup Steps

1. **Login to Proxmox Web UI** at https://192.168.10.200:8006

2. **Create API Token**:
   - Go to Datacenter → Permissions → API Tokens
   - Click "Add"
   - User: root
   - Token ID: ansible
   - Privilege Separation: UNCHECKED (for full permissions)
   - Click "Add"
   - **COPY THE TOKEN SECRET** - it's only shown once!

3. **Create terraform.tfvars**:
   ```bash
   cd /home/user/ansible-mcp-server/terraform/mcp-server
   cat > terraform.tfvars << EOF
   proxmox_api_token_id = "root@pam!ansible"
   proxmox_api_token_secret = "YOUR-TOKEN-SECRET-HERE"
   EOF
   ```

4. **Test the connection**:
   ```bash
   cd /home/user/ansible-mcp-server/terraform/mcp-server
   terraform init
   terraform plan
   ```

## Alternative: Use Password Authentication

If you prefer, you can modify the Terraform provider to use password auth:

```hcl
provider "proxmox" {
  pm_api_url = "https://192.168.10.200:8006/api2/json"
  pm_user = "root@pam"
  pm_password = "Tenchi01!"
  pm_tls_insecure = true
}
```

But API tokens are more secure and recommended.