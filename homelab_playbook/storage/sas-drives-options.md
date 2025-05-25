# Options for 3x 4TB SAS Drives

## Current Situation
- 3x 4TB SAS drives in TrueNAS box
- AM4 Proxmox server has PCIe slots occupied by MI50s
- Already have 12TB drive for main storage

## Option 1: USB 3.0 SAS Enclosure (Easiest)
**Hardware needed:** ~$150-200
- External SAS to USB 3.0 enclosure
- Example: StarTech.com 4-Bay enclosure
- Connect to Proxmox server via USB 3.0

**Pros:**
- ✅ Easy to move between systems
- ✅ No PCIe slots needed
- ✅ Can use with any system

**Cons:**
- ❌ USB 3.0 bottleneck (~500MB/s max)
- ❌ Additional cost

## Option 2: Convert TrueNAS Box to Backup Server
**Keep the hardware, change the OS:**
```bash
# Install Proxmox Backup Server (PBS) on TrueNAS hardware
# Use 3x 4TB in RAIDZ1 = 8TB usable backup space
```

**Pros:**
- ✅ Dedicated backup solution
- ✅ Keeps drives in current system
- ✅ Automated VM/container backups

**Cons:**
- ❌ Still managing another server

## Option 3: External NAS Box (Repurpose)
**Convert TrueNAS box to simple NAS:**
- Install lightweight OS (Debian/Ubuntu)
- Run Samba/NFS shares only
- Use for cold storage/archives

## Option 4: Sell/Store the Drives
**Reality check:**
- 4TB SAS drives are older/slower
- Worth ~$30-50 each used
- Power consumption vs. value

**Consider:**
- Do you need 12TB + 12TB = 24TB total?
- Backup needs covered by Proxmox snapshots?
- Cloud backup for critical data?

## Recommendation: Start Simple

### Phase 1: Deploy Nextcloud
1. Use your 12TB drive for Nextcloud
2. Shut down TrueNAS
3. Monitor actual storage usage

### Phase 2: Decide on SAS drives (in 30 days)
After seeing real usage:
- **< 4TB used**: Sell the SAS drives
- **> 4TB used**: USB enclosure for archives
- **Need backups**: Convert to PBS server

### Quick Math:
- TrueNAS box probably uses ~100W idle
- = ~$15/month electricity
- = $180/year
- Cloud storage 5TB = ~$25/month

## Migration Plan:

### This Weekend:
1. Check what's actually stored on TrueNAS
2. Deploy Nextcloud on Proxmox
3. Migrate important data
4. Power off TrueNAS

### Next Month:
- See if you miss TrueNAS
- Check Nextcloud storage growth
- Decide on SAS drives

Most homelabbers find they use way less storage than they think!