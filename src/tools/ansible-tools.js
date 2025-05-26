// Ansible-specific tools module

import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { spawnCommand } from '../command-utils.js';
import { promises as fs } from 'fs';
import path from 'path';

// Schemas
const RunPlaybookSchema = z.object({
  playbook: z.string().describe('Ansible playbook to run'),
  inventory: z.string().optional().describe('Path to inventory file'),
  hosts: z.string().optional().describe('Limit to specific hosts'),
  check: z.boolean().optional().describe('Run in check mode (dry-run)'),
  diff: z.boolean().optional().describe('Show differences'),
  tags: z.array(z.string()).optional().describe('Only run tasks with these tags'),
  skipTags: z.array(z.string()).optional().describe('Skip tasks with these tags'),
  extraVars: z.record(z.string()).optional().describe('Extra variables to pass'),
  verbose: z.boolean().optional().describe('Enable verbose output'),
  become: z.boolean().optional().default(true).describe('Use sudo/become'),
  timeout: z.number().optional().default(300).describe('Command timeout in seconds')
});

const RunTaskSchema = z.object({
  task: z.string().describe('Ansible task to run (module and args)'),
  hosts: z.string().default('localhost').describe('Target hosts'),
  inventory: z.string().optional().describe('Path to inventory file'),
  become: z.boolean().optional().default(true).describe('Use sudo/become'),
  extraVars: z.record(z.string()).optional().describe('Extra variables'),
  check: z.boolean().optional().describe('Run in check mode'),
  verbose: z.boolean().optional().describe('Enable verbose output')
});

const RunRoleSchema = z.object({
  role: z.string().describe('Ansible role to run'),
  hosts: z.string().default('localhost').describe('Target hosts'),
  inventory: z.string().optional().describe('Path to inventory file'),
  become: z.boolean().optional().default(true).describe('Use sudo/become'),
  extraVars: z.record(z.string()).optional().describe('Extra variables'),
  check: z.boolean().optional().describe('Run in check mode'),
  verbose: z.boolean().optional().describe('Enable verbose output')
});

const CreatePlaybookSchema = z.object({
  name: z.string().describe('Playbook name'),
  hosts: z.string().default('all').describe('Target hosts'),
  tasks: z.array(z.object({
    name: z.string().describe('Task name'),
    module: z.string().describe('Ansible module'),
    args: z.record(z.any()).optional().describe('Module arguments'),
    become: z.boolean().optional().describe('Use sudo for this task'),
    when: z.string().optional().describe('Conditional'),
    register: z.string().optional().describe('Variable to store result'),
    tags: z.array(z.string()).optional().describe('Task tags')
  })).describe('List of tasks'),
  vars: z.record(z.any()).optional().describe('Playbook variables'),
  become: z.boolean().optional().default(false).describe('Use sudo for all tasks')
});

const ListHostsSchema = z.object({
  inventory: z.string().optional().describe('Path to inventory file (default: inventory/hosts.yml)'),
  group: z.string().optional().describe('Filter by specific group'),
  format: z.enum(['list', 'json', 'yaml']).optional().default('list').describe('Output format')
});

// Helper functions
async function executeAnsibleCommand(command, args, options = {}) {
  const defaultOptions = {
    cwd: options.cwd || process.cwd(),
    timeout: options.timeout || 300000,
    env: {
      ...process.env,
      ANSIBLE_HOST_KEY_CHECKING: 'False',
      ANSIBLE_RETRY_FILES_ENABLED: 'False',
      ANSIBLE_STDOUT_CALLBACK: 'yaml',
      PYTHONUNBUFFERED: '1'
    }
  };

  return spawnCommand(command, args, { ...defaultOptions, ...options });
}

// Tool handlers
const ansibleTools = [
  {
    name: 'ansible-playbook',
    description: 'Run an Ansible playbook',
    inputSchema: RunPlaybookSchema,
    handler: async (args) => {
      const validatedArgs = RunPlaybookSchema.parse(args);
      const commandArgs = [validatedArgs.playbook];
      
      if (validatedArgs.inventory) {
        commandArgs.push('-i', validatedArgs.inventory);
      }
      
      if (validatedArgs.hosts) {
        commandArgs.push('-l', validatedArgs.hosts);
      }
      
      if (validatedArgs.check) {
        commandArgs.push('--check');
      }
      
      if (validatedArgs.diff) {
        commandArgs.push('--diff');
      }
      
      if (validatedArgs.tags && validatedArgs.tags.length > 0) {
        commandArgs.push('--tags', validatedArgs.tags.join(','));
      }
      
      if (validatedArgs.skipTags && validatedArgs.skipTags.length > 0) {
        commandArgs.push('--skip-tags', validatedArgs.skipTags.join(','));
      }
      
      if (validatedArgs.extraVars) {
        for (const [key, value] of Object.entries(validatedArgs.extraVars)) {
          commandArgs.push('-e', `${key}=${JSON.stringify(value)}`);
        }
      }
      
      if (validatedArgs.verbose) {
        commandArgs.push('-vvv');
      }
      
      if (validatedArgs.become !== false) {
        commandArgs.push('--become');
      }
      
      const result = await executeAnsibleCommand('ansible-playbook', commandArgs, {
        timeout: validatedArgs.timeout * 1000
      });
      
      return {
        success: result.exitCode === 0,
        output: result.stdout,
        error: result.stderr,
        exitCode: result.exitCode
      };
    }
  },

  {
    name: 'ansible-task',
    description: 'Run a single Ansible task ad-hoc',
    inputSchema: RunTaskSchema,
    handler: async (args) => {
      const validatedArgs = RunTaskSchema.parse(args);
      const commandArgs = [validatedArgs.hosts];
      
      if (validatedArgs.inventory) {
        commandArgs.push('-i', validatedArgs.inventory);
      } else {
        commandArgs.push('-i', 'localhost,');
      }
      
      // Parse the task string to extract module and arguments
      const taskParts = validatedArgs.task.split(' ');
      const module = taskParts[0];
      const moduleArgs = taskParts.slice(1).join(' ');
      
      commandArgs.push('-m', module);
      
      if (moduleArgs) {
        commandArgs.push('-a', moduleArgs);
      }
      
      if (validatedArgs.check) {
        commandArgs.push('--check');
      }
      
      if (validatedArgs.extraVars) {
        for (const [key, value] of Object.entries(validatedArgs.extraVars)) {
          commandArgs.push('-e', `${key}=${JSON.stringify(value)}`);
        }
      }
      
      if (validatedArgs.verbose) {
        commandArgs.push('-vvv');
      }
      
      if (validatedArgs.become !== false) {
        commandArgs.push('--become');
      }
      
      const result = await executeAnsibleCommand('ansible', commandArgs);
      
      return {
        success: result.exitCode === 0,
        output: result.stdout,
        error: result.stderr,
        exitCode: result.exitCode
      };
    }
  },

  {
    name: 'ansible-role',
    description: 'Run an Ansible role',
    inputSchema: RunRoleSchema,
    handler: async (args) => {
      const validatedArgs = RunRoleSchema.parse(args);
      
      // Create a temporary playbook to run the role
      const tempPlaybook = {
        hosts: validatedArgs.hosts,
        become: validatedArgs.become,
        vars: validatedArgs.extraVars || {},
        roles: [validatedArgs.role]
      };
      
      const tempFile = `/tmp/ansible-role-${Date.now()}.yml`;
      await fs.writeFile(tempFile, JSON.stringify([tempPlaybook], null, 2));
      
      try {
        const commandArgs = [tempFile];
        
        if (validatedArgs.inventory) {
          commandArgs.push('-i', validatedArgs.inventory);
        }
        
        if (validatedArgs.check) {
          commandArgs.push('--check');
        }
        
        if (validatedArgs.verbose) {
          commandArgs.push('-vvv');
        }
        
        const result = await executeAnsibleCommand('ansible-playbook', commandArgs);
        
        return {
          success: result.exitCode === 0,
          output: result.stdout,
          error: result.stderr,
          exitCode: result.exitCode
        };
      } finally {
        // Clean up temp file
        await fs.unlink(tempFile).catch(() => {});
      }
    }
  },

  {
    name: 'create-playbook',
    description: 'Create a new Ansible playbook file',
    inputSchema: CreatePlaybookSchema,
    handler: async (args) => {
      const validatedArgs = CreatePlaybookSchema.parse(args);
      
      const playbook = {
        name: validatedArgs.name,
        hosts: validatedArgs.hosts,
        become: validatedArgs.become,
        vars: validatedArgs.vars,
        tasks: validatedArgs.tasks.map(task => {
          const ansibleTask = {
            name: task.name,
            [task.module]: task.args || {}
          };
          
          if (task.become !== undefined) ansibleTask.become = task.become;
          if (task.when) ansibleTask.when = task.when;
          if (task.register) ansibleTask.register = task.register;
          if (task.tags) ansibleTask.tags = task.tags;
          
          return ansibleTask;
        })
      };
      
      const filename = validatedArgs.name.endsWith('.yml') ? 
        validatedArgs.name : `${validatedArgs.name}.yml`;
      
      const playbookPath = path.join(process.cwd(), 'playbooks', filename);
      await fs.mkdir(path.dirname(playbookPath), { recursive: true });
      
      const yamlContent = `---\n${JSON.stringify([playbook], null, 2)}`;
      await fs.writeFile(playbookPath, yamlContent);
      
      return {
        success: true,
        output: `Created playbook: ${playbookPath}`,
        error: ''
      };
    }
  },

  {
    name: 'list-hosts',
    description: 'List all hosts in inventory',
    inputSchema: ListHostsSchema,
    handler: async (args) => {
      const validatedArgs = ListHostsSchema.parse(args);
      const inventory = validatedArgs.inventory || 'inventory/hosts.yml';
      
      const commandArgs = ['-i', inventory, '--list-hosts'];
      
      if (validatedArgs.group) {
        commandArgs.push(validatedArgs.group);
      } else {
        commandArgs.push('all');
      }
      
      const result = await executeAnsibleCommand('ansible', commandArgs);
      
      if (result.exitCode === 0) {
        // Parse the output based on format requested
        const hosts = result.stdout.split('\n')
          .map(line => line.trim())
          .filter(line => line && !line.startsWith('hosts ('));
        
        let output;
        switch (validatedArgs.format) {
          case 'json':
            output = JSON.stringify(hosts, null, 2);
            break;
          case 'yaml':
            output = hosts.map(h => `- ${h}`).join('\n');
            break;
          case 'list':
          default:
            output = hosts.join('\n');
        }
        
        return {
          success: true,
          output: output,
          error: ''
        };
      }
      
      return {
        success: false,
        output: '',
        error: result.stderr,
        exitCode: result.exitCode
      };
    }
  }
];

// Export tools with proper schema conversion
export const ansibleToolDefinitions = ansibleTools.map(tool => ({
  name: tool.name,
  description: tool.description,
  inputSchema: zodToJsonSchema(tool.inputSchema)
}));

export const ansibleToolHandlers = Object.fromEntries(
  ansibleTools.map(tool => [tool.name, tool.handler])
);