// Standard Operating Procedures (SOP) query tools

import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

// Schemas
const QuerySOPSchema = z.object({
  operation: z.string().describe('The operation to get SOPs for (e.g., "create_vm", "install_ollama")'),
  category: z.enum(['vm_operations', 'service_operations', 'inventory_operations', 'template_operations']).optional().describe('Category to search in'),
  detailed: z.boolean().optional().default(true).describe('Include detailed steps')
});

const ListSOPsSchema = z.object({
  category: z.string().optional().describe('Filter by category')
});

const GetBestPracticeSchema = z.object({
  topic: z.enum(['naming_conventions', 'resource_allocation', 'network_configuration']).describe('Best practice topic')
});

const GetErrorRecoverySchema = z.object({
  error: z.string().describe('Error scenario (e.g., "vm_creation_failed", "ssh_connection_failed")')
});

// Helper to get context from registry
function getSOPContext(registry) {
  return {
    sops: registry.getContext('standard_operating_procedures') || {},
    bestPractices: registry.getContext('best_practices') || {},
    errorRecovery: registry.getContext('error_recovery') || {},
    validationChecks: registry.getContext('validation_checks') || {}
  };
}

// Tool handlers
const sopTools = [
  {
    name: 'query-sop',
    description: 'Query standard operating procedures for common MCP operations',
    inputSchema: QuerySOPSchema,
    handler: async (args, { registry }) => {
      try {
        const { operation, category, detailed } = args;
        const context = getSOPContext(registry);
        
        let sop = null;
        let foundCategory = null;
        
        // Search for the SOP
        if (category) {
          const categoryData = context.sops[category];
          if (categoryData && categoryData[operation]) {
            sop = categoryData[operation];
            foundCategory = category;
          }
        } else {
          // Search all categories
          for (const [cat, ops] of Object.entries(context.sops)) {
            if (ops[operation]) {
              sop = ops[operation];
              foundCategory = cat;
              break;
            }
          }
        }
        
        if (!sop) {
          // Try to find partial matches
          const matches = [];
          for (const [cat, ops] of Object.entries(context.sops)) {
            for (const opName of Object.keys(ops)) {
              if (opName.includes(operation) || operation.includes(opName)) {
                matches.push(`${cat}.${opName}`);
              }
            }
          }
          
          return {
            success: false,
            output: '',
            error: `No SOP found for operation: ${operation}. ${matches.length > 0 ? `Did you mean: ${matches.join(', ')}?` : 'Use list-sops to see available operations.'}`
          };
        }
        
        let output = {
          operation,
          category: foundCategory,
          description: sop.description
        };
        
        if (detailed) {
          output.steps = sop.steps;
          output.prerequisite_checks = sop.prerequisite_checks;
          output.common_issues = sop.common_issues;
          output.requirements = sop.requirements;
        } else {
          output.step_summary = sop.steps.map(s => `${s.step}. ${s.action}`);
        }
        
        return {
          success: true,
          output: JSON.stringify(output, null, 2),
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
    name: 'list-sops',
    description: 'List all available standard operating procedures',
    inputSchema: ListSOPsSchema,
    handler: async (args, { registry }) => {
      try {
        const { category } = args;
        const context = getSOPContext(registry);
        
        let operations = {};
        
        if (category) {
          if (context.sops[category]) {
            operations[category] = Object.keys(context.sops[category]);
          }
        } else {
          for (const [cat, ops] of Object.entries(context.sops)) {
            operations[cat] = Object.keys(ops);
          }
        }
        
        return {
          success: true,
          output: JSON.stringify({
            available_sops: operations,
            total_count: Object.values(operations).flat().length,
            categories: Object.keys(context.sops)
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
    name: 'get-best-practice',
    description: 'Get best practices for MCP operations',
    inputSchema: GetBestPracticeSchema,
    handler: async (args, { registry }) => {
      try {
        const { topic } = args;
        const context = getSOPContext(registry);
        
        const practice = context.bestPractices[topic];
        if (!practice) {
          return {
            success: false,
            output: '',
            error: `No best practices found for topic: ${topic}`
          };
        }
        
        return {
          success: true,
          output: JSON.stringify({
            topic,
            practices: practice
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
    name: 'get-error-recovery',
    description: 'Get error recovery steps for common issues',
    inputSchema: GetErrorRecoverySchema,
    handler: async (args, { registry }) => {
      try {
        const { error } = args;
        const context = getSOPContext(registry);
        
        const recovery = context.errorRecovery[error];
        if (!recovery) {
          // Try partial match
          const matches = Object.keys(context.errorRecovery).filter(e => 
            e.includes(error) || error.includes(e)
          );
          
          if (matches.length > 0) {
            return {
              success: true,
              output: JSON.stringify({
                partial_matches: matches.map(m => ({
                  error: m,
                  steps: context.errorRecovery[m].steps
                }))
              }, null, 2),
              error: ''
            };
          }
          
          return {
            success: false,
            output: '',
            error: `No recovery steps found for error: ${error}`
          };
        }
        
        return {
          success: true,
          output: JSON.stringify({
            error,
            recovery_steps: recovery.steps
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
    name: 'get-validation-checks',
    description: 'Get validation checks for operations',
    inputSchema: z.object({
      phase: z.enum(['pre_operation', 'post_operation']).describe('Validation phase')
    }),
    handler: async (args, { registry }) => {
      try {
        const { phase } = args;
        const context = getSOPContext(registry);
        
        const checks = context.validationChecks[phase];
        if (!checks) {
          return {
            success: false,
            output: '',
            error: `No validation checks found for phase: ${phase}`
          };
        }
        
        return {
          success: true,
          output: JSON.stringify({
            phase,
            checks
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
export const sopToolDefinitions = sopTools.map(tool => ({
  name: tool.name,
  description: tool.description,
  inputSchema: zodToJsonSchema(tool.inputSchema)
}));

export const sopToolHandlers = Object.fromEntries(
  sopTools.map(tool => [tool.name, async (args) => {
    // Import toolRegistry dynamically to avoid circular dependency
    const { toolRegistry } = await import('./index.js');
    return tool.handler(args, { registry: toolRegistry });
  }])
);