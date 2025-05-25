#!/bin/bash
# ClouDNS DDNS Update Script for washyushomelab.ip-ddns.com

# Your ClouDNS update URL
UPDATE_URL="https://ipv4.cloudns.net/api/dynamicURL/?q=OTQ2OTU4OTo2MDQwMjcyOTk6ODZhN2RhNmYzNTQ1NDIwMzY0ZTA0NzMzYjVkZWFkMThkNTNhNzUwMmQ5NzZjNTg4YWJkY2E4NDQzZDhiMDc1Ng"

# Update the IP
RESPONSE=$(curl -s "$UPDATE_URL")

# Log the update
echo "$(date): Response=${RESPONSE}" >> /var/log/cloudns-update.log

if [[ "$RESPONSE" == *"OK"* ]] || [[ "$RESPONSE" == *"Success"* ]]; then
    echo "Successfully updated washyushomelab.ip-ddns.com"
else
    echo "Update response: ${RESPONSE}"
fi