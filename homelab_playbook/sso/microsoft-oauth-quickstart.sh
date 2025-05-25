#!/bin/bash
# Quick setup script for Microsoft OAuth

echo "=== Microsoft OAuth Setup for Homelab ==="
echo ""
echo "1. Go to: https://portal.azure.com"
echo "   - Sign in with washyu@hotmail.com"
echo ""
echo "2. Navigate to: Azure Active Directory → App registrations → New registration"
echo "   - Name: Homelab SSO"
echo "   - Supported account types: Personal Microsoft accounts only"
echo "   - Redirect URI: Leave blank for now"
echo ""
echo "3. After creation, copy these values:"
echo "   - Application (client) ID"
echo "   - Directory (tenant) ID: should be 'consumers'"
echo ""
echo "4. Create client secret:"
echo "   - Certificates & secrets → New client secret"
echo "   - Description: Homelab"
echo "   - Expires: 24 months"
echo "   - Copy the VALUE (not the ID)"
echo ""
echo "5. Add Redirect URIs:"
echo "   - Authentication → Add a platform → Web"
echo "   - Add these URLs:"
echo "     • http://grafana.shaunjackson.space/login/generic_oauth"
echo "     • http://portainer.shaunjackson.space/"
echo "     • http://proxmox.shaunjackson.space:8006/"
echo ""
echo "6. API Permissions (should be automatic):"
echo "   - Microsoft Graph: openid, profile, email, User.Read"
echo ""
echo "Press Enter when you have the Client ID and Secret..."
read

echo ""
read -p "Enter Client ID: " CLIENT_ID
read -s -p "Enter Client Secret: " CLIENT_SECRET
echo ""

# Update Grafana
echo "Updating Grafana configuration..."
cat > /tmp/grafana-update.sh << EOF
docker stop grafana
docker rm grafana
docker run -d \\
  --name grafana \\
  -p 3000:3000 \\
  -e GF_SECURITY_ADMIN_USER=admin \\
  -e GF_SECURITY_ADMIN_PASSWORD=Tenchi01! \\
  -e GF_SERVER_ROOT_URL=http://grafana.shaunjackson.space \\
  -e GF_AUTH_GENERIC_OAUTH_ENABLED=true \\
  -e GF_AUTH_GENERIC_OAUTH_NAME=Microsoft \\
  -e GF_AUTH_GENERIC_OAUTH_ALLOW_SIGN_UP=true \\
  -e GF_AUTH_GENERIC_OAUTH_CLIENT_ID=$CLIENT_ID \\
  -e GF_AUTH_GENERIC_OAUTH_CLIENT_SECRET=$CLIENT_SECRET \\
  -e GF_AUTH_GENERIC_OAUTH_SCOPES="openid email profile" \\
  -e GF_AUTH_GENERIC_OAUTH_AUTH_URL=https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize \\
  -e GF_AUTH_GENERIC_OAUTH_TOKEN_URL=https://login.microsoftonline.com/consumers/oauth2/v2.0/token \\
  -e GF_AUTH_GENERIC_OAUTH_API_URL=https://graph.microsoft.com/v1.0/me \\
  -e GF_AUTH_GENERIC_OAUTH_EMAIL_ATTRIBUTE_PATH=mail \\
  -e 'GF_AUTH_GENERIC_OAUTH_ROLE_ATTRIBUTE_PATH=mail=="washyu@hotmail.com" && "Admin" || "Viewer"' \\
  -v grafana-data:/var/lib/grafana \\
  grafana/grafana:latest
EOF

echo ""
echo "Ready to update Grafana? (y/n)"
read -r response
if [[ "$response" == "y" ]]; then
    ssh shaun@homelab2 'bash -s' < /tmp/grafana-update.sh
    echo "Grafana updated!"
fi

echo ""
echo "=== Next Steps ==="
echo "1. Test Grafana: http://grafana.shaunjackson.space"
echo "2. Click 'Sign in with Microsoft'"
echo "3. If it works, stop Keycloak:"
echo "   docker stop keycloak-simple"
echo "   docker rm keycloak-simple"
echo ""
echo "For Portainer OAuth setup:"
echo "- Go to Settings → Authentication → OAuth → Custom"
echo "- Use the same Client ID and Secret"
echo "- Auth URL: https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize"
echo "- Token URL: https://login.microsoftonline.com/consumers/oauth2/v2.0/token"
echo "- Resource URL: https://graph.microsoft.com/v1.0/me"
echo "- User ID: mail"
echo "- Scopes: openid email profile"