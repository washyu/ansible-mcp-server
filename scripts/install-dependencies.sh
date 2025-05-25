#!/bin/bash
# Install all dependencies for MCP server
# Can be run standalone or as part of deployment

set -e

echo "Installing MCP Server Dependencies"
echo "=================================="

# Detect OS
if [ -f /etc/debian_version ]; then
    OS="debian"
    PKG_MANAGER="apt-get"
elif [ -f /etc/redhat-release ]; then
    OS="redhat"
    PKG_MANAGER="yum"
else
    echo "Unsupported OS"
    exit 1
fi

# Update package manager
echo "Updating package manager..."
if [ "$OS" = "debian" ]; then
    apt-get update
else
    yum makecache
fi

# Install system dependencies
echo "Installing system packages..."
if [ "$OS" = "debian" ]; then
    apt-get install -y \
        curl \
        wget \
        git \
        gnupg \
        software-properties-common \
        python3 \
        python3-pip \
        python3-venv \
        openssh-client \
        jq \
        unzip
else
    yum install -y \
        curl \
        wget \
        git \
        gnupg2 \
        python3 \
        python3-pip \
        openssh-clients \
        jq \
        unzip
fi

# Install Node.js if not present
if ! command -v node &> /dev/null; then
    echo "Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    $PKG_MANAGER install -y nodejs
fi

# Install Ansible
if ! command -v ansible &> /dev/null; then
    echo "Installing Ansible..."
    if [ "$OS" = "debian" ]; then
        apt-get install -y ansible
    else
        yum install -y ansible
    fi
fi

# Install Terraform
if ! command -v terraform &> /dev/null; then
    echo "Installing Terraform..."
    TERRAFORM_VERSION="1.7.0"
    wget https://releases.hashicorp.com/terraform/${TERRAFORM_VERSION}/terraform_${TERRAFORM_VERSION}_linux_amd64.zip
    unzip terraform_${TERRAFORM_VERSION}_linux_amd64.zip
    mv terraform /usr/local/bin/
    rm terraform_${TERRAFORM_VERSION}_linux_amd64.zip
    chmod +x /usr/local/bin/terraform
fi

# Install Python packages for Ansible
echo "Installing Python packages..."
pip3 install --upgrade pip
pip3 install \
    ansible-core \
    netaddr \
    jmespath \
    passlib \
    bcrypt

# Install useful Ansible collections
echo "Installing Ansible collections..."
ansible-galaxy collection install community.general
ansible-galaxy collection install ansible.posix
ansible-galaxy collection install community.docker

# Create ansible directory structure
echo "Creating Ansible directory structure..."
mkdir -p /etc/ansible
mkdir -p /opt/ansible-mcp-server/{playbooks,inventory,roles,terraform}

# Set up basic ansible.cfg
if [ ! -f /etc/ansible/ansible.cfg ]; then
    cat > /etc/ansible/ansible.cfg << 'EOF'
[defaults]
host_key_checking = False
inventory = /opt/ansible-mcp-server/inventory
roles_path = /opt/ansible-mcp-server/roles
retry_files_enabled = False
gathering = smart
fact_caching = jsonfile
fact_caching_connection = /tmp/ansible-facts
fact_caching_timeout = 86400

[ssh_connection]
pipelining = True
control_path = /tmp/ansible-%%h-%%p-%%r
EOF
fi

# Install Docker (optional, for Docker-based deployments)
if ! command -v docker &> /dev/null; then
    echo "Docker not found. Skipping Docker installation."
    echo "To install Docker later, run: curl -fsSL https://get.docker.com | sh"
fi

# Verify installations
echo ""
echo "Verifying installations..."
echo "=========================="

check_command() {
    if command -v $1 &> /dev/null; then
        echo "✓ $1 $(command -v $1) - $($1 --version 2>&1 | head -1)"
    else
        echo "✗ $1 not found"
    fi
}

check_command node
check_command npm
check_command ansible
check_command ansible-playbook
check_command terraform
check_command python3
check_command pip3
check_command git

echo ""
echo "Checking Ansible collections..."
ansible-galaxy collection list | grep -E "(community.general|ansible.posix|community.docker)" || echo "Some collections may be missing"

echo ""
echo "Dependencies installation complete!"
echo ""
echo "Next steps:"
echo "1. Install the MCP server: sudo ./scripts/install.sh"
echo "2. Configure environment: cp .env.example .env && edit .env"
echo "3. Start the service: sudo systemctl start ansible-mcp-server"