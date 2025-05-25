# Keycloak SSO Setup for All Services

## Step 1: Configure Keycloak

### 1.1 Create Homelab Realm
1. Login to Keycloak: http://192.168.10.108:8090/admin
2. Top-left dropdown → Create Realm
3. Realm name: `homelab`
4. Display name: `Homelab SSO`
5. Create

### 1.2 Create Your User Account
1. In homelab realm → Users → Add User
2. Username: `user`
3. Email: `user@userjackson.space`
4. Email Verified: ON
5. Save
6. Credentials tab → Set Password
7. Temporary: OFF
8. Set your password

### 1.3 Create Admin Group (Optional)
1. Groups → Create Group
2. Name: `admins`
3. Save
4. Add your user to this group

## Step 2: Configure Services for SSO

### Grafana SSO Setup

1. **In Keycloak** - Create Client:
   - Clients → Create Client
   - Client ID: `grafana`
   - Name: `Grafana`
   - Client Protocol: `openid-connect`
   - Next → Next
   - Client Authentication: ON
   - Authorization: OFF
   - Save
   - Valid Redirect URIs: `https://grafana.userjackson.space/*`
   - (For testing: also add `http://192.168.10.108:3000/*`)
   - Save
   - Credentials tab → Copy the Client Secret

2. **In Grafana** - Configure OAuth:
   ```ini
   # Add to Grafana environment or grafana.ini
   [auth.generic_oauth]
   enabled = true
   name = Keycloak
   allow_sign_up = true
   client_id = grafana
   client_secret = <paste-from-keycloak>
   scopes = openid email profile
   email_attribute_name = email
   login_attribute_path = username
   auth_url = http://192.168.10.108:8090/realms/homelab/protocol/openid-connect/auth
   token_url = http://192.168.10.108:8090/realms/homelab/protocol/openid-connect/token
   api_url = http://192.168.10.108:8090/realms/homelab/protocol/openid-connect/userinfo
   role_attribute_path = contains(groups[*], 'admins') && 'Admin' || 'Viewer'
   ```

### Portainer SSO Setup

1. **In Keycloak** - Create Client:
   - Client ID: `portainer`
   - Same settings as Grafana
   - Valid Redirect URIs: `https://portainer.userjackson.space/*`
   - (For testing: `http://192.168.10.108:9000/*`)

2. **In Portainer**:
   - Settings → Authentication → OAuth
   - Provider: Custom
   - Client ID: `portainer`
   - Client Secret: <from-keycloak>
   - Authorization URL: `http://192.168.10.108:8090/realms/homelab/protocol/openid-connect/auth`
   - Access Token URL: `http://192.168.10.108:8090/realms/homelab/protocol/openid-connect/token`
   - Resource URL: `http://192.168.10.108:8090/realms/homelab/protocol/openid-connect/userinfo`
   - User Identifier: `preferred_username`
   - Scopes: `openid email profile`

### NPM SSO Setup (if supported in your version)

1. **In Keycloak** - Create Client:
   - Client ID: `nginx-proxy-manager`
   - Valid Redirect URIs: `https://npm.userjackson.space/*`

2. **In NPM**: Check Settings for OAuth options

### Proxmox SSO Setup

1. **In Keycloak** - Create Client:
   - Client ID: `proxmox`
   - Valid Redirect URIs: `https://proxmox.userjackson.space/*`

2. **In Proxmox**:
   ```bash
   # SSH to Proxmox
   pvesh create /access/domains \
     --realm keycloak \
     --type openid \
     --client-id proxmox \
     --client-key <secret> \
     --issuer-url http://192.168.10.108:8090/realms/homelab \
     --username-claim preferred_username \
     --autocreate 1
   ```

## Step 3: Quick Docker Command for Grafana

```bash
# Update Grafana with SSO config
docker exec -it grafana sh -c 'cat >> /etc/grafana/grafana.ini << EOF

[auth.generic_oauth]
enabled = true
name = Keycloak
allow_sign_up = true
client_id = grafana
client_secret = YOUR_SECRET_HERE
scopes = openid email profile
auth_url = http://192.168.10.108:8090/realms/homelab/protocol/openid-connect/auth
token_url = http://192.168.10.108:8090/realms/homelab/protocol/openid-connect/token
api_url = http://192.168.10.108:8090/realms/homelab/protocol/openid-connect/userinfo
EOF'

docker restart grafana
```

## Step 4: After DNS Propagates

Update all URLs to use HTTPS:
- Change http://192.168.10.108:8090 → https://auth.userjackson.space
- Update all service configurations

## Benefits:
- One password for all services
- Centralized user management
- Easy to add/remove access
- Audit logs in one place
- 2FA in one place (when enabled)