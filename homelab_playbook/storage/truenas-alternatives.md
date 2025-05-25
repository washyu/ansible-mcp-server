# TrueNAS Alternatives with OAuth Support

## Current Setup Analysis
- **TrueNAS**: Enterprise-grade, but no OAuth support
- **Your needs**: Mainly Nextcloud, which DOES support Microsoft OAuth
- **Hardware**: 12TB HDD + potential SAS drives

## Option 1: Nextcloud on Proxmox (Recommended)
**Pros:**
- ✅ Full Microsoft OAuth/SSO support
- ✅ Can use your 12TB HDD directly
- ✅ More features than just storage (Office, Calendar, etc.)
- ✅ Mobile apps with SSO
- ✅ Can run in LXC container (lightweight)

**Setup:**
```bash
# Create LXC container on Proxmox
# Mount 12TB drive directly to container
# Install Nextcloud with OAuth
```

## Option 2: Seafile Pro (Community Edition)
**Pros:**
- ✅ OAuth/SAML support
- ✅ Faster than Nextcloud
- ✅ Better for pure file storage
- ✅ Mobile sync

**Cons:**
- ❌ Less features than Nextcloud
- ❌ OAuth in Pro version (but Community Edition is free)

## Option 3: MinIO Object Storage
**Pros:**
- ✅ S3-compatible
- ✅ OAuth/OpenID support
- ✅ Great for backups/archives
- ✅ Kubernetes-ready

**Cons:**
- ❌ Not a traditional file server
- ❌ Different use case

## Option 4: Keep TrueNAS + Add OAuth Proxy
Use Authelia or Authentik in front of TrueNAS:
- ✅ Adds SSO to any service
- ✅ Keep TrueNAS features
- ❌ More complex setup

## Hardware Considerations

### AM4 Board PCIe Slots:
- 2x MI50s using x16 slots
- Remaining slots: Usually x1 or x4
- SAS HBA needs x8 minimum (won't fit)

### Better Option:
1. **Pass through 12TB to Proxmox VM/LXC**
2. **Use Proxmox ZFS** for redundancy if needed
3. **USB 3.0 external enclosure** for SAS drives

## Recommendation: Replace TrueNAS with Nextcloud

### Why:
1. **OAuth/SSO**: Works with Microsoft accounts
2. **Features**: Calendar, contacts, office suite
3. **Simplicity**: One less system to manage
4. **Resource efficient**: LXC uses less RAM than TrueNAS
5. **Direct storage**: No iSCSI/NFS overhead

### Nextcloud with Microsoft OAuth:
```yaml
# docker-compose.yml
version: '3'
services:
  nextcloud:
    image: nextcloud:latest
    environment:
      - NEXTCLOUD_TRUSTED_DOMAINS=nextcloud.shaunjackson.space
      - OIDC_CLIENT_ID=<your-ms-client-id>
      - OIDC_CLIENT_SECRET=<your-ms-secret>
      - OIDC_PROVIDER_URL=https://login.microsoftonline.com/consumers/v2.0
    volumes:
      - /mnt/12tb-drive:/var/www/html/data
```

### Quick Migration Path:
1. Backup any data on TrueNAS
2. Create Nextcloud on Proxmox
3. Mount 12TB drive
4. Configure Microsoft OAuth
5. Migrate data
6. Shut down TrueNAS
7. Reclaim those resources!

## Do You Even Need NAS?
Ask yourself:
- **File sharing**: Nextcloud handles this
- **Backups**: Proxmox Backup Server is better
- **Media**: Jellyfin/Plex can use local storage
- **VMs/Containers**: Proxmox local storage works

**Verdict**: For most homelabs, Nextcloud + Proxmox storage is enough!