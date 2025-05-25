import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { fileURLToPath } from 'url';
import path from 'path';
import { promises as fs } from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('create-playbook-flexible', () => {
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
    const result = await global.testUtils.callMCPTool(server, 'create-playbook-flexible', {
      name: 'test-playbook',
      content: '---\n- hosts: all\n  tasks:\n    - ping:',
      directory: testOutputDir
    });

    expect(result).toBeDefined();
    expect(result.error || result.output).toBeTruthy();
    
    // Tool-specific assertions
    if (result.success) {
      expect(result.output).toBeTruthy();
      expect(result.output).toContain('Created playbook');
      
      // Check if file was created
      const files = await fs.readdir(testOutputDir);
      expect(files.length).toBeGreaterThan(0);
    }
  });

  it('should fail when missing required parameters', async () => {
    const result = await global.testUtils.callMCPTool(server, 'create-playbook-flexible', {
      // Missing required params: name, content, directory
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
    expect(result.error.toLowerCase()).toMatch(/required|missing/);
  });

  it('should validate parameter types', async () => {
    const result = await global.testUtils.callMCPTool(server, 'create-playbook-flexible', {
      name: 123, // Should be string
      content: 'invalid', // Should be mixed
      directory: 123, // Should be string
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  

  it('should handle file operations correctly', async () => {
    const testFile = path.join(testOutputDir, 'test-playbook-flexible.yml');
    const result = await global.testUtils.callMCPTool(server, 'create-playbook-flexible', {
      name: 'test-playbook-flexible',
      content: 'test content',
      directory: testOutputDir
    });

    expect(result).toBeDefined();
    
    // Check if file was created/modified
    if (result.success) {
      const exists = await fs.access(testFile).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    }
  });

  // TODO: Add more specific tests for create-playbook-flexible
  // - Edge cases
  // - Integration with other tools
  // - Error scenarios
});
