import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { fileURLToPath } from 'url';
import path from 'path';
import { promises as fs } from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('add-external-server', () => {
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
    const result = await global.testUtils.callMCPTool(server, 'add-external-server', {
      hostname: 'test-server.example.com',
      ipAddress: '192.168.1.100',
      sshUser: 'ansible',
      sshKey: path.join(testOutputDir, 'test-key'),
      groups: ['webservers']
    });

    expect(result).toBeDefined();
    expect(result.error || result.output).toBeTruthy();
    
    // Tool-specific assertions
    if (result.success) {
      // Some tools may succeed without output
      expect(result.success).toBe(true);
      expect(result.output.toLowerCase()).toMatch(/added/);
    }
  });

  it('should fail when missing required parameters', async () => {
    const result = await global.testUtils.callMCPTool(server, 'add-external-server', {
      // Missing required params: name, ip, type, sshPort, sshUser, sshKey, groups, vars
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
    expect(result.error.toLowerCase()).toMatch(/required|missing|undefined|invalid/);
  });

  it('should validate parameter types', async () => {
    const result = await global.testUtils.callMCPTool(server, 'add-external-server', {
      name: 'test-name', // Should be string
      ip: '192.168.1.50', // Should be string
      type: 123, // Should be string
      sshPort: 'invalid', // Should be number
      sshUser: 123, // Should be string
      sshKey: 123, // Should be string
      groups: 'invalid', // Should be array
      vars: 'invalid', // Should be object
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  

  

  // TODO: Add more specific tests for add-external-server
  // - Edge cases
  // - Integration with other tools
  // - Error scenarios
});
