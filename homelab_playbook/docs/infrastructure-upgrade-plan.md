# Homelab Infrastructure Upgrade Plan
Domain: shaunjackson.space

## Current State Analysis

### Current IP Addresses (DHCP)
- **linuxrwifi**: 192.168.10.1, 192.168.50.92 (Pi-hole DNS)
- **homelab2**: 192.168.10.108 (Management)
- **truenas**: 192.168.10.164 (Storage)
- **amdaiserver**: 192.168.10.200 (Proxmox)

### Issues to Address
1. IP addresses are DHCP assigned (not ideal for servers)
2. No centralized authentication (SSO)
3. No reverse proxy for friendly URLs
4. Need to update website with server info
5. Need proper DNS records for services

## Proposed Infrastructure Design

### 1. Network Redesign - Static IP Scheme

#### Proposed IP Allocation (192.168.10.0/24)
```
192.168.10.1    - Router/Gateway (linuxrwifi)
192.168.10.2-9  - Reserved for network equipment

192.168.10.10   - homelab2 (Management/Ansible)
192.168.10.11   - Keycloak (SSO) - VM on Proxmox
192.168.10.12   - Nginx Proxy Manager - VM on Proxmox
192.168.10.13-19 - Reserved for future services

192.168.10.20   - amdaiserver (Proxmox Host)
192.168.10.21-29 - Proxmox VMs

192.168.10.30   - truenas (Storage)
192.168.10.31-39 - Storage network expansion

192.168.10.100-199 - DHCP Range for clients
```

### 2. Service Architecture

#### Core Services to Deploy
1. **Keycloak** (SSO/Authentication)
   - Deploy as Proxmox VM/LXC
   - Integrate with all services
   - LDAP compatible

2. **Nginx Proxy Manager** (Reverse Proxy)
   - Deploy as Proxmox VM/LXC
   - SSL certificates via Let's Encrypt
   - Friendly URLs for all services

3. **External DNS** (Cloudflare/etc)
   - Point *.shaunjackson.space to home IP
   - Use dynamic DNS if needed

### 3. Service URLs (via reverse proxy)
```
proxmox.shaunjackson.space    -> 192.168.10.20:8006
truenas.shaunjackson.space    -> 192.168.10.30:80
pihole.shaunjackson.space     -> 192.168.10.1:80
keycloak.shaunjackson.space   -> 192.168.10.11:8080
npm.shaunjackson.space        -> 192.168.10.12:81
ansible.shaunjackson.space    -> 192.168.10.10:8080 (future web UI)
```

### 4. Website Update
- Static site with server status dashboard
- Can be hosted on homelab2 or as GitHub Pages
- Auto-update via Ansible playbook

## Implementation Steps

### Phase 1: IP Address Migration
1. Configure static IPs on all servers
2. Update DHCP range in Pi-hole
3. Update Ansible inventory

### Phase 2: Deploy Core Services (on Proxmox)
1. Create Keycloak VM/LXC
2. Create Nginx Proxy Manager VM/LXC
3. Configure both services

### Phase 3: DNS & Reverse Proxy
1. Configure external DNS
2. Set up reverse proxy rules
3. Generate SSL certificates

### Phase 4: SSO Integration
1. Configure Keycloak realms
2. Integrate services with Keycloak
3. Create user accounts

### Phase 5: Website & Monitoring
1. Deploy status website
2. Set up monitoring dashboard
3. Automate updates

## Ansible Playbooks Needed
1. `static-ip-migration.yml` - Convert to static IPs
2. `deploy-keycloak.yml` - Deploy Keycloak
3. `deploy-nginx-proxy-manager.yml` - Deploy NPM
4. `configure-reverse-proxy.yml` - Set up domains
5. `update-website.yml` - Update shaunjackson.space

## Next Steps
1. Review and approve IP scheme
2. Choose between Keycloak (recommended) or OpenLDAP
3. Decide on website hosting (local vs GitHub Pages)
4. Begin Phase 1 implementation