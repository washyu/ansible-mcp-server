#!/bin/bash
# Manual SSL certificate generation for NPM

# Run this on homelab2
docker run -it --rm \
  -v /etc/letsencrypt:/etc/letsencrypt \
  -v /var/lib/letsencrypt:/var/lib/letsencrypt \
  -p 80:80 \
  certbot/certbot certonly \
  --standalone \
  --email admin@shaunjackson.space \
  --agree-tos \
  --no-eff-email \
  -d heimdall.shaunjackson.space \
  -d auth.shaunjackson.space \
  -d grafana.shaunjackson.space \
  -d mail.shaunjackson.space \
  -d webmail.shaunjackson.space \
  -d www.shaunjackson.space

# Then in NPM, use "Custom SSL Certificate" and point to:
# Certificate: /etc/letsencrypt/live/heimdall.shaunjackson.space/fullchain.pem
# Private Key: /etc/letsencrypt/live/heimdall.shaunjackson.space/privkey.pem