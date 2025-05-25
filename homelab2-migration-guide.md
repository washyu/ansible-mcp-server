# Homelab2 Migration Guide

## Current Situation Discovery ✅
- **Proxmox Host**: 192.168.10.200 (root user, password auth)
- **test-server**: 192.168.10.20 (existing Ansible controller, user: user)
- **MCP Server**: Needs sshpass for Proxmox discovery
- **Network**: 192.168.10.0/24

## Migration Strategy Options

### Option 1: Full Migration (Recommended)
**Migrate everything from test-server to MCP server, then repurpose test-server**

### Option 2: Gradual Migration  
**Keep test-server running while MCP takes over incrementally**

### Option 3: Proxy Mode
**MCP uses test-server as the actual Ansible controller**

---

## Step-by-Step Migration Process

### Phase 1: Prepare MCP Server

#### 1. Install Dependencies
```bash
# Install sshpass for Proxmox password authentication
install-dependencies --packages='["sshpass", "ansible"]' --target="local"
```

#### 2. Discover Current Infrastructure
```bash
# Discover your existing Ansible controller
discover-ansible-controller --networkRange="192.168.10.0/24"

# Expected result: Should find test-server (192.168.10.20) with user 'user'
```

#### 3. Discover All Proxmox VMs
```bash
# Now that sshpass is installed, discover all VMs
discover-proxmox --host="192.168.10.200" --user="root@pam" --node="proxmox"

# This should show test-server and any other VMs you have
```

### Phase 2: Set Up SSH Key Authentication

#### 4. Generate SSH Keys for MCP
```bash
# Generate new SSH keypair for MCP server
manage-ssh-keys --action="generate" --keyType="ed25519" --forceOverwrite=false
```

#### 5. Distribute Keys to All Hosts
```bash
# Add MCP's key to test-server (will need user's password)
manage-ssh-keys --action="distribute" --targets='["192.168.10.20"]' --username="user"

# Add MCP's key to Proxmox host (will need root password)  
manage-ssh-keys --action="distribute" --targets='["192.168.10.200"]' --username="root"

# Test the connections
manage-ssh-keys --action="test" --targets='["192.168.10.20", "192.168.10.200"]'
```

### Phase 3: Import Existing Configuration

#### 6. Import from test-server
```bash
# Import Ansible configuration from test-server
import-ansible-config \
  --controllerHost="192.168.10.20" \
  --username="user" \
  --authMethod="key" \
  --mergeStrategy="prompt"

# This will show you what needs to be copied
```

#### 7. Manual File Transfer (if needed)
Based on the import-ansible-config output, you may need to manually copy:
```bash
# Example commands (adjust paths as needed)
scp user@192.168.10.20:/home/user/ansible/inventory/* ./inventory/
scp -r user@192.168.10.20:/home/user/ansible/playbooks/* ./playbooks/
scp -r user@192.168.10.20:/home/user/ansible/roles/* ./roles/
```

### Phase 4: Test MCP Control

#### 8. Test Direct Control
```bash
# Test that MCP can now control test-server directly
test-server-connectivity --hostname="192.168.10.20" --method="ssh"

# Test that MCP can control Proxmox
test-server-connectivity --hostname="192.168.10.200" --method="ssh"
```

#### 9. Add test-server as External Server
```bash
# Add test-server to the MCP inventory as an external server
add-external-server \
  --hostname="192.168.10.20" \
  --alias="test-server-original-controller" \
  --type="generic" \
  --purpose="Former Ansible controller, now managed by MCP" \
  --connection='{"method":"ssh","username":"user"}' \
  --groups='["ansible_controllers", "dev_servers"]'
```

### Phase 5: Decision Point - What to do with test-server?

#### Option A: Retire as Controller, Repurpose
```bash
# test-server becomes a regular managed server
# You can now use it for:
# - Development environment
# - Testing new playbooks
# - Additional services (Jenkins, GitLab, etc.)
# - Backup system
```

#### Option B: Keep as Secondary Controller
```bash
# Keep test-server as a backup controller
# Useful for:
# - Disaster recovery
# - Testing new MCP features
# - Gradual migration validation
```

#### Option C: Remove Completely
```bash
# If you don't need test-server anymore
remove-external-server --hostname="192.168.10.20"
# Then delete the VM in Proxmox
```

---

## Post-Migration Testing

### Test Complete Infrastructure Control
```bash
# Discover everything MCP now manages
discover-network-devices --networkRange="192.168.10.0/24" --classify=true

# Generate unified inventory
generate-inventory --vms='[discovered_vms]' --outputFile="inventory/complete-infrastructure.yml"

# Test deploying a new service
deploy-service --serviceName="nginx-proxy-manager" --vmName="npm-server" --ip="192.168.10.50"
```

### Verify Ansible Functionality
```bash
# Test that Ansible works through MCP
ansible-playbook ./playbooks/test-connectivity.yml --inventory="./inventory/complete-infrastructure.yml"
```

---

## Migration Benefits

### Before Migration
- ✅ test-server controls some infrastructure
- ❌ Limited to basic Ansible functionality
- ❌ Manual VM management in Proxmox
- ❌ No service catalog or automation
- ❌ No unified infrastructure view

### After Migration  
- ✅ **Complete infrastructure automation** through MCP
- ✅ **Service catalog** with 20+ services ready to deploy
- ✅ **Unified inventory** of VMs + external servers
- ✅ **SSH key-based authentication** (more secure)
- ✅ **Network discovery** and device classification
- ✅ **Proxmox integration** for VM lifecycle management
- ✅ **External server management** for NAS, Pi-hole, etc.
- ✅ **Backup and migration capabilities**
- ✅ **Multi-cloud ready** for future expansion

---

## Rollback Plan (If Needed)

If something goes wrong, you can rollback:

1. **SSH back into test-server** using original credentials
2. **Remove MCP's SSH key** from test-server: `nano ~/.ssh/authorized_keys`
3. **Continue using test-server** as your Ansible controller
4. **Fix MCP issues** and retry migration

---

## Troubleshooting

### Issue: Can't discover test-server
```bash
# Check if test-server is responding
test-server-connectivity --hostname="192.168.10.20" --method="ping"
test-server-connectivity --hostname="192.168.10.20" --method="ssh" --port=22
```

### Issue: SSH key distribution fails
```bash
# Try manual key distribution
ssh-copy-id user@192.168.10.20
```

### Issue: Proxmox discovery fails
```bash
# Install sshpass first
install-dependencies --packages='["sshpass"]'

# Then test Proxmox connectivity
test-server-connectivity --hostname="192.168.10.200" --method="ssh" --port=22
```

### Issue: Import fails
```bash
# Check what's actually on test-server
discover-ansible-controller --networkRange="192.168.10.20/32"
```

---

## Next Steps After Migration

1. **Deploy new services** using the service catalog
2. **Set up backups** for your infrastructure
3. **Add external devices** (TrueNAS, Pi-hole, etc.)
4. **Create custom playbooks** for your specific needs
5. **Set up monitoring** for all systems
6. **Plan multi-cloud expansion** if desired

Ready to start the migration? 🚀

Let me know which approach you'd prefer:
- **Full migration** (take over completely)
- **Gradual migration** (test alongside test-server)  
- **Proxy mode** (use test-server as backend)