# GoDaddy DNS Changes for userjackson.space

## Records to Add (if zone file import fails)

### Email Records:
1. **MX Record**
   - Type: MX
   - Name: @
   - Value: mail.userjackson.space
   - Priority: 10
   - TTL: 1 Hour

2. **SPF Record**
   - Type: TXT
   - Name: @
   - Value: v=spf1 mx a ~all
   - TTL: 1 Hour

### Service Records (CNAME):
Add these one by one:

| Type | Name | Value | TTL |
|------|------|-------|-----|
| CNAME | mail | sideboard.asuscomm.com | 1 Hour |
| CNAME | heimdall | sideboard.asuscomm.com | 1 Hour |
| CNAME | grafana | sideboard.asuscomm.com | 1 Hour |
| CNAME | portainer | sideboard.asuscomm.com | 1 Hour |
| CNAME | proxmox | sideboard.asuscomm.com | 1 Hour |
| CNAME | truenas | sideboard.asuscomm.com | 1 Hour |
| CNAME | pihole | sideboard.asuscomm.com | 1 Hour |
| CNAME | auth | sideboard.asuscomm.com | 1 Hour |
| CNAME | npm | sideboard.asuscomm.com | 1 Hour |
| CNAME | webmail | sideboard.asuscomm.com | 1 Hour |

## How to Import Zone File in GoDaddy:

1. Go to your domain management
2. Click on DNS
3. Look for "Import Zone File" or "Advanced Features"
4. Upload the zone file

OR

## How to Add Manually:

1. Go to DNS management
2. For each record above:
   - Click "Add"
   - Select the Type
   - Enter the Name (subdomain)
   - Enter the Value
   - Set TTL to 1 Hour
   - Save

## After Adding:
- DNS propagation takes 5-30 minutes
- Test with: `nslookup mail.userjackson.space`
- Should resolve to your current IP via sideboard.asuscomm.com