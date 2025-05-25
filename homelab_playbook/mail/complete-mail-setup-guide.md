# Complete Mail Server Setup Guide

## ✅ Mail Server Deployed!

Poste.io mail server is now running on your homelab with:
- Full email server (SMTP/IMAP)
- Webmail interface
- Admin panel
- Anti-spam features
- Multiple domain support

## 📧 Initial Setup (Do This Now!)

### 1. Access Poste.io Admin Panel
- **URL**: http://192.168.10.108:8085
- First time setup wizard will appear
- Configure:
  - **Primary Domain**: userjackson.space
  - **Admin Email**: admin@userjackson.space
  - **Admin Password**: (choose a strong one)
  - **Timezone**: America/New_York

### 2. DNS Records (Add These Immediately)

Login to your DNS provider and add:

```
Type    Name    Value                           Priority
A       mail    68.111.95.149                   -
MX      @       mail.userjackson.space         10
TXT     @       "v=spf1 mx a ~all"              -
```

Optional but recommended:
```
CNAME   webmail     mail.userjackson.space     -
CNAME   smtp        mail.userjackson.space     -
CNAME   imap        mail.userjackson.space     -
```

### 3. Router Port Forwarding

Add these port forwards to 192.168.10.108:
- **Port 25** - SMTP (receiving mail)
- **Port 587** - SMTP (sending mail)
- **Port 993** - IMAPS (secure IMAP)

### 4. NPM Proxy Configuration

Add this proxy host in Nginx Proxy Manager:
- **Domain**: mail.userjackson.space
- **Scheme**: http
- **Forward Host**: 192.168.10.108
- **Forward Port**: 8085
- **Enable**: SSL, Force SSL, HTTP/2, HSTS

Also add (optional):
- **Domain**: webmail.userjackson.space
- Same settings as above

## 📱 Email Client Configuration

After DNS propagates (5-30 minutes):

### Incoming Mail (IMAP)
- **Server**: mail.userjackson.space
- **Port**: 993
- **Security**: SSL/TLS
- **Username**: admin@userjackson.space
- **Password**: (what you set)

### Outgoing Mail (SMTP)
- **Server**: mail.userjackson.space
- **Port**: 587
- **Security**: STARTTLS
- **Username**: admin@userjackson.space
- **Password**: (what you set)

## 🔧 Advanced Configuration

### Add More Email Accounts
1. Login to Poste admin
2. Go to: Email Accounts → Create Account
3. Fill in details for new user

### Enable DKIM (Recommended)
1. In Poste admin: System Settings → DKIM
2. Enable DKIM
3. Copy the DKIM record
4. Add to DNS as TXT record:
   - Name: `mail._domainkey`
   - Value: (from Poste)

### Add DMARC Record
Add this TXT record for better deliverability:
- Name: `_dmarc`
- Value: `"v=DMARC1; p=quarantine; rua=mailto:admin@userjackson.space"`

### Configure Spam Filter
1. System Settings → Antispam
2. Adjust SpamAssassin settings
3. Enable/disable filters as needed

## 🧪 Testing Your Email

### 1. Internal Test
- Send email from admin@userjackson.space to itself
- Should arrive instantly

### 2. External Test
- Send to your Gmail/other email
- Check spam folder if not in inbox

### 3. Professional Test
- Send test email to: test@mail-tester.com
- Visit the URL they provide
- Aim for 8+ score

### 4. Check DNS
- Visit: mxtoolbox.com
- Test: "MX Lookup" for userjackson.space
- Should show mail.userjackson.space

## 🚨 Troubleshooting

### Can't receive emails
1. Check MX record is correct
2. Verify port 25 is forwarded
3. Check Poste logs: `docker logs poste`

### Can't send emails
1. Check port 587 is forwarded
2. Verify SPF record
3. May need to contact ISP if port 25 is blocked

### Emails going to spam
1. Add DKIM record
2. Add DMARC record
3. Ensure reverse DNS (PTR) is set (contact ISP)
4. Build sender reputation slowly

## 📊 Monitoring

Check mail server status:
```bash
docker logs poste --tail 50
docker exec poste postqueue -p  # Mail queue
```

## 🔐 Security Notes

1. Use strong passwords
2. Enable 2FA in Poste when available
3. Regular backups of /opt/poste/data
4. Monitor for unusual activity
5. Keep Poste updated

## 🎉 Success!

Once DNS propagates, you'll have:
- Professional email: admin@userjackson.space
- Webmail at: https://mail.userjackson.space
- Full IMAP/SMTP for any email client
- Unlimited email accounts for your domain

Congratulations on your complete homelab infrastructure!