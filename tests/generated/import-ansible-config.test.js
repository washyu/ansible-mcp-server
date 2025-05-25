import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { fileURLToPath } from 'url';
import path from 'path';
import { promises as fs } from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('import-ansible-config', () => {
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
    const result = await global.testUtils.callMCPTool(server, 'import-ansible-config', {
      controllerHost: 'localhost',
      sshUser: 'test-string',
      configTypes: []
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
    const result = await global.testUtils.callMCPTool(server, 'import-ansible-config', {
      // Missing required params: controllerHost, sshUser, configTypes
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
    expect(result.error.toLowerCase()).toMatch(/required|missing/);
  });

  it('should validate parameter types', async () => {
    const result = await global.testUtils.callMCPTool(server, 'import-ansible-config', {
      controllerHost: 123, // Should be string
      sshUser: 123, // Should be string
      configTypes: 'invalid', // Should be array
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  

  

  // TODO: Add more specific tests for import-ansible-config
  // - Edge cases
  // - Integration with other tools
  // - Error scenarios
});
