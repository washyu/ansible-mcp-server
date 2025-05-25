# Homelab Infrastructure Action Plan

## Quick Implementation Guide

### Phase 1: Reverse Proxy (Today - 30 minutes)
1. **Deploy Nginx Proxy Manager**
   ```bash
   ansible-playbook -i inventory/hosts playbooks/deploy-nginx-proxy-manager.yml
   ```

2. **Configure Router**
   - Port forward 80 & 443 to 192.168.10.108 (test-server)

3. **Access NPM**
   - http://192.168.10.108:81
   - Login: admin@example.com / changeme
   - Change password immediately!

4. **Add First Proxy Host**
   - Domain: heimdall.userjackson.space
   - Forward to: localhost:8080
   - Enable SSL (Let's Encrypt)

### Phase 2: Status Website (15 minutes)
1. **Create Status Page**
   ```bash
   ansible-playbook -i inventory/hosts playbooks/create-status-website.yml
   ```

2. **Add to NPM**
   - Domain: userjackson.space (and www)
   - Forward to: localhost:8888

### Phase 3: Authentication (1 hour)
1. **Deploy Keycloak**
   ```bash
   ansible-playbook -i inventory/hosts playbooks/deploy-keycloak.yml
   ```

2. **Configure in NPM**
   - Domain: auth.userjackson.space
   - Forward to: localhost:8080

3. **Setup Keycloak**
   - Create 'homelab' realm
   - Add users
   - Configure services

### Phase 4: Clean IP Scheme (Weekend Project)
**Current → Proposed IPs:**
- linuxrwifi: 192.168.10.1 → Keep as-is ✓
- test-server: 192.168.10.108 → 192.168.10.10
- amdaiserver: 192.168.10.200 → 192.168.10.20
- truenas: 192.168.10.164 → 192.168.10.30

**Steps:**
1. Configure DHCP reservations first
2. Run: `ansible-playbook -i inventory/hosts playbooks/static-ip-migration.yml --check`
3. Migrate one server at a time

## Service URLs After Setup
All accessible via HTTPS with valid certificates:
- https://userjackson.space - Status dashboard
- https://heimdall.userjackson.space - Service dashboard
- https://portainer.userjackson.space - Docker management
- https://grafana.userjackson.space - Monitoring
- https://proxmox.userjackson.space - Virtualization
- https://truenas.userjackson.space - Storage
- https://pihole.userjackson.space - DNS management
- https://auth.userjackson.space - SSO login
- https://npm.userjackson.space - Proxy management

## DNS Configuration
Option 1: If you use Cloudflare
- Add A record: @ → Your public IP
- Add CNAME: * → @

Option 2: Individual records
- Add A records for each subdomain → Your public IP

## Important Notes
1. **Prometheus is restarting** - Check configuration after NPM setup
2. **Keycloak on test-server** - Consider moving to Proxmox later
3. **Backup everything** before IP migration
4. **Document passwords** in a password manager

## Commands Summary
```bash
# Deploy everything
cd /home/user/ansible
ansible-playbook -i inventory/hosts playbooks/deploy-nginx-proxy-manager.yml
ansible-playbook -i inventory/hosts playbooks/create-status-website.yml
ansible-playbook -i inventory/hosts playbooks/deploy-keycloak.yml

# Check what would change for IP migration
ansible-playbook -i inventory/hosts playbooks/static-ip-migration.yml --check
```

## Start Now With
1. Run NPM deployment playbook
2. Configure router port forwarding
3. Set up first subdomain
4. Celebrate! 🎉