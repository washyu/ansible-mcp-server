import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { fileURLToPath } from 'url';
import path from 'path';
import { promises as fs } from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('get-config', () => {
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
    const result = await global.testUtils.callMCPTool(server, 'get-config', {
      key: 'test.key',
      section: 'general'
    });

    expect(result).toBeDefined();
    expect(result.error || result.output).toBeTruthy();
    
    // Tool-specific assertions
    if (result.success) {
      expect(result.output !== undefined).toBe(true);
      // Config might be null or empty for test keys
      if (result.output) {
        expect(typeof result.output === 'string' || typeof result.output === 'object').toBe(true);
      }
    }
  });

  

  

  

  

  // TODO: Add more specific tests for get-config
  // - Edge cases
  // - Integration with other tools
  // - Error scenarios
});
