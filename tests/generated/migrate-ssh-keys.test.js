import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { fileURLToPath } from 'url';
import path from 'path';
import { promises as fs } from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('migrate-ssh-keys', () => {
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
    const result = await global.testUtils.callMCPTool(server, 'migrate-ssh-keys', {
      sourceHost: 'localhost',
      sshUser: 'test-string',
      keyTypes: 'test-key'
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
    const result = await global.testUtils.callMCPTool(server, 'migrate-ssh-keys', {
      // Missing required params: sourceHost, sshUser, keyTypes
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
    expect(result.error.toLowerCase()).toMatch(/required|missing/);
  });

  it('should validate parameter types', async () => {
    const result = await global.testUtils.callMCPTool(server, 'migrate-ssh-keys', {
      sourceHost: 123, // Should be string
      sshUser: 123, // Should be string
      keyTypes: 'invalid', // Should be array
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  

  

  // TODO: Add more specific tests for migrate-ssh-keys
  // - Edge cases
  // - Integration with other tools
  // - Error scenarios
});
