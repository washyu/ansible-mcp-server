#!/bin/bash

# Configure all services for Keycloak SSO

KEYCLOAK_URL="http://192.168.10.108:8090"
REALM="homelab"

echo "=== Configuring SSO for all services ==="

# First, let's create the remaining clients in Keycloak
# We'll need to do this through the UI since we need the admin token

cat > /tmp/sso-services-guide.md << 'EOF'
# SSO Configuration for All Services

## 1. Create Clients in Keycloak

Go to Keycloak Admin: http://192.168.10.108:8090/admin
Make sure you're in the "homelab" realm.

### Create Portainer Client
1. Clients → Create client
2. Client ID: `portainer`
3. Name: `Portainer`
4. Next → Client authentication: ON → Next
5. Valid redirect URIs: 
   - `http://192.168.10.108:9000/*`
   - `https://portainer.shaunjackson.space/*`
6. Save
7. Credentials tab → Copy the secret

### Create NPM Client (if supported)
1. Clients → Create client
2. Client ID: `nginx-proxy-manager`
3. Name: `Nginx Proxy Manager`
4. Next → Client authentication: ON → Next
5. Valid redirect URIs:
   - `http://192.168.10.108:81/*`
   - `https://npm.shaunjackson.space/*`
6. Save
7. Credentials tab → Copy the secret

### Create Proxmox Client
1. Clients → Create client
2. Client ID: `proxmox`
3. Name: `Proxmox VE`
4. Next → Client authentication: ON → Next
5. Valid redirect URIs:
   - `https://192.168.10.20:8006/*`
   - `https://proxmox.shaunjackson.space/*`
6. Save
7. Credentials tab → Copy the secret

### Create Heimdall Client (if it supports OAuth)
1. Clients → Create client
2. Client ID: `heimdall`
3. Name: `Heimdall Dashboard`
4. Next → Client authentication: ON → Next
5. Valid redirect URIs:
   - `http://192.168.10.108:8080/*`
   - `https://heimdall.shaunjackson.space/*`
6. Save
7. Credentials tab → Copy the secret

## 2. Configure Each Service

### Portainer Configuration
1. Login to Portainer: http://192.168.10.108:9000
2. Go to Settings → Authentication
3. Select "OAuth" and configure:
   - Provider: Custom
   - Client ID: `portainer`
   - Client Secret: (from Keycloak)
   - Authorization URL: `http://192.168.10.108:8090/realms/homelab/protocol/openid-connect/auth`
   - Access Token URL: `http://192.168.10.108:8090/realms/homelab/protocol/openid-connect/token`
   - Resource URL: `http://192.168.10.108:8090/realms/homelab/protocol/openid-connect/userinfo`
   - Redirect URL: `http://192.168.10.108:9000`
   - User Identifier: `preferred_username`
   - Scopes: `openid email profile`
4. Save settings

### NPM Configuration (if OAuth is available)
1. Login to NPM: http://192.168.10.108:81
2. Check Settings or User menu for OAuth/SSO options
3. If available, configure with Keycloak URLs

### Proxmox Configuration
SSH to Proxmox server and run:
```bash
pvesh create /access/domains \
  --realm keycloak \
  --type openid \
  --client-id proxmox \
  --client-key YOUR_SECRET_HERE \
  --issuer-url http://192.168.10.108:8090/realms/homelab \
  --username-claim preferred_username \
  --autocreate 1 \
  --default 0
```

Then in Proxmox UI:
1. Go to Datacenter → Permissions → Realms
2. Edit the keycloak realm
3. Set as default if desired

### TrueNAS Configuration
TrueNAS SCALE supports OIDC:
1. Login to TrueNAS
2. Credentials → Directory Services → LDAP
3. Or check System → General → GUI Settings for OIDC options

## 3. Services That Don't Support SSO

These services need local authentication:
- Pi-hole (no SSO support)
- Most Docker containers without explicit OAuth support

## 4. Testing

After configuration, test each service:
1. Logout of the service
2. You should see "Login with Keycloak" or similar
3. Click it and authenticate through Keycloak
4. You should be logged in automatically

## 5. Single Logout

When you logout from Keycloak, you'll be logged out from all services.
Access the logout URL: http://192.168.10.108:8090/realms/homelab/protocol/openid-connect/logout
EOF

echo "Guide created at /tmp/sso-services-guide.md"
echo ""
echo "Since each service has different UI configurations, please:"
echo "1. Create the clients in Keycloak first"
echo "2. Then configure each service using the guide"
echo ""
echo "Services that support SSO:"
echo "✅ Grafana (already configured)"
echo "✅ Portainer (UI configuration needed)"
echo "✅ Proxmox (CLI + UI configuration)"
echo "❓ NPM (check if your version supports OAuth)"
echo "❓ TrueNAS (OIDC support in SCALE)"
echo "❌ Pi-hole (no SSO support)"