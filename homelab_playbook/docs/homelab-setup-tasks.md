# Homelab Setup Tasks

## Current Status
- **Domain**: shaunjackson.space → 68.111.95.149 (your public IP)
- **Existing Services**:
  - Heimdall (Dashboard) on ports 8080/8443
  - Grafana (Monitoring) on port 3000
  - Portainer (Docker Management) on port 9000
  - Pi-hole (DNS) on linuxrwifi

## Implementation Plan

### Step 1: Deploy Reverse Proxy (Nginx Proxy Manager)
Since you already have Docker on homelab2, we'll deploy NPM there first:

```bash
# Deploy Nginx Proxy Manager
docker run -d \
  --name nginx-proxy-manager \
  --restart unless-stopped \
  -p 80:80 \
  -p 443:443 \
  -p 81:81 \
  -v npm_data:/data \
  -v npm_letsencrypt:/etc/letsencrypt \
  jc21/nginx-proxy-manager:latest
```

Default login: admin@example.com / changeme

### Step 2: Configure Subdomains
After NPM is running, configure these proxy hosts:
- `heimdall.shaunjackson.space` → localhost:8080
- `grafana.shaunjackson.space` → localhost:3000
- `portainer.shaunjackson.space` → localhost:9000
- `pihole.shaunjackson.space` → 192.168.10.1:80
- `proxmox.shaunjackson.space` → 192.168.10.20:8006
- `truenas.shaunjackson.space` → 192.168.10.30:80

### Step 3: Deploy Keycloak for SSO
We'll deploy Keycloak on Proxmox as an LXC container:

1. Create Ubuntu LXC container on Proxmox
2. Install Docker in the container
3. Deploy Keycloak with PostgreSQL

### Step 4: Static IP Migration
Before changing IPs, we should:
1. Document current DHCP reservations
2. Update Pi-hole DHCP settings
3. Migrate servers one by one

### Step 5: Update Website
Create a simple status page showing all services

## Quick Start Commands

### 1. Deploy NPM right now:
```bash
ssh shaun@homelab2
docker run -d \
  --name nginx-proxy-manager \
  --restart unless-stopped \
  -p 80:80 \
  -p 443:443 \
  -p 81:81 \
  -v npm_data:/data \
  -v npm_letsencrypt:/etc/letsencrypt \
  jc21/nginx-proxy-manager:latest
```

### 2. Configure router port forwarding:
- Forward ports 80 and 443 to homelab2 (192.168.10.108)

### 3. Access NPM:
- Local: http://192.168.10.108:81
- After setup: https://npm.shaunjackson.space

## Ansible Playbooks Created
1. `static-ip-migration.yml` - Migrate to static IPs
2. `check-web-services.yml` - Audit current services

## Next Immediate Actions
1. Deploy Nginx Proxy Manager (5 minutes)
2. Configure port forwarding on router
3. Set up first proxy host for Heimdall
4. Test with heimdall.shaunjackson.space