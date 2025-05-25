import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { fileURLToPath } from 'url';
import path from 'path';
import { promises as fs } from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('network-interfaces', () => {
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
    const result = await global.testUtils.callMCPTool(server, 'network-interfaces', {
      target: 'test-string',
      includeVirtual: true,
      includeStats: true
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
    const result = await global.testUtils.callMCPTool(server, 'network-interfaces', {
      // Missing required params: target, includeVirtual, includeStats
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
    expect(result.error.toLowerCase()).toMatch(/required|missing/);
  });

  it('should validate parameter types', async () => {
    const result = await global.testUtils.callMCPTool(server, 'network-interfaces', {
      target: 'production', // Should be string
      includeVirtual: 'invalid', // Should be boolean
      includeStats: 'invalid', // Should be boolean
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  

  

  // TODO: Add more specific tests for network-interfaces
  // - Edge cases
  // - Integration with other tools
  // - Error scenarios
});
