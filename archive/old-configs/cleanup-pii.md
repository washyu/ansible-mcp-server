# PII Cleanup and Genericization Plan

## Current PII/Specific References to Remove

### Documentation Files
- `test-server-migration-guide.md` - Contains specific server names and IPs
- `deploy-v1.1-features.md` - Has specific IP addresses
- Configuration examples with real hostnames/IPs
- User-specific paths and usernames

### Code References
- Default usernames like 'user', 'ubuntu', etc.
- Specific IP ranges (192.168.10.x)
- Specific hostnames (test-server, truenas.local, etc.)
- Specific paths (/home/user/ansible)

## Generic Replacements

### IP Addresses
- `192.168.10.200` → `192.168.1.100` (generic Proxmox)
- `192.168.10.20` → `192.168.1.50` (generic controller)
- `192.168.10.0/24` → `192.168.1.0/24` (generic network)

### Hostnames
- `test-server` → `ansible-controller-01` or `existing-controller`
- `truenas.local` → `nas-server.local`
- `pihole.local` → `dns-server.local`
- Gateway `192.168.10.1` → `192.168.1.1`

### Usernames
- `user` → `ansible` or `admin`
- Specific user paths → generic `/home/ansible/` or `/opt/ansible/`

### Server Names
- Use descriptive generic names like:
  - `web-server-01`
  - `database-server`
  - `monitoring-server`
  - `backup-server`

## Files to Update

1. **Documentation**
   - Create generic migration guide
   - Update all README examples
   - Clean up deployment guides

2. **Code Examples**
   - Update default schemas
   - Clean up test files
   - Generic configuration examples

3. **Configuration Templates**
   - Generic inventory examples
   - Sample playbook templates
   - Default variable examples

## Generic Documentation Structure

Instead of specific migration guides, create:
- **General migration patterns**
- **Example scenarios** (not specific installations)
- **Template configurations**
- **Best practices guides**

This way the MCP server is useful for anyone, not just your specific setup.