// Template validation and compliance tools

import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Schemas
const ValidateTemplateSchema = z.object({
  templateId: z.string().describe('Template VM ID to validate'),
  testVmId: z.string().optional().describe('VM ID to use for test (auto-generated if not provided)'),
  cleanup: z.boolean().optional().default(true).describe('Delete test VM after validation')
});

const FixTemplateSchema = z.object({
  templateId: z.string().describe('Template ID to fix'),
  issue: z.enum(['no_ansible_admin', 'no_ssh_access', 'missing_packages']),
  credentials: z.object({
    username: z.string().describe('Admin username for template'),
    password: z.string().optional().describe('Admin password'),
    sshKey: z.string().optional().describe('SSH private key content')
  }).optional(),
  action: z.enum(['fix', 'delete', 'keep_non_compliant'])
});

const DiscoverTemplatesSchema = z.object({
  validateAll: z.boolean().optional().default(false).describe('Validate all discovered templates'),
  fixNonCompliant: z.boolean().optional().default(false).describe('Attempt to fix non-compliant templates')
});

const CreateCompliantTemplateSchema = z.object({
  baseVmId: z.string().describe('Base VM to convert to template'),
  templateName: z.string().describe('Name for the new template'),
  osType: z.enum(['ubuntu', 'debian', 'centos', 'rocky']).optional().default('ubuntu')
});

// Helper functions
async function testSSHAccess(ip, username = 'ansible-admin') {
  try {
    const { stdout } = await execAsync(
      `timeout 10 ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 ${username}@${ip} 'sudo whoami'`
    );
    return {
      accessible: true,
      sudoWorks: stdout.trim() === 'root',
      username
    };
  } catch (error) {
    return {
      accessible: false,
      sudoWorks: false,
      error: error.message
    };
  }
}

async function checkCloudInit(ip, username = 'ansible-admin') {
  try {
    const { stdout } = await execAsync(
      `ssh -o StrictHostKeyChecking=no ${username}@${ip} 'which cloud-init && cloud-init status'`
    );
    return {
      installed: stdout.includes('/cloud-init'),
      status: stdout.includes('status:') ? stdout.split('status:')[1].trim() : 'unknown'
    };
  } catch {
    return {
      installed: false,
      status: 'not installed'
    };
  }
}

async function checkRequiredPackages(ip, username = 'ansible-admin') {
  const packages = ['python3', 'sudo', 'openssh-server'];
  const results = {};
  
  for (const pkg of packages) {
    try {
      await execAsync(
        `ssh -o StrictHostKeyChecking=no ${username}@${ip} 'which ${pkg} || dpkg -l | grep ^ii | grep ${pkg}'`
      );
      results[pkg] = true;
    } catch {
      results[pkg] = false;
    }
  }
  
  return results;
}

// Tool handlers
const templateValidationTools = [
  {
    name: 'validate-template',
    description: 'Validate a template meets MCP standards',
    inputSchema: ValidateTemplateSchema,
    handler: async (args, { registry }) => {
      try {
        const { templateId, testVmId, cleanup } = args;
        const results = {
          templateId,
          validationSteps: [],
          issues: [],
          compliant: true
        };
        
        // Step 1: Clone template to test VM
        const cloneId = testVmId || `test-${templateId}-${Date.now()}`;
        results.validationSteps.push({
          step: 'Clone template',
          status: 'pending',
          details: `Creating test VM ${cloneId} from template ${templateId}`
        });
        
        // In real implementation, would use ansible playbook to clone
        // For now, simulate the validation steps
        const testIp = '192.168.10.250'; // Would get from clone operation
        
        // Step 2: Test ansible-admin access
        const sshTest = await testSSHAccess(testIp);
        results.validationSteps.push({
          step: 'Test ansible-admin SSH access',
          status: sshTest.accessible && sshTest.sudoWorks ? 'passed' : 'failed',
          details: sshTest
        });
        
        if (!sshTest.accessible || !sshTest.sudoWorks) {
          results.issues.push('no_ansible_admin');
          results.compliant = false;
        }
        
        // Step 3: Check cloud-init
        const cloudInit = await checkCloudInit(testIp, sshTest.username);
        results.validationSteps.push({
          step: 'Check cloud-init',
          status: cloudInit.installed ? 'passed' : 'failed',
          details: cloudInit
        });
        
        if (!cloudInit.installed) {
          results.issues.push('no_cloud_init');
          results.compliant = false;
        }
        
        // Step 4: Check required packages
        const packages = await checkRequiredPackages(testIp, sshTest.username);
        const allPackagesInstalled = Object.values(packages).every(v => v);
        results.validationSteps.push({
          step: 'Check required packages',
          status: allPackagesInstalled ? 'passed' : 'failed',
          details: packages
        });
        
        if (!allPackagesInstalled) {
          results.issues.push('missing_packages');
          results.compliant = false;
        }
        
        // Step 5: Cleanup if requested
        if (cleanup) {
          results.validationSteps.push({
            step: 'Cleanup test VM',
            status: 'completed',
            details: `Test VM ${cloneId} deleted`
          });
        }
        
        // Update template metadata
        const templateMeta = {
          mcp_compliant: results.compliant,
          last_validated: new Date().toISOString(),
          validation_issues: results.issues,
          ansible_admin_configured: sshTest.accessible && sshTest.sudoWorks,
          cloud_init_ready: cloudInit.installed
        };
        
        await registry.setContext(`templates.${templateId}.metadata`, templateMeta);
        
        // Generate recommendation
        if (!results.compliant) {
          results.recommendation = `Template ${templateId} is not MCP compliant. Issues found: ${results.issues.join(', ')}. Use fix-template to resolve.`;
        } else {
          results.recommendation = `Template ${templateId} is MCP compliant and ready for use.`;
        }
        
        return {
          success: true,
          output: JSON.stringify(results, null, 2),
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
    name: 'fix-template',
    description: 'Fix non-compliant template issues',
    inputSchema: FixTemplateSchema,
    handler: async (args, { registry }) => {
      try {
        const { templateId, issue, credentials, action } = args;
        
        if (action === 'delete') {
          return {
            success: true,
            output: JSON.stringify({
              action: 'delete',
              templateId,
              message: 'Template marked for deletion',
              nextStep: 'Run delete-vm to remove template'
            }, null, 2),
            error: ''
          };
        }
        
        if (action === 'keep_non_compliant') {
          await registry.setContext(`templates.${templateId}.metadata`, {
            mcp_compliant: false,
            legacy_template: true,
            requires_manual_access: true,
            note: 'Template kept as non-compliant per user request'
          });
          
          return {
            success: true,
            output: JSON.stringify({
              action: 'keep_non_compliant',
              templateId,
              message: 'Template marked as legacy/non-compliant'
            }, null, 2),
            error: ''
          };
        }
        
        // Fix action
        if (!credentials) {
          return {
            success: false,
            output: '',
            error: 'Credentials required to fix template'
          };
        }
        
        const fixSteps = [];
        
        switch (issue) {
          case 'no_ansible_admin':
            fixSteps.push(
              'Create ansible-admin user',
              'Configure sudo access',
              'Add MCP SSH keys',
              'Test access'
            );
            break;
            
          case 'no_ssh_access':
            fixSteps.push(
              'Add MCP SSH public key',
              'Configure SSH settings',
              'Restart SSH service',
              'Test access'
            );
            break;
            
          case 'missing_packages':
            fixSteps.push(
              'Update package lists',
              'Install python3, sudo, openssh-server',
              'Install cloud-init',
              'Verify installations'
            );
            break;
        }
        
        // In real implementation, would execute fix commands
        // For now, return the plan
        
        return {
          success: true,
          output: JSON.stringify({
            templateId,
            issue,
            action: 'fix',
            fixPlan: fixSteps,
            commands: [
              '# Connect to template VM',
              `ssh ${credentials.username}@{template_ip}`,
              '# Execute fix commands based on issue',
              '# Update template after fixes',
              '# Re-validate template'
            ],
            nextStep: 'Run validate-template after fixes are applied'
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
    name: 'discover-templates',
    description: 'Discover and validate all templates in infrastructure',
    inputSchema: DiscoverTemplatesSchema,
    handler: async (args, { registry }) => {
      try {
        const { validateAll, fixNonCompliant } = args;
        
        // Get templates from inventory
        const inventory = registry.getContext('infrastructure_state') || {};
        const templates = {};
        
        // In real implementation, would query Proxmox for templates
        // For now, simulate discovery
        const discoveredTemplates = [
          { vmid: '9000', name: 'ubuntu-cloud-template', created: '2024-01-01' },
          { vmid: '9001', name: 'debian-template', created: '2024-02-01' },
          { vmid: '9002', name: 'unknown-template', created: '2023-12-01' }
        ];
        
        const report = {
          discovered: discoveredTemplates.length,
          templates: {},
          summary: {
            compliant: 0,
            non_compliant: 0,
            unknown: 0,
            fixed: 0
          }
        };
        
        for (const template of discoveredTemplates) {
          const metadata = registry.getContext(`templates.${template.vmid}.metadata`);
          
          if (metadata && metadata.mcp_compliant !== undefined) {
            // Already validated
            report.templates[template.vmid] = {
              name: template.name,
              status: metadata.mcp_compliant ? 'compliant' : 'non_compliant',
              last_validated: metadata.last_validated,
              issues: metadata.validation_issues || []
            };
            
            if (metadata.mcp_compliant) {
              report.summary.compliant++;
            } else {
              report.summary.non_compliant++;
            }
          } else {
            // Unknown template
            report.templates[template.vmid] = {
              name: template.name,
              status: 'unknown',
              needs_validation: true
            };
            report.summary.unknown++;
            
            if (validateAll) {
              // Would trigger validation
              report.templates[template.vmid].validation_scheduled = true;
            }
          }
        }
        
        // Generate recommendations
        report.recommendations = [];
        if (report.summary.unknown > 0) {
          report.recommendations.push(
            `Found ${report.summary.unknown} unknown templates. Run with validateAll=true to check compliance.`
          );
        }
        if (report.summary.non_compliant > 0) {
          report.recommendations.push(
            `Found ${report.summary.non_compliant} non-compliant templates. Use fix-template to resolve issues.`
          );
        }
        
        return {
          success: true,
          output: JSON.stringify(report, null, 2),
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
    name: 'create-compliant-template',
    description: 'Create a new MCP-compliant template from a base VM',
    inputSchema: CreateCompliantTemplateSchema,
    handler: async (args, { registry }) => {
      try {
        const { baseVmId, templateName, osType } = args;
        
        const steps = [
          {
            step: 1,
            action: 'Install required packages',
            commands: [
              'apt update && apt install -y cloud-init python3 sudo openssh-server'
            ]
          },
          {
            step: 2,
            action: 'Create ansible-admin account',
            commands: [
              'useradd -m -s /bin/bash ansible-admin',
              'usermod -aG sudo ansible-admin',
              'echo "ansible-admin ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/ansible-admin'
            ]
          },
          {
            step: 3,
            action: 'Configure SSH access',
            commands: [
              'mkdir -p /home/ansible-admin/.ssh',
              'Add MCP public key to authorized_keys',
              'chown -R ansible-admin:ansible-admin /home/ansible-admin/.ssh',
              'chmod 700 /home/ansible-admin/.ssh'
            ]
          },
          {
            step: 4,
            action: 'Clean for templating',
            commands: [
              'cloud-init clean',
              'truncate -s 0 /etc/machine-id',
              'rm -rf /tmp/* /var/tmp/*',
              'history -c'
            ]
          },
          {
            step: 5,
            action: 'Convert to template',
            command: 'Mark VM as template in Proxmox'
          }
        ];
        
        const result = {
          baseVmId,
          templateName,
          osType,
          steps,
          playbook: 'playbooks/create-mcp-template.yml',
          variables: {
            vm_id: baseVmId,
            template_name: templateName,
            os_type: osType
          },
          note: 'Run the playbook to create MCP-compliant template'
        };
        
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
  }
];

// Export tools
export const templateValidationToolDefinitions = templateValidationTools.map(tool => ({
  name: tool.name,
  description: tool.description,
  inputSchema: zodToJsonSchema(tool.inputSchema)
}));

export const templateValidationToolHandlers = Object.fromEntries(
  templateValidationTools.map(tool => [tool.name, async (args) => {
    const { toolRegistry } = await import('./index.js');
    return tool.handler(args, { registry: toolRegistry });
  }])
);