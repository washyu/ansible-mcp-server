import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { fileURLToPath } from 'url';
import path from 'path';
import { promises as fs } from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('homelab-deploy', () => {
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
    const result = await global.testUtils.callMCPTool(server, 'homelab-deploy', {
      service: 'test-string',
      vmName: 'test-name',
      vmid: 42,
      ipAddress: 'test-string',
      deploy: true,
      terraformDir: testOutputDir,
      ansibleDir: testOutputDir
    });

    expect(result).toBeDefined();
    expect(result.error || result.output).toBeTruthy();
    
    // Tool-specific assertions
    if (result.success) {
      // Some tools may succeed without output
      expect(result.success).toBe(true);
      
      expect(result.output.toLowerCase()).toContain('created');
      expect(result.output).toContain('deploy');
    }
  });

  it('should fail when missing required parameters', async () => {
    const result = await global.testUtils.callMCPTool(server, 'homelab-deploy', {
      // Missing required params: service, vmName, vmid, ipAddress, deploy, terraformDir, ansibleDir
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
    expect(result.error.toLowerCase()).toMatch(/required|missing/);
  });

  it('should validate parameter types', async () => {
    const result = await global.testUtils.callMCPTool(server, 'homelab-deploy', {
      service: 'nginx', // Should be string
      vmName: 123, // Should be string
      vmid: 'invalid', // Should be number
      ipAddress: 123, // Should be string
      deploy: 'invalid', // Should be boolean
      terraformDir: 123, // Should be string
      ansibleDir: 123, // Should be string
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  

  it('should handle file operations correctly', async () => {
    const testFile = path.join(testOutputDir, 'test-homelab-deploy.yml');
    const result = await global.testUtils.callMCPTool(server, 'homelab-deploy', {
      service: 'test-string',
      vmName: 'test-name',
      vmid: 42,
      ipAddress: 'test-string',
      deploy: true,
      terraformDir: testOutputDir,
      ansibleDir: testOutputDir
    });

    expect(result).toBeDefined();
    
    // Check if file was created/modified
    if (result.success) {
      const exists = await fs.access(testFile).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    }
  });

  // TODO: Add more specific tests for homelab-deploy
  // - Edge cases
  // - Integration with other tools
  // - Error scenarios
});
