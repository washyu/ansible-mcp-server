// Terraform-specific tools module

import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { spawnCommand } from '../command-utils.js';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Schemas
const TerraformPlanSchema = z.object({
  directory: z.string().describe('Directory containing Terraform configuration'),
  destroy: z.boolean().optional().describe('Plan to destroy resources'),
  target: z.string().optional().describe('Resource to target for planning'),
  varFile: z.string().optional().describe('Path to variables file'),
  vars: z.record(z.string()).optional().describe('Variables to pass to Terraform')
});

const TerraformApplySchema = z.object({
  directory: z.string().describe('Directory containing Terraform configuration'),
  autoApprove: z.boolean().optional().default(false).describe('Skip interactive approval'),
  target: z.string().optional().describe('Resource to target for apply')
});

const TerraformOutputSchema = z.object({
  directory: z.string().describe('Directory containing Terraform configuration'),
  json: z.boolean().optional().default(true).describe('Output in JSON format')
});

const CreateVMTemplateSchema = z.object({
  name: z.string().describe('Name for the VM template'),
  vmid: z.number().describe('Proxmox VM ID'),
  template: z.enum(['ubuntu-cloud', 'debian-cloud', 'custom']).describe('Base template to use'),
  cores: z.number().default(2).describe('Number of CPU cores'),
  memory: z.number().default(2048).describe('Memory in MB'),
  disk: z.string().default('20G').describe('Disk size'),
  network: z.object({
    bridge: z.string().default('vmbr0'),
    ip: z.string().optional().describe('Static IP address'),
    gateway: z.string().optional().describe('Gateway IP'),
    nameserver: z.string().optional().describe('DNS server')
  }).optional(),
  outputDir: z.string().default('terraform').describe('Output directory for configuration')
});

// Helper functions
async function executeTerraformCommand(command, args, cwd) {
  const options = {
    cwd,
    timeout: 600000, // 10 minutes
    env: {
      ...process.env,
      TF_IN_AUTOMATION: 'true',
      TF_CLI_ARGS: '-no-color'
    }
  };

  return spawnCommand(command, args, options);
}

function generateVMTemplate(args) {
  const { name, vmid, template, cores, memory, disk, network } = args;
  
  let templateSource = '';
  switch (template) {
    case 'ubuntu-cloud':
      templateSource = 'ubuntu-cloud-init-template';
      break;
    case 'debian-cloud':
      templateSource = 'debian-cloud-init-template';
      break;
    default:
      templateSource = 'custom-template';
  }

  const tfConfig = `
terraform {
  required_providers {
    proxmox = {
      source = "Telmate/proxmox"
      version = "~> 2.9"
    }
  }
}

provider "proxmox" {
  pm_api_url      = var.proxmox_api_url
  pm_api_token_id = var.proxmox_api_token_id
  pm_api_token_secret = var.proxmox_api_token_secret
  pm_tls_insecure = true
}

variable "proxmox_api_url" {
  description = "Proxmox API URL"
  type        = string
}

variable "proxmox_api_token_id" {
  description = "Proxmox API Token ID"
  type        = string
}

variable "proxmox_api_token_secret" {
  description = "Proxmox API Token Secret"
  type        = string
  sensitive   = true
}

resource "proxmox_vm_qemu" "${name}" {
  name        = "${name}"
  target_node = "pve"
  vmid        = ${vmid}
  
  clone       = "${templateSource}"
  full_clone  = true
  
  cores       = ${cores}
  memory      = ${memory}
  
  disk {
    size    = "${disk}"
    type    = "scsi"
    storage = "local-lvm"
  }
  
  network {
    model  = "virtio"
    bridge = "${network?.bridge || 'vmbr0'}"
  }
  
  ${network?.ip ? `
  ipconfig0 = "ip=${network.ip}/24,gw=${network.gateway || 'YOUR_GATEWAY_IP'}"
  nameserver = "${network.nameserver || '8.8.8.8'}"
  ` : ''}
  
  lifecycle {
    ignore_changes = [
      network,
    ]
  }
}

output "${name}_ip" {
  value = proxmox_vm_qemu.${name}.default_ipv4_address
}
`;

  return tfConfig;
}

// Tool handlers
const terraformTools = [
  {
    name: 'terraform-plan',
    description: 'Create an execution plan for Terraform changes',
    inputSchema: TerraformPlanSchema,
    handler: async (args) => {
      const validatedArgs = TerraformPlanSchema.parse(args);
      const tfDir = path.isAbsolute(validatedArgs.directory) 
        ? validatedArgs.directory 
        : path.join(process.cwd(), validatedArgs.directory);
      
      const commandArgs = ['plan'];
      
      if (validatedArgs.destroy) {
        commandArgs.push('-destroy');
      }
      
      if (validatedArgs.target) {
        commandArgs.push('-target', validatedArgs.target);
      }
      
      if (validatedArgs.varFile) {
        commandArgs.push('-var-file', validatedArgs.varFile);
      }
      
      if (validatedArgs.vars) {
        for (const [key, value] of Object.entries(validatedArgs.vars)) {
          commandArgs.push('-var', `${key}=${value}`);
        }
      }
      
      const result = await executeTerraformCommand('terraform', commandArgs, tfDir);
      
      return {
        success: result.exitCode === 0,
        output: result.stdout,
        error: result.stderr,
        exitCode: result.exitCode
      };
    }
  },

  {
    name: 'terraform-apply',
    description: 'Apply Terraform configuration to create/update infrastructure',
    inputSchema: TerraformApplySchema,
    handler: async (args) => {
      const validatedArgs = TerraformApplySchema.parse(args);
      const tfDir = path.isAbsolute(validatedArgs.directory) 
        ? validatedArgs.directory 
        : path.join(process.cwd(), validatedArgs.directory);
      
      const commandArgs = ['apply'];
      
      if (validatedArgs.autoApprove) {
        commandArgs.push('-auto-approve');
      }
      
      if (validatedArgs.target) {
        commandArgs.push('-target', validatedArgs.target);
      }
      
      const result = await executeTerraformCommand('terraform', commandArgs, tfDir);
      
      return {
        success: result.exitCode === 0,
        output: result.stdout,
        error: result.stderr,
        exitCode: result.exitCode
      };
    }
  },

  {
    name: 'terraform-output',
    description: 'Get outputs from Terraform state',
    inputSchema: TerraformOutputSchema,
    handler: async (args) => {
      const validatedArgs = TerraformOutputSchema.parse(args);
      const tfDir = path.isAbsolute(validatedArgs.directory) 
        ? validatedArgs.directory 
        : path.join(process.cwd(), validatedArgs.directory);
      
      const commandArgs = ['output'];
      if (validatedArgs.json) {
        commandArgs.push('-json');
      }
      
      const result = await executeTerraformCommand('terraform', commandArgs, tfDir);
      
      return {
        success: result.exitCode === 0,
        output: result.stdout,
        error: result.stderr,
        exitCode: result.exitCode
      };
    }
  },

  {
    name: 'create-vm-template',
    description: 'Generate Terraform configuration for Proxmox VMs',
    inputSchema: CreateVMTemplateSchema,
    handler: async (args) => {
      const validatedArgs = CreateVMTemplateSchema.parse(args);
      const baseDir = path.isAbsolute(validatedArgs.outputDir) 
        ? validatedArgs.outputDir 
        : path.join(process.cwd(), validatedArgs.outputDir);
      const outputDir = path.join(baseDir, validatedArgs.name);
      
      // Create directory
      await fs.mkdir(outputDir, { recursive: true });
      
      // Generate Terraform configuration
      const tfConfig = generateVMTemplate(validatedArgs);
      await fs.writeFile(path.join(outputDir, 'main.tf'), tfConfig);
      
      // Create terraform.tfvars.example
      const tfvarsExample = `# Proxmox API credentials
proxmox_api_token_id = "root@pam!ansible"
proxmox_api_token_secret = "your-api-token-secret"
proxmox_api_url = "https://YOUR_PROXMOX_HOST:8006/api2/json"
`;
      await fs.writeFile(path.join(outputDir, 'terraform.tfvars.example'), tfvarsExample);
      
      // Initialize Terraform
      await executeTerraformCommand('terraform', ['init'], outputDir);
      
      return {
        success: true,
        output: `Created Terraform configuration in ${outputDir}\nRun 'terraform plan' to see what will be created`,
        error: ''
      };
    }
  }
];

// Export tools with proper schema conversion
export const terraformToolDefinitions = terraformTools.map(tool => ({
  name: tool.name,
  description: tool.description,
  inputSchema: zodToJsonSchema(tool.inputSchema)
}));

export const terraformToolHandlers = Object.fromEntries(
  terraformTools.map(tool => [tool.name, tool.handler])
);