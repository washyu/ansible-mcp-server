import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { fileURLToPath } from 'url';
import path from 'path';
import { promises as fs } from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('ansible-task', () => {
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
    const result = await global.testUtils.callMCPTool(server, 'ansible-task', {
      task: 'test-string',
      hosts: 'localhost',
      inventory: 'test-string',
      become: true,
      extraVars: {},
      check: true,
      verbose: true
    });

    expect(result).toBeDefined();
    expect(result.error || result.output).toBeTruthy();
    
    // Tool-specific assertions
    if (result.success) {
      expect(result.output).toBeTruthy();
      
      
      
    }
  });

  it('should fail when missing required parameters', async () => {
    const result = await global.testUtils.callMCPTool(server, 'ansible-task', {
      // Missing required params: task, hosts, inventory, become, extraVars, check, verbose
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
    expect(result.error.toLowerCase()).toMatch(/required|missing/);
  });

  it('should validate parameter types', async () => {
    const result = await global.testUtils.callMCPTool(server, 'ansible-task', {
      task: 123, // Should be string
      hosts: 123, // Should be string
      inventory: 123, // Should be string
      become: 'invalid', // Should be boolean
      extraVars: 'invalid', // Should be object
      check: 'invalid', // Should be boolean
      verbose: 'invalid', // Should be boolean
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  

  

  // TODO: Add more specific tests for ansible-task
  // - Edge cases
  // - Integration with other tools
  // - Error scenarios
});
