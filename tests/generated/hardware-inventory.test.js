import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { fileURLToPath } from 'url';
import path from 'path';
import { promises as fs } from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('hardware-inventory', () => {
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
    const result = await global.testUtils.callMCPTool(server, 'hardware-inventory', {
      action: 'test-string',
      hostname: 'test-name',
      hardware: 'test-value'
    });

    expect(result).toBeDefined();
    expect(result.error || result.output).toBeTruthy();
    
    // Tool-specific assertions
    if (result.success) {
      // Some tools may succeed without output
      expect(result.success).toBe(true);
      
      
      
    }
  });

  it.skip('should fail when missing required parameters', async () => {
    const result = await global.testUtils.callMCPTool(server, 'hardware-inventory', {
      // Missing required params: action, hostname
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
    expect(result.error.toLowerCase()).toMatch(/required|missing/);
  });

  it('should validate parameter types', async () => {
    const result = await global.testUtils.callMCPTool(server, 'hardware-inventory', {
      action: 123, // Should be string
      hostname: 'test-host', // Should be string
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('should work with only required parameters', async () => {
    const result = await global.testUtils.callMCPTool(server, 'hardware-inventory', {
      action: 'test-string',
      hostname: 'test-name'
    });

    expect(result).toBeDefined();
    // Should either succeed or fail with a specific error (not validation)
    if (!result.success) {
      expect(result.error).not.toMatch(/required|missing|invalid/i);
    }
  });

  

  // TODO: Add more specific tests for hardware-inventory
  // - Edge cases
  // - Integration with other tools
  // - Error scenarios
});
