#!/bin/bash
# Simple script to create Nextcloud VM on Proxmox

PROXMOX_HOST="192.168.10.200"
PROXMOX_PASS="Tenchi01!"
VM_ID="111"
VM_IP="192.168.10.111"

echo "Creating Nextcloud VM on Proxmox..."

# Create VM creation script
cat > /tmp/create-nextcloud-vm.sh << 'SCRIPT'
#!/bin/bash

VM_ID=111
VM_IP="192.168.10.111"

# Remove old VM/LXC if exists
if qm status $VM_ID &>/dev/null; then
    echo "Removing existing VM..."
    qm stop $VM_ID || true
    sleep 5
    qm destroy $VM_ID || true
fi

if pct status 110 &>/dev/null; then
    echo "Removing old LXC..."
    pct stop 110 || true
    sleep 5
    pct destroy 110 || true
fi

# Check for Ubuntu ISO
ISO=$(ls /var/lib/vz/template/iso/ | grep -i ubuntu | head -1)
if [ -z "$ISO" ]; then
    echo "Downloading Ubuntu Server ISO..."
    cd /var/lib/vz/template/iso/
    wget https://releases.ubuntu.com/22.04.4/ubuntu-22.04.4-live-server-amd64.iso
    ISO="ubuntu-22.04.4-live-server-amd64.iso"
fi

echo "Using ISO: $ISO"

# Create VM
qm create $VM_ID \
    --name nextcloud \
    --memory 8192 \
    --cores 4 \
    --net0 virtio,bridge=vmbr0 \
    --cdrom local:iso/$ISO \
    --boot order=scsi0 \
    --ostype l26 \
    --scsihw virtio-scsi-pci \
    --agent 1 \
    --onboot 1

# Add disk
qm set $VM_ID --scsi0 local-lvm:100,format=qcow2

# Start VM
qm start $VM_ID

echo "
==========================================
Nextcloud VM Created!
==========================================

VM ID: $VM_ID
Planned IP: $VM_IP

Next Steps:
1. Open Proxmox web console: https://192.168.10.200:8006
2. Open VM $VM_ID console
3. Install Ubuntu Server:
   - Username: ubuntu
   - Password: Tenchi01!
   - Hostname: nextcloud
   - Manual network config:
     - IP: $VM_IP/24
     - Gateway: 192.168.10.1
     - DNS: 192.168.10.1

4. After installation, SSH to VM and run:
   curl -fsSL https://raw.githubusercontent.com/nextcloud/all-in-one/main/install.sh | sudo bash

5. Access Nextcloud AIO at:
   https://$VM_IP:8080

6. In NPM, add:
   - Domain: nextcloud.shaunjackson.space
   - Forward to: $VM_IP port 11000
==========================================
"

# Create setup script for after Ubuntu install
cat > /root/nextcloud-setup.sh << 'SETUP'
#!/bin/bash
# Run this on the Nextcloud VM after Ubuntu is installed

# Install Docker
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER

# Install Nextcloud AIO
sudo docker run -d \
  --name nextcloud-aio-mastercontainer \
  --restart always \
  -p 80:80 \
  -p 8080:8080 \
  -p 8443:8443 \
  --env APACHE_PORT=11000 \
  --env APACHE_IP_BINDING=0.0.0.0 \
  --env SKIP_DOMAIN_VALIDATION=true \
  -v nextcloud_aio_mastercontainer:/mnt/docker-aio-config \
  -v /var/run/docker.sock:/var/run/docker.sock:ro \
  nextcloud/all-in-one:latest

echo "Nextcloud AIO installed!"
echo "Access setup wizard at: https://YOUR_VM_IP:8080"
SETUP

chmod +x /root/nextcloud-setup.sh
SCRIPT

# Copy and run on Proxmox
sshpass -p "$PROXMOX_PASS" scp /tmp/create-nextcloud-vm.sh root@$PROXMOX_HOST:/tmp/
sshpass -p "$PROXMOX_PASS" ssh root@$PROXMOX_HOST 'bash /tmp/create-nextcloud-vm.sh'