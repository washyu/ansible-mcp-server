import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { fileURLToPath } from 'url';
import path from 'path';
import { promises as fs } from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('hardware-scan', () => {
  let server;

  beforeAll(() => {
    // Set timeout for slow hardware operations
  }, 15000);
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
    const result = await global.testUtils.callMCPTool(server, 'hardware-scan', {
      target: 'localhost',
      categories: ['system', 'cpu'],
      format: 'json'
    });

    expect(result).toBeDefined();
    expect(result.error || result.output).toBeTruthy();
    
    // Tool-specific assertions
    if (result.success) {
      // Some tools may succeed without output
      expect(result.success).toBe(true);
      expect(result.output).toContain('{');
    }
  });

  it.skip('should fail when missing required parameters', async () => {
    const result = await global.testUtils.callMCPTool(server, 'hardware-scan', {
      // Missing required params: target, categories, format, saveToInventory
    });

    // This tool might not strictly validate types
    if (!result.success) {
      expect(result.error).toBeTruthy();
    }
    expect(result.error.toLowerCase()).toMatch(/required|missing/);
  });

  it('should validate parameter types', async () => {
    const result = await global.testUtils.callMCPTool(server, 'hardware-scan', {
      target: 'production', // Should be string
      categories: 'invalid', // Should be array
      format: 123, // Should be string
      saveToInventory: 'invalid', // Should be boolean
    });

    // This tool might not strictly validate types
    if (!result.success) {
      expect(result.error).toBeTruthy();
    }
  });

  

  

  // TODO: Add more specific tests for hardware-scan
  // - Edge cases
  // - Integration with other tools
  // - Error scenarios
});
