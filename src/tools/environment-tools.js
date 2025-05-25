// Environment management tools for CI/CD

import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Schemas
const EnvironmentSchema = z.object({
  name: z.string(),
  type: z.enum(['test', 'staging', 'production']),
  server: z.string(),
  protected: z.boolean(),
  requiresApproval: z.boolean(),
  description: z.string().optional()
});

const DeployToEnvironmentSchema = z.object({
  serviceName: z.string().describe('Service to deploy'),
  environment: z.enum(['test', 'staging', 'production']).describe('Target environment'),
  config: z.record(z.any()).optional().describe('Environment-specific configuration')
});

const AcceptanceTestSchema = z.object({
  serviceName: z.string().describe('Service to test'),
  testType: z.enum(['smoke', 'integration', 'performance', 'full']).describe('Type of test to run'),
  testConfig: z.record(z.any()).optional().describe('Test configuration')
});

const ListEnvironmentsSchema = z.object({});

// Helper functions
async function loadEnvironments() {
  const envFile = path.join(__dirname, '../../environments.json');
  try {
    const data = await fs.readFile(envFile, 'utf8');
    return JSON.parse(data);
  } catch {
    // Default environments
    return [
      {
        name: 'homelab-test',
        type: 'test',
        server: 'YOUR_TEST_SERVER_IP',
        protected: true,
        requiresApproval: false,
        description: 'Your personal test server - protected from overwrites'
      },
      {
        name: 'homelab-staging',
        type: 'staging',
        server: 'YOUR_STAGING_SERVER_IP',
        protected: false,
        requiresApproval: false,
        description: 'Staging environment for acceptance testing'
      },
      {
        name: 'homelab-production',
        type: 'production',
        server: 'YOUR_PRODUCTION_SERVER_IP',
        protected: true,
        requiresApproval: true,
        description: 'Production environment - requires approval'
      }
    ];
  }
}

async function validateEnvironmentDeployment(serviceName, environment, config) {
  const environments = await loadEnvironments();
  const env = environments.find(e => e.type === environment);
  
  if (!env) {
    return {
      canDeploy: false,
      reason: `Environment ${environment} not found`
    };
  }
  
  if (env.protected && environment === 'test') {
    return {
      canDeploy: false,
      reason: 'Test server is protected. Use staging environment for testing new deployments.'
    };
  }
  
  if (env.requiresApproval) {
    // In real implementation, check for approval
    return {
      canDeploy: true,
      environment: env,
      warning: 'Production deployment - ensure all tests have passed'
    };
  }
  
  return {
    canDeploy: true,
    environment: env
  };
}

// Tool handlers
const environmentTools = [
  {
    name: 'list-environments',
    description: 'List available deployment environments',
    inputSchema: ListEnvironmentsSchema,
    handler: async () => {
      try {
        const environments = await loadEnvironments();
        return {
          success: true,
          output: JSON.stringify(environments, null, 2),
          error: ''
        };
      } catch (error) {
        return {
          success: false,
          output: '',
          error: `Failed to list environments: ${error.message}`
        };
      }
    }
  },

  {
    name: 'deploy-to-environment',
    description: 'Deploy a service to a specific environment',
    inputSchema: DeployToEnvironmentSchema,
    handler: async (args) => {
      try {
        const { serviceName, environment, config } = args;
        const deploymentResult = await validateEnvironmentDeployment(serviceName, environment, config);
        
        if (!deploymentResult.canDeploy) {
          return {
            success: false,
            output: '',
            error: `Deployment blocked: ${deploymentResult.reason}`
          };
        }

        // Deploy to the specified environment
        const output = [];
        output.push(`Deploying ${serviceName} to ${environment} environment`);
        output.push(`Environment: ${deploymentResult.environment.name}`);
        output.push(`Target server: ${deploymentResult.environment.server}`);
        
        if (environment === 'production') {
          output.push('\n⚠️  Production deployment - please verify configuration');
        }
        
        return {
          success: true,
          output: output.join('\n'),
          error: ''
        };
      } catch (error) {
        return {
          success: false,
          output: '',
          error: `Failed to deploy to environment: ${error.message}`
        };
      }
    }
  },

  {
    name: 'create-acceptance-test',
    description: 'Create an acceptance test deployment',
    inputSchema: AcceptanceTestSchema,
    handler: async (args) => {
      try {
        const { serviceName, testType, testConfig } = args;
        
        const testId = `test-${serviceName}-${Date.now()}`;
        const testServer = 'homelab-staging';
        
        const testPlan = {
          testId,
          serviceName,
          testType,
          testServer,
          config: testConfig,
          status: 'created',
          createdAt: new Date().toISOString()
        };
        
        const output = [];
        output.push(`Created acceptance test: ${testId}`);
        output.push(`Service: ${serviceName}`);
        output.push(`Test type: ${testType}`);
        output.push(`Test server: ${testServer}`);
        output.push('\nTest will deploy to staging environment to avoid overwriting test server');
        
        return {
          success: true,
          output: output.join('\n'),
          error: ''
        };
      } catch (error) {
        return {
          success: false,
          output: '',
          error: `Failed to create acceptance test: ${error.message}`
        };
      }
    }
  }
];

// Export tools with proper schema conversion
export const environmentToolDefinitions = environmentTools.map(tool => ({
  name: tool.name,
  description: tool.description,
  inputSchema: zodToJsonSchema(tool.inputSchema)
}));

export const environmentToolHandlers = Object.fromEntries(
  environmentTools.map(tool => [tool.name, tool.handler])
);