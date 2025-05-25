#!/bin/bash

# Fix network routing on Pi-hole server

echo "Fixing network configuration for persistent routing..."

# Create proper netplan configuration
cat > /tmp/01-network-config.yaml << 'EOF'
network:
  version: 2
  renderer: networkd
  ethernets:
    enp1s0:
      addresses:
        - 192.168.10.1/24
      dhcp4: false
      nameservers:
        addresses:
          - 127.0.0.1
          - 1.1.1.1
  wifis:
    wlp2s0:
      dhcp4: true
      dhcp4-overrides:
        use-routes: true
      access-points:
        "Sid's House":
          auth:
            key-management: "psk"
            password: "Tenchi01!"
EOF

# Backup and replace netplan configs
echo "Backing up current configuration..."
sudo mkdir -p /etc/netplan/backup
sudo cp /etc/netplan/*.yaml /etc/netplan/backup/ 2>/dev/null

echo "Installing new configuration..."
sudo rm /etc/netplan/*.yaml
sudo cp /tmp/01-network-config.yaml /etc/netplan/

# Enable IP forwarding permanently
echo "Enabling IP forwarding..."
sudo sysctl -w net.ipv4.ip_forward=1
echo "net.ipv4.ip_forward=1" | sudo tee -a /etc/sysctl.conf

# Apply netplan
echo "Applying network configuration..."
sudo netplan generate
sudo netplan apply

# Check results
echo ""
echo "Current network status:"
ip addr show | grep -E "inet.*192.168"
echo ""
echo "Current routes:"
ip route show
echo ""
echo "Configuration complete! Network settings will persist across reboots."