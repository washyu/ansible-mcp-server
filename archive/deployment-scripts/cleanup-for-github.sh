#!/bin/bash
# Cleanup script to prepare repository for GitHub
# Removes PII and sensitive data

set -e

echo "Cleaning up repository for GitHub..."
echo "===================================="

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Files to remove completely
FILES_TO_REMOVE=(
    ".env"
    "*.log"
    "*.pid"
    "*.key"
    "*.pem"
    "*.crt"
    "id_rsa*"
    "id_ed25519*"
    "known_hosts"
    ".ssh/*"
    "*.bak"
    "*.swp"
    "*.tmp"
    "node_modules/"
    ".npm/"
    ".cache/"
    "terraform.tfstate*"
    ".terraform/"
    "*.tfvars"
    "ansible.cfg"
    "vault-password"
    "*-key.json"
    "credentials*"
    "secrets*"
)

# Remove sensitive files
echo -e "${YELLOW}Removing sensitive files...${NC}"
for pattern in "${FILES_TO_REMOVE[@]}"; do
    if compgen -G "$pattern" > /dev/null; then
        rm -rf $pattern
        echo "  Removed: $pattern"
    fi
done

# Clean up specific files with PII
echo -e "${YELLOW}Sanitizing configuration files...${NC}"

# Create example versions of config files
if [ -f ".env.example" ]; then
    echo "  .env.example already exists"
else
    echo -e "${RED}  Warning: .env.example not found${NC}"
fi

# Remove any IPs, passwords, or tokens from specific files
echo -e "${YELLOW}Scrubbing sensitive data from files...${NC}"

# List of files to check for sensitive data
FILES_TO_SCRUB=(
    "*.yml"
    "*.yaml"
    "*.json"
    "*.md"
    "*.txt"
    "*.sh"
    "*.js"
)

# Patterns to look for (case insensitive)
SENSITIVE_PATTERNS=(
    "password"
    "token"
    "secret"
    "key"
    "192\.168\."
    "10\.0\."
    "172\.16\."
    "@.*\.com"
    "username"
    "user@"
)

# Create a backup directory
mkdir -p .cleanup-backup

# Function to check if file contains sensitive data
check_sensitive_file() {
    local file=$1
    local has_sensitive=false
    
    for pattern in "${SENSITIVE_PATTERNS[@]}"; do
        if grep -qi "$pattern" "$file" 2>/dev/null; then
            has_sensitive=true
            break
        fi
    done
    
    if [ "$has_sensitive" = true ]; then
        echo -e "  ${YELLOW}Warning: $file may contain sensitive data${NC}"
        cp "$file" ".cleanup-backup/$(basename $file).bak"
    fi
}

# Check all files
for pattern in "${FILES_TO_SCRUB[@]}"; do
    for file in $pattern; do
        if [ -f "$file" ]; then
            check_sensitive_file "$file"
        fi
    done
done

# Create comprehensive .gitignore
echo -e "${YELLOW}Creating .gitignore...${NC}"
cat > .gitignore << 'EOF'
# Environment and secrets
.env
.env.*
!.env.example
*.key
*.pem
*.crt
secrets/
credentials/
vault-password
ansible-vault-password

# SSH keys
id_rsa*
id_ed25519*
id_dsa*
*.ppk
known_hosts
.ssh/

# Node
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*
.npm/
.node_repl_history
*.tsbuildinfo
.eslintcache

# Terraform
*.tfstate
*.tfstate.*
.terraform/
*.tfvars
*.tfvars.json
override.tf
override.tf.json
*_override.tf
*_override.tf.json
.terraformrc
terraform.rc

# Ansible
*.retry
ansible.cfg
inventory/*
!inventory/.gitkeep
!inventory/example.ini

# Logs and temp files
*.log
*.pid
*.seed
*.pid.lock
*.tmp
*.temp
*.bak
*.swp
*.swo
*~
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/
*.sublime-*

# Test and coverage
coverage/
.nyc_output/
test-results/
*.lcov

# Build
dist/
build/
out/

# Cache
.cache/
.parcel-cache/
.next/
.nuxt/
.vuepress/dist
.serverless/
.fusebox/
.dynamodb/

# OS
.DS_Store
.DS_Store?
._*
.Spotlight-V100
.Trashes
ehthumbs.db
Thumbs.db

# Backup
.cleanup-backup/
*.backup
*.old

# Local configuration
local-config/
*.local

# Homelab specific
homelab_playbook/**/vars/
homelab_playbook/**/vault/
homelab_playbook/**/passwords/
terraform/**/terraform.tfvars
EOF

echo "  Created .gitignore"

# Create example inventory file
echo -e "${YELLOW}Creating example files...${NC}"
mkdir -p inventory
cat > inventory/example.ini << 'EOF'
# Example Ansible Inventory
[webservers]
web1 ansible_host=10.0.1.10
web2 ansible_host=10.0.1.11

[databases]
db1 ansible_host=10.0.2.10

[proxmox]
proxmox1 ansible_host=10.0.0.10

[all:vars]
ansible_user=ubuntu
ansible_ssh_private_key_file=~/.ssh/id_rsa
EOF

echo "  Created inventory/example.ini"

# Remove specific sensitive data from the current .env file values
echo -e "${YELLOW}Checking for exposed credentials...${NC}"

# Files that might contain real IPs or passwords
CRITICAL_FILES=(
    "README.md"
    "deploy-*.sh"
    "setup*.sh"
    "*.yml"
    "*.yaml"
)

for file in "${CRITICAL_FILES[@]}"; do
    if [ -f "$file" ]; then
        # Check for real IP addresses
        if grep -E "192\.168\.[0-9]+\.[0-9]+" "$file" > /dev/null 2>&1; then
            echo -e "  ${YELLOW}Warning: $file contains private IP addresses${NC}"
        fi
        
        # Check for any real passwords or sensitive data
        # Add more patterns as needed
        sensitive_patterns=(
            "Tenchi01"
            "192\.168\.10\."
            "192\.168\.1\."
            "shaunjackson\.space"
            "washy"
            "ubuntu@192"
        )
        
        for pattern in "${sensitive_patterns[@]}"; do
            if grep -i "$pattern" "$file" > /dev/null 2>&1; then
                echo -e "  ${RED}CRITICAL: $file contains sensitive pattern: $pattern${NC}"
                # Create backup before modifying
                cp "$file" ".cleanup-backup/$(basename $file).sensitive"
            fi
        done
    fi
done

# Clean up test artifacts
echo -e "${YELLOW}Cleaning up test artifacts...${NC}"
rm -rf test-workspace/
rm -rf /tmp/sse-test-*
rm -rf /tmp/ansible-*

# Remove any docker/container data
echo -e "${YELLOW}Cleaning up container data...${NC}"
rm -rf .docker/
docker-compose down 2>/dev/null || true

# Create a pre-commit hook to prevent accidental commits
echo -e "${YELLOW}Creating pre-commit hook...${NC}"
mkdir -p .git/hooks
cat > .git/hooks/pre-commit << 'EOF'
#!/bin/bash
# Pre-commit hook to check for sensitive data

SENSITIVE_PATTERNS=(
    "password.*=.*[A-Za-z0-9]"
    "token.*=.*[A-Za-z0-9]"
    "Tenchi"
    "192\.168\.10\."
    "192\.168\.1\."
)

for pattern in "${SENSITIVE_PATTERNS[@]}"; do
    if git diff --cached --name-only | xargs grep -E "$pattern" 2>/dev/null; then
        echo "Error: Sensitive data detected in commit!"
        echo "Pattern found: $pattern"
        echo "Please remove sensitive data before committing."
        exit 1
    fi
done

exit 0
EOF

chmod +x .git/hooks/pre-commit
echo "  Created pre-commit hook"

# Summary
echo
echo -e "${GREEN}Cleanup complete!${NC}"
echo
echo "Please review the following before pushing to GitHub:"
echo "1. Check .cleanup-backup/ for any files that might contain sensitive data"
echo "2. Review the warnings above for files that may need manual editing"
echo "3. Ensure .env.example has generic values, not real ones"
echo "4. Run 'git status' to see what will be committed"
echo "5. Consider running 'git diff' to review changes"
echo
echo -e "${YELLOW}Recommended next steps:${NC}"
echo "  git add ."
echo "  git status  # Review what will be committed"
echo "  git commit -m \"Initial commit - MCP Ansible/Terraform server\""
echo "  git remote add origin https://github.com/yourusername/ansible-mcp-server.git"
echo "  git push -u origin main"
echo
echo -e "${RED}IMPORTANT: The .cleanup-backup directory contains file backups.${NC}"
echo -e "${RED}Do not commit this directory! Review and delete it when done.${NC}"