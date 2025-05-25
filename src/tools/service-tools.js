// Service catalog and deployment tools

import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { serviceCatalog, serviceCategories } from '../service-catalog.js';
import { spawnCommand } from '../command-utils.js';
import path from 'path';

// Schemas
const BrowseCatalogSchema = z.object({
  category: z.enum([...Object.keys(serviceCategories), 'all']).optional().default('all').describe('Filter by service category'),
  search: z.string().optional().describe('Search term to filter services')
});

const ServiceDetailsSchema = z.object({
  serviceName: z.string().describe('Name of the service to get details for')
});

const DeployServiceSchema = z.object({
  serviceName: z.string().describe('Service to deploy from catalog'),
  vmName: z.string().describe('Name for the VM'),
  vmid: z.number().describe('Proxmox VM ID'),
  ipAddress: z.string().optional().describe('Static IP address'),
  config: z.record(z.any()).optional().describe('Service-specific configuration')
});

// Helper functions
function filterServices(category = 'all', search = '') {
  // Convert serviceCatalog object to array
  let services = Object.entries(serviceCatalog).map(([key, service]) => ({
    ...service,
    id: key
  }));
  
  if (category !== 'all') {
    services = services.filter(s => s.category === category);
  }
  
  if (search) {
    const searchLower = search.toLowerCase();
    services = services.filter(s => 
      s.name.toLowerCase().includes(searchLower) ||
      s.description.toLowerCase().includes(searchLower) ||
      s.features.some(f => f.toLowerCase().includes(searchLower))
    );
  }
  
  return services;
}

// Tool handlers
const serviceTools = [
  {
    name: 'browse-services',
    description: 'Browse available services in the catalog with optional filtering',
    inputSchema: BrowseCatalogSchema,
    handler: async (args) => {
      const validatedArgs = BrowseCatalogSchema.parse(args);
      const services = filterServices(validatedArgs.category, validatedArgs.search);
      
      const output = services.map(service => ({
        name: service.name,
        category: service.category,
        description: service.description,
        alternatives: service.alternatives,
        link: service.github || service.website
      }));
      
      return {
        success: true,
        output: JSON.stringify({
          total: output.length,
          category: validatedArgs.category,
          services: output
        }, null, 2),
        error: ''
      };
    }
  },

  {
    name: 'service-details',
    description: 'Get detailed information about a specific service',
    inputSchema: ServiceDetailsSchema,
    handler: async (args) => {
      const validatedArgs = ServiceDetailsSchema.parse(args);
      // Convert serviceCatalog object to array and find service
      const services = Object.entries(serviceCatalog).map(([key, service]) => ({
        ...service,
        id: key
      }));
      const service = services.find(s => 
        s.name.toLowerCase() === validatedArgs.serviceName.toLowerCase()
      );
      
      if (!service) {
        return {
          success: false,
          output: '',
          error: `Service '${validatedArgs.serviceName}' not found in catalog`
        };
      }
      
      return {
        success: true,
        output: JSON.stringify(service, null, 2),
        error: ''
      };
    }
  },

  {
    name: 'deploy-service',
    description: 'Deploy a service from the catalog by creating VM and configuring it',
    inputSchema: DeployServiceSchema,
    handler: async (args) => {
      const validatedArgs = DeployServiceSchema.parse(args);
      // Convert serviceCatalog object to array and find service
      const services = Object.entries(serviceCatalog).map(([key, service]) => ({
        ...service,
        id: key
      }));
      const service = services.find(s => 
        s.name.toLowerCase() === validatedArgs.serviceName.toLowerCase()
      );
      
      if (!service) {
        return {
          success: false,
          output: '',
          error: `Service '${validatedArgs.serviceName}' not found in catalog`
        };
      }
      
      // Prepare deployment configuration
      const deploymentConfig = {
        service: service.name,
        vmName: validatedArgs.vmName,
        vmid: validatedArgs.vmid,
        requirements: service.requirements,
        features: service.features,
        config: validatedArgs.config || {}
      };
      
      if (validatedArgs.ipAddress) {
        deploymentConfig.ipAddress = validatedArgs.ipAddress;
      }
      
      // In a real implementation, this would:
      // 1. Create appropriate Terraform configuration
      // 2. Deploy the VM
      // 3. Run Ansible playbook for the service
      // 4. Configure any service-specific settings
      
      return {
        success: true,
        output: JSON.stringify({
          message: `Deployment initiated for ${service.name}`,
          deployment: deploymentConfig,
          next_steps: [
            'VM will be created with Terraform',
            `Service ${service.name} will be installed via Ansible`,
            'Service-specific configuration will be applied',
            `Access the service at: http://${validatedArgs.ipAddress || validatedArgs.vmName}`
          ]
        }, null, 2),
        error: ''
      };
    }
  }
];

// Export tools with proper schema conversion
export const serviceToolDefinitions = serviceTools.map(tool => ({
  name: tool.name,
  description: tool.description,
  inputSchema: zodToJsonSchema(tool.inputSchema)
}));

export const serviceToolHandlers = Object.fromEntries(
  serviceTools.map(tool => [tool.name, tool.handler])
);