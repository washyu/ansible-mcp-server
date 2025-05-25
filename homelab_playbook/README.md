# Homelab Playbook Organization

This directory contains all homelab infrastructure configuration files organized by service.

## Directory Structure

- **dns/** - DNS and domain management configurations
  - CloudDNS setup and Docker configurations
  - DuckDNS configuration
  - GoDaddy zone files
  - Cloudflare DNS setup

- **nextcloud/** - Nextcloud deployment configurations
  - Various deployment methods (VM, Docker, Proxmox)
  - OAuth configuration
  - Setup scripts

- **mail/** - Mail server configurations
  - Deployment playbooks
  - Setup guides

- **sso/** - Single Sign-On and OAuth configurations
  - Keycloak setup
  - Microsoft OAuth integration
  - Grafana OAuth
  - Proxmox SSO

- **infrastructure/** - Core infrastructure configurations
  - Network routing and port forwarding
  - Nginx Proxy Manager
  - SSL certificates
  - Static IP migration
  - Ansible vault setup

- **monitoring/** - Monitoring and status checking
  - Prometheus configuration
  - Web service checks
  - Status website creation
  - SSL service testing

- **storage/** - Storage configuration documentation
  - TrueNAS alternatives
  - SAS drives decisions
  - SSH setup

- **docs/** - General documentation
  - Infrastructure status reports
  - Setup guides
  - Action plans
  - Password checklists