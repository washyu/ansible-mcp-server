// Enhanced Ansible tools with more flexible input handling

import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { promises as fs } from 'fs';
import path from 'path';
import yaml from 'js-yaml';

// More flexible schema for creating playbooks
const CreatePlaybookFlexibleSchema = z.object({
  name: z.string().describe('Playbook filename (with or without .yml extension)'),
  content: z.union([
    z.string().describe('YAML content as string'),
    z.object({
      hosts: z.string().optional(),
      tasks: z.array(z.any()).optional(),
      plays: z.array(z.any()).optional()
    }).passthrough().describe('Playbook object structure')
  ]).describe('Playbook content - either YAML string or object'),
  directory: z.string().optional().default('playbooks').describe('Directory to save playbook')
});

const ValidatePlaybookSchema = z.object({
  playbook: z.string().describe('Path to playbook file'),
  syntaxCheck: z.boolean().optional().default(true).describe('Run ansible-playbook --syntax-check')
});

const GenerateInventoryPlaybookSchema = z.object({
  name: z.string().describe('Playbook name'),
  targetHosts: z.string().default('all').describe('Target hosts/groups'),
  gatherFacts: z.array(z.enum([
    'hardware', 'network', 'virtual', 'ohai', 'facter', 
    'system', 'distribution', 'devices', 'mounts'
  ])).optional().describe('Specific facts to gather'),
  outputFile: z.string().optional().describe('Save facts to file')
});

const CreateRoleStructureSchema = z.object({
  roleName: z.string().describe('Name of the role'),
  includeTasks: z.array(z.string()).optional().describe('Initial task names'),
  includeHandlers: z.array(z.string()).optional().describe('Initial handler names'),
  includeTemplates: z.boolean().optional().default(false).describe('Include templates directory'),
  includeDefaults: z.boolean().optional().default(true).describe('Include defaults/main.yml')
});

// Helper to ensure directory exists
async function ensureDirectory(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

// Helper to convert various formats to YAML
function toYAML(content) {
  if (typeof content === 'string') {
    // Already YAML
    return content;
  }
  
  // Convert object to YAML
  return yaml.dump(content, {
    noRefs: true,
    lineWidth: -1,
    quotingType: '"'
  });
}

// Enhanced tools
const ansibleEnhancedTools = [
  {
    name: 'create-playbook-flexible',
    description: 'Create an Ansible playbook with flexible input (YAML string or structured data)',
    inputSchema: CreatePlaybookFlexibleSchema,
    handler: async (args) => {
      try {
        const validatedArgs = CreatePlaybookFlexibleSchema.parse(args);
        const { name, content, directory } = validatedArgs;
        
        // Ensure filename has .yml extension
        const filename = name.endsWith('.yml') || name.endsWith('.yaml') 
          ? name 
          : `${name}.yml`;
        
        // Convert content to YAML if needed
        let yamlContent = '';
        
        if (typeof content === 'string') {
          // Validate it's valid YAML
          try {
            yaml.load(content);
            yamlContent = content;
          } catch (e) {
            return {
              success: false,
              output: '',
              error: `Invalid YAML: ${e.message}`
            };
          }
        } else {
          // Convert object to YAML
          // Handle both single play and multiple plays format
          if (content.plays) {
            yamlContent = toYAML(content.plays);
          } else {
            // Single play format
            yamlContent = toYAML([content]);
          }
        }
        
        // Ensure directory exists
        const fullPath = path.isAbsolute(directory) ? directory : path.join(process.cwd(), directory);
        await ensureDirectory(fullPath);
        
        // Write playbook
        const filePath = path.join(fullPath, filename);
        await fs.writeFile(filePath, yamlContent);
        
        return {
          success: true,
          output: `Created playbook: ${filePath}\n\nContent:\n${yamlContent.substring(0, 500)}${yamlContent.length > 500 ? '...' : ''}`,
          error: ''
        };
      } catch (error) {
        return {
          success: false,
          output: '',
          error: `Failed to create playbook: ${error.message}`
        };
      }
    }
  },

  {
    name: 'validate-playbook',
    description: 'Validate an Ansible playbook syntax',
    inputSchema: ValidatePlaybookSchema,
    handler: async (args) => {
      try {
        const validatedArgs = ValidatePlaybookSchema.parse(args);
        const { playbook, syntaxCheck } = validatedArgs;
        
        // Check if file exists
        try {
          await fs.access(playbook);
        } catch {
          return {
            success: false,
            output: '',
            error: `Playbook not found: ${playbook}`
          };
        }
        
        if (syntaxCheck) {
          // Run ansible-playbook --syntax-check
          const { exec } = await import('child_process');
          const { promisify } = await import('util');
          const execAsync = promisify(exec);
          
          try {
            const { stdout, stderr } = await execAsync(
              `ansible-playbook --syntax-check ${playbook}`,
              { timeout: 30000 }
            );
            
            return {
              success: true,
              output: stdout || 'Playbook syntax is valid',
              error: stderr
            };
          } catch (error) {
            return {
              success: false,
              output: '',
              error: `Syntax check failed: ${error.message}`
            };
          }
        } else {
          // Just validate YAML structure
          const content = await fs.readFile(playbook, 'utf8');
          try {
            const parsed = yaml.loadAll(content);
            return {
              success: true,
              output: `YAML structure is valid. ${parsed.length} play(s) found.`,
              error: ''
            };
          } catch (e) {
            return {
              success: false,
              output: '',
              error: `Invalid YAML: ${e.message}`
            };
          }
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
    name: 'generate-inventory-playbook',
    description: 'Generate a playbook for gathering inventory information',
    inputSchema: GenerateInventoryPlaybookSchema,
    handler: async (args) => {
      try {
        const validatedArgs = GenerateInventoryPlaybookSchema.parse(args);
        const { name, targetHosts, gatherFacts, outputFile } = validatedArgs;
        
        const tasks = [];
        
        // Setup fact gathering
        const factSubsets = gatherFacts && gatherFacts.length > 0 
          ? gatherFacts 
          : ['all'];
        
        // Add setup task
        tasks.push({
          name: 'Gather facts',
          setup: {
            gather_subset: factSubsets
          }
        });
        
        // Add debug task to show facts
        tasks.push({
          name: 'Display system information',
          debug: {
            msg: [
              "Hostname: {{ ansible_hostname }}",
              "OS: {{ ansible_distribution }} {{ ansible_distribution_version }}",
              "Kernel: {{ ansible_kernel }}",
              "Architecture: {{ ansible_architecture }}",
              "CPU count: {{ ansible_processor_vcpus }}",
              "Memory: {{ ansible_memtotal_mb }} MB",
              "Python: {{ ansible_python_version }}"
            ]
          }
        });
        
        // If output file specified, save facts
        if (outputFile) {
          tasks.push({
            name: 'Save facts to file',
            copy: {
              content: "{{ hostvars[inventory_hostname] | to_nice_json }}",
              dest: outputFile
            },
            delegate_to: 'localhost'
          });
        }
        
        const playbook = [{
          name: `Inventory gathering: ${name}`,
          hosts: targetHosts,
          gather_facts: true,
          tasks: tasks
        }];
        
        const yamlContent = yaml.dump(playbook);
        const filename = name.endsWith('.yml') ? name : `${name}.yml`;
        const filePath = path.join(process.cwd(), 'playbooks', filename);
        
        await ensureDirectory(path.join(process.cwd(), 'playbooks'));
        await fs.writeFile(filePath, yamlContent);
        
        return {
          success: true,
          output: `Created inventory playbook: ${filePath}`,
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
    name: 'create-role-structure',
    description: 'Create a complete Ansible role directory structure',
    inputSchema: CreateRoleStructureSchema,
    handler: async (args) => {
      try {
        const validatedArgs = CreateRoleStructureSchema.parse(args);
        const { roleName, includeTasks, includeHandlers, includeTemplates, includeDefaults } = validatedArgs;
        
        const roleBase = path.join(process.cwd(), 'roles', roleName);
        
        // Create role directories
        const directories = [
          'tasks',
          'handlers',
          'defaults',
          'vars',
          'files',
          'meta'
        ];
        
        if (includeTemplates) {
          directories.push('templates');
        }
        
        for (const dir of directories) {
          await ensureDirectory(path.join(roleBase, dir));
        }
        
        // Create main.yml files
        const created = [];
        
        // Tasks
        const tasksContent = includeTasks && includeTasks.length > 0
          ? includeTasks.map(task => ({
              name: task,
              debug: { msg: `TODO: Implement ${task}` }
            }))
          : [{
              name: `Main tasks for ${roleName}`,
              debug: { msg: 'TODO: Add tasks here' }
            }];
        
        await fs.writeFile(
          path.join(roleBase, 'tasks', 'main.yml'),
          '---\n' + yaml.dump(tasksContent)
        );
        created.push('tasks/main.yml');
        
        // Handlers
        if (includeHandlers && includeHandlers.length > 0) {
          const handlersContent = includeHandlers.map(handler => ({
            name: handler,
            debug: { msg: `Handler: ${handler}` }
          }));
          
          await fs.writeFile(
            path.join(roleBase, 'handlers', 'main.yml'),
            '---\n' + yaml.dump(handlersContent)
          );
          created.push('handlers/main.yml');
        }
        
        // Defaults
        if (includeDefaults) {
          await fs.writeFile(
            path.join(roleBase, 'defaults', 'main.yml'),
            `---\n# Default variables for ${roleName}\n${roleName}_enabled: true\n`
          );
          created.push('defaults/main.yml');
        }
        
        // Meta
        const metaContent = {
          galaxy_info: {
            author: 'Your Name',
            description: `${roleName} role`,
            min_ansible_version: '2.9',
            platforms: [
              {
                name: 'Ubuntu',
                versions: ['all']
              }
            ]
          },
          dependencies: []
        };
        
        await fs.writeFile(
          path.join(roleBase, 'meta', 'main.yml'),
          '---\n' + yaml.dump(metaContent)
        );
        created.push('meta/main.yml');
        
        // README
        const readmeContent = `# ${roleName}

A brief description of the role goes here.

## Requirements

Any pre-requisites that may not be covered by Ansible itself.

## Role Variables

Available variables are listed below:

\`\`\`yaml
${roleName}_enabled: true
\`\`\`

## Dependencies

None.

## Example Playbook

\`\`\`yaml
- hosts: servers
  roles:
    - ${roleName}
\`\`\`
`;
        
        await fs.writeFile(path.join(roleBase, 'README.md'), readmeContent);
        created.push('README.md');
        
        return {
          success: true,
          output: `Created role structure at: ${roleBase}\n\nCreated files:\n${created.map(f => `  - ${f}`).join('\n')}`,
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
export const ansibleEnhancedToolDefinitions = ansibleEnhancedTools.map(tool => ({
  name: tool.name,
  description: tool.description,
  inputSchema: zodToJsonSchema(tool.inputSchema)
}));

export const ansibleEnhancedToolHandlers = Object.fromEntries(
  ansibleEnhancedTools.map(tool => [tool.name, tool.handler])
);