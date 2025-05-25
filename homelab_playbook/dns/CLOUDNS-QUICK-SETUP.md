# ClouDNS Quick Setup Guide

## 1. Sign up at ClouDNS.net
- Go to https://www.cloudns.net
- Create a free account
- Verify your email

## 2. Create Your Free DNS Zone
- Login to ClouDNS
- Go to "DNS Hosting" → "Free zones"
- Choose a free domain like:
  - `yourname.cloudns.net`
  - `yourname.cloudns.ph`
  - `yourname.cloudns.be`
  - `yourname.cloudns.cl`
- Create the zone

## 3. Get API Credentials
- Go to "API" → "API settings"
- Enable API access
- Note your auth-id (usually your email)
- Set an API password

## 4. Deploy on test-server
```bash
cd /home/user/ansible-mcp-server

# Edit the docker-compose file
nano cloudns-docker-compose.yml

# Update these values:
# - CLOUDNS_SUBDOMAIN=yourname (without .cloudns.net)
# - CLOUDNS_AUTH_ID=your-email@example.com
# - CLOUDNS_AUTH_PASSWORD=your-api-password

# Start the service
docker-compose -f cloudns-docker-compose.yml up -d

# Check logs
docker-compose -f cloudns-docker-compose.yml logs -f
```

## 5. Update GoDaddy DNS
Replace all your CNAME records to point to your ClouDNS domain:

| Record | Type | Points to |
|--------|------|-----------|
| www | CNAME | yourname.cloudns.net |
| mail | CNAME | yourname.cloudns.net |
| heimdall | CNAME | yourname.cloudns.net |
| grafana | CNAME | yourname.cloudns.net |
| portainer | CNAME | yourname.cloudns.net |
| proxmox | CNAME | yourname.cloudns.net |
| truenas | CNAME | yourname.cloudns.net |
| pihole | CNAME | yourname.cloudns.net |
| auth | CNAME | yourname.cloudns.net |
| npm | CNAME | yourname.cloudns.net |
| webmail | CNAME | yourname.cloudns.net |

## 6. Test Your Setup
```bash
# Check if DDNS is updating
tail -f ./cloudns-logs/cloudns-ddns.log

# Verify DNS resolution
dig yourname.cloudns.net

# Test a service
curl -I https://www.userjackson.space
```

## Why ClouDNS?
- Free tier includes DDNS API
- Reliable and actively maintained
- Updates with your actual WAN IP
- Works with dynamic IPs
- No proxy/redirect like ASUS DDNS