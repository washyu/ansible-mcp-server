import { spawn } from 'child_process';
import path from 'path';
import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
import { describe, it, expect, beforeEach, afterEach, beforeAll } from '@jest/globals';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('Ansible Tools', () => {
  let server;
  const testOutputDir = path.join(__dirname, '../test-output');

  beforeEach(async () => {
    // Ensure test directory exists
    await fs.mkdir(testOutputDir, { recursive: true });
    
    // Start MCP server
    server = global.testUtils.createMCPServer();
    await global.testUtils.waitForServer(server);
  });

  afterEach(() => {
    if (server) {
      server.kill();
    }
  });

  describe('create-playbook-flexible', () => {
    it('should create playbook from YAML string', async () => {
      const yamlContent = `---
- hosts: all
  tasks:
    - name: Test task
      ping:`;

      const result = await global.testUtils.callMCPTool(server, 'create-playbook-flexible', {
        name: 'test-playbook',
        content: yamlContent,
        directory: testOutputDir
      });

      expect(result.success).toBe(true);
      expect(result.output).toContain('Created playbook');

      // Verify file was created
      const filePath = path.join(testOutputDir, 'test-playbook.yml');
      const exists = await fs.access(filePath).then(() => true).catch(() => false);
      expect(exists).toBe(true);

      // Verify content
      const content = await fs.readFile(filePath, 'utf8');
      expect(content).toBe(yamlContent);
    });

    it('should create playbook from object structure', async () => {
      const result = await global.testUtils.callMCPTool(server, 'create-playbook-flexible', {
        name: 'test-object-playbook',
        content: {
          hosts: 'localhost',
          tasks: [
            {
              name: 'Test task',
              debug: { msg: 'Hello from Jest!' }
            }
          ]
        },
        directory: testOutputDir
      });

      expect(result.success).toBe(true);
      expect(result.output).toContain('Created playbook');

      // Verify file was created
      const filePath = path.join(testOutputDir, 'test-object-playbook.yml');
      const exists = await fs.access(filePath).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    });

    it('should handle missing required fields', async () => {
      const result = await global.testUtils.callMCPTool(server, 'create-playbook-flexible', {
        content: '---\n- hosts: all'
        // missing 'name' field
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Required');
    });

    it('should validate YAML syntax', async () => {
      const result = await global.testUtils.callMCPTool(server, 'create-playbook-flexible', {
        name: 'invalid-yaml',
        content: '---\n- hosts: all\n  tasks:\n    - name: test\n      bad: indent:\n        wrong',
        directory: testOutputDir
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Invalid YAML|can not read/);
    });
  });

  describe('validate-playbook', () => {
    beforeEach(async () => {
      // Create a test playbook
      await fs.writeFile(
        path.join(testOutputDir, 'valid-test.yml'),
        '---\n- hosts: all\n  tasks:\n    - ping:'
      );
    });

    it('should validate correct playbook syntax', async () => {
      const result = await global.testUtils.callMCPTool(server, 'validate-playbook', {
        playbook: path.join(testOutputDir, 'valid-test.yml'),
        syntaxCheck: false
      });

      expect(result.success).toBe(true);
      expect(result.output).toMatch(/valid|YAML structure is valid/);
    });

    it('should detect invalid YAML', async () => {
      await fs.writeFile(
        path.join(testOutputDir, 'invalid-test.yml'),
        '---\n- hosts: all\n  tasks:\n    - ping:\n      bad indent'
      );

      const result = await global.testUtils.callMCPTool(server, 'validate-playbook', {
        playbook: path.join(testOutputDir, 'invalid-test.yml'),
        syntaxCheck: false
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid YAML');
    });

    it('should handle non-existent playbook', async () => {
      const result = await global.testUtils.callMCPTool(server, 'validate-playbook', {
        playbook: path.join(testOutputDir, 'does-not-exist.yml'),
        syntaxCheck: false
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('create-role-structure', () => {
    it('should create complete role structure', async () => {
      const result = await global.testUtils.callMCPTool(server, 'create-role-structure', {
        roleName: 'test-role',
        includeTasks: ['install', 'configure'],
        includeHandlers: ['restart service'],
        includeTemplates: true,
        includeDefaults: true
      });

      expect(result.success).toBe(true);
      expect(result.output).toContain('Created role structure');

      // Verify directories were created
      const roleBase = path.join(process.cwd(), 'roles', 'test-role');
      const expectedDirs = ['tasks', 'handlers', 'templates', 'defaults'];
      
      for (const dir of expectedDirs) {
        const exists = await fs.access(path.join(roleBase, dir)).then(() => true).catch(() => false);
        expect(exists).toBe(true);
      }
    });
  });
});