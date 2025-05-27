// Service SOP loader and manager

import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Cache for loaded SOPs
const sopCache = new Map();

// Load base SOP
async function loadBaseSOP() {
  if (sopCache.has('base')) {
    return sopCache.get('base');
  }
  
  const basePath = path.join(__dirname, '..', 'service-sops', 'base-service-sop.json');
  const data = await fs.readFile(basePath, 'utf8');
  const baseSOP = JSON.parse(data);
  sopCache.set('base', baseSOP);
  return baseSOP;
}

// Load service-specific SOP
async function loadServiceSOP(serviceName) {
  if (sopCache.has(serviceName)) {
    return sopCache.get(serviceName);
  }
  
  const sopPath = path.join(__dirname, '..', 'service-sops', `${serviceName}-sop.json`);
  try {
    const data = await fs.readFile(sopPath, 'utf8');
    const serviceSOP = JSON.parse(data);
    sopCache.set(serviceName, serviceSOP[serviceName]);
    return serviceSOP[serviceName];
  } catch (error) {
    console.log(`No specific SOP found for ${serviceName}, using base SOP`);
    return null;
  }
}

// Merge base and service SOPs
async function getServiceSOP(serviceName) {
  const baseSOP = await loadBaseSOP();
  const serviceSOP = await loadServiceSOP(serviceName);
  
  if (!serviceSOP) {
    return {
      ...baseSOP.base_service_installation,
      service_name: serviceName,
      description: `Generic service: ${serviceName}`
    };
  }
  
  // Merge base with service-specific
  return {
    ...baseSOP.base_service_installation,
    ...serviceSOP,
    // Ensure arrays are merged, not replaced
    pre_checks: {
      ...baseSOP.base_service_installation.pre_checks,
      ...serviceSOP.pre_checks
    },
    post_install_steps: {
      ...baseSOP.base_service_installation.post_install_steps,
      ...serviceSOP.post_install_steps
    }
  };
}

// List available service SOPs
async function listServiceSOPs() {
  const sopDir = path.join(__dirname, '..', 'service-sops');
  const files = await fs.readdir(sopDir);
  
  const services = files
    .filter(f => f.endsWith('-sop.json') && f !== 'base-service-sop.json')
    .map(f => f.replace('-sop.json', ''));
    
  return services;
}

// Schema
const GetServiceSOPSchema = z.object({
  serviceName: z.string().describe('Service name (e.g., ollama, nextcloud, docker)'),
  section: z.string().optional().describe('Specific section to retrieve')
});

// Tool definition
const serviceSOPTools = [
  {
    name: 'get-service-sop',
    description: 'Get installation and management procedures for a specific service',
    inputSchema: GetServiceSOPSchema,
    handler: async (args) => {
      try {
        const { serviceName, section } = args;
        const sop = await getServiceSOP(serviceName.toLowerCase());
        
        let result = sop;
        if (section) {
          result = sop[section] || `Section '${section}' not found`;
        }
        
        return {
          success: true,
          output: JSON.stringify({
            service: serviceName,
            has_specific_sop: sopCache.has(serviceName.toLowerCase()),
            sop: result
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
    name: 'list-service-sops',
    description: 'List all available service-specific SOPs',
    inputSchema: z.object({}),
    handler: async () => {
      try {
        const services = await listServiceSOPs();
        const details = {};
        
        for (const service of services) {
          const sop = await loadServiceSOP(service);
          if (sop) {
            details[service] = {
              description: sop.description,
              requirements: sop.requirements,
              detection_methods: sop.detection?.methods || []
            };
          }
        }
        
        return {
          success: true,
          output: JSON.stringify({
            available_services: services,
            service_details: details,
            note: "Any service not listed will use the base service installation SOP"
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
    name: 'compare-service-requirements',
    description: 'Compare requirements for multiple services',
    inputSchema: z.object({
      services: z.array(z.string()).describe('List of services to compare')
    }),
    handler: async (args) => {
      try {
        const { services } = args;
        const comparison = {};
        
        for (const service of services) {
          const sop = await getServiceSOP(service.toLowerCase());
          comparison[service] = {
            requirements: sop.requirements || {},
            installation_method: sop.installation?.install_method || 'custom',
            has_specific_sop: sopCache.has(service.toLowerCase())
          };
        }
        
        // Find service with highest requirements
        let maxCores = 0;
        let maxMemory = 0;
        let maxDisk = 0;
        let needsGPU = false;
        
        Object.values(comparison).forEach(service => {
          const req = service.requirements;
          maxCores = Math.max(maxCores, req.recommended_cores || req.min_cores || 0);
          maxMemory = Math.max(maxMemory, req.recommended_memory_gb || req.min_memory_gb || 0);
          maxDisk = Math.max(maxDisk, req.disk_space_gb || 0);
          if (req.gpu_recommended || req.gpu_required) needsGPU = true;
        });
        
        return {
          success: true,
          output: JSON.stringify({
            services: comparison,
            combined_requirements: {
              cores: maxCores,
              memory_gb: maxMemory,
              disk_gb: maxDisk,
              gpu_needed: needsGPU
            },
            recommendation: `To run all services, you need at least ${maxCores} cores, ${maxMemory}GB RAM, ${maxDisk}GB disk${needsGPU ? ', and GPU support' : ''}`
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
export const serviceSOPToolDefinitions = serviceSOPTools.map(tool => ({
  name: tool.name,
  description: tool.description,
  inputSchema: zodToJsonSchema(tool.inputSchema)
}));

export const serviceSOPToolHandlers = Object.fromEntries(
  serviceSOPTools.map(tool => [tool.name, tool.handler])
);