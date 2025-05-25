# Moving Nextcloud to Proxmox

## Current Setup
- Nextcloud running on test-server (not ideal)
- Should be on Proxmox (192.168.10.200)
- Proxmox credentials: root / Tenchi01!

## Options for Proxmox:

### Option 1: LXC Container (Recommended)
- Lightweight, fast
- Easy backup/snapshot
- Less resource usage than VM

### Option 2: Docker in LXC
- Run Docker inside LXC container
- Best of both worlds

### Option 3: Direct on Proxmox
- Not recommended (breaks Proxmox)

## Steps to Move:

1. **Stop Nextcloud on test-server**
```bash
cd ~/
docker-compose -f nextcloud-oauth-docker.yml down
```

2. **Create LXC on Proxmox**
- Use Proxmox web UI: https://192.168.10.200:8006
- Create Ubuntu 22.04 LXC
- 4GB RAM, 100GB disk
- Mount your 12TB drive

3. **Install Docker in LXC**
```bash
# In LXC container
curl -fsSL https://get.docker.com | sh
```

4. **Deploy Nextcloud**
- Copy docker-compose.yml
- Point to 12TB storage
- Start services

## Access Proxmox:
- Web UI: https://192.168.10.200:8006
- Login: root / Tenchi01!
- Create container from template

Would you like me to:
1. Create an Ansible playbook for this?
2. Guide you through the Proxmox UI?
3. Keep it on test-server for now?