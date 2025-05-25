import { describe, it, expect } from '@jest/globals';
import { spawnAsync, findCommand } from '../../src/command-utils.js';

describe('Command Utils', () => {
  describe('spawnAsync', () => {
    it('should execute simple commands', async () => {
      const result = await spawnAsync('echo', ['Hello Jest']);
      
      expect(result.code).toBe(0);
      expect(result.stdout.trim()).toBe('Hello Jest');
      expect(result.stderr).toBe('');
    });

    it('should handle command errors', async () => {
      try {
        await spawnAsync('false', []);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.code).not.toBe(0);
        expect(error.message).toContain('Command failed');
      }
    });

    it('should capture stderr', async () => {
      try {
        await spawnAsync('sh', ['-c', 'echo "error" >&2; exit 1']);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.stderr).toContain('error');
      }
    });
  });

  describe('findCommand', () => {
    it('should find common commands', () => {
      const echoPath = findCommand('echo');
      expect(echoPath).toBeTruthy();
      expect(echoPath).toContain('echo');
    });

    it('should return null for non-existent commands', () => {
      const result = findCommand('nonexistentcommand12345');
      expect(result).toBeNull();
    });
  });
});