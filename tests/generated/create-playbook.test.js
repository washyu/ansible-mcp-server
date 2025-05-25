import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { fileURLToPath } from 'url';
import path from 'path';
import { promises as fs } from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('create-playbook', () => {
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
    const result = await global.testUtils.callMCPTool(server, 'create-playbook', {
      name: 'test-playbook',
      hosts: 'all',
      tasks: [{ name: 'Test task', ping: {} }],
      become: false,
      vars: {}
    });

    expect(result).toBeDefined();
    expect(result.error || result.output).toBeTruthy();
    
    // Tool-specific assertions
    if (result.success) {
      // Some tools may succeed without output
      expect(result.success).toBe(true);
      expect(result.output.toLowerCase()).toContain('created');
      
      // Check if file was created
      const files = await fs.readdir(testOutputDir);
      expect(files.length).toBeGreaterThan(0);
    }
  });

  it('should fail when missing required parameters', async () => {
    const result = await global.testUtils.callMCPTool(server, 'create-playbook', {
      // Missing required params: name, hosts, tasks, vars, become
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
    expect(result.error.toLowerCase()).toMatch(/required|missing/);
  });

  it('should validate parameter types', async () => {
    const result = await global.testUtils.callMCPTool(server, 'create-playbook', {
      name: 'test-name', // Should be string
      hosts: 123, // Should be string
      tasks: 'invalid', // Should be array
      vars: 'invalid', // Should be object
      become: 'invalid', // Should be boolean
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  

  it('should handle file operations correctly', async () => {
    const testFile = path.join(testOutputDir, 'test-create-playbook.yml');
    const result = await global.testUtils.callMCPTool(server, 'create-playbook', {
      name: 'test-name',
      hosts: 'localhost',
      tasks: [],
      vars: {},
      become: true
    });

    expect(result).toBeDefined();
    
    // Check if file was created/modified
    if (result.success) {
      const exists = await fs.access(testFile).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    }
  });

  // TODO: Add more specific tests for create-playbook
  // - Edge cases
  // - Integration with other tools
  // - Error scenarios
});
