#!/bin/bash
# Sanitize files by replacing sensitive data with generic examples

set -e

echo "Sanitizing files for GitHub release..."
echo "====================================="

# Backup directory
BACKUP_DIR=".sanitize-backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

# Files to sanitize
FILES_TO_SANITIZE=(
    "*.yml"
    "*.yaml" 
    "*.sh"
    "*.js"
    "*.json"
    "*.md"
    "inventory/*"
    "homelab_playbook/**/*.yml"
)

# Replacement patterns
declare -A REPLACEMENTS=(
    # IP addresses
    ["192.168.10.200"]="10.0.0.10"
    ["192.168.10.100"]="10.0.0.100"
    ["192.168.10."]="10.0.0."
    ["192.168.1."]="10.0.1."
    
    # Hostnames and domains
    ["shaunjackson.space"]="example.com"
    ["homelab2"]="homelab-server"
    ["proxmox.shaunjackson.space"]="proxmox.example.com"
    ["mail.shaunjackson.space"]="mail.example.com"
    
    # Usernames
    ["washy"]="user"
    ["shaun"]="ansible-user"
    ["ubuntu@192"]="ubuntu@10"
    
    # Specific services
    ["mcp-server"]="mcp-server"
    ["nextcloud.shaunjackson.space"]="nextcloud.example.com"
    ["keycloak.shaunjackson.space"]="keycloak.example.com"
)

# Function to sanitize a file
sanitize_file() {
    local file=$1
    local modified=false
    
    # Skip if file doesn't exist
    if [ ! -f "$file" ]; then
        return
    fi
    
    # Create backup
    cp "$file" "$BACKUP_DIR/$(basename $file)"
    
    # Apply replacements
    for pattern in "${!REPLACEMENTS[@]}"; do
        replacement="${REPLACEMENTS[$pattern]}"
        if grep -q "$pattern" "$file" 2>/dev/null; then
            sed -i "s|$pattern|$replacement|g" "$file"
            modified=true
        fi
    done
    
    if [ "$modified" = true ]; then
        echo "  ✓ Sanitized: $file"
    fi
}

# Process all files
echo "Processing files..."
for pattern in "${FILES_TO_SANITIZE[@]}"; do
    while IFS= read -r -d '' file; do
        # Skip backup directories and node_modules
        if [[ "$file" == *".backup"* ]] || [[ "$file" == *"node_modules"* ]] || [[ "$file" == *".git"* ]]; then
            continue
        fi
        sanitize_file "$file"
    done < <(find . -name "$pattern" -type f -print0 2>/dev/null)
done

# Special handling for .env.example
if [ -f ".env.example" ]; then
    echo "Sanitizing .env.example..."
    sed -i 's/PROXMOX_HOST=.*/PROXMOX_HOST=10.0.0.10/g' .env.example
    sed -i 's/DEFAULT_GATEWAY=.*/DEFAULT_GATEWAY=10.0.0.1/g' .env.example
    sed -i 's/MCP_VM_IP=.*/MCP_VM_IP=10.0.0.100/g' .env.example
    echo "  ✓ Sanitized: .env.example"
fi

# Remove any .env files
rm -f .env .env.* 
echo "  ✓ Removed .env files"

# Create sanitized inventory example
cat > inventory/example.ini << 'EOF'
# Example Ansible Inventory
[proxmox]
proxmox-server ansible_host=10.0.0.10

[webservers]
web1 ansible_host=10.0.1.10
web2 ansible_host=10.0.1.11

[databases]
db1 ansible_host=10.0.2.10

[services:children]
webservers
databases

[all:vars]
ansible_user=ansible-user
ansible_ssh_private_key_file=~/.ssh/id_rsa
ansible_python_interpreter=/usr/bin/python3
EOF

echo "  ✓ Created sanitized inventory example"

# Summary
echo ""
echo "Sanitization complete!"
echo "Backup created in: $BACKUP_DIR"
echo ""
echo "Please review the changes:"
echo "  git diff"
echo ""
echo "If everything looks good, commit the changes:"
echo "  git add -A"
echo "  git commit -m 'Sanitize files for public release'"