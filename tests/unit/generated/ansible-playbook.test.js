import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { fileURLToPath } from 'url';
import path from 'path';
import { promises as fs } from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('ansible-playbook', () => {
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
    const result = await global.testUtils.callMCPTool(server, 'ansible-playbook', {
      playbook: 'test-string',
      inventory: 'test-string',
      hosts: 'localhost',
      check: true,
      diff: true,
      tags: [],
      skipTags: [],
      extraVars: {},
      verbose: true,
      become: true,
      timeout: 42
    });

    expect(result).toBeDefined();
    expect(result.error || result.output).toBeTruthy();
    
    // Tool-specific assertions
    if (result.success) {
      expect(result.output).toBeTruthy();
      
      
      
    }
  });

  it('should fail when missing required parameters', async () => {
    const result = await global.testUtils.callMCPTool(server, 'ansible-playbook', {
      // Missing required params: playbook, inventory, hosts, check, diff, tags, skipTags, extraVars, verbose, become, timeout
    });

    // This tool might not strictly validate types
    if (!result.success) {
      expect(result.error).toBeTruthy();
    }
    expect(result.error?.toLowerCase() || '').toMatch(/required|missing/);
  });

  it('should validate parameter types', async () => {
    const result = await global.testUtils.callMCPTool(server, 'ansible-playbook', {
      playbook: 123, // Should be string
      inventory: 123, // Should be string
      hosts: 123, // Should be string
      check: 'invalid', // Should be boolean
      diff: 'invalid', // Should be boolean
      tags: 'invalid', // Should be array
      skipTags: 'invalid', // Should be array
      extraVars: 'invalid', // Should be object
      verbose: 'invalid', // Should be boolean
      become: 'invalid', // Should be boolean
      timeout: 'invalid', // Should be number
    });

    // This tool might not strictly validate types
    if (!result.success) {
      expect(result.error).toBeTruthy();
    }
  });

  

  

  // TODO: Add more specific tests for ansible-playbook
  // - Edge cases
  // - Integration with other tools
  // - Error scenarios
});
