# SAS Drives Decision Tree

## Current Situation
- 3x 4TB SAS drives = 12TB raw
- Nextcloud now running on homelab2
- TrueNAS still has the SAS drives

## Quick Decision: Keep or Toss?

### Check 1: How much data do you actually have?
```bash
# Check TrueNAS usage
http://192.168.10.164
# or SSH: df -h
```

### Check 2: Power consumption
- TrueNAS server: ~100-150W idle
- = $10-15/month electricity
- = $120-180/year

### My Recommendation: Sell/Repurpose

**Why:**
1. **SAS drives are old tech** - 4TB SAS drives are 7+ years old
2. **Power hungry** - Use more power than modern drives
3. **You have 12TB SATA** - Already enough for most use
4. **Cloud backup** - Better to backup critical data to cloud

**Options:**
1. **Sell the drives** - $30-50 each on eBay
2. **Keep one for backups** - USB enclosure for occasional use
3. **Donate to makerspace** - Tax write-off

**Convert TrueNAS box to:**
- Proxmox backup server
- Kubernetes node
- AI/ML workstation
- Sell it

## Migration Steps This Weekend:

1. **Check TrueNAS data:**
```bash
# What's actually on there?
ssh truenas_admin@192.168.10.164
df -h
ls /mnt/pool/
```

2. **Migrate important data to Nextcloud**

3. **Shut down TrueNAS**

4. **Monitor for 2 weeks**
   - If you don't miss it, sell/repurpose
   - If you need more storage, add to Proxmox

Remember: Most homelabbers use <10% of their storage!