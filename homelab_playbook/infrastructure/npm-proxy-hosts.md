# Nginx Proxy Manager - Proxy Host Configuration

## Add these proxy hosts with SSL:

| Domain | Forward IP | Forward Port | Service |
|--------|------------|--------------|---------|
| heimdall.shaunjackson.space | 192.168.10.20 | 8888 | Heimdall Dashboard |
| auth.shaunjackson.space | 192.168.10.20 | 8090 | Keycloak |
| grafana.shaunjackson.space | 192.168.10.20 | 3000 | Grafana |
| portainer.shaunjackson.space | 192.168.10.164 | 9443 | Portainer (TrueNAS) |
| proxmox.shaunjackson.space | 192.168.10.200 | 8006 | Proxmox |
| truenas.shaunjackson.space | 192.168.10.164 | 443 | TrueNAS |
| mail.shaunjackson.space | 192.168.10.20 | 8085 | Poste.io |
| webmail.shaunjackson.space | 192.168.10.20 | 8085 | Poste.io Webmail |

## For each host:
1. Click "Add Proxy Host"
2. Details tab:
   - Domain Names: [enter domain]
   - Forward Hostname/IP: [enter IP]
   - Forward Port: [enter port]
   - Enable "Block Common Exploits"
   - Enable "Websockets Support" (for Portainer/Proxmox)
3. SSL tab:
   - SSL Certificate: "Request a new SSL Certificate"
   - Enable "Force SSL"
   - Email: admin@shaunjackson.space
   - Agree to Terms
4. Save

## Special configurations:

### Proxmox (needs custom location):
In Advanced tab, add:
```
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
```

### Portainer (if using HTTPS):
- Use scheme: https
- Forward Port: 9443

## Microsoft OAuth Alternative:
After SSL setup, we can replace Keycloak with:
- Azure AD B2C (free tier)
- Microsoft Account integration
- Supports personal Microsoft accounts (washyu@hotmail.com)
- Can integrate with most services via OIDC/OAuth2