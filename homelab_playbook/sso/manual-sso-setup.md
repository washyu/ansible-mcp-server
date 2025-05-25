# Manual Keycloak SSO Setup

## Step 1: Create Homelab Realm

1. Go to: http://192.168.10.108:8090/admin
2. Login with your admin credentials
3. Click the dropdown (probably says "master") in the top-left
4. Click "Create Realm"
5. Fill in:
   - Realm name: `homelab`
   - Display name: `Homelab SSO`
6. Click Create

## Step 2: Create Your User

1. Make sure you're in the "homelab" realm (check top-left dropdown)
2. Left menu → Users → Add User
3. Fill in:
   - Username: `shaun`
   - Email: `shaun@shaunjackson.space`
   - Email verified: ON
   - Click Save
4. Go to Credentials tab
5. Set Password:
   - Password: `The Old One01!`
   - Temporary: OFF
   - Click Save

## Step 3: Create Grafana Client

1. Left menu → Clients → Create client
2. Fill in:
   - Client ID: `grafana`
   - Name: `Grafana`
   - Click Next
3. Settings:
   - Client authentication: ON
   - Click Next
4. Login settings:
   - Valid redirect URIs: 
     - `http://192.168.10.108:3000/*`
     - `https://grafana.shaunjackson.space/*`
   - Valid post logout redirect URIs: `+`
   - Web origins: `+`
   - Click Save
5. Go to Credentials tab
6. Copy the Client Secret (you'll need this)

## Step 4: Configure Grafana for SSO

SSH to homelab2 and run:

```bash
# Create Grafana SSO config
docker exec grafana sh -c 'cat >> /etc/grafana/grafana.ini << EOF

[auth.generic_oauth]
enabled = true
name = Keycloak
allow_sign_up = true
client_id = grafana
client_secret = YOUR_SECRET_FROM_KEYCLOAK
scopes = openid email profile
email_attribute_name = email
login_attribute_path = username
auth_url = http://192.168.10.108:8090/realms/homelab/protocol/openid-connect/auth
token_url = http://192.168.10.108:8090/realms/homelab/protocol/openid-connect/token
api_url = http://192.168.10.108:8090/realms/homelab/protocol/openid-connect/userinfo
role_attribute_path = contains(groups[*], 'admins') && 'Admin' || 'Viewer'
EOF'

# Restart Grafana
docker restart grafana
```

## Step 5: Test SSO

1. Go to Grafana: http://192.168.10.108:3000
2. You should see "Sign in with Keycloak" button
3. Click it
4. Login with: shaun / The Old One01!
5. You should be logged into Grafana!

## Step 6: Configure Other Services

### Portainer:
1. Create client in Keycloak (same as Grafana)
   - Client ID: `portainer`
2. In Portainer → Settings → Authentication → OAuth
3. Configure with Keycloak URLs

### NPM (if supported):
1. Create client in Keycloak
   - Client ID: `nginx-proxy-manager`
2. Check NPM settings for OAuth options

## Benefits:
- One login for all services
- Centralized user management
- Easy to add/remove access
- Can add 2FA in one place