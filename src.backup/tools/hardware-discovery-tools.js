// Hardware discovery and inventory tools

import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { exec } from 'child_process';
import { promisify } from 'util';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

const execAsync = promisify(exec);

// Schemas
const HardwareScanSchema = z.object({
  target: z.string().optional().default('localhost').describe('Target host to scan'),
  categories: z.array(z.enum(['cpu', 'memory', 'storage', 'network', 'gpu', 'system'])).optional().describe('Hardware categories to scan'),
  format: z.enum(['summary', 'detailed', 'json']).optional().default('summary').describe('Output format'),
  saveToInventory: z.boolean().optional().default(false).describe('Save results to hardware inventory')
});

const StorageAnalysisSchema = z.object({
  target: z.string().optional().default('localhost').describe('Target host'),
  includePartitions: z.boolean().optional().default(true).describe('Include partition details'),
  includeSmartData: z.boolean().optional().default(false).describe('Include SMART health data')
});

const NetworkInterfacesSchema = z.object({
  target: z.string().optional().default('localhost').describe('Target host'),
  includeVirtual: z.boolean().optional().default(false).describe('Include virtual interfaces'),
  includeStats: z.boolean().optional().default(true).describe('Include interface statistics')
});

const GPUDetectionSchema = z.object({
  target: z.string().optional().default('localhost').describe('Target host'),
  includeDriverInfo: z.boolean().optional().default(true).describe('Include driver information')
});

const HardwareInventorySchema = z.object({
  action: z.enum(['list', 'add', 'update', 'remove']).describe('Inventory action'),
  hostname: z.string().optional().describe('Hostname for add/update/remove'),
  hardware: z.any().optional().describe('Hardware data for add/update')
});

const BenchmarkSchema = z.object({
  target: z.string().optional().default('localhost').describe('Target host'),
  tests: z.array(z.enum(['cpu', 'memory', 'disk', 'network'])).optional().default(['cpu']).describe('Benchmark tests to run'),
  duration: z.number().optional().default(10).describe('Test duration in seconds')
});

// Helper functions
async function executeRemoteCommand(target, command) {
  if (target === 'localhost') {
    return execAsync(command);
  } else {
    return execAsync(`ssh -o ConnectTimeout=5 ${target} '${command}'`);
  }
}

async function getCPUInfo(target) {
  try {
    const info = {};
    
    // Get CPU model and count
    const { stdout: cpuinfo } = await executeRemoteCommand(target, 
      'lscpu | grep -E "Model name:|Socket|Core|Thread|CPU\\(s\\):|Architecture:" || cat /proc/cpuinfo | grep -E "model name|processor" | sort -u'
    );
    
    const lines = cpuinfo.split('\n').filter(l => l.trim());
    lines.forEach(line => {
      if (line.includes('Model name:')) {
        info.model = line.split(':')[1].trim();
      } else if (line.includes('CPU(s):')) {
        info.totalCores = parseInt(line.split(':')[1].trim());
      } else if (line.includes('Thread(s) per core:')) {
        info.threadsPerCore = parseInt(line.split(':')[1].trim());
      } else if (line.includes('Architecture:')) {
        info.architecture = line.split(':')[1].trim();
      }
    });
    
    // Get CPU usage
    const { stdout: usage } = await executeRemoteCommand(target,
      'top -bn1 | grep "Cpu(s)" | sed "s/.*, *\\([0-9.]*\\)%* id.*/\\1/" | awk \'{print 100 - $1}\''
    );
    info.currentUsage = parseFloat(usage.trim()) || 0;
    
    // Get CPU frequency
    try {
      const { stdout: freq } = await executeRemoteCommand(target,
        'lscpu | grep "CPU MHz" || cat /proc/cpuinfo | grep "cpu MHz" | head -1'
      );
      if (freq.includes('MHz')) {
        info.currentFreqMHz = parseFloat(freq.split(':')[1].trim());
      }
    } catch {}
    
    return info;
  } catch (error) {
    return { error: error.message };
  }
}

async function getMemoryInfo(target) {
  try {
    const { stdout } = await executeRemoteCommand(target, 'free -b');
    const lines = stdout.split('\n');
    const memLine = lines.find(l => l.startsWith('Mem:'));
    
    if (memLine) {
      const parts = memLine.split(/\s+/);
      return {
        totalBytes: parseInt(parts[1]),
        totalGB: (parseInt(parts[1]) / 1024 / 1024 / 1024).toFixed(2),
        usedBytes: parseInt(parts[2]),
        usedGB: (parseInt(parts[2]) / 1024 / 1024 / 1024).toFixed(2),
        freeBytes: parseInt(parts[3]),
        freeGB: (parseInt(parts[3]) / 1024 / 1024 / 1024).toFixed(2),
        usagePercent: ((parseInt(parts[2]) / parseInt(parts[1])) * 100).toFixed(1)
      };
    }
    
    return { error: 'Could not parse memory info' };
  } catch (error) {
    return { error: error.message };
  }
}

async function getStorageInfo(target, includePartitions = true) {
  try {
    const info = { disks: [], partitions: [] };
    
    // Get block devices
    const { stdout: lsblk } = await executeRemoteCommand(target,
      'lsblk -b -o NAME,SIZE,TYPE,MOUNTPOINT,FSTYPE,MODEL -J 2>/dev/null || lsblk -b -o NAME,SIZE,TYPE,MOUNTPOINT,FSTYPE'
    );
    
    try {
      const data = JSON.parse(lsblk);
      if (data.blockdevices) {
        data.blockdevices.forEach(device => {
          if (device.type === 'disk') {
            info.disks.push({
              name: device.name,
              sizeBytes: device.size,
              sizeGB: (device.size / 1024 / 1024 / 1024).toFixed(2),
              model: device.model || 'Unknown'
            });
            
            if (includePartitions && device.children) {
              device.children.forEach(part => {
                if (part.type === 'part') {
                  info.partitions.push({
                    name: part.name,
                    disk: device.name,
                    sizeBytes: part.size,
                    sizeGB: (part.size / 1024 / 1024 / 1024).toFixed(2),
                    mountpoint: part.mountpoint,
                    filesystem: part.fstype
                  });
                }
              });
            }
          }
        });
      }
    } catch {
      // Fallback parsing for non-JSON output
      const lines = lsblk.split('\n').filter(l => l.trim());
      lines.forEach(line => {
        if (line.includes('disk')) {
          const parts = line.split(/\s+/);
          info.disks.push({
            name: parts[0],
            sizeBytes: parseInt(parts[1]),
            sizeGB: (parseInt(parts[1]) / 1024 / 1024 / 1024).toFixed(2)
          });
        }
      });
    }
    
    // Get filesystem usage
    const { stdout: df } = await executeRemoteCommand(target, 'df -B1');
    const dfLines = df.split('\n').slice(1).filter(l => l.trim());
    
    info.filesystems = [];
    dfLines.forEach(line => {
      const parts = line.split(/\s+/);
      if (parts.length >= 6 && !parts[0].includes('tmpfs')) {
        info.filesystems.push({
          filesystem: parts[0],
          sizeBytes: parseInt(parts[1]),
          usedBytes: parseInt(parts[2]),
          availableBytes: parseInt(parts[3]),
          usagePercent: parts[4],
          mountpoint: parts[5]
        });
      }
    });
    
    return info;
  } catch (error) {
    return { error: error.message };
  }
}

async function getNetworkInfo(target, includeVirtual = false) {
  try {
    const info = { interfaces: [] };
    
    // Get network interfaces
    const { stdout: ifconfig } = await executeRemoteCommand(target,
      'ip -j addr show 2>/dev/null || ip addr show'
    );
    
    try {
      const data = JSON.parse(ifconfig);
      data.forEach(iface => {
        if (!includeVirtual && (iface.ifname.startsWith('veth') || iface.ifname.startsWith('docker'))) {
          return;
        }
        
        const addresses = [];
        if (iface.addr_info) {
          iface.addr_info.forEach(addr => {
            addresses.push({
              family: addr.family,
              address: addr.local,
              prefixlen: addr.prefixlen
            });
          });
        }
        
        info.interfaces.push({
          name: iface.ifname,
          state: iface.operstate,
          mtu: iface.mtu,
          mac: iface.address,
          addresses
        });
      });
    } catch {
      // Fallback parsing for non-JSON output
      const blocks = ifconfig.split(/^\d+:/m);
      blocks.forEach(block => {
        if (!block.trim()) return;
        
        const lines = block.split('\n');
        const nameLine = lines[0];
        if (!nameLine) return;
        
        const nameMatch = nameLine.match(/(\S+):/);
        if (!nameMatch) return;
        
        const name = nameMatch[1];
        if (!includeVirtual && (name.startsWith('veth') || name.startsWith('docker'))) {
          return;
        }
        
        const iface = { name, addresses: [] };
        
        lines.forEach(line => {
          if (line.includes('link/ether')) {
            const macMatch = line.match(/link\/ether (\S+)/);
            if (macMatch) iface.mac = macMatch[1];
          } else if (line.includes('inet ')) {
            const ipMatch = line.match(/inet (\d+\.\d+\.\d+\.\d+\/\d+)/);
            if (ipMatch) {
              const [address, prefixlen] = ipMatch[1].split('/');
              iface.addresses.push({
                family: 'inet',
                address,
                prefixlen: parseInt(prefixlen)
              });
            }
          }
        });
        
        info.interfaces.push(iface);
      });
    }
    
    // Get network speed for physical interfaces
    for (const iface of info.interfaces) {
      if (iface.name.startsWith('en') || iface.name.startsWith('eth')) {
        try {
          const { stdout: speed } = await executeRemoteCommand(target,
            `cat /sys/class/net/${iface.name}/speed 2>/dev/null`
          );
          if (speed.trim()) {
            iface.speedMbps = parseInt(speed.trim());
          }
        } catch {}
      }
    }
    
    return info;
  } catch (error) {
    return { error: error.message };
  }
}

async function getGPUInfo(target) {
  try {
    const gpus = [];
    
    // Try nvidia-smi first
    try {
      const { stdout: nvidia } = await executeRemoteCommand(target,
        'nvidia-smi --query-gpu=name,memory.total,utilization.gpu,temperature.gpu --format=csv,noheader'
      );
      
      const lines = nvidia.split('\n').filter(l => l.trim());
      lines.forEach((line, index) => {
        const parts = line.split(',').map(p => p.trim());
        gpus.push({
          index,
          vendor: 'NVIDIA',
          name: parts[0],
          memoryMB: parseInt(parts[1]),
          utilizationPercent: parseInt(parts[2]),
          temperatureC: parseInt(parts[3])
        });
      });
    } catch {
      // nvidia-smi not available
    }
    
    // Try lspci for all GPUs
    try {
      const { stdout: lspci } = await executeRemoteCommand(target,
        'lspci | grep -E "VGA|3D|Display"'
      );
      
      const lines = lspci.split('\n').filter(l => l.trim());
      lines.forEach(line => {
        const match = line.match(/\d+:\d+\.\d+\s+.*:\s+(.+)/);
        if (match) {
          // Check if we already have this GPU from nvidia-smi
          const name = match[1];
          if (!gpus.find(g => name.includes(g.name))) {
            gpus.push({
              vendor: name.includes('AMD') ? 'AMD' : name.includes('Intel') ? 'Intel' : 'Unknown',
              name: name,
              driver: 'Unknown'
            });
          }
        }
      });
    } catch {}
    
    // Try to get AMD GPU info
    try {
      const { stdout: amd } = await executeRemoteCommand(target,
        'rocm-smi --showtemp --showuse 2>/dev/null'
      );
      // Parse AMD GPU info if available
    } catch {}
    
    return gpus;
  } catch (error) {
    return [];
  }
}

async function getSystemInfo(target) {
  try {
    const info = {};
    
    // OS info
    try {
      const { stdout: os } = await executeRemoteCommand(target,
        'cat /etc/os-release | grep -E "^NAME=|^VERSION=" || uname -a'
      );
      info.os = os.trim();
    } catch {}
    
    // Hostname
    try {
      const { stdout: hostname } = await executeRemoteCommand(target, 'hostname');
      info.hostname = hostname.trim();
    } catch {}
    
    // Kernel
    try {
      const { stdout: kernel } = await executeRemoteCommand(target, 'uname -r');
      info.kernel = kernel.trim();
    } catch {}
    
    // Uptime
    try {
      const { stdout: uptime } = await executeRemoteCommand(target, 'uptime -p');
      info.uptime = uptime.trim();
    } catch {}
    
    // BIOS/UEFI info
    try {
      const { stdout: bios } = await executeRemoteCommand(target,
        'sudo dmidecode -s bios-vendor && sudo dmidecode -s bios-version'
      );
      const lines = bios.split('\n').filter(l => l.trim());
      if (lines.length >= 2) {
        info.biosVendor = lines[0];
        info.biosVersion = lines[1];
      }
    } catch {}
    
    // System manufacturer
    try {
      const { stdout: system } = await executeRemoteCommand(target,
        'sudo dmidecode -s system-manufacturer && sudo dmidecode -s system-product-name'
      );
      const lines = system.split('\n').filter(l => l.trim());
      if (lines.length >= 2) {
        info.manufacturer = lines[0];
        info.model = lines[1];
      }
    } catch {}
    
    return info;
  } catch (error) {
    return { error: error.message };
  }
}

async function saveToInventory(hostname, hardware) {
  const inventoryFile = path.join(process.cwd(), 'inventory', 'hardware-inventory.json');
  
  let inventory = {};
  try {
    const data = await fs.readFile(inventoryFile, 'utf8');
    inventory = JSON.parse(data);
  } catch {
    // File doesn't exist yet
  }
  
  inventory[hostname] = {
    ...hardware,
    lastUpdated: new Date().toISOString()
  };
  
  await fs.mkdir(path.dirname(inventoryFile), { recursive: true });
  await fs.writeFile(inventoryFile, JSON.stringify(inventory, null, 2));
  
  return inventory;
}

// Tool handlers
const hardwareTools = [
  {
    name: 'hardware-scan',
    description: 'Comprehensive hardware scan of a system',
    inputSchema: HardwareScanSchema,
    handler: async (args) => {
      try {
        const { target, categories, format, saveToInventory: save } = args;
        const scanCategories = categories || ['cpu', 'memory', 'storage', 'network', 'gpu', 'system'];
        
        const hardware = {};
        
        if (scanCategories.includes('system')) {
          hardware.system = await getSystemInfo(target);
        }
        
        if (scanCategories.includes('cpu')) {
          hardware.cpu = await getCPUInfo(target);
        }
        
        if (scanCategories.includes('memory')) {
          hardware.memory = await getMemoryInfo(target);
        }
        
        if (scanCategories.includes('storage')) {
          hardware.storage = await getStorageInfo(target);
        }
        
        if (scanCategories.includes('network')) {
          hardware.network = await getNetworkInfo(target);
        }
        
        if (scanCategories.includes('gpu')) {
          hardware.gpu = await getGPUInfo(target);
        }
        
        if (save) {
          const hostname = hardware.system?.hostname || target;
          await saveToInventory(hostname, hardware);
        }
        
        let output = '';
        
        if (format === 'json') {
          output = JSON.stringify(hardware, null, 2);
        } else if (format === 'summary') {
          output = '=== Hardware Summary ===\n';
          
          if (hardware.system) {
            output += `\nSystem: ${hardware.system.manufacturer || 'Unknown'} ${hardware.system.model || ''}\n`;
            output += `OS: ${hardware.system.os || 'Unknown'}\n`;
            output += `Kernel: ${hardware.system.kernel || 'Unknown'}\n`;
          }
          
          if (hardware.cpu) {
            output += `\nCPU: ${hardware.cpu.model || 'Unknown'}\n`;
            output += `Cores: ${hardware.cpu.totalCores || 'Unknown'}\n`;
            output += `Usage: ${hardware.cpu.currentUsage || 0}%\n`;
          }
          
          if (hardware.memory) {
            output += `\nMemory: ${hardware.memory.totalGB || 0} GB total\n`;
            output += `Used: ${hardware.memory.usedGB || 0} GB (${hardware.memory.usagePercent || 0}%)\n`;
          }
          
          if (hardware.storage?.disks) {
            output += `\nStorage:\n`;
            hardware.storage.disks.forEach(disk => {
              output += `  ${disk.name}: ${disk.sizeGB} GB ${disk.model || ''}\n`;
            });
          }
          
          if (hardware.gpu?.length > 0) {
            output += `\nGPUs:\n`;
            hardware.gpu.forEach(gpu => {
              output += `  ${gpu.vendor} ${gpu.name}\n`;
              if (gpu.memoryMB) {
                output += `    Memory: ${(gpu.memoryMB / 1024).toFixed(1)} GB\n`;
              }
            });
          }
        } else {
          // Detailed format
          output = JSON.stringify(hardware, null, 2);
        }
        
        return {
          success: true,
          output,
          error: ''
        };
      } catch (error) {
        return {
          success: false,
          output: '',
          error: error.message
        };
      }
    }
  },

  {
    name: 'storage-analysis',
    description: 'Detailed storage analysis including health checks',
    inputSchema: StorageAnalysisSchema,
    handler: async (args) => {
      try {
        const { target, includePartitions, includeSmartData } = args;
        
        const storage = await getStorageInfo(target, includePartitions);
        
        if (includeSmartData) {
          storage.smartData = [];
          
          if (storage.disks) {
            for (const disk of storage.disks) {
              try {
                const { stdout: smart } = await executeRemoteCommand(target,
                  `sudo smartctl -H /dev/${disk.name} | grep -E "SMART overall-health|result"`
                );
                
                storage.smartData.push({
                  disk: disk.name,
                  health: smart.includes('PASSED') ? 'PASSED' : 'FAILED',
                  raw: smart.trim()
                });
              } catch {
                storage.smartData.push({
                  disk: disk.name,
                  health: 'UNKNOWN',
                  error: 'smartctl not available or permission denied'
                });
              }
            }
          }
        }
        
        return {
          success: true,
          output: JSON.stringify(storage, null, 2),
          error: ''
        };
      } catch (error) {
        return {
          success: false,
          output: '',
          error: error.message
        };
      }
    }
  },

  {
    name: 'network-interfaces',
    description: 'Detailed network interface information',
    inputSchema: NetworkInterfacesSchema,
    handler: async (args) => {
      try {
        const { target, includeVirtual, includeStats } = args;
        
        const network = await getNetworkInfo(target, includeVirtual);
        
        if (includeStats) {
          // Get interface statistics
          for (const iface of network.interfaces) {
            try {
              const { stdout: stats } = await executeRemoteCommand(target,
                `cat /sys/class/net/${iface.name}/statistics/rx_bytes /sys/class/net/${iface.name}/statistics/tx_bytes 2>/dev/null`
              );
              
              const lines = stats.split('\n').filter(l => l.trim());
              if (lines.length >= 2) {
                iface.statistics = {
                  rxBytes: parseInt(lines[0]),
                  txBytes: parseInt(lines[1]),
                  rxGB: (parseInt(lines[0]) / 1024 / 1024 / 1024).toFixed(2),
                  txGB: (parseInt(lines[1]) / 1024 / 1024 / 1024).toFixed(2)
                };
              }
            } catch {}
          }
        }
        
        return {
          success: true,
          output: JSON.stringify(network, null, 2),
          error: ''
        };
      } catch (error) {
        return {
          success: false,
          output: '',
          error: error.message
        };
      }
    }
  },

  {
    name: 'gpu-detection',
    description: 'Detect and analyze GPU hardware',
    inputSchema: GPUDetectionSchema,
    handler: async (args) => {
      try {
        const { target, includeDriverInfo } = args;
        
        const gpus = await getGPUInfo(target);
        
        if (includeDriverInfo) {
          // Get driver information
          try {
            const { stdout: nvidia } = await executeRemoteCommand(target,
              'nvidia-smi --query-gpu=driver_version --format=csv,noheader 2>/dev/null'
            );
            if (nvidia.trim()) {
              gpus.forEach(gpu => {
                if (gpu.vendor === 'NVIDIA') {
                  gpu.driverVersion = nvidia.trim();
                }
              });
            }
          } catch {}
          
          // Check for kernel modules
          try {
            const { stdout: modules } = await executeRemoteCommand(target,
              'lsmod | grep -E "nvidia|amdgpu|i915"'
            );
            gpus.forEach(gpu => {
              if (!gpu.driver) {
                if (modules.includes('nvidia') && gpu.vendor === 'NVIDIA') {
                  gpu.driver = 'nvidia';
                } else if (modules.includes('amdgpu') && gpu.vendor === 'AMD') {
                  gpu.driver = 'amdgpu';
                } else if (modules.includes('i915') && gpu.vendor === 'Intel') {
                  gpu.driver = 'i915';
                }
              }
            });
          } catch {}
        }
        
        return {
          success: true,
          output: JSON.stringify({
            count: gpus.length,
            gpus
          }, null, 2),
          error: ''
        };
      } catch (error) {
        return {
          success: false,
          output: '',
          error: error.message
        };
      }
    }
  },

  {
    name: 'hardware-inventory',
    description: 'Manage hardware inventory database',
    inputSchema: HardwareInventorySchema,
    handler: async (args) => {
      try {
        const { action, hostname, hardware } = args;
        const inventoryFile = path.join(process.cwd(), 'inventory', 'hardware-inventory.json');
        
        let inventory = {};
        try {
          const data = await fs.readFile(inventoryFile, 'utf8');
          inventory = JSON.parse(data);
        } catch {
          // File doesn't exist yet
        }
        
        switch (action) {
          case 'list':
            const summary = Object.entries(inventory).map(([host, hw]) => ({
              hostname: host,
              lastUpdated: hw.lastUpdated,
              cpu: hw.cpu?.model || 'Unknown',
              memory: hw.memory?.totalGB ? `${hw.memory.totalGB} GB` : 'Unknown',
              diskCount: hw.storage?.disks?.length || 0,
              gpuCount: hw.gpu?.length || 0
            }));
            
            return {
              success: true,
              output: JSON.stringify(summary, null, 2),
              error: ''
            };
            
          case 'add':
          case 'update':
            if (!hostname || !hardware) {
              return {
                success: false,
                output: '',
                error: 'Hostname and hardware data required for add/update'
              };
            }
            
            inventory[hostname] = {
              ...hardware,
              lastUpdated: new Date().toISOString()
            };
            
            await fs.mkdir(path.dirname(inventoryFile), { recursive: true });
            await fs.writeFile(inventoryFile, JSON.stringify(inventory, null, 2));
            
            return {
              success: true,
              output: `Hardware inventory ${action}d for ${hostname}`,
              error: ''
            };
            
          case 'remove':
            if (!hostname) {
              return {
                success: false,
                output: '',
                error: 'Hostname required for remove'
              };
            }
            
            delete inventory[hostname];
            await fs.writeFile(inventoryFile, JSON.stringify(inventory, null, 2));
            
            return {
              success: true,
              output: `Removed ${hostname} from hardware inventory`,
              error: ''
            };
            
          default:
            return {
              success: false,
              output: '',
              error: `Unknown action: ${action}`
            };
        }
      } catch (error) {
        return {
          success: false,
          output: '',
          error: error.message
        };
      }
    }
  },

  {
    name: 'hardware-benchmark',
    description: 'Run basic hardware benchmarks',
    inputSchema: BenchmarkSchema,
    handler: async (args) => {
      try {
        const { target, tests, duration } = args;
        const results = {};
        
        for (const test of tests) {
          switch (test) {
            case 'cpu':
              // Simple CPU benchmark using sysbench
              try {
                const { stdout } = await executeRemoteCommand(target,
                  `timeout ${duration} sysbench cpu --time=${duration} run 2>/dev/null | grep "events per second" || echo "sysbench not installed"`
                );
                results.cpu = stdout.trim();
              } catch {
                results.cpu = 'CPU benchmark failed or sysbench not installed';
              }
              break;
              
            case 'memory':
              // Memory bandwidth test
              try {
                const { stdout } = await executeRemoteCommand(target,
                  `timeout ${duration} sysbench memory --time=${duration} run 2>/dev/null | grep "transferred" || echo "sysbench not installed"`
                );
                results.memory = stdout.trim();
              } catch {
                results.memory = 'Memory benchmark failed';
              }
              break;
              
            case 'disk':
              // Simple disk speed test
              try {
                const { stdout } = await executeRemoteCommand(target,
                  `dd if=/dev/zero of=/tmp/test bs=1M count=1024 conv=fdatasync 2>&1 | grep -E "copied|MB/s" && rm -f /tmp/test`
                );
                results.disk = stdout.trim();
              } catch {
                results.disk = 'Disk benchmark failed';
              }
              break;
              
            case 'network':
              // Basic network test (ping)
              try {
                const { stdout } = await executeRemoteCommand(target,
                  'ping -c 10 8.8.8.8 | tail -1'
                );
                results.network = stdout.trim();
              } catch {
                results.network = 'Network benchmark failed';
              }
              break;
          }
        }
        
        return {
          success: true,
          output: JSON.stringify({
            target,
            duration,
            results
          }, null, 2),
          error: ''
        };
      } catch (error) {
        return {
          success: false,
          output: '',
          error: error.message
        };
      }
    }
  }
];

// Export tools with proper schema conversion
export const hardwareToolDefinitions = hardwareTools.map(tool => ({
  name: tool.name,
  description: tool.description,
  inputSchema: zodToJsonSchema(tool.inputSchema)
}));

export const hardwareToolHandlers = Object.fromEntries(
  hardwareTools.map(tool => [tool.name, tool.handler])
);