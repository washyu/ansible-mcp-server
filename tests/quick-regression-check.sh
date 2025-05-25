#!/bin/bash
# Quick regression check for common issues
# Run this after deployment to verify everything works

set -e

echo "Quick Regression Check"
echo "===================="
echo

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

FAILED=0

# Function to check a condition
check() {
    local name="$1"
    local command="$2"
    
    echo -n "Checking $name... "
    if eval "$command" > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC}"
    else
        echo -e "${RED}✗${NC}"
        FAILED=$((FAILED + 1))
    fi
}

# 1. Check dependencies are findable
check "Ansible in PATH" "sudo -u mcp which ansible"
check "Terraform in PATH" "sudo -u mcp which terraform"
check "Python packages" "sudo -u mcp python3 -c 'import ansible'"

# 2. Check directories exist with correct permissions
check "MCP home directory" "test -d /home/mcp"
check "Ansible temp directory" "test -d /home/mcp/.ansible/tmp"
check "MCP server directory" "test -d /opt/ansible-mcp-server"
check "States directory" "test -d /opt/ansible-mcp-server/states"

# 3. Check file permissions
check "Ansible temp writable" "sudo -u mcp touch /home/mcp/.ansible/tmp/test && sudo -u mcp rm /home/mcp/.ansible/tmp/test"
check "Playbooks dir writable" "sudo -u mcp touch /opt/ansible-mcp-server/playbooks/test && sudo -u mcp rm /opt/ansible-mcp-server/playbooks/test"

# 4. Check services
check "SSE service running" "systemctl is-active sse-server"
check "SSE port listening" "ss -tlnp | grep :3001"
check "SSE health endpoint" "curl -s http://localhost:3001/health | grep -q 'ok'"

# 5. Check environment
check "Environment file exists" "test -f /opt/ansible-mcp-server/.env"
check "Ansible config exists" "test -f /home/mcp/.ansible.cfg"

# 6. Test actual commands
echo
echo "Testing actual commands..."
check "Ansible version works" "sudo -u mcp ansible --version"
check "Ansible-playbook works" "sudo -u mcp ansible-playbook --version"
check "Terraform version works" "sudo -u mcp terraform --version"

# Summary
echo
echo "===================="
if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}All checks passed!${NC}"
    exit 0
else
    echo -e "${RED}$FAILED checks failed${NC}"
    echo
    echo "Common fixes:"
    echo "1. Run: sudo /opt/ansible-mcp-server/scripts/install-dependencies.sh"
    echo "2. Run: sudo mkdir -p /home/mcp/.ansible/{tmp,cp,facts} && sudo chown -R mcp:mcp /home/mcp/.ansible"
    echo "3. Run: sudo systemctl restart sse-server"
    exit 1
fi