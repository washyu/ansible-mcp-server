# Create All OAuth Clients in Keycloak

## Create These Clients (one by one):

### 1. Portainer Client
- Client ID: `portainer`
- Name: `Portainer`
- Client authentication: ON
- Valid redirect URIs:
  - `http://192.168.10.108:9000/*`
  - `https://portainer.shaunjackson.space/*`

### 2. Proxmox Client
- Client ID: `proxmox`
- Name: `Proxmox VE`
- Client authentication: ON
- Valid redirect URIs:
  - `https://192.168.10.20:8006/*`
  - `https://proxmox.shaunjackson.space/*`

### 3. NPM Client (if supported)
- Client ID: `nginx-proxy-manager`
- Name: `Nginx Proxy Manager`
- Client authentication: ON
- Valid redirect URIs:
  - `http://192.168.10.108:81/*`
  - `https://npm.shaunjackson.space/*`

### 4. TrueNAS Client (if supported)
- Client ID: `truenas`
- Name: `TrueNAS SCALE`
- Client authentication: ON
- Valid redirect URIs:
  - `http://192.168.10.30/*`
  - `https://truenas.shaunjackson.space/*`

## After Creating Each Client:
1. Go to Credentials tab
2. Copy the Client Secret
3. We'll configure the service with that secret

## Services We'll Configure:
✅ Grafana (done)
🔄 Portainer (next)
🔄 Proxmox (command line setup)
❓ NPM (check if version supports OAuth)
❓ TrueNAS (OIDC support varies)