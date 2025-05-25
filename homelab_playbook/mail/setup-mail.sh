#!/bin/bash

# Simple Mail Server Setup for shaunjackson.space

echo "Setting up Poste.io mail server..."

# Deploy Poste.io - a complete mail server with webmail
docker run -d \
  --name=poste \
  --restart=unless-stopped \
  -p 8085:80 \
  -p 25:25 \
  -p 587:587 \
  -p 993:993 \
  -p 4190:4190 \
  -e TZ=America/New_York \
  -v /opt/poste/data:/data \
  -h mail.shaunjackson.space \
  analogic/poste.io

echo "Mail server deployed!"
echo ""
echo "=== Setup Instructions ==="
echo ""
echo "1. Access Poste.io admin at: http://192.168.10.108:8085"
echo "2. Initial setup:"
echo "   - Domain: shaunjackson.space"
echo "   - Admin email: admin@shaunjackson.space"
echo "   - Choose a strong password"
echo ""
echo "3. DNS Records to add:"
echo "   A     mail    → 68.111.95.149"
echo "   MX    @       → mail.shaunjackson.space (priority 10)"
echo "   TXT   @       → \"v=spf1 mx a ~all\""
echo ""
echo "4. Router port forwarding:"
echo "   - Port 25 (SMTP) → 192.168.10.108"
echo "   - Port 587 (Submission) → 192.168.10.108"
echo "   - Port 993 (IMAPS) → 192.168.10.108"
echo ""
echo "5. NPM Proxy Host:"
echo "   - Domain: mail.shaunjackson.space"
echo "   - Forward to: 192.168.10.108:8085"
echo "   - Enable SSL"
echo ""
echo "6. After DNS propagates, you can:"
echo "   - Send/receive emails"
echo "   - Access webmail at https://mail.shaunjackson.space"
echo "   - Use any email client with IMAP/SMTP"