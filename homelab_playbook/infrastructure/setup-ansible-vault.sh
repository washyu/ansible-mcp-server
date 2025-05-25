#!/bin/bash

echo "Setting up Ansible Vault for password management..."

cd /home/shaun/ansible

# Create vault file
cat > vault.yml << 'EOF'
---
# Ansible Vault - Encrypted Passwords
# Edit with: ansible-vault edit vault.yml

# Service Passwords
vault_npm_admin_password: "ChangeMe123!"
vault_keycloak_admin_password: "ChangeMe123!"
vault_grafana_admin_password: "ChangeMe123!"
vault_portainer_admin_password: "ChangeMe123!"
vault_mail_admin_password: "ChangeMe123!"

# Database Passwords
vault_postgres_password: "KeycloakDB123!"

# System Passwords
vault_sudo_password: "your_sudo_password"

# Email Settings
vault_smtp_password: ""
vault_mail_domain: "shaunjackson.space"
EOF

echo "Encrypting vault file..."
echo "Choose a strong vault password!"
ansible-vault encrypt vault.yml

echo ""
echo "Vault created! To edit passwords:"
echo "  ansible-vault edit vault.yml"
echo ""
echo "To use in playbooks:"
echo "  ansible-playbook playbook.yml --ask-vault-pass"
echo "Or create .vault_pass file with password and use:"
echo "  ansible-playbook playbook.yml --vault-password-file .vault_pass"