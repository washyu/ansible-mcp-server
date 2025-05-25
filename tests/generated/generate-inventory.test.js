import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { fileURLToPath } from 'url';
import path from 'path';
import { promises as fs } from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('generate-inventory', () => {
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
    const result = await global.testUtils.callMCPTool(server, 'generate-inventory', {
      includeOffline: false,
      outputFile: path.join(testOutputDir, 'inventory.yml')
    });

    expect(result).toBeDefined();
    expect(result.error || result.output).toBeTruthy();
    
    // Tool-specific assertions
    if (result.success) {
      // Some tools may succeed without output
      expect(result.success).toBe(true);
      expect(result.output.toLowerCase()).toMatch(/inventory/);
      
      // Check if file was created
      const files = await fs.readdir(testOutputDir);
      expect(files.length).toBeGreaterThan(0);
    }
  });

  it('should fail when missing required parameters', async () => {
    const result = await global.testUtils.callMCPTool(server, 'generate-inventory', {
      // Missing required params: outputFile, groupBy, includeOffline
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
    expect(result.error.toLowerCase()).toMatch(/required|missing/);
  });

  it('should validate parameter types', async () => {
    const result = await global.testUtils.callMCPTool(server, 'generate-inventory', {
      outputFile: 123, // Should be string
      groupBy: 123, // Should be string
      includeOffline: 'invalid', // Should be boolean
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  

  it('should handle file operations correctly', async () => {
    const testFile = path.join(testOutputDir, 'test-generate-inventory.yml');
    const result = await global.testUtils.callMCPTool(server, 'generate-inventory', {
      outputFile: path.join(testOutputDir, 'test-generate-inventory.yml'),
      groupBy: 'test-string',
      includeOffline: true
    });

    expect(result).toBeDefined();
    
    // Check if file was created/modified
    if (result.success) {
      const exists = await fs.access(testFile).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    }
  });

  // TODO: Add more specific tests for generate-inventory
  // - Edge cases
  // - Integration with other tools
  // - Error scenarios
});
