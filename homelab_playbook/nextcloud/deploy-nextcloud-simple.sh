#!/bin/bash
# Simple script to deploy Nextcloud on Proxmox without Ansible

echo "=== Deploying Nextcloud on Proxmox ==="

# Configuration
PROXMOX_HOST="192.168.10.200"
PROXMOX_PASSWORD="Tenchi01!"
LXC_ID="110"
LXC_IP="192.168.10.110"

# First, remove from homelab2
echo "1. Removing Nextcloud from homelab2..."
ssh shaun@homelab2 << 'EOF'
cd /home/shaun
docker-compose -f nextcloud-oauth-docker.yml down -v 2>/dev/null || true
rm -rf nextcloud-data
docker system prune -f
EOF

echo "2. Creating setup script for Proxmox..."
cat > /tmp/proxmox-nextcloud.sh << 'SCRIPT'
#!/bin/bash

# Download Ubuntu 22.04 template if not exists
echo "Checking for Ubuntu template..."
if ! pveam list local | grep -q "ubuntu-22.04"; then
    echo "Downloading Ubuntu 22.04 template..."
    pveam download local ubuntu-22.04-standard_22.04-1_amd64.tar.zst
fi

# Create LXC container
echo "Creating LXC container..."
pct create 110 local:vztmpl/ubuntu-22.04-standard_22.04-1_amd64.tar.zst \
    --hostname nextcloud \
    --password Tenchi01! \
    --cores 4 \
    --memory 4096 \
    --storage local-lvm \
    --rootfs local-lvm:100 \
    --net0 name=eth0,bridge=vmbr0,ip=192.168.10.110/24,gw=192.168.10.1 \
    --features keyctl=1,nesting=1 \
    --unprivileged 1 \
    --start 1 \
    2>/dev/null || echo "Container might already exist"

# Wait for container to start
echo "Starting container..."
pct start 110 2>/dev/null || true
sleep 10

# Install Docker in container
echo "Installing Docker in container..."
pct exec 110 -- bash -c '
apt-get update
apt-get install -y curl ca-certificates gnupg lsb-release
mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
curl -L "https://github.com/docker/compose/releases/download/v2.20.2/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose
'

# Create Nextcloud directories
echo "Setting up Nextcloud..."
pct exec 110 -- mkdir -p /opt/nextcloud /mnt/storage/nextcloud/{data,config,apps}

# Create docker-compose.yml
pct exec 110 -- bash -c 'cat > /opt/nextcloud/docker-compose.yml << "EOF"
version: "3.8"

services:
  nextcloud-db:
    image: mariadb:10.11
    container_name: nextcloud-db
    restart: unless-stopped
    environment:
      - MYSQL_ROOT_PASSWORD=Tenchi01!
      - MYSQL_DATABASE=nextcloud
      - MYSQL_USER=nextcloud
      - MYSQL_PASSWORD=Tenchi01!
    volumes:
      - nextcloud-db:/var/lib/mysql

  nextcloud-redis:
    image: redis:alpine
    container_name: nextcloud-redis
    restart: unless-stopped

  nextcloud:
    image: nextcloud:latest
    container_name: nextcloud
    restart: unless-stopped
    ports:
      - 80:80
    depends_on:
      - nextcloud-db
      - nextcloud-redis
    environment:
      - MYSQL_HOST=nextcloud-db
      - MYSQL_DATABASE=nextcloud
      - MYSQL_USER=nextcloud
      - MYSQL_PASSWORD=Tenchi01!
      - REDIS_HOST=nextcloud-redis
      - NEXTCLOUD_TRUSTED_DOMAINS=nextcloud.shaunjackson.space 192.168.10.110
      - OVERWRITEPROTOCOL=http
      - OVERWRITEHOST=nextcloud.shaunjackson.space
      - NEXTCLOUD_ADMIN_USER=admin
      - NEXTCLOUD_ADMIN_PASSWORD=Tenchi01!
    volumes:
      - /mnt/storage/nextcloud/data:/var/www/html/data
      - /mnt/storage/nextcloud/config:/var/www/html/config
      - /mnt/storage/nextcloud/apps:/var/www/html/custom_apps

  onlyoffice:
    image: onlyoffice/documentserver:latest
    container_name: onlyoffice
    restart: unless-stopped
    ports:
      - 8080:80
    environment:
      - JWT_SECRET=your-secret-key
    volumes:
      - onlyoffice-data:/var/www/onlyoffice/Data
      - onlyoffice-logs:/var/log/onlyoffice

volumes:
  nextcloud-db:
  onlyoffice-data:
  onlyoffice-logs:
EOF'

# Start Nextcloud
echo "Starting Nextcloud..."
pct exec 110 -- bash -c "cd /opt/nextcloud && docker-compose up -d"

echo "
=== Nextcloud Deployed Successfully! ===

Access URLs:
- Direct: http://192.168.10.110
- Domain: http://nextcloud.shaunjackson.space (add to NPM)
- OnlyOffice: http://192.168.10.110:8080

Admin credentials:
- Username: admin
- Password: Tenchi01!

Container: LXC 110 on Proxmox

Next steps:
1. Add to Nginx Proxy Manager
2. Install 'OpenID Connect Login' app
3. Configure Microsoft OAuth
"
SCRIPT

echo "3. Copying script to Proxmox..."
scp /tmp/proxmox-nextcloud.sh root@$PROXMOX_HOST:/tmp/

echo "4. Please run the following command on your local machine:"
echo ""
echo "ssh root@$PROXMOX_HOST 'bash /tmp/proxmox-nextcloud.sh'"
echo ""
echo "This will create the Nextcloud LXC container on Proxmox."