#!/bin/bash
# Ansible MCP Server Setup Script

set -e

echo "=== Ansible MCP Server Setup ==="
echo

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if .env exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}No .env file found. Creating from template...${NC}"
    cp .env.example .env
    echo -e "${GREEN}Created .env file. Please edit it with your configuration.${NC}"
    echo
fi

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Function to prompt for value
prompt_for_value() {
    local var_name=$1
    local description=$2
    local default_value=$3
    local current_value=${!var_name}
    
    if [ -z "$current_value" ]; then
        read -p "$description [$default_value]: " input_value
        export $var_name="${input_value:-$default_value}"
    fi
}

# Interactive setup if key values are missing
if [ -z "$PROXMOX_HOST" ] || [ -z "$PROXMOX_PASSWORD" ]; then
    echo "Let's configure your Proxmox connection:"
    echo
    
    prompt_for_value "PROXMOX_HOST" "Proxmox server IP" "192.168.1.100"
    prompt_for_value "PROXMOX_USER" "Proxmox username" "root@pam"
    
    if [ -z "$PROXMOX_PASSWORD" ]; then
        read -s -p "Proxmox password: " PROXMOX_PASSWORD
        echo
        export PROXMOX_PASSWORD
    fi
    
    # Update .env file
    echo -e "\n${YELLOW}Updating .env file...${NC}"
    sed -i "s/PROXMOX_HOST=.*/PROXMOX_HOST=$PROXMOX_HOST/" .env
    sed -i "s/PROXMOX_USER=.*/PROXMOX_USER=$PROXMOX_USER/" .env
    sed -i "s/PROXMOX_PASSWORD=.*/PROXMOX_PASSWORD=$PROXMOX_PASSWORD/" .env
fi

# Deployment options
echo
echo "Choose deployment method:"
echo "1) Docker (Recommended)"
echo "2) Proxmox VM"
echo "3) Local installation"
echo
read -p "Select option [1-3]: " deploy_option

case $deploy_option in
    1)
        echo -e "\n${GREEN}Deploying with Docker...${NC}"
        
        # Check Docker
        if ! command -v docker &> /dev/null; then
            echo -e "${RED}Docker is not installed. Please install Docker first.${NC}"
            exit 1
        fi
        
        # Build and run
        docker compose build
        docker compose up -d
        
        echo -e "\n${GREEN}MCP Server is running in Docker!${NC}"
        echo "Container name: ansible-mcp-server"
        echo
        echo "For Claude Desktop on Windows, configure SSH connection to:"
        echo "  Host: $(hostname -I | awk '{print $1}')"
        echo "  Port: 2222"
        echo "  User: mcp"
        ;;
        
    2)
        echo -e "\n${GREEN}Deploying to Proxmox VM...${NC}"
        
        # Check prerequisites
        if ! command -v ansible &> /dev/null; then
            echo -e "${RED}Ansible is not installed. Please install Ansible first.${NC}"
            exit 1
        fi
        
        # Create inventory
        cat > inventory/proxmox.yml << EOF
all:
  hosts:
    proxmox:
      ansible_host: $PROXMOX_HOST
      ansible_user: $PROXMOX_USER
      ansible_password: $PROXMOX_PASSWORD
      ansible_ssh_common_args: '-o StrictHostKeyChecking=no'
EOF
        
        # Run deployment playbooks
        echo "Creating Ubuntu template..."
        ansible-playbook -i inventory/proxmox.yml playbooks/create-ubuntu-template.yml
        
        echo "Creating MCP VM..."
        ansible-playbook -i inventory/proxmox.yml playbooks/create-mcp-vm.yml
        
        echo "Deploying MCP server..."
        ansible-playbook -i inventory/mcp-server.yml playbooks/deploy-mcp-server.yml
        
        echo -e "\n${GREEN}MCP Server deployed to Proxmox!${NC}"
        echo "VM IP: ${MCP_VM_IP:-192.168.1.110}"
        ;;
        
    3)
        echo -e "\n${GREEN}Installing locally...${NC}"
        
        # Check Node.js
        if ! command -v node &> /dev/null; then
            echo -e "${RED}Node.js is not installed. Please install Node.js 20+ first.${NC}"
            exit 1
        fi
        
        # Install dependencies
        npm install
        
        # Create systemd service (optional)
        if [ -d /etc/systemd/system ]; then
            read -p "Create systemd service? [y/N]: " create_service
            if [[ $create_service =~ ^[Yy]$ ]]; then
                sudo tee /etc/systemd/system/ansible-mcp.service > /dev/null << EOF
[Unit]
Description=Ansible MCP Server
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$(pwd)
ExecStart=$(which node) $(pwd)/src/index.js
Restart=always
Environment="NODE_ENV=production"

[Install]
WantedBy=multi-user.target
EOF
                sudo systemctl daemon-reload
                sudo systemctl enable ansible-mcp
                echo -e "${GREEN}Systemd service created: ansible-mcp.service${NC}"
            fi
        fi
        
        echo -e "\n${GREEN}Local installation complete!${NC}"
        echo "Run with: npm start"
        ;;
esac

# Display configuration info
echo
echo "=== Configuration Summary ==="
echo "Proxmox Host: $PROXMOX_HOST"
echo "Proxmox User: $PROXMOX_USER"
echo "Default Gateway: ${DEFAULT_GATEWAY:-192.168.1.1}"
echo "Default Storage: ${DEFAULT_STORAGE:-local-lvm}"
echo

# Claude Desktop configuration
echo "=== Claude Desktop Configuration ==="
echo
echo "Add this to your Claude Desktop config:"
echo '```json'
echo '{'
echo '  "mcpServers": {'
echo '    "ansible-homelab": {'
echo '      "command": "ssh",'
echo '      "args": ['
echo '        "-i", "C:\\Users\\YourName\\.ssh\\mcp_key",'
echo '        "-o", "StrictHostKeyChecking=no",'
if [ "$deploy_option" == "1" ]; then
    echo "        \"-p\", \"2222\","
    echo "        \"mcp@$(hostname -I | awk '{print $1}')\","
else
    echo "        \"mcp@${MCP_VM_IP:-192.168.1.110}\","
fi
echo '        "/home/mcp/mcp-ssh-wrapper.sh"'
echo '      ]'
echo '    }'
echo '  }'
echo '}'
echo '```'
echo
echo -e "${GREEN}Setup complete!${NC}"