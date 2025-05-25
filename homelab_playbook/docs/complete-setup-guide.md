# Complete Homelab Setup Guide

## ✅ Services Successfully Deployed

### 1. Nginx Proxy Manager
- **URL**: http://192.168.10.108:81
- **Login**: admin@example.com / changeme
- **Purpose**: Reverse proxy with SSL for all services

### 2. Homelab Status Website  
- **URL**: http://192.168.10.108:8888
- **Purpose**: Dashboard showing all servers and services

### 3. Keycloak SSO
- **URL**: http://192.168.10.108:8090/admin
- **Login**: admin / ChangeMe123!
- **Purpose**: Single Sign-On for all services

### 4. Existing Services
- **Heimdall**: http://192.168.10.108:8080
- **Grafana**: http://192.168.10.108:3000
- **Portainer**: http://192.168.10.108:9000
- **Pi-hole**: http://192.168.10.1:80

## 📋 Setup Checklist

### Step 1: Router Configuration ⚠️ CRITICAL
Configure port forwarding on your router:
- **Port 80** → 192.168.10.108:80
- **Port 443** → 192.168.10.108:443

### Step 2: DNS Configuration
Add these DNS records to your domain provider:

**Option A - Wildcard (Recommended)**
```
Type  Name  Value
A     @     68.111.95.149
CNAME *     @
```

**Option B - Individual Records**
```
Type  Name       Value
A     @          68.111.95.149
A     www        68.111.95.149
A     heimdall   68.111.95.149
A     grafana    68.111.95.149
A     portainer  68.111.95.149
A     proxmox    68.111.95.149
A     truenas    68.111.95.149
A     pihole     68.111.95.149
A     auth       68.111.95.149
A     npm        68.111.95.149
```

### Step 3: Configure Nginx Proxy Manager

1. **Login**: http://192.168.10.108:81
2. **Change Default Password** immediately!
3. **Add Proxy Hosts** (in this order):

#### Main Website
- Domain: `userjackson.space`
- Forward to: `192.168.10.108:8888`
- Also add: `www.userjackson.space`
- Enable SSL, Force SSL, HTTP/2, HSTS

#### Heimdall Dashboard
- Domain: `heimdall.userjackson.space`
- Forward to: `192.168.10.108:8080`
- Enable all SSL options

#### Grafana
- Domain: `grafana.userjackson.space`
- Forward to: `192.168.10.108:3000`
- Enable all SSL options

#### Portainer
- Domain: `portainer.userjackson.space`
- Forward to: `192.168.10.108:9000`
- Enable all SSL options

#### Keycloak (Auth)
- Domain: `auth.userjackson.space`
- Forward to: `192.168.10.108:8090`
- Enable all SSL options

#### NPM Admin
- Domain: `npm.userjackson.space`
- Forward to: `192.168.10.108:81`
- Enable all SSL options

#### Pi-hole
- Domain: `pihole.userjackson.space`
- Forward to: `192.168.10.1:80`
- Enable all SSL options

#### Proxmox
- Domain: `proxmox.userjackson.space`
- Forward to: `192.168.10.20:8006`
- Scheme: `https` (not http)
- Enable all SSL options

#### TrueNAS
- Domain: `truenas.userjackson.space`
- Forward to: `192.168.10.30:80`
- Enable all SSL options

### Step 4: Configure Keycloak

1. **Access**: https://auth.userjackson.space (after NPM setup)
2. **Login**: admin / ChangeMe123!
3. **Create Realm**:
   - Name: `homelab`
   - Display name: `Homelab SSO`

4. **Create User**:
   - Username: `user`
   - Email: your email
   - Email Verified: ON
   - Set permanent password

5. **Configure Grafana OAuth**:
   - Create client: `grafana`
   - Client Protocol: `openid-connect`
   - Access Type: `confidential`
   - Valid Redirect URIs: `https://grafana.userjackson.space/*`
   - Get client secret from Credentials tab

### Step 5: Update Services Configuration

#### Grafana SSO
Edit Grafana config or environment:
```ini
[auth.generic_oauth]
enabled = true
name = Keycloak
allow_sign_up = true
client_id = grafana
client_secret = <from-keycloak>
scopes = openid email profile
auth_url = https://auth.userjackson.space/realms/homelab/protocol/openid-connect/auth
token_url = https://auth.userjackson.space/realms/homelab/protocol/openid-connect/token
api_url = https://auth.userjackson.space/realms/homelab/protocol/openid-connect/userinfo
```

## 🔒 Security Checklist

- [ ] Changed NPM default password
- [ ] Changed Keycloak admin password
- [ ] Created personal user in Keycloak
- [ ] Enabled 2FA on critical services
- [ ] All services using HTTPS
- [ ] Firewall configured properly

## 🎯 Quick Access Links (After Setup)

- **Main Site**: https://userjackson.space
- **Dashboard**: https://heimdall.userjackson.space
- **Monitoring**: https://grafana.userjackson.space
- **Docker**: https://portainer.userjackson.space
- **Auth**: https://auth.userjackson.space
- **Proxy**: https://npm.userjackson.space
- **DNS**: https://pihole.userjackson.space
- **VMs**: https://proxmox.userjackson.space
- **Storage**: https://truenas.userjackson.space

## 📝 Passwords to Remember

- NPM: (set your own)
- Keycloak Admin: ChangeMe123!
- Your SSO User: (set your own)

## 🚨 Troubleshooting

### SSL Certificate Issues
- Make sure ports 80/443 are forwarded
- DNS must be propagated (check with `nslookup`)
- Try HTTP-01 challenge if DNS-01 fails

### Can't Access Services
- Check firewall rules
- Verify port forwarding
- Test locally first (192.168.x.x addresses)

### Keycloak Issues
- Container logs: `docker logs keycloak`
- Database: `docker logs keycloak-postgres`

## Next Steps

1. Complete all proxy host configurations
2. Test each service with HTTPS
3. Configure SSO for compatible services
4. Update Heimdall dashboard with new URLs
5. Consider IP migration (weekend project)

---
Generated: $(date)