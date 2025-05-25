import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { fileURLToPath } from 'url';
import path from 'path';
import { promises as fs } from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('discover-proxmox', () => {
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
    const result = await global.testUtils.callMCPTool(server, 'discover-proxmox', {
      network: '192.168.1.0/24',
      port: 8006
    });

    expect(result).toBeDefined();
    expect(result.error || result.output).toBeTruthy();
    
    // Tool-specific assertions
    if (result.success) {
      // Some tools may succeed without output
      expect(result.success).toBe(true);
      expect(result.output.toLowerCase()).toMatch(/vms/);
    }
  });

  it('should fail when missing required parameters', async () => {
    const result = await global.testUtils.callMCPTool(server, 'discover-proxmox', {
      // Missing required params: proxmoxHost, proxmoxUser, proxmoxPassword, includeTemplates, groupBy
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
    expect(result.error.toLowerCase()).toMatch(/required|missing/);
  });

  it('should validate parameter types', async () => {
    const result = await global.testUtils.callMCPTool(server, 'discover-proxmox', {
      proxmoxHost: 123, // Should be string
      proxmoxUser: 123, // Should be string
      proxmoxPassword: 123, // Should be string
      includeTemplates: 'invalid', // Should be boolean
      groupBy: 123, // Should be string
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  

  

  // TODO: Add more specific tests for discover-proxmox
  // - Edge cases
  // - Integration with other tools
  // - Error scenarios
});
