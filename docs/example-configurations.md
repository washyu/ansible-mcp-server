# Example Configurations (Generic Templates)

## Network Topologies

### Small Homelab Setup
```
Network: 192.168.1.0/24
Gateway: 192.168.1.1

Servers:
- Proxmox Host: 192.168.1.100
- MCP Server: 192.168.1.10  
- NAS Server: 192.168.1.101
- DNS Server: 192.168.1.102
- VMs: 192.168.1.110-199
```

### Medium Enterprise Setup
```
Network: 10.0.0.0/16
Gateway: 10.0.0.1

Infrastructure:
- Proxmox Cluster: 10.0.1.10-13
- MCP Server: 10.0.1.5
- Storage: 10.0.2.0/24
- Services: 10.0.3.0/24
- Development: 10.0.4.0/24
```

## Service Deployment Examples

### Web Server Stack
```bash
# Deploy web server
deploy-service --serviceName="nginx" --vmName="web-server-01" --ip="192.168.1.110"

# Deploy database
deploy-service --serviceName="postgresql" --vmName="db-server-01" --ip="192.168.1.111"

# Deploy monitoring
deploy-service --serviceName="prometheus" --vmName="monitoring-01" --ip="192.168.1.112"
```

### Development Environment
```bash
# Git server
deploy-service --serviceName="gitea" --vmName="git-server" --ip="192.168.1.120"

# CI/CD
deploy-service --serviceName="jenkins" --vmName="ci-server" --ip="192.168.1.121"

# Container registry
deploy-service --serviceName="docker-registry" --vmName="registry" --ip="192.168.1.122"
```

## External Server Examples

### Network Infrastructure
```bash
# Router/Gateway
add-external-server \
  --hostname="192.168.1.1" \
  --type="gateway" \
  --connection='{"method":"ssh","username":"admin"}'

# DNS Server (Pi-hole)
add-external-server \
  --hostname="dns-server.local" \
  --type="pihole" \
  --connection='{"method":"api","port":80}'

# Network Storage
add-external-server \
  --hostname="nas-server.local" \
  --type="nas" \
  --connection='{"method":"ssh","username":"admin"}'
```

### IoT and Smart Home
```bash
# Home automation
add-external-server \
  --hostname="home-assistant.local" \
  --type="iot" \
  --connection='{"method":"api","port":8123}'

# Media server
add-external-server \
  --hostname="media-server.local" \
  --type="media" \
  --connection='{"method":"ssh","username":"media"}'
```

## Inventory Templates

### Basic Inventory Structure
```yaml
all:
  children:
    proxmox_vms:
      hosts:
        web-server-01:
          ansible_host: 192.168.1.110
          purpose: web_frontend
        db-server-01:
          ansible_host: 192.168.1.111
          purpose: database
    
    external_servers:
      hosts:
        nas-server:
          ansible_host: nas-server.local
          server_type: nas
          managed_externally: true
        
    web_servers:
      hosts:
        web-server-01: {}
    
    databases:
      hosts:
        db-server-01: {}
```

### Advanced Grouping
```yaml
all:
  children:
    production:
      children:
        web_tier:
          hosts:
            web-server-01: {}
            web-server-02: {}
        database_tier:
          hosts:
            db-server-01: {}
            db-server-02: {}
    
    development:
      hosts:
        dev-server-01:
          ansible_host: 192.168.1.150
    
    monitoring:
      hosts:
        prometheus-server:
          ansible_host: 192.168.1.160
        grafana-server:
          ansible_host: 192.168.1.161
```

## Environment Variables Templates

### Development Environment
```bash
# .env.development
PROXMOX_HOST=192.168.1.100
PROXMOX_USER=root@pam
PROXMOX_NODE=pve-dev
DEFAULT_GATEWAY=192.168.1.1
DEFAULT_NETWORK_CIDR=24
```

### Production Environment
```bash
# .env.production  
PROXMOX_HOST=10.0.1.10
PROXMOX_USER=automation@pve
PROXMOX_NODE=pve-cluster
DEFAULT_GATEWAY=10.0.0.1
DEFAULT_NETWORK_CIDR=16
```

## SSH Key Management Examples

### Generate Keys
```bash
# Development keys
manage-ssh-keys --action="generate" --keyType="ed25519"

# Production keys (stronger)
manage-ssh-keys --action="generate" --keyType="rsa" --keySize=4096
```

### Distribute to Multiple Hosts
```bash
# Web servers
manage-ssh-keys --action="distribute" \
  --targets='["192.168.1.110", "192.168.1.111", "192.168.1.112"]' \
  --username="ansible"

# Infrastructure servers
manage-ssh-keys --action="distribute" \
  --targets='["192.168.1.100", "192.168.1.1"]' \
  --username="root"
```

## Migration Scenarios

### Scenario 1: Single Controller Migration
```bash
# Discover existing setup
discover-ansible-controller --networkRange="192.168.1.0/24"

# Import configuration
import-ansible-config \
  --controllerHost="192.168.1.50" \
  --username="ansible"

# Migrate control
manage-ssh-keys --action="distribute" --targets='["all_managed_hosts"]'
```

### Scenario 2: Multi-Controller Environment
```bash
# Discover all controllers
discover-ansible-controller --networkRange="10.0.0.0/16"

# Import from primary
import-ansible-config --controllerHost="10.0.1.20" --username="ansible"

# Import from secondary  
import-ansible-config --controllerHost="10.0.2.20" --username="ansible"
```

## Service Categories

### Infrastructure Services
- DNS: Pi-hole, AdGuard Home
- Storage: TrueNAS, MinIO, Ceph
- Networking: Nginx, HAProxy, Traefik
- Monitoring: Prometheus, Grafana, Zabbix

### Development Services  
- Version Control: GitLab, Gitea, Gogs
- CI/CD: Jenkins, Drone, Woodpecker
- Documentation: BookStack, DokuWiki, Outline
- Project Management: Taiga, OpenProject

### Communication Services
- Chat: Matrix, Rocket.Chat, Mattermost
- Email: Docker Mailserver, Mailu, iRedMail
- Video: Jitsi Meet, BigBlueButton

### Media Services
- Streaming: Jellyfin, Plex, Emby
- Downloads: Transmission, qBittorrent, Deluge
- Libraries: Calibre, Komga, Kavita

All examples use generic naming conventions and can be adapted to your specific environment.