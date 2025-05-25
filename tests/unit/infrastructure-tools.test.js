import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import path from 'path';
import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('Infrastructure Tools', () => {
  let server;
  const testOutputDir = path.join(__dirname, '../test-output');

  beforeEach(async () => {
    await fs.mkdir(testOutputDir, { recursive: true });
    server = global.testUtils.createMCPServer();
    await global.testUtils.waitForServer(server);
  });

  afterEach(() => {
    if (server) {
      server.kill();
    }
  });

  describe('network-topology', () => {
    it('should generate network topology visualization', async () => {
      const result = await global.testUtils.callMCPTool(server, 'network-topology', {
        format: 'mermaid'
      });

      expect(result.success).toBe(true);
      expect(result.output).toContain('graph TD');
      expect(result.output).toContain('Network Topology');
    });

    it('should generate ASCII format topology', async () => {
      const result = await global.testUtils.callMCPTool(server, 'network-topology', {
        format: 'ascii'
      });

      expect(result.success).toBe(true);
      expect(result.output).toContain('Network Topology');
      expect(result.output).toContain('='); // ASCII art borders
    });
  });

  describe('generate-diagram', () => {
    it('should generate infrastructure diagram', async () => {
      const result = await global.testUtils.callMCPTool(server, 'generate-diagram', {
        type: 'network',
        format: 'mermaid',
        outputFile: path.join(testOutputDir, 'test-diagram.md')
      });

      expect(result.success).toBe(true);
      expect(result.output).toContain('generated successfully');

      // Check file was created
      const exists = await fs.access(path.join(testOutputDir, 'test-diagram.md'))
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);
    });
  });

  describe('generate-inventory', () => {
    it('should generate Ansible inventory', async () => {
      const result = await global.testUtils.callMCPTool(server, 'generate-inventory', {
        includeOffline: false,
        outputFile: path.join(testOutputDir, 'test-inventory.yml')
      });

      expect(result.success).toBe(true);
      expect(result.output).toContain('Generated inventory');

      // Check file was created
      const exists = await fs.access(path.join(testOutputDir, 'test-inventory.yml'))
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);
    });
  });

  // Note: These tests don't use mocking since they're integration tests
  // They test the actual tool functionality without external dependencies
});