# VM Cloning Guide - Happy Path

This guide documents the working process for cloning VMs in Proxmox using the MCP Ansible tools.

## Prerequisites

1. Proxmox API token with appropriate permissions
2. A template VM (e.g., ID 9000) with cloud-init installed
3. Network configuration planned (IP addresses, gateway, etc.)

## Key Discoveries

### 1. Use `newid` for Cloning
When cloning a VM, the critical parameter is `newid`, not `vmid`:
- `vmid`: The SOURCE template ID
- `newid`: The TARGET VM ID for the clone
- `clone`: Should match the source template ID

### 2. Working Clone Configuration

```yaml
- name: Clone VM from template
  community.general.proxmox_kvm:
    # Authentication
    api_host: "{{ proxmox_api_host }}"
    api_user: "root@pam"
    api_token_id: "{{ api_token_id }}"     # Just the token name
    api_token_secret: "{{ api_token_secret }}"
    validate_certs: no
    
    # Clone operation
    vmid: 9000         # Source template
    clone: 9000        # Clone from this
    newid: 202         # Create new VM with this ID
    name: "my-new-vm"
    node: "proxmox"
    full: yes
    
    # Resources
    cores: 12
    memory: 32768
    
    # Required to avoid warnings
    proxmox_default_behavior: no_defaults
    state: present
```

### 3. Post-Clone Configuration

After cloning, configure the VM in a separate task:

```yaml
- name: Configure VM after cloning
  community.general.proxmox_kvm:
    vmid: "{{ new_vm_id }}"  # Now use the NEW VM ID
    node: "proxmox"
    
    # Performance optimization
    cpu: host
    
    # Network
    net:
      net0: "virtio,bridge=vmbr0"
      
    # Cloud-init
    ipconfig:
      ipconfig0: "ip=192.168.10.202/24,gw=192.168.10.1"
    nameservers: "8.8.8.8"  # Note: plural!
    
    update: yes
    proxmox_default_behavior: no_defaults
```

## Common Issues and Solutions

### 1. "VM with vmid = X does not exist in cluster"
- **Cause**: Using `vmid` instead of `newid` for the target VM
- **Solution**: Use `newid` parameter for the clone target

### 2. SSH Access After Cloning
- **Issue**: Cloned VMs don't automatically have SSH keys
- **Solutions**:
  1. Add SSH keys to the template before cloning
  2. Use cloud-init with `sshkeys` parameter
  3. Configure template with password authentication as fallback

### 3. Parameter Names
- Use `nameservers` (plural), not `nameserver`
- Always include `node` parameter, even for updates
- Use `proxmox_default_behavior: no_defaults` to avoid deprecation warnings

## Complete Working Example

See `/playbooks/templates/clone-vm-template.yml` for a complete, tested example.

## Usage

```bash
# With vars file
ansible-playbook clone-vm-template.yml -e @clone-vm-vars.yml

# With inline variables
ansible-playbook clone-vm-template.yml \
  -e proxmox_host=192.168.10.200 \
  -e api_token_id=mytoken \
  -e api_token_secret=secret \
  -e template_id=9000 \
  -e new_vm_id=202 \
  -e new_vm_name=test-vm \
  -e vm_cores=4 \
  -e vm_memory=8192 \
  -e vm_ip=192.168.10.202 \
  -e vm_gateway=192.168.10.1 \
  -e vm_nameservers=8.8.8.8
```

## Template Requirements

For smooth cloning, templates should have:
1. Cloud-init installed and configured
2. Network interfaces configured for DHCP or static assignment
3. A default user account (if not using SSH keys)
4. Basic packages installed (python3, sudo, etc.)

## Next Steps

After cloning:
1. Update MCP inventory with the new VM
2. Configure application-specific settings
3. Install required software (e.g., Ollama, Docker, etc.)