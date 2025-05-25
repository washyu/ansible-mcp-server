/**
 * Comprehensive test suite for all MCP tools
 * Tests each tool with various scenarios including error cases
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

describe('MCP Tools Comprehensive Test Suite', () => {
  let server;

  beforeEach(async () => {
    server = global.testUtils.createMCPServer();
    await global.testUtils.waitForServer(server);
  });

  afterEach(() => {
    if (server) {
      server.kill();
    }
  });

  describe('Ansible Tools', () => {
    describe('ansible-playbook', () => {
      it('should execute basic playbook', async () => {
        const result = await global.testUtils.callMCPTool(server, 'ansible-playbook', {
          playbook: 'test.yml'
        });
        
        expect(result.success).toBe(true);
        expect(result.output).toContain('ansible-playbook');
      });

      it('should run in check mode', async () => {
        const result = await global.testUtils.callMCPTool(server, 'ansible-playbook', {
          playbook: 'test.yml',
          check: true
        });
        
        expect(result.success).toBe(true);
        expect(result.output).toContain('--check');
      });

      it('should pass extra variables', async () => {
        const result = await global.testUtils.callMCPTool(server, 'ansible-playbook', {
          playbook: 'test.yml',
          extraVars: { test_var: 'value' }
        });
        
        expect(result.success).toBe(true);
        expect(result.output).toContain('--extra-vars');
      });

      it('should fail with invalid playbook path', async () => {
        const result = await global.testUtils.callMCPTool(server, 'ansible-playbook', {
          playbook: '../../../etc/passwd'
        });
        
        expect(result.success).toBe(false);
        expect(result.error).toBeTruthy();
      });

      it('should fail with non-existent playbook', async () => {
        const result = await global.testUtils.callMCPTool(server, 'ansible-playbook', {
          playbook: 'does-not-exist.yml'
        });
        
        expect(result.success).toBe(false);
      });
    });

    describe('create-playbook', () => {
      it('should create basic playbook', async () => {
        const result = await global.testUtils.callMCPTool(server, 'create-playbook', {
          name: 'test-playbook',
          hosts: 'all',
          tasks: [
            {
              name: 'Test task',
              module: 'debug',
              args: { msg: 'Hello World' }
            }
          ]
        });
        
        expect(result.success).toBe(true);
        expect(result.output).toContain('Created playbook');
      });

      it('should create complex playbook with vars', async () => {
        const result = await global.testUtils.callMCPTool(server, 'create-playbook', {
          name: 'complex-playbook',
          hosts: 'webservers',
          vars: { test_var: 'value' },
          tasks: [
            {
              name: 'Install nginx',
              module: 'package',
              args: { name: 'nginx', state: 'present' },
              become: true
            }
          ]
        });
        
        expect(result.success).toBe(true);
      });
    });
  });

  describe('Service Management Tools', () => {
    describe('browse-services', () => {
      it('should browse all services', async () => {
        const result = await global.testUtils.callMCPTool(server, 'browse-services', {
          category: 'all'
        });
        
        expect(result.success).toBe(true);
        const output = JSON.parse(result.output);
        expect(output.total).toBeGreaterThan(0);
        expect(output.services).toBeInstanceOf(Array);
      });

      it('should browse dev-tools category', async () => {
        const result = await global.testUtils.callMCPTool(server, 'browse-services', {
          category: 'dev-tools'
        });
        
        expect(result.success).toBe(true);
        const output = JSON.parse(result.output);
        expect(output.category).toBe('dev-tools');
      });

      it('should search for Jenkins', async () => {
        const result = await global.testUtils.callMCPTool(server, 'browse-services', {
          search: 'jenkins'
        });
        
        expect(result.success).toBe(true);
        const output = JSON.parse(result.output);
        const jenkinsService = output.services.find(s => s.name === 'Jenkins');
        expect(jenkinsService).toBeDefined();
      });
    });

    describe('service-details', () => {
      it('should get Jenkins details', async () => {
        const result = await global.testUtils.callMCPTool(server, 'service-details', {
          serviceName: 'Jenkins'
        });
        
        expect(result.success).toBe(true);
        const service = JSON.parse(result.output);
        expect(service.name).toBe('Jenkins');
        expect(service.category).toBe('dev-tools');
      });

      it('should fail for non-existent service', async () => {
        const result = await global.testUtils.callMCPTool(server, 'service-details', {
          serviceName: 'NonExistentService'
        });
        
        expect(result.success).toBe(false);
        expect(result.error).toContain('not found');
      });
    });

    describe('deploy-service', () => {
      it('should return deployment plan for Jenkins', async () => {
        const result = await global.testUtils.callMCPTool(server, 'deploy-service', {
          serviceName: 'Jenkins',
          vmName: 'jenkins-test',
          vmid: 150,
          ipAddress: '192.168.10.50'
        });
        
        // This is currently a stub, so we just check it returns successfully
        expect(result.success).toBe(true);
        expect(result.output).toContain('Jenkins');
      });
    });
  });

  describe('Infrastructure Tools', () => {
    describe('create-vm-template', () => {
      it('should create Jenkins VM template', async () => {
        const result = await global.testUtils.callMCPTool(server, 'create-vm-template', {
          name: 'jenkins',
          vmid: 150,
          template: 'ubuntu-cloud',
          cores: 4,
          memory: 4096,
          disk: '50G',
          network: {
            bridge: 'vmbr0',
            ip: '192.168.10.50',
            gateway: '192.168.10.1'
          }
        });
        
        expect(result.success).toBe(true);
        expect(result.output).toContain('terraform');
      });
    });

    describe('generate-diagram', () => {
      it('should generate Mermaid diagram', async () => {
        const result = await global.testUtils.callMCPTool(server, 'generate-diagram', {
          format: 'mermaid'
        });
        
        expect(result.success).toBe(true);
        expect(result.output).toContain('graph');
      });

      it('should generate ASCII diagram', async () => {
        const result = await global.testUtils.callMCPTool(server, 'generate-diagram', {
          format: 'ascii'
        });
        
        expect(result.success).toBe(true);
        expect(result.output).toContain('Infrastructure Overview');
      });
    });

    describe('discover-proxmox', () => {
      it('should skip if no Proxmox config', async () => {
        if (!process.env.PROXMOX_HOST) {
          const result = await global.testUtils.callMCPTool(server, 'discover-proxmox', {
            groupBy: 'all'
          });
          
          expect(result.success).toBe(false);
          expect(result.error).toContain('password not provided');
        } else {
          // If configured, test discovery
          const result = await global.testUtils.callMCPTool(server, 'discover-proxmox', {
            groupBy: 'all'
          });
          
          expect(result.success).toBe(true);
        }
      });
    });
  });

  describe('Utility Tools', () => {
    describe('list-loaded-tools', () => {
      it('should list all loaded tools', async () => {
        const result = await global.testUtils.callMCPTool(server, 'list-loaded-tools', {});
        
        expect(result.success).toBe(true);
        const output = JSON.parse(result.output);
        expect(output.totalTools).toBe(57);
        expect(output.toolsByCategory).toBeDefined();
      });
    });

    describe('server-health', () => {
      it('should check server health', async () => {
        const result = await global.testUtils.callMCPTool(server, 'server-health', {});
        
        expect(result.success).toBe(true);
        expect(result.output).toContain('healthy');
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid tool name', async () => {
      const result = await global.testUtils.callMCPTool(server, 'non-existent-tool', {});
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown tool');
    });

    it('should handle missing required parameters', async () => {
      const result = await global.testUtils.callMCPTool(server, 'ansible-playbook', {});
      
      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });
  });
});