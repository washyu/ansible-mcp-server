#!/bin/bash

echo "🔍 Checking All Homelab Services Status"
echo "======================================="
echo ""

# Check each service
services=(
    "Nginx Proxy Manager|http://192.168.10.108:81|NPM Admin Panel"
    "Status Website|http://192.168.10.108:8888|Homelab Dashboard"
    "Keycloak|http://192.168.10.108:8090|SSO Authentication"
    "Heimdall|http://192.168.10.108:8080|Service Dashboard"
    "Grafana|http://192.168.10.108:3000|Monitoring"
    "Portainer|http://192.168.10.108:9000|Docker Management"
    "Pi-hole|http://192.168.10.1:80/admin|DNS Management"
    "Proxmox|https://192.168.10.20:8006|Virtualization"
    "TrueNAS|http://192.168.10.30|Storage"
)

for service in "${services[@]}"; do
    IFS='|' read -r name url description <<< "$service"
    
    # Check if service is reachable
    if curl -s -o /dev/null -w "%{http_code}" --connect-timeout 2 "$url" | grep -qE "200|301|302|401|403"; then
        echo "✅ $name - $description"
        echo "   URL: $url"
    else
        echo "❌ $name - $description"
        echo "   URL: $url (Not responding)"
    fi
    echo ""
done

echo ""
echo "📋 Next Steps:"
echo "1. Configure router port forwarding (80, 443 → 192.168.10.108)"
echo "2. Add DNS records for *.shaunjackson.space"
echo "3. Login to NPM at http://192.168.10.108:81"
echo "4. Change default passwords!"
echo ""
echo "📖 Full guide at: /home/shaun/ansible-mcp-server/complete-setup-guide.md"