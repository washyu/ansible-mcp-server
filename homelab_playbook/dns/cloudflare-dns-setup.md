# Cloudflare DNS Setup for SSL Certificates

## Why Cloudflare?
- Free DNS service
- Supports DNS-01 validation (no port 80 needed)
- Works with NPM for automatic SSL certificates
- Can keep using GoDaddy as registrar

## Setup Steps:

### 1. Create Cloudflare Account
- Go to https://www.cloudflare.com
- Sign up for free account
- Add your domain: userjackson.space

### 2. Update Nameservers at GoDaddy
- Login to GoDaddy
- Go to Domain Settings
- Change nameservers to Cloudflare's (they'll provide these)
- Example: 
  - ns1.cloudflare.com
  - ns2.cloudflare.com

### 3. Configure DNS Records in Cloudflare
Add these records (with proxy DISABLED - grey cloud):
```
Type    Name        Content                         Proxy
CNAME   @           washyushomelab.ip-ddns.com     No (DNS only)
CNAME   www         washyushomelab.ip-ddns.com     No (DNS only)
CNAME   heimdall    washyushomelab.ip-ddns.com     No (DNS only)
CNAME   auth        washyushomelab.ip-ddns.com     No (DNS only)
CNAME   grafana     washyushomelab.ip-ddns.com     No (DNS only)
CNAME   mail        washyushomelab.ip-ddns.com     No (DNS only)
CNAME   webmail     washyushomelab.ip-ddns.com     No (DNS only)
CNAME   portainer   washyushomelab.ip-ddns.com     No (DNS only)
CNAME   proxmox     washyushomelab.ip-ddns.com     No (DNS only)
CNAME   truenas     washyushomelab.ip-ddns.com     No (DNS only)
MX      @           mail.userjackson.space        10
TXT     @           "v=spf1 mx a ~all"
```

### 4. Get Cloudflare API Token
- Go to My Profile → API Tokens
- Create Token → Edit zone DNS
- Permissions:
  - Zone → DNS → Edit
  - Zone → Zone → Read
- Zone Resources: Include → Specific zone → userjackson.space

### 5. Configure NPM with Cloudflare
In NPM SSL settings, you can use:
- DNS Challenge
- Provider: Cloudflare
- API Token: (paste your token)

## Alternative: Use acme.sh
If NPM doesn't support Cloudflare directly, use acme.sh:

```bash
# Install acme.sh
curl https://get.acme.sh | sh

# Set Cloudflare credentials
export CF_Token="your-api-token"
export CF_Zone_ID="your-zone-id"

# Get certificate
~/.acme.sh/acme.sh --issue -d userjackson.space -d "*.userjackson.space" --dns dns_cf

# Certificate files will be in:
# ~/.acme.sh/userjackson.space/
```

## Benefits:
- No port 80/443 needed for validation
- Can get wildcard certificates (*.userjackson.space)
- Works behind CGNAT or blocked ports
- Free SSL certificates
- Automatic renewal