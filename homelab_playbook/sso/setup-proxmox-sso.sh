#!/bin/bash

# Proxmox SSO Configuration Script
# Run this on the Proxmox server after creating the client in Keycloak

CLIENT_SECRET="REPLACE_WITH_PROXMOX_SECRET"
KEYCLOAK_URL="http://192.168.10.108:8090"
REALM="homelab"

echo "Setting up Proxmox SSO with Keycloak..."

# Create OpenID Connect realm in Proxmox
pvesh create /access/domains \
  --realm keycloak \
  --type openid \
  --client-id proxmox \
  --client-key "$CLIENT_SECRET" \
  --issuer-url "$KEYCLOAK_URL/realms/$REALM" \
  --username-claim preferred_username \
  --autocreate 1 \
  --default 0 \
  --comment "Keycloak SSO Integration"

echo "Proxmox SSO realm created!"
echo ""
echo "Next steps:"
echo "1. Go to Proxmox UI: https://192.168.10.20:8006"
echo "2. Datacenter → Permissions → Realms"
echo "3. You should see 'keycloak' realm"
echo "4. Edit it if needed (set as default, etc.)"
echo ""
echo "To login with SSO:"
echo "1. On Proxmox login page, select 'keycloak' realm"
echo "2. Login with shaun / The Old One01!"