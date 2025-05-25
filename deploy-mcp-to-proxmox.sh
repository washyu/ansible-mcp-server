#!/bin/bash
# Deploy MCP Server to Proxmox VM

set -e

echo "=== Ansible MCP Server Deployment to Proxmox ==="
echo

# Configuration
MCP_VM_NAME="${MCP_VM_NAME:-mcp-server}"
MCP_VM_IP="${MCP_VM_IP:-192.168.10.100}"
MCP_VM_CORES="${MCP_VM_CORES:-2}"
MCP_VM_MEMORY="${MCP_VM_MEMORY:-4096}"
MCP_VM_DISK="${MCP_VM_DISK:-20G}"
PROXMOX_NODE="${PROXMOX_NODE:-proxmox}"

# Check if Terraform is installed
if ! command -v terraform &> /dev/null; then
    echo "Error: Terraform is not installed. Please install Terraform first."
    exit 1
fi

# Check if Ansible is installed
if ! command -v ansible &> /dev/null; then
    echo "Error: Ansible is not installed. Please install Ansible first."
    exit 1
fi

echo "Configuration:"
echo "  VM Name: $MCP_VM_NAME"
echo "  VM IP: $MCP_VM_IP"
echo "  Cores: $MCP_VM_CORES"
echo "  Memory: $MCP_VM_MEMORY MB"
echo "  Disk: $MCP_VM_DISK"
echo

read -p "Continue with deployment? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
fi

# Step 1: Create Terraform configuration for MCP VM
echo "Step 1: Creating Terraform configuration..."
mkdir -p terraform/mcp-server

cat > terraform/mcp-server/main.tf << EOF
terraform {
  required_providers {
    proxmox = {
      source = "Telmate/proxmox"
      version = ">=2.9.0"
    }
  }
}

provider "proxmox" {
  pm_api_url = var.proxmox_api_url
  pm_api_token_id = var.proxmox_api_token_id
  pm_api_token_secret = var.proxmox_api_token_secret
  pm_tls_insecure = true
}

variable "proxmox_api_url" {
  description = "Proxmox API URL"
  type = string
  default = "https://192.168.10.200:8006/api2/json"
}

variable "proxmox_api_token_id" {
  description = "Proxmox API Token ID"
  type = string
}

variable "proxmox_api_token_secret" {
  description = "Proxmox API Token Secret"
  type = string
  sensitive = true
}

resource "proxmox_vm_qemu" "mcp_server" {
  name        = "${MCP_VM_NAME}"
  target_node = "${PROXMOX_NODE}"
  clone       = "ubuntu-cloud-template"
  
  cores   = ${MCP_VM_CORES}
  memory  = ${MCP_VM_MEMORY}
  
  disk {
    storage = "local-lvm"
    size    = "${MCP_VM_DISK}"
    type    = "scsi"
  }
  
  network {
    model  = "virtio"
    bridge = "vmbr0"
  }
  
  # Cloud-init settings
  os_type = "cloud-init"
  ipconfig0 = "ip=${MCP_VM_IP}/24,gw=192.168.10.1"
  sshkeys = file("~/.ssh/id_rsa.pub")
  
  lifecycle {
    ignore_changes = [
      network,
    ]
  }
}

output "mcp_server_ip" {
  value = proxmox_vm_qemu.mcp_server.default_ipv4_address
  description = "IP address of MCP Server VM"
}
EOF

# Step 2: Apply Terraform configuration
echo "Step 2: Creating VM with Terraform..."
cd terraform/mcp-server

if [ ! -f terraform.tfvars ]; then
    echo "Please create terraform.tfvars with your Proxmox credentials:"
    echo "proxmox_api_token_id = \"root@pam!ansible\""
    echo "proxmox_api_token_secret = \"your-token-secret\""
    exit 1
fi

terraform init
terraform plan
terraform apply -auto-approve

cd ../..

# Step 3: Wait for VM to be ready
echo "Step 3: Waiting for VM to be ready..."
sleep 30

# Test SSH connection
until ssh -o StrictHostKeyChecking=no root@${MCP_VM_IP} "echo 'VM is ready'" 2>/dev/null; do
    echo "Waiting for SSH to be available..."
    sleep 5
done

# Step 4: Create Ansible inventory
echo "Step 4: Creating Ansible inventory..."
cat > inventory/mcp-server.yml << EOF
all:
  hosts:
    mcp-server:
      ansible_host: ${MCP_VM_IP}
      ansible_user: root
      ansible_ssh_common_args: '-o StrictHostKeyChecking=no'
EOF

# Step 5: Get Windows SSH public key if available
if [ -f ~/.ssh/windows_key.pub ]; then
    WINDOWS_KEY=$(cat ~/.ssh/windows_key.pub)
    EXTRA_VARS="windows_ssh_pubkey='$WINDOWS_KEY'"
else
    echo "Note: No Windows SSH key found at ~/.ssh/windows_key.pub"
    echo "You'll need to manually add your Windows SSH key to the MCP server"
    EXTRA_VARS=""
fi

# Step 6: Run Ansible playbook
echo "Step 6: Configuring MCP server with Ansible..."
ansible-playbook -i inventory/mcp-server.yml playbooks/deploy-mcp-server.yml -e "$EXTRA_VARS"

echo
echo "=== Deployment Complete ==="
echo
echo "MCP Server is now running at: ${MCP_VM_IP}"
echo
echo "To connect from Windows Claude Desktop, add this to your config:"
echo "{"
echo "  \"mcpServers\": {"
echo "    \"ansible-homelab\": {"
echo "      \"command\": \"ssh\","
echo "      \"args\": ["
echo "        \"-i\", \"C:\\\\Users\\\\YourName\\\\.ssh\\\\mcp_key\","
echo "        \"mcp@${MCP_VM_IP}\","
echo "        \"/home/mcp/mcp-ssh-wrapper.sh\""
echo "      ]"
echo "    }"
echo "  }"
echo "}"
echo
echo "Don't forget to add your Windows SSH public key to:"
echo "  /home/mcp/.ssh/authorized_keys on the MCP server"