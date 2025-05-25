#!/bin/bash

# Keycloak SSO Automated Setup Script

KEYCLOAK_URL="http://192.168.10.108:8090"
ADMIN_USER="admin"
ADMIN_PASS="admin123"
REALM_NAME="homelab"
USERNAME="shaun"
USER_PASS="The Old One01!"
USER_EMAIL="shaun@shaunjackson.space"

echo "Setting up Keycloak SSO..."

# Get admin token
echo "Getting admin token..."
TOKEN=$(curl -s -X POST "$KEYCLOAK_URL/realms/master/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=$ADMIN_USER" \
  -d "password=$ADMIN_PASS" \
  -d "grant_type=password" \
  -d "client_id=admin-cli" | jq -r '.access_token')

if [ "$TOKEN" == "null" ] || [ -z "$TOKEN" ]; then
  echo "Failed to get admin token. Check admin credentials."
  exit 1
fi

echo "Token obtained successfully!"

# Create realm
echo "Creating homelab realm..."
curl -s -X POST "$KEYCLOAK_URL/admin/realms" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "realm": "'$REALM_NAME'",
    "displayName": "Homelab SSO",
    "enabled": true,
    "sslRequired": "external",
    "registrationAllowed": false,
    "loginWithEmailAllowed": true,
    "duplicateEmailsAllowed": false,
    "resetPasswordAllowed": true,
    "editUsernameAllowed": false,
    "bruteForceProtected": true
  }'

echo "Realm created!"

# Create user
echo "Creating user shaun..."
USER_ID=$(curl -s -X POST "$KEYCLOAK_URL/admin/realms/$REALM_NAME/users" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "'$USERNAME'",
    "email": "'$USER_EMAIL'",
    "emailVerified": true,
    "enabled": true,
    "attributes": {
      "admin": ["true"]
    }
  }' -i | grep -i location | cut -d'/' -f8 | tr -d '\r\n')

echo "User created with ID: $USER_ID"

# Set password
echo "Setting user password..."
curl -s -X PUT "$KEYCLOAK_URL/admin/realms/$REALM_NAME/users/$USER_ID/reset-password" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "password",
    "value": "'"$USER_PASS"'",
    "temporary": false
  }'

echo "Password set!"

# Create clients for services
echo "Creating OAuth clients..."

# Grafana Client
echo "Creating Grafana client..."
GRAFANA_SECRET=$(openssl rand -hex 32)
curl -s -X POST "$KEYCLOAK_URL/admin/realms/$REALM_NAME/clients" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "grafana",
    "name": "Grafana",
    "protocol": "openid-connect",
    "publicClient": false,
    "serviceAccountsEnabled": false,
    "directAccessGrantsEnabled": true,
    "standardFlowEnabled": true,
    "rootUrl": "http://192.168.10.108:3000",
    "redirectUris": ["http://192.168.10.108:3000/*", "https://grafana.shaunjackson.space/*"],
    "webOrigins": ["*"],
    "attributes": {
      "login_theme": "keycloak"
    }
  }'

# Get Grafana client ID and set secret
GRAFANA_CLIENT_ID=$(curl -s "$KEYCLOAK_URL/admin/realms/$REALM_NAME/clients?clientId=grafana" \
  -H "Authorization: Bearer $TOKEN" | jq -r '.[0].id')

curl -s -X POST "$KEYCLOAK_URL/admin/realms/$REALM_NAME/clients/$GRAFANA_CLIENT_ID/client-secret" \
  -H "Authorization: Bearer $TOKEN"

GRAFANA_SECRET=$(curl -s "$KEYCLOAK_URL/admin/realms/$REALM_NAME/clients/$GRAFANA_CLIENT_ID/client-secret" \
  -H "Authorization: Bearer $TOKEN" | jq -r '.value')

echo "Grafana client created!"

# Portainer Client
echo "Creating Portainer client..."
curl -s -X POST "$KEYCLOAK_URL/admin/realms/$REALM_NAME/clients" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "portainer",
    "name": "Portainer",
    "protocol": "openid-connect",
    "publicClient": false,
    "serviceAccountsEnabled": false,
    "directAccessGrantsEnabled": true,
    "standardFlowEnabled": true,
    "rootUrl": "http://192.168.10.108:9000",
    "redirectUris": ["http://192.168.10.108:9000/*", "https://portainer.shaunjackson.space/*"],
    "webOrigins": ["*"]
  }'

# Get Portainer secret
PORTAINER_CLIENT_ID=$(curl -s "$KEYCLOAK_URL/admin/realms/$REALM_NAME/clients?clientId=portainer" \
  -H "Authorization: Bearer $TOKEN" | jq -r '.[0].id')

curl -s -X POST "$KEYCLOAK_URL/admin/realms/$REALM_NAME/clients/$PORTAINER_CLIENT_ID/client-secret" \
  -H "Authorization: Bearer $TOKEN"

PORTAINER_SECRET=$(curl -s "$KEYCLOAK_URL/admin/realms/$REALM_NAME/clients/$PORTAINER_CLIENT_ID/client-secret" \
  -H "Authorization: Bearer $TOKEN" | jq -r '.value')

echo "Portainer client created!"

# Save configuration
cat > /tmp/sso-config.txt << EOF
=== Keycloak SSO Configuration ===

Realm: homelab
User: shaun
Password: Set successfully

=== Grafana Configuration ===
Client ID: grafana
Client Secret: $GRAFANA_SECRET

Add to Grafana (docker exec grafana):
[auth.generic_oauth]
enabled = true
name = Keycloak
allow_sign_up = true
client_id = grafana
client_secret = $GRAFANA_SECRET
scopes = openid email profile
email_attribute_name = email
login_attribute_path = username
auth_url = $KEYCLOAK_URL/realms/homelab/protocol/openid-connect/auth
token_url = $KEYCLOAK_URL/realms/homelab/protocol/openid-connect/token
api_url = $KEYCLOAK_URL/realms/homelab/protocol/openid-connect/userinfo
role_attribute_path = contains(groups[*], 'admins') && 'Admin' || 'Viewer'

=== Portainer Configuration ===
Client ID: portainer
Client Secret: $PORTAINER_SECRET

Configure in Portainer UI:
- Provider: Custom OAuth
- Authorization URL: $KEYCLOAK_URL/realms/homelab/protocol/openid-connect/auth
- Access Token URL: $KEYCLOAK_URL/realms/homelab/protocol/openid-connect/token
- Resource URL: $KEYCLOAK_URL/realms/homelab/protocol/openid-connect/userinfo
- User Identifier: preferred_username
- Scopes: openid email profile
EOF

echo ""
echo "Setup complete! Configuration saved to /tmp/sso-config.txt"
echo ""
echo "Next steps:"
echo "1. Configure Grafana with the OAuth settings"
echo "2. Configure Portainer in the UI"
echo "3. Test SSO login!"