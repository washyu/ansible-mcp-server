#!/bin/bash
# ClouDNS.net DDNS Update Script
# This script updates your ClouDNS subdomain with your current public IP

# CONFIGURATION - Replace these values
CLOUDNS_SUBDOMAIN="YOUR_SUBDOMAIN"     # e.g., "homelab" for homelab.cloudns.net
CLOUDNS_AUTH_ID="YOUR_AUTH_ID"         # Your ClouDNS auth ID
CLOUDNS_AUTH_PASSWORD="YOUR_PASSWORD"   # Your ClouDNS auth password

# ClouDNS API endpoint
API_URL="https://api.cloudns.net/dns/dyndns.php"

# Get current public IP
CURRENT_IP=$(curl -s https://ipv4.icanhazip.com)

if [ -z "$CURRENT_IP" ]; then
    echo "Failed to get current IP"
    exit 1
fi

# Update ClouDNS
RESPONSE=$(curl -s "${API_URL}?id=${CLOUDNS_AUTH_ID}&password=${CLOUDNS_AUTH_PASSWORD}&host=${CLOUDNS_SUBDOMAIN}")

# Log the update
echo "$(date): IP=${CURRENT_IP} Response=${RESPONSE}" >> /var/log/cloudns-ddns.log

if [[ "$RESPONSE" == *"OK"* ]]; then
    echo "Successfully updated ${CLOUDNS_SUBDOMAIN}.cloudns.net to ${CURRENT_IP}"
else
    echo "Update failed: ${RESPONSE}"
    exit 1
fi