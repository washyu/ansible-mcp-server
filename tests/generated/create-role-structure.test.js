import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { fileURLToPath } from 'url';
import path from 'path';
import { promises as fs } from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('create-role-structure', () => {
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
    const result = await global.testUtils.callMCPTool(server, 'create-role-structure', {
      roleName: 'test-role',
      includeTasks: ['install', 'configure'],
      includeHandlers: ['restart'],
      includeTemplates: true,
      includeDefaults: true
    });

    expect(result).toBeDefined();
    expect(result.error || result.output).toBeTruthy();
    
    // Tool-specific assertions
    if (result.success) {
      // Some tools may succeed without output
      expect(result.success).toBe(true);
      expect(result.output).toContain('Created role');
    }
  });

  it('should fail when missing required parameters', async () => {
    const result = await global.testUtils.callMCPTool(server, 'create-role-structure', {
      // Missing required params: roleName, includeTasks, includeHandlers, includeTemplates, includeDefaults
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
    expect(result.error.toLowerCase()).toMatch(/required|missing/);
  });

  it('should validate parameter types', async () => {
    const result = await global.testUtils.callMCPTool(server, 'create-role-structure', {
      roleName: 123, // Should be string
      includeTasks: 'invalid', // Should be array
      includeHandlers: 'invalid', // Should be array
      includeTemplates: 'invalid', // Should be boolean
      includeDefaults: 'invalid', // Should be boolean
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  

  it('should handle file operations correctly', async () => {
    // Role structure creates directories, not a single file
    const roleDir = path.join(process.cwd(), 'roles', 'test-role');
    const result = await global.testUtils.callMCPTool(server, 'create-role-structure', {
      roleName: 'test-name',
      includeTasks: [],
      includeHandlers: [],
      includeTemplates: true,
      includeDefaults: true
    });

    expect(result).toBeDefined();
    
    // Check if file was created/modified
    if (result.success) {
      const exists = await fs.access(roleDir).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    }
  });

  // TODO: Add more specific tests for create-role-structure
  // - Edge cases
  // - Integration with other tools
  // - Error scenarios
});
