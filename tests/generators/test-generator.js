#!/usr/bin/env node

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Automated Test Generator for MCP Tools
 * 
 * This generates basic test cases for all tools based on their schemas
 */

// Template for generating test files
const generateTestFile = (toolName, toolDef) => {
  const requiredParams = extractRequiredParams(toolDef.inputSchema);
  const optionalParams = extractOptionalParams(toolDef.inputSchema);
  
  return `import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('${toolName}', () => {
  let server;

  beforeEach(async () => {
    server = global.testUtils.createMCPServer();
    await global.testUtils.waitForServer(server);
  });

  afterEach(() => {
    if (server) server.kill();
  });

  it('should execute successfully with valid parameters', async () => {
    const result = await global.testUtils.callMCPTool(server, '${toolName}', {
      ${generateSampleParams(requiredParams, optionalParams)}
    });

    expect(result).toBeDefined();
    expect(result.success).toBeDefined();
    if (result.success) {
      expect(result.output).toBeTruthy();
    }
  });

  ${requiredParams.length > 0 ? `
  it('should fail when missing required parameters', async () => {
    const result = await global.testUtils.callMCPTool(server, '${toolName}', {
      // Missing required params: ${requiredParams.join(', ')}
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });` : ''}

  it('should handle invalid parameter types', async () => {
    const result = await global.testUtils.callMCPTool(server, '${toolName}', {
      ${generateInvalidParams(requiredParams)}
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('invalid');
  });

  ${toolDef.description.includes('file') || toolDef.description.includes('create') ? `
  it('should handle file operations correctly', async () => {
    const testDir = path.join(__dirname, '../test-output');
    const result = await global.testUtils.callMCPTool(server, '${toolName}', {
      ${generateFileParams(requiredParams, optionalParams, testDir)}
    });

    // Add file-specific assertions here
    expect(result).toBeDefined();
  });` : ''}
});
`;
};

// Helper functions to analyze schemas
function extractRequiredParams(schema) {
  // This would parse the Zod schema to find required fields
  // For now, return mock data
  return ['exampleRequired'];
}

function extractOptionalParams(schema) {
  // This would parse the Zod schema to find optional fields
  return ['exampleOptional'];
}

function generateSampleParams(required, optional) {
  // Generate valid sample values based on param types
  const params = [];
  required.forEach(param => {
    params.push(`${param}: 'test-value'`);
  });
  optional.slice(0, 2).forEach(param => {
    params.push(`${param}: 'optional-value'`);
  });
  return params.join(',\n      ');
}

function generateInvalidParams(required) {
  // Generate invalid values to test validation
  const params = [];
  required.forEach(param => {
    params.push(`${param}: 123 // Should be string`);
  });
  return params.join(',\n      ');
}

function generateFileParams(required, optional, testDir) {
  // Generate file-related parameters
  const params = [];
  required.forEach(param => {
    if (param.includes('file') || param.includes('path')) {
      params.push(`${param}: path.join('${testDir}', 'test-file')`);
    } else {
      params.push(`${param}: 'test-value'`);
    }
  });
  return params.join(',\n      ');
}

// Main generator function
async function generateTests() {
  console.log('🚀 Generating tests for all MCP tools...\n');

  // Load all tool definitions
  const toolModules = [
    '../src/tools/ansible-tools.js',
    '../src/tools/terraform-tools.js',
    '../src/tools/infrastructure-tools.js',
    // ... add all tool modules
  ];

  let generatedCount = 0;

  for (const modulePath of toolModules) {
    try {
      const module = await import(path.join(__dirname, '..', modulePath));
      const tools = module.default || module.tools || [];
      
      for (const tool of tools) {
        const testPath = path.join(__dirname, '../generated', `${tool.name}.test.js`);
        const testContent = generateTestFile(tool.name, tool);
        
        await fs.mkdir(path.dirname(testPath), { recursive: true });
        await fs.writeFile(testPath, testContent);
        
        console.log(`✅ Generated test for: ${tool.name}`);
        generatedCount++;
      }
    } catch (error) {
      console.error(`❌ Failed to process ${modulePath}:`, error.message);
    }
  }

  console.log(`\n✨ Generated ${generatedCount} test files!`);
  console.log('📁 Tests saved to: tests/generated/');
  console.log('\nNext steps:');
  console.log('1. Review generated tests');
  console.log('2. Add specific assertions for each tool');
  console.log('3. Run: npm test tests/generated/');
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  generateTests().catch(console.error);
}

export { generateTestFile, generateTests };