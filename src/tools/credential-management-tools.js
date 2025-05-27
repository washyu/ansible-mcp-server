// Credential management tools for ansible-admin accounts

import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';

// Schemas
const StoreCredentialSchema = z.object({
  vmId: z.string().describe('VM ID'),
  vmName: z.string().describe('VM name'),
  vmIp: z.string().describe('VM IP address'),
  adminUser: z.string().optional().default('ansible-admin'),
  adminPassword: z.string().optional().describe('Admin password (will be encrypted)'),
  sshKeyName: z.string().optional().default('mcp_default'),
  purpose: z.string().optional(),
  owner: z.string().optional().default('mcp')
});

const RetrieveCredentialSchema = z.object({
  vmId: z.string().describe('VM ID to retrieve credentials for'),
  decrypt: z.boolean().optional().default(false).describe('Decrypt password if stored encrypted')
});

const GeneratePasswordSchema = z.object({
  length: z.number().optional().default(20),
  includeSpecial: z.boolean().optional().default(true)
});

const UpdateContextAfterOperationSchema = z.object({
  operationType: z.enum(['vm_created', 'service_installed', 'vm_updated', 'service_updated']),
  entityId: z.string().describe('VM ID or service name'),
  updates: z.record(z.any()).describe('Key-value pairs to update in context')
});

// Helper functions
function generateSecurePassword(length = 20, includeSpecial = true) {
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  const special = '!@#$%^&*()_+-=[]{}|;:,.<>?';
  
  let charset = lowercase + uppercase + numbers;
  if (includeSpecial) charset += special;
  
  let password = '';
  const randomBytes = crypto.randomBytes(length);
  
  for (let i = 0; i < length; i++) {
    password += charset[randomBytes[i] % charset.length];
  }
  
  // Ensure at least one of each type
  const ensureTypes = [
    lowercase[crypto.randomBytes(1)[0] % lowercase.length],
    uppercase[crypto.randomBytes(1)[0] % uppercase.length],
    numbers[crypto.randomBytes(1)[0] % numbers.length]
  ];
  if (includeSpecial) {
    ensureTypes.push(special[crypto.randomBytes(1)[0] % special.length]);
  }
  
  // Replace first characters with ensured types
  for (let i = 0; i < ensureTypes.length; i++) {
    password = password.substring(0, i) + ensureTypes[i] + password.substring(i + 1);
  }
  
  return password;
}

// Simple encryption for demo (in production, use proper vault)
function encrypt(text, key = 'mcp-default-key') {
  const algorithm = 'aes-256-cbc';
  const keyHash = crypto.createHash('sha256').update(key).digest();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, keyHash, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  return iv.toString('hex') + ':' + encrypted;
}

function decrypt(encryptedText, key = 'mcp-default-key') {
  const algorithm = 'aes-256-cbc';
  const keyHash = crypto.createHash('sha256').update(key).digest();
  const parts = encryptedText.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const encrypted = parts[1];
  
  const decipher = crypto.createDecipheriv(algorithm, keyHash, iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

// Tool handlers
const credentialTools = [
  {
    name: 'store-vm-credentials',
    description: 'Store ansible-admin credentials for a VM in context',
    inputSchema: StoreCredentialSchema,
    handler: async (args, { registry }) => {
      try {
        const { vmId, vmName, vmIp, adminUser, adminPassword, sshKeyName, purpose, owner } = args;
        
        // Generate password if not provided
        const password = adminPassword || generateSecurePassword();
        
        // Encrypt password
        const encryptedPassword = encrypt(password);
        
        // Create credential object
        const credentials = {
          admin_user: adminUser,
          admin_password_encrypted: encryptedPassword,
          ssh_key: sshKeyName,
          stored_at: new Date().toISOString()
        };
        
        // Update infrastructure state
        const vmData = {
          name: vmName,
          ip: vmIp,
          purpose: purpose || 'general',
          owner: owner,
          credentials,
          created: new Date().toISOString(),
          last_verified: new Date().toISOString()
        };
        
        // Store in context
        await registry.setContext(`infrastructure_state.vms.${vmId}`, vmData);
        
        // Also store in a quick lookup
        await registry.setContext(`vm_credentials.${vmId}`, {
          ip: vmIp,
          admin_user: adminUser,
          ssh_command: `ssh ${adminUser}@${vmIp}`
        });
        
        return {
          success: true,
          output: JSON.stringify({
            message: 'Credentials stored successfully',
            vm_id: vmId,
            admin_user: adminUser,
            ssh_access: `ssh ${adminUser}@${vmIp}`,
            password_stored: 'encrypted',
            note: 'Password has been generated and encrypted' + (adminPassword ? '' : ' (auto-generated)')
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
    name: 'retrieve-vm-credentials',
    description: 'Retrieve ansible-admin credentials for a VM',
    inputSchema: RetrieveCredentialSchema,
    handler: async (args, { registry }) => {
      try {
        const { vmId, decrypt: shouldDecrypt } = args;
        
        // Get VM data from context
        const vmData = registry.getContext(`infrastructure_state.vms.${vmId}`);
        if (!vmData) {
          return {
            success: false,
            output: '',
            error: `No credentials found for VM ${vmId}`
          };
        }
        
        const result = {
          vm_id: vmId,
          vm_name: vmData.name,
          vm_ip: vmData.ip,
          admin_user: vmData.credentials?.admin_user || 'ansible-admin',
          ssh_key: vmData.credentials?.ssh_key || 'default',
          ssh_command: `ssh ${vmData.credentials?.admin_user || 'ansible-admin'}@${vmData.ip}`,
          created: vmData.created,
          last_verified: vmData.last_verified
        };
        
        if (shouldDecrypt && vmData.credentials?.admin_password_encrypted) {
          try {
            result.admin_password = decrypt(vmData.credentials.admin_password_encrypted);
            result.password_note = 'Password decrypted - handle with care';
          } catch (err) {
            result.password_error = 'Failed to decrypt password';
          }
        } else {
          result.password_status = 'Encrypted (use decrypt=true to reveal)';
        }
        
        return {
          success: true,
          output: JSON.stringify(result, null, 2),
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
    name: 'generate-secure-password',
    description: 'Generate a secure password for ansible-admin accounts',
    inputSchema: GeneratePasswordSchema,
    handler: async (args) => {
      try {
        const { length, includeSpecial } = args;
        const password = generateSecurePassword(length, includeSpecial);
        
        return {
          success: true,
          output: JSON.stringify({
            password,
            length,
            includeSpecial,
            note: 'Store this password securely - it will not be shown again'
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
    name: 'update-context-after-operation',
    description: 'Update MCP context after successful VM or service operations',
    inputSchema: UpdateContextAfterOperationSchema,
    handler: async (args, { registry }) => {
      try {
        const { operationType, entityId, updates } = args;
        const timestamp = new Date().toISOString();
        
        let contextKey;
        let contextData = { ...updates, last_updated: timestamp };
        
        switch (operationType) {
          case 'vm_created':
          case 'vm_updated':
            contextKey = `infrastructure_state.vms.${entityId}`;
            // Merge with existing VM data if updating
            if (operationType === 'vm_updated') {
              const existing = registry.getContext(contextKey) || {};
              contextData = { ...existing, ...contextData };
            }
            break;
            
          case 'service_installed':
          case 'service_updated':
            contextKey = `services.${entityId}`;
            // Add installation metadata
            if (operationType === 'service_installed') {
              contextData.installed_date = timestamp;
            }
            break;
            
          default:
            throw new Error(`Unknown operation type: ${operationType}`);
        }
        
        // Store in context
        await registry.setContext(contextKey, contextData);
        
        // Log the operation
        const operations = registry.getContext('operation_history') || [];
        operations.push({
          type: operationType,
          entity: entityId,
          timestamp,
          updates: Object.keys(updates)
        });
        
        // Keep only last 100 operations
        if (operations.length > 100) {
          operations.splice(0, operations.length - 100);
        }
        await registry.setContext('operation_history', operations);
        
        return {
          success: true,
          output: JSON.stringify({
            message: `Context updated for ${operationType}`,
            entity: entityId,
            key: contextKey,
            updates_applied: Object.keys(updates).length,
            timestamp
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
    name: 'list-vm-credentials',
    description: 'List all VMs with stored credentials',
    inputSchema: z.object({}),
    handler: async (args, { registry }) => {
      try {
        const infraState = registry.getContext('infrastructure_state') || {};
        const vms = infraState.vms || {};
        
        const vmList = Object.entries(vms).map(([vmId, vmData]) => ({
          vm_id: vmId,
          name: vmData.name,
          ip: vmData.ip,
          purpose: vmData.purpose,
          owner: vmData.owner,
          admin_user: vmData.credentials?.admin_user || 'not configured',
          ssh_command: vmData.credentials?.admin_user ? 
            `ssh ${vmData.credentials.admin_user}@${vmData.ip}` : 
            'credentials not configured',
          created: vmData.created,
          last_verified: vmData.last_verified
        }));
        
        return {
          success: true,
          output: JSON.stringify({
            total_vms: vmList.length,
            vms: vmList
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

// Export tools
export const credentialToolDefinitions = credentialTools.map(tool => ({
  name: tool.name,
  description: tool.description,
  inputSchema: zodToJsonSchema(tool.inputSchema)
}));

export const credentialToolHandlers = Object.fromEntries(
  credentialTools.map(tool => [tool.name, async (args) => {
    const { toolRegistry } = await import('./index.js');
    return tool.handler(args, { registry: toolRegistry });
  }])
);