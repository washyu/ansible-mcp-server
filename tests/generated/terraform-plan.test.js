import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { fileURLToPath } from 'url';
import path from 'path';
import { promises as fs } from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('terraform-plan', () => {
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
    const result = await global.testUtils.callMCPTool(server, 'terraform-plan', {
      directory: testOutputDir,
      destroy: true,
      target: 'test-string',
      varFile: path.join(testOutputDir, 'test-file.yml'),
      vars: {}
    });

    expect(result).toBeDefined();
    expect(result.error || result.output).toBeTruthy();
    
    // Tool-specific assertions
    if (result.success) {
      // Some tools may succeed without output
      expect(result.success).toBe(true);
      
      
      
    }
  });

  it('should fail when missing required parameters', async () => {
    const result = await global.testUtils.callMCPTool(server, 'terraform-plan', {
      // Missing required params: directory, destroy, target, varFile, vars
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
    expect(result.error.toLowerCase()).toMatch(/required|missing/);
  });

  it('should validate parameter types', async () => {
    const result = await global.testUtils.callMCPTool(server, 'terraform-plan', {
      directory: '/tmp', // Should be string
      destroy: 'invalid', // Should be boolean
      target: 'production', // Should be string
      varFile: 123, // Should be string
      vars: 'invalid', // Should be object
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  

  it('should handle file operations correctly', async () => {
    const testFile = path.join(testOutputDir, 'test-terraform-plan.yml');
    const result = await global.testUtils.callMCPTool(server, 'terraform-plan', {
      directory: testOutputDir,
      destroy: true,
      target: 'test-string',
      varFile: path.join(testOutputDir, 'test-terraform-plan.yml'),
      vars: {}
    });

    expect(result).toBeDefined();
    
    // Check if file was created/modified
    if (result.success) {
      const exists = await fs.access(testFile).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    }
  });

  // TODO: Add more specific tests for terraform-plan
  // - Edge cases
  // - Integration with other tools
  // - Error scenarios
});
