#!/usr/bin/env node

// Initialize comprehensive infrastructure context
// This script sets up the initial context with your current infrastructure state

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const contextFile = path.join(__dirname, '../.mcp-context.json');

const infrastructureContext = {
  infrastructure: {
    lastUpdated: new Date().toISOString(),
    version: "1.1.0",
    nodes: {
      "proxmox": {
        ip: "192.168.10.10",
        type: "proxmox",
        description: "Primary Proxmox host",
        resources: {
          cpu: { cores: 32, allocated: 0, trend: "stable" },
          memory: { total: 128, allocated: 0, trend: "stable" },
          storage: { total: 2000, used: 0, trend: "stable" }
        },
        vms: [],
        lastHealthCheck: new Date().toISOString()
      }
    },
    network: {
      subnets: {
        management: {
          cidr: "192.168.10.0/24",
          gateway: "192.168.10.1",
          description: "Management and infrastructure services"
        }
      },
      services: {
        dns: ["192.168.10.1", "8.8.8.8"],
        ntp: ["time.nist.gov"]
      }
    },
    ipAllocation: {
      "192.168.10.10": { type: "proxmox", name: "proxmox" },
      "192.168.10.100": { type: "vm", name: "mcp-server", service: "ansible-mcp" },
      "192.168.10.169": { type: "vm", name: "dev-vm", service: "development" },
      "192.168.10.178": { type: "vm", name: "jenkins", service: "jenkins", status: "pending" }
    }
  },
  services: {
    "ansible-mcp": {
      type: "infrastructure",
      category: "automation",
      vm: {
        name: "mcp-server",
        node: "proxmox",
        ip: "192.168.10.100",
        resources: { cpu: 2, memory: 4, disk: 20 }
      },
      deployedAt: "2024-05-24T04:14:00Z",
      status: "running",
      endpoints: {
        sse: "http://192.168.10.100:3001/sse"
      },
      description: "Ansible MCP server with SSE proxy for Claude Desktop"
    },
    "jenkins": {
      type: "ci/cd",
      category: "dev-tools",
      vm: {
        name: "jenkins",
        node: "proxmox",
        ip: "192.168.10.178",
        resources: { cpu: 4, memory: 8, disk: 50 }
      },
      status: "deploying",
      deploymentStarted: new Date().toISOString(),
      description: "Jenkins CI/CD server - deployment in progress"
    }
  },
  deploymentHistory: [
    {
      timestamp: "2024-05-24T04:14:00Z",
      service: "ansible-mcp",
      action: "deployed",
      target: "192.168.10.100",
      result: "success"
    },
    {
      timestamp: new Date().toISOString(),
      service: "jenkins",
      action: "deployment-started",
      target: "192.168.10.178",
      result: "in-progress"
    }
  ],
  resourcePools: {
    available: {
      ips: {
        management: [
          "192.168.10.101-192.168.10.120",
          "192.168.10.180-192.168.10.250"
        ]
      }
    },
    reserved: {
      ips: {
        "192.168.10.1-192.168.10.10": "infrastructure",
        "192.168.10.250-192.168.10.254": "network-devices"
      }
    }
  },
  policies: {
    deployment: {
      defaultResources: {
        small: { cpu: 2, memory: 4, disk: 20 },
        medium: { cpu: 4, memory: 8, disk: 50 },
        large: { cpu: 8, memory: 16, disk: 100 }
      },
      ipAllocation: "sequential",
      preferredNode: "least-utilized"
    },
    backup: {
      schedule: "daily",
      retention: 7
    }
  }
};

async function initializeContext() {
  try {
    // Read existing context
    let existingContext = {};
    try {
      const data = await fs.readFile(contextFile, 'utf8');
      existingContext = JSON.parse(data);
    } catch (error) {
      console.log('No existing context found, creating new one');
    }

    // Merge with infrastructure context (preserving any existing data)
    const newContext = {
      ...existingContext,
      ...infrastructureContext,
      metadata: {
        initialized: new Date().toISOString(),
        schema: "1.0.0"
      }
    };

    // Write back
    await fs.writeFile(contextFile, JSON.stringify(newContext, null, 2));
    console.log('Infrastructure context initialized successfully');
    console.log(`Context written to: ${contextFile}`);
    
    // Display summary
    console.log('\nContext Summary:');
    console.log(`- Nodes: ${Object.keys(newContext.infrastructure.nodes).length}`);
    console.log(`- Services: ${Object.keys(newContext.services).length}`);
    console.log(`- Allocated IPs: ${Object.keys(newContext.infrastructure.ipAllocation).length}`);
    
  } catch (error) {
    console.error('Error initializing context:', error);
    process.exit(1);
  }
}

initializeContext();