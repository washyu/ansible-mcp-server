#!/usr/bin/env node

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Automated Test Generator for MCP Tools
 * Generates comprehensive test suites for all tools
 */

// Analyze Zod schema to determine parameter types and requirements
function analyzeSchema(schema) {
  const analysis = {
    required: [],
    optional: [],
    types: {}
  };

  if (!schema || !schema.properties) return analysis;

  // Extract field information from the schema
  Object.entries(schema.properties).forEach(([key, value]) => {
    // Check if field is required
    const isRequired = schema.required?.includes(key) || 
                      (value.type && !value.anyOf && !value.oneOf);
    
    if (isRequired) {
      analysis.required.push(key);
    } else {
      analysis.optional.push(key);
    }

    // Determine type
    if (value.type) {
      analysis.types[key] = value.type;
    } else if (value.enum) {
      analysis.types[key] = 'enum';
    } else if (value.anyOf || value.oneOf) {
      analysis.types[key] = 'mixed';
    }
  });

  return analysis;
}

// Generate sample values based on parameter name and type
function generateSampleValue(paramName, paramType) {
  // Smart defaults based on parameter name
  if (paramName.includes('file') || paramName.includes('File')) {
    return 'path.join(testOutputDir, \'test-file.yml\')';
  }
  if (paramName.includes('path') || paramName.includes('Path')) {
    return 'path.join(testOutputDir, \'test-path\')';
  }
  if (paramName.includes('directory') || paramName.includes('Dir')) {
    return 'testOutputDir';
  }
  if (paramName.includes('name') || paramName.includes('Name')) {
    return '\'test-name\'';
  }
  if (paramName.includes('host') || paramName.includes('Host')) {
    return '\'localhost\'';
  }
  if (paramName.includes('port') || paramName.includes('Port')) {
    return '8080';
  }
  if (paramName.includes('url') || paramName.includes('Url')) {
    return '\'http://localhost:8080\'';
  }
  if (paramName.includes('content') || paramName.includes('Content')) {
    return '\'test content\'';
  }
  if (paramName.includes('key') || paramName.includes('Key')) {
    return '\'test-key\'';
  }
  if (paramName.includes('value') || paramName.includes('Value')) {
    return '{ test: true }';
  }

  // Type-based defaults
  switch (paramType) {
    case 'string':
      return '\'test-string\'';
    case 'number':
    case 'integer':
      return '42';
    case 'boolean':
      return 'true';
    case 'array':
      return '[]';
    case 'object':
      return '{}';
    default:
      return '\'test-value\'';
  }
}

// Generate test file content
function generateTestFile(toolName, toolDef) {
  const schema = toolDef.inputSchema;
  const analysis = analyzeSchema(schema);
  
  // Generate parameter lists
  const requiredParams = analysis.required.map(param => 
    `      ${param}: ${generateSampleValue(param, analysis.types[param])}`
  ).join(',\n');

  const allParams = [...analysis.required, ...analysis.optional.slice(0, 2)].map(param =>
    `      ${param}: ${generateSampleValue(param, analysis.types[param])}`
  ).join(',\n');

  const invalidParams = analysis.required.map(param => {
    const correctType = analysis.types[param] || 'string';
    const invalidValue = correctType === 'string' ? '123' : '\'invalid\'';
    return `      ${param}: ${invalidValue}, // Should be ${correctType}`;
  }).join('\n');

  // Check if tool deals with files
  const isFileTool = toolDef.description.toLowerCase().includes('file') ||
                     toolDef.description.toLowerCase().includes('create') ||
                     toolDef.description.toLowerCase().includes('write') ||
                     analysis.required.some(p => p.includes('file') || p.includes('path'));

  return `import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { fileURLToPath } from 'url';
import path from 'path';
import { promises as fs } from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('${toolName}', () => {
  let server;
  const testOutputDir = path.join(__dirname, '../test-output');

  beforeEach(async () => {
    server = global.testUtils.createMCPServer();
    await global.testUtils.waitForServer(server);
    await fs.mkdir(testOutputDir, { recursive: true });
  });

  afterEach(() => {
    if (server) server.kill();
  });

  it('should execute successfully with valid parameters', async () => {
    const result = await global.testUtils.callMCPTool(server, '${toolName}', {
${allParams}
    });

    expect(result).toBeDefined();
    expect(result.error || result.output).toBeTruthy();
    
    // Tool-specific assertions
    if (result.success) {
      expect(result.output).toBeTruthy();
      ${toolDef.description.includes('list') ? 'expect(result.output).toContain(\'[\');' : ''}
      ${toolDef.description.includes('create') ? 'expect(result.output).toContain(\'created\');' : ''}
      ${toolDef.description.includes('deploy') ? 'expect(result.output).toContain(\'deploy\');' : ''}
    }
  });

  ${analysis.required.length > 0 ? `it('should fail when missing required parameters', async () => {
    const result = await global.testUtils.callMCPTool(server, '${toolName}', {
      // Missing required params: ${analysis.required.join(', ')}
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
    expect(result.error.toLowerCase()).toMatch(/required|missing/);
  });` : ''}

  ${analysis.required.length > 0 ? `it('should validate parameter types', async () => {
    const result = await global.testUtils.callMCPTool(server, '${toolName}', {
${invalidParams}
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });` : ''}

  ${analysis.optional.length > 0 ? `it('should work with only required parameters', async () => {
    const result = await global.testUtils.callMCPTool(server, '${toolName}', {
${requiredParams}
    });

    expect(result).toBeDefined();
    // Should either succeed or fail with a specific error (not validation)
    if (!result.success) {
      expect(result.error).not.toMatch(/required|missing|invalid/i);
    }
  });` : ''}

  ${isFileTool ? `it('should handle file operations correctly', async () => {
    const testFile = path.join(testOutputDir, 'test-${toolName}.yml');
    const result = await global.testUtils.callMCPTool(server, '${toolName}', {
${allParams.replace(/test-file\.yml/g, `test-${toolName}.yml`)}
    });

    expect(result).toBeDefined();
    
    // Check if file was created/modified
    if (result.success && toolDef.description.includes('create')) {
      const exists = await fs.access(testFile).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    }
  });` : ''}

  // TODO: Add more specific tests for ${toolName}
  // - Edge cases
  // - Integration with other tools
  // - Error scenarios
});
`;
}

// Load and process tool definitions
async function loadToolDefinitions() {
  const tools = [];
  
  // Tool module paths
  const toolModules = [
    { path: '../../src/tools/ansible-tools.js', exportName: 'ansibleToolDefinitions' },
    { path: '../../src/tools/ansible-enhanced-tools.js', exportName: 'ansibleEnhancedToolDefinitions' },
    { path: '../../src/tools/terraform-tools.js', exportName: 'terraformToolDefinitions' },
    { path: '../../src/tools/infrastructure-tools.js', exportName: 'infrastructureToolDefinitions' },
    { path: '../../src/tools/service-tools.js', exportName: 'serviceToolDefinitions' },
    { path: '../../src/tools/environment-tools.js', exportName: 'environmentToolDefinitions' },
    { path: '../../src/tools/external-server-tools.js', exportName: 'externalServerToolDefinitions' },
    { path: '../../src/tools/hardware-discovery-tools.js', exportName: 'hardwareToolDefinitions' },
    { path: '../../src/security-tools.js', exportName: 'securityTools' },
    { path: '../../src/server-management-tools.js', exportName: 'serverManagementTools' },
    { path: '../../src/setup-tools.js', exportName: 'setupTools' }
  ];

  for (const { path: modulePath, exportName } of toolModules) {
    try {
      const module = await import(modulePath);
      const toolDefs = module[exportName] || module.default || [];
      
      if (Array.isArray(toolDefs)) {
        tools.push(...toolDefs);
        console.log(`✅ Loaded ${toolDefs.length} tools from ${exportName}`);
      } else {
        console.log(`⚠️  Skipping ${exportName} - not an array`);
      }
    } catch (error) {
      console.error(`❌ Failed to load ${modulePath}:`, error.message);
    }
  }

  return tools;
}

// Main generator
async function generateTests() {
  console.log('🚀 MCP Tool Test Generator\n');
  console.log('Loading tool definitions...\n');

  const tools = await loadToolDefinitions();
  console.log(`\nFound ${tools.length} tools total\n`);

  const outputDir = path.join(__dirname, '../generated');
  await fs.mkdir(outputDir, { recursive: true });

  // Track generation stats
  const stats = {
    generated: 0,
    skipped: 0,
    failed: 0
  };

  // Generate test for each tool
  for (const tool of tools) {
    try {
      // Skip if test already exists in unit tests
      const existingTestPath = path.join(__dirname, '../unit', `${tool.name}.test.js`);
      const exists = await fs.access(existingTestPath).then(() => true).catch(() => false);
      
      if (exists) {
        console.log(`⏭️  Skipping ${tool.name} - test already exists`);
        stats.skipped++;
        continue;
      }

      // Generate test content
      const testContent = generateTestFile(tool.name, tool);
      const testPath = path.join(outputDir, `${tool.name}.test.js`);
      
      await fs.writeFile(testPath, testContent);
      console.log(`✅ Generated test for: ${tool.name}`);
      stats.generated++;
      
    } catch (error) {
      console.error(`❌ Failed to generate test for ${tool.name}:`, error.message);
      stats.failed++;
    }
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 Generation Summary:');
  console.log(`   Generated: ${stats.generated}`);
  console.log(`   Skipped: ${stats.skipped}`);
  console.log(`   Failed: ${stats.failed}`);
  console.log(`   Total: ${tools.length}`);
  console.log('='.repeat(50));
  
  if (stats.generated > 0) {
    console.log('\n✨ Tests generated successfully!');
    console.log(`📁 Location: ${outputDir}`);
    console.log('\n📝 Next steps:');
    console.log('1. Review generated tests');
    console.log('2. Add tool-specific assertions');
    console.log('3. Run: npm test tests/generated/');
    console.log('4. Move refined tests to tests/unit/');
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  generateTests().catch(console.error);
}

export { generateTestFile, analyzeSchema, generateTests };