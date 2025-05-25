#!/bin/bash
# Script to deploy Nextcloud on Proxmox

echo "=== Nextcloud Deployment Script ==="
echo ""
echo "This script will:"
echo "1. Remove Nextcloud from homelab2"
echo "2. Create an LXC container on Proxmox"
echo "3. Install Nextcloud with Docker"
echo ""

# Check if ansible is installed
if ! command -v ansible-playbook &> /dev/null; then
    echo "Ansible not found. Installing..."
    sudo apt update
    sudo apt install -y ansible sshpass
fi

# Change to ansible directory
cd /home/shaun/ansible-mcp-server

# Run the playbook
echo "Running Ansible playbook..."
export ANSIBLE_HOST_KEY_CHECKING=False
ansible-playbook -i inventory/proxmox-hosts.yml deploy-nextcloud-proxmox-v2.yml -v

echo ""
echo "Deployment complete! Check the output above for access details."