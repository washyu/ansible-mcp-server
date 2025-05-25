# Deploy v1.1 External Server Management Features

## What's New in v1.1

### 🆕 External Server Management
- **add-external-server**: Add TrueNAS, Pi-hole, gateways to inventory
- **discover-network-devices**: Auto-discover and classify network devices  
- **remove-external-server**: Remove servers from inventory
- **test-server-connectivity**: Test server connectivity

### 🔍 Enhanced Discovery
- **discover-proxmox**: Find all VMs on Proxmox server
- **generate-inventory**: Create Ansible inventory from discovered VMs

### 🎯 Smart Classification
- Auto-detect TrueNAS, Pi-hole, Home Assistant, pfSense/OPNsense
- Port scanning and service identification
- Confidence scoring for device types

## Quick Deployment

### Option 1: Update Existing Installation
```bash
# On your MCP server
cd /opt/ansible-mcp-server
sudo git pull origin main
sudo npm install
sudo systemctl restart ansible-mcp-server
```

### Option 2: Fresh Deployment
```bash
# If you need to redeploy completely
sudo systemctl stop ansible-mcp-server
cd /opt
sudo rm -rf ansible-mcp-server
sudo git clone <your-repo-url> ansible-mcp-server
cd ansible-mcp-server
sudo npm install
sudo ./scripts/install.sh
```

## Testing the New Features

### 1. Test Proxmox Discovery
```bash
# Test discovering your current Proxmox VMs
discover-proxmox --host="192.168.10.200" --user="root@pam" --node="proxmox"
```

### 2. Test Network Discovery
```bash
# Discover devices on your network (replace with your network)
discover-network-devices --networkRange="192.168.10.0/24" --classify=true
```

### 3. Add External Servers
```bash
# Add your TrueNAS server
add-external-server --hostname="truenas.local" --type="truenas" --connection='{"method":"api","port":443}'

# Add Pi-hole server
add-external-server --hostname="pihole.local" --type="pihole" --connection='{"method":"api","port":80}'

# Add gateway/router
add-external-server --hostname="192.168.10.1" --type="gateway" --connection='{"method":"ssh","port":22,"username":"admin"}'
```

### 4. Test Connectivity
```bash
# Test if servers are reachable
test-server-connectivity --hostname="truenas.local" --method="ping"
test-server-connectivity --hostname="pihole.local" --method="api" --port=80
```

## Expected Results

### Network Discovery Output
```
Found 15 responsive devices:

Device: 192.168.10.1
  Hostname: gateway.local
  Open Ports: 80, 443, 22
  Primary Type: gateway
  Classifications:
    - gateway (70% confidence)

Device: 192.168.10.10
  Hostname: truenas.local
  Open Ports: 80, 443
  Primary Type: truenas
  Classifications:
    - truenas (95% confidence)
      version: TrueNAS-13.0-U5.3
```

### Inventory Structure
After adding external servers, you'll have:
```
inventory/
├── external-servers.yml    # New external servers
└── proxmox-hosts.yml      # Existing Proxmox inventory
```

## Configuration Files

### External Servers Inventory
Location: `inventory/external-servers.yml`
```yaml
all:
  children:
    external_servers:
      hosts:
        truenas-local:
          ansible_host: truenas.local
          server_type: truenas
          managed_externally: true
          connection_method: api
    
    truenas_servers:
      hosts:
        truenas-local: {}
    
    storage_servers:
      hosts:
        truenas-local: {}
```

## Troubleshooting

### Issue: Network discovery times out
```bash
# Reduce timeout and scan smaller ranges
discover-network-devices --networkRange="192.168.10.1/32" --timeout=3
```

### Issue: Can't connect to Proxmox
```bash
# Check credentials and test connectivity
test-server-connectivity --hostname="192.168.10.200" --method="api" --port=8006
```

### Issue: External server not detected
```bash
# Test basic connectivity first
test-server-connectivity --hostname="your-server" --method="ping"
```

## Next Steps

1. **Test Proxmox discovery** with your current setup
2. **Scan your network** to find all devices
3. **Add important external servers** (TrueNAS, Pi-hole, etc.)
4. **Verify unified inventory** works with both VMs and external servers
5. **Try cross-infrastructure playbooks** that target both types

## Security Notes

- Network discovery only pings and tests common ports
- No intrusive scanning or vulnerability testing
- External servers are added to inventory but not modified
- All connectivity tests respect timeouts and fail gracefully

Ready to test the complete network infrastructure visibility! 🚀