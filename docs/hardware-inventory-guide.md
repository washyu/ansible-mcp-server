# Hardware Inventory Guide

The MCP server now includes comprehensive hardware discovery tools that can scan systems and maintain a hardware inventory database.

## Available Hardware Tools

### 1. Hardware Scan
Comprehensive scan of system hardware:

```bash
# Scan local system
claude "Run hardware scan"

# Scan remote system
claude "Scan hardware on test-server"

# Scan specific categories
claude "Scan CPU and memory on YOUR_TEST_SERVER_IP"

# Save to inventory
claude "Scan hardware on all servers and save to inventory"
```

### 2. Storage Analysis
Detailed storage information including SMART health:

```bash
# Basic storage info
claude "Analyze storage on test-server"

# Include SMART data
claude "Check disk health with SMART data on server1"
```

### 3. Network Interfaces
Network adapter information:

```bash
# Physical interfaces only
claude "Show network interfaces on test-server"

# Include virtual interfaces
claude "Show all network interfaces including virtual"
```

### 4. GPU Detection
Find and analyze GPUs:

```bash
# Detect GPUs
claude "Detect GPUs on workstation1"

# Include driver info
claude "Show GPU details with drivers"
```

### 5. Hardware Inventory Management
Maintain a database of hardware across your infrastructure:

```bash
# List inventory
claude "Show hardware inventory"

# Add/update entry
claude "Update hardware inventory for server1"

# Remove entry
claude "Remove old-server from hardware inventory"
```

### 6. Hardware Benchmarks
Basic performance testing:

```bash
# CPU benchmark
claude "Run CPU benchmark for 30 seconds"

# Multiple tests
claude "Run CPU, memory and disk benchmarks"
```

## Hardware Scan Output Example

```json
{
  "system": {
    "hostname": "test-server",
    "os": "Ubuntu 22.04.3 LTS",
    "kernel": "5.15.0-89-generic",
    "manufacturer": "Dell Inc.",
    "model": "PowerEdge R720"
  },
  "cpu": {
    "model": "Intel(R) Xeon(R) CPU E5-2650 v2 @ 2.60GHz",
    "totalCores": 32,
    "threadsPerCore": 2,
    "architecture": "x86_64",
    "currentUsage": 15.2,
    "currentFreqMHz": 2594.123
  },
  "memory": {
    "totalGB": "128.00",
    "usedGB": "45.67",
    "freeGB": "82.33",
    "usagePercent": "35.7"
  },
  "storage": {
    "disks": [
      {
        "name": "sda",
        "sizeGB": "931.51",
        "model": "SAMSUNG MZ7LM960"
      },
      {
        "name": "sdb",
        "sizeGB": "3726.02",
        "model": "HGST HUS726040AL"
      }
    ],
    "filesystems": [
      {
        "filesystem": "/dev/sda2",
        "mountpoint": "/",
        "usagePercent": "45%"
      }
    ]
  },
  "gpu": [
    {
      "vendor": "NVIDIA",
      "name": "Tesla P40",
      "memoryMB": 24576,
      "driverVersion": "535.129.03"
    }
  ]
}
```

## Integration with Ansible

The hardware inventory can be used to:

1. **Generate Ansible host variables**:
   ```yaml
   test-server:
     ansible_host: YOUR_TEST_SERVER_IP
     hardware_cpu_cores: 32
     hardware_memory_gb: 128
     hardware_gpu_present: true
   ```

2. **Create dynamic groups**:
   ```yaml
   gpu_servers:
     hosts:
       test-server:
       workstation1:
   
   high_memory_servers:
     hosts:
       test-server:
       database1:
   ```

3. **Deployment decisions**:
   - Deploy GPU-accelerated services only to servers with GPUs
   - Adjust service configurations based on available memory
   - Choose appropriate storage locations based on disk space

## Automation Examples

### Scan all servers and update inventory
```bash
claude "For each server in the Ansible inventory, run a hardware scan and save to the hardware inventory"
```

### Find servers suitable for a service
```bash
claude "Find all servers with at least 16GB RAM and 100GB free disk space"
```

### Monitor hardware changes
```bash
claude "Compare current hardware scan of test-server with the inventory and report any changes"
```

## Future Enhancements

### Windows Support (Planned)
- WMI-based hardware discovery
- PowerShell remoting integration
- Windows-specific hardware details

### macOS Support (Planned)
- System profiler integration
- Hardware serial numbers
- Apple-specific hardware info

### Additional Features
- Temperature monitoring
- Power consumption tracking
- Hardware failure prediction
- Automated capacity planning