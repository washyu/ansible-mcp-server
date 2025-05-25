#!/bin/bash
# Direct deployment script for Nextcloud on Proxmox

PROXMOX_HOST="192.168.10.200"
PROXMOX_USER="root"
PROXMOX_PASS="Tenchi01!"
LXC_ID="110"
LXC_IP="192.168.10.110"

echo "Deploying Nextcloud on Proxmox..."

# Create the deployment script
cat > /tmp/deploy-nextcloud.sh << 'DEPLOY_SCRIPT'
#!/bin/bash

# Configuration
LXC_ID=110
LXC_IP="192.168.10.110"
TEMPLATE="ubuntu-22.04-standard_22.04-1_amd64.tar.zst"

# Download template if needed
if ! pveam list local | grep -q "ubuntu-22.04"; then
    echo "Downloading Ubuntu template..."
    pveam download local $TEMPLATE
fi

# Remove existing container if exists
if pct status $LXC_ID &>/dev/null; then
    echo "Removing existing container..."
    pct stop $LXC_ID || true
    sleep 5
    pct destroy $LXC_ID || true
fi

# Create container
echo "Creating LXC container..."
pct create $LXC_ID local:vztmpl/$TEMPLATE \
    --hostname nextcloud \
    --password Tenchi01! \
    --cores 4 \
    --memory 4096 \
    --storage local-lvm \
    --rootfs local-lvm:100 \
    --net0 name=eth0,bridge=vmbr0,ip=$LXC_IP/24,gw=192.168.10.1 \
    --features keyctl=1,nesting=1 \
    --unprivileged 1

# Start container
pct start $LXC_ID
sleep 20

# Install Docker
echo "Installing Docker..."
pct exec $LXC_ID -- apt-get update
pct exec $LXC_ID -- apt-get install -y curl ca-certificates gnupg lsb-release
pct exec $LXC_ID -- mkdir -p /etc/apt/keyrings
pct exec $LXC_ID -- bash -c 'curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg'
pct exec $LXC_ID -- bash -c 'echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" > /etc/apt/sources.list.d/docker.list'
pct exec $LXC_ID -- apt-get update
pct exec $LXC_ID -- apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
pct exec $LXC_ID -- bash -c 'curl -L "https://github.com/docker/compose/releases/download/v2.20.2/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose && chmod +x /usr/local/bin/docker-compose'

# Create directories
echo "Setting up Nextcloud..."
pct exec $LXC_ID -- mkdir -p /opt/nextcloud /mnt/storage/nextcloud/{data,config,apps}

# Create docker-compose.yml
pct exec $LXC_ID -- bash -c 'cat > /opt/nextcloud/docker-compose.yml << "EOF"
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

# Start services
echo "Starting Nextcloud..."
pct exec $LXC_ID -- bash -c 'cd /opt/nextcloud && docker-compose up -d'

echo "
==========================================
Nextcloud Deployment Complete!
==========================================

Container ID: $LXC_ID
Container IP: $LXC_IP

Access URLs:
- Direct: http://$LXC_IP
- Domain: http://nextcloud.shaunjackson.space (add to NPM)
- OnlyOffice: http://$LXC_IP:8080

Admin Credentials:
- Username: admin
- Password: Tenchi01!

Next Steps:
1. Add to Nginx Proxy Manager
2. Install 'OpenID Connect Login' app
3. Configure Microsoft OAuth
==========================================
"
DEPLOY_SCRIPT

# Copy and run on Proxmox
sshpass -p "$PROXMOX_PASS" scp /tmp/deploy-nextcloud.sh $PROXMOX_USER@$PROXMOX_HOST:/tmp/
sshpass -p "$PROXMOX_PASS" ssh $PROXMOX_USER@$PROXMOX_HOST 'bash /tmp/deploy-nextcloud.sh'