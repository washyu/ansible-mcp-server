# Replace Keycloak with Microsoft OAuth

## Why Switch?
- Use your existing washyu@hotmail.com account
- No need to manage another identity provider
- Free for personal use
- Works with most modern applications
- Simpler than maintaining Keycloak

## Setup Steps

### 1. Register Application in Azure Portal
1. Go to https://portal.azure.com (use your hotmail account)
2. Navigate to "Azure Active Directory" → "App registrations"
3. Click "New registration"
   - Name: "Homelab SSO"
   - Account types: "Personal Microsoft accounts only"
   - Redirect URI: Add later for each service

### 2. Get OAuth Credentials
After registration:
- Application (client) ID: `<your-client-id>`
- Create a client secret: "Certificates & secrets" → "New client secret"
- Note the tenant: `consumers` (for personal accounts)

### 3. OAuth Endpoints for Personal Microsoft Accounts
```
Authorization URL: https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize
Token URL: https://login.microsoftonline.com/consumers/oauth2/v2.0/token
User Info URL: https://graph.microsoft.com/v1.0/me
Logout URL: https://login.microsoftonline.com/consumers/oauth2/v2.0/logout
```

### 4. Configure Services

#### Grafana Configuration
```yaml
environment:
  - GF_AUTH_GENERIC_OAUTH_ENABLED=true
  - GF_AUTH_GENERIC_OAUTH_NAME=Microsoft
  - GF_AUTH_GENERIC_OAUTH_ALLOW_SIGN_UP=true
  - GF_AUTH_GENERIC_OAUTH_CLIENT_ID=<your-client-id>
  - GF_AUTH_GENERIC_OAUTH_CLIENT_SECRET=<your-client-secret>
  - GF_AUTH_GENERIC_OAUTH_SCOPES=openid email profile
  - GF_AUTH_GENERIC_OAUTH_AUTH_URL=https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize
  - GF_AUTH_GENERIC_OAUTH_TOKEN_URL=https://login.microsoftonline.com/consumers/oauth2/v2.0/token
  - GF_AUTH_GENERIC_OAUTH_API_URL=https://graph.microsoft.com/v1.0/me
  - GF_AUTH_GENERIC_OAUTH_EMAIL_ATTRIBUTE_PATH=mail
  - GF_AUTH_GENERIC_OAUTH_ROLE_ATTRIBUTE_PATH=mail=="washyu@hotmail.com" && "Admin" || "Viewer"
  - GF_SERVER_ROOT_URL=http://grafana.userjackson.space
```

#### Portainer Configuration
1. Settings → Authentication → OAuth
2. Provider: Custom
3. Client ID: `<your-client-id>`
4. Client Secret: `<your-client-secret>`
5. Authorization URL: `https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize`
6. Access Token URL: `https://login.microsoftonline.com/consumers/oauth2/v2.0/token`
7. Resource URL: `https://graph.microsoft.com/v1.0/me`
8. Redirect URL: `http://portainer.userjackson.space`
9. User Identifier: `mail`
10. Scopes: `openid email profile`

### 5. Add Redirect URIs in Azure
For each service, add redirect URIs:
- `http://grafana.userjackson.space/login/generic_oauth`
- `http://portainer.userjackson.space`
- Add more as needed

### 6. Services That Support Microsoft OAuth
✅ **Supported:**
- Grafana
- Portainer
- Proxmox (with OpenID Connect)
- Most modern web apps

❌ **Not Supported (use local auth):**
- TrueNAS
- Pi-hole
- Nginx Proxy Manager

### 7. Remove Keycloak
Once Microsoft OAuth is working:
```bash
docker stop keycloak-simple
docker rm keycloak-simple
```

## Benefits Over Keycloak
1. **No maintenance** - Microsoft handles updates/security
2. **Single password** - Use your existing Microsoft account
3. **2FA included** - If enabled on your Microsoft account
4. **No resource usage** - Frees up memory/CPU on test-server
5. **Always available** - Even if your homelab is down

## Quick Test
After setup, test with:
```bash
curl -I http://grafana.userjackson.space/login/generic_oauth
```

You should be redirected to Microsoft login.