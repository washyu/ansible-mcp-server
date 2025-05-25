#!/bin/bash
# Setup acme.sh with Cloudflare DNS validation

# Install acme.sh on homelab2
ssh shaun@homelab2 << 'EOF'
# Download and install acme.sh
curl https://get.acme.sh | sh -s email=admin@shaunjackson.space

# Set Cloudflare credentials
export CF_Token="ZK_j2dkVJ9b2PdSEypT6m3_edXsQp0_3i9PZV0ea"

# Save credentials for future use
echo 'export CF_Token="ZK_j2dkVJ9b2PdSEypT6m3_edXsQp0_3i9PZV0ea"' >> ~/.bashrc

# Create certificate directory
sudo mkdir -p /etc/ssl/certificates

# Function to get certificates
get_certs() {
    ~/.acme.sh/acme.sh --issue \
        -d shaunjackson.space \
        -d "*.shaunjackson.space" \
        --dns dns_cf \
        --keylength 2048
        
    # Install certificates to a location NPM can access
    ~/.acme.sh/acme.sh --install-cert \
        -d shaunjackson.space \
        --key-file /etc/ssl/certificates/shaunjackson.space.key \
        --fullchain-file /etc/ssl/certificates/shaunjackson.space.crt \
        --reloadcmd "docker restart nginx-proxy-manager"
}

echo "Run 'get_certs' after adding domain to Cloudflare"
EOF