#!/bin/bash

# Port forwarding setup script for linuxrwifi
# This forwards ports from the WiFi interface to homelab2

echo "Setting up port forwarding on linuxrwifi..."

# Enable IP forwarding
sudo sysctl -w net.ipv4.ip_forward=1
echo "net.ipv4.ip_forward=1" | sudo tee -a /etc/sysctl.conf

# Web traffic forwarding (HTTP/HTTPS)
sudo iptables -t nat -A PREROUTING -i wlp2s0 -p tcp --dport 80 -j DNAT --to-destination 192.168.10.108:80
sudo iptables -t nat -A PREROUTING -i wlp2s0 -p tcp --dport 443 -j DNAT --to-destination 192.168.10.108:443

# Email traffic forwarding
sudo iptables -t nat -A PREROUTING -i wlp2s0 -p tcp --dport 25 -j DNAT --to-destination 192.168.10.108:25
sudo iptables -t nat -A PREROUTING -i wlp2s0 -p tcp --dport 587 -j DNAT --to-destination 192.168.10.108:587
sudo iptables -t nat -A PREROUTING -i wlp2s0 -p tcp --dport 993 -j DNAT --to-destination 192.168.10.108:993

# Allow forwarding
sudo iptables -A FORWARD -i wlp2s0 -o enp1s0 -p tcp --dport 80 -j ACCEPT
sudo iptables -A FORWARD -i wlp2s0 -o enp1s0 -p tcp --dport 443 -j ACCEPT
sudo iptables -A FORWARD -i wlp2s0 -o enp1s0 -p tcp --dport 25 -j ACCEPT
sudo iptables -A FORWARD -i wlp2s0 -o enp1s0 -p tcp --dport 587 -j ACCEPT
sudo iptables -A FORWARD -i wlp2s0 -o enp1s0 -p tcp --dport 993 -j ACCEPT

# Masquerade for return traffic
sudo iptables -t nat -A POSTROUTING -o enp1s0 -j MASQUERADE

# Save iptables rules
sudo iptables-save | sudo tee /etc/iptables/rules.v4

echo "Port forwarding configured!"
echo ""
echo "Current NAT rules:"
sudo iptables -t nat -L PREROUTING -n -v --line-numbers

echo ""
echo "=== IMPORTANT ==="
echo "Now configure your main router (192.168.50.1) to forward:"
echo "  - Ports 80, 443 → 192.168.50.92"
echo "  - Ports 25, 587, 993 → 192.168.50.92"
echo ""
echo "Traffic flow will be:"
echo "Internet → Router (192.168.50.1) → linuxrwifi (192.168.50.92) → homelab2 (192.168.10.108)"