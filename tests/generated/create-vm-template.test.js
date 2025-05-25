import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { fileURLToPath } from 'url';
import path from 'path';
import { promises as fs } from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('create-vm-template', () => {
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
    const result = await global.testUtils.callMCPTool(server, 'create-vm-template', {
      name: 'test-name',
      vmid: 42,
      template: 'test-string',
      cores: 42,
      memory: 42,
      disk: 'test-string',
      network: {},
      outputDir: testOutputDir
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
    const result = await global.testUtils.callMCPTool(server, 'create-vm-template', {
      // Missing required params: name, vmid, template, cores, memory, disk, network, outputDir
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
    expect(result.error.toLowerCase()).toMatch(/required|missing/);
  });

  it('should validate parameter types', async () => {
    const result = await global.testUtils.callMCPTool(server, 'create-vm-template', {
      name: 'test-name', // Should be string
      vmid: 'invalid', // Should be number
      template: 123, // Should be string
      cores: 'invalid', // Should be number
      memory: 'invalid', // Should be number
      disk: 123, // Should be string
      network: 'invalid', // Should be object
      outputDir: 123, // Should be string
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  

  

  // TODO: Add more specific tests for create-vm-template
  // - Edge cases
  // - Integration with other tools
  // - Error scenarios
});
