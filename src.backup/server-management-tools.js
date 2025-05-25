// Server management tools for MCP
// Allows Claude to restart services, check status, and get logs

import { exec } from 'child_process';
import { promisify } from 'util';
import { z } from 'zod';

const execAsync = promisify(exec);

// Tool schemas
const restartServiceSchema = z.object({
  service: z.enum(['mcp', 'sse', 'both']).describe('Which service to restart'),
  reason: z.string().optional().describe('Reason for restart')
});

const getLogsSchema = z.object({
  service: z.enum(['mcp', 'sse', 'system']).describe('Which logs to retrieve'),
  lines: z.number().default(50).describe('Number of log lines to retrieve'),
  since: z.string().optional().describe('Time specification (e.g., "5 minutes ago")')
});

const checkHealthSchema = z.object({
  detailed: z.boolean().default(false).describe('Include detailed diagnostics')
});

const debugCommandSchema = z.object({
  command: z.string().describe('Diagnostic command to run'),
  safe: z.boolean().default(true).describe('Only allow safe read-only commands')
});

// Implementation
export const serverManagementTools = [
  {
    name: 'server-restart',
    description: 'Restart MCP or SSE server to recover from errors',
    inputSchema: restartServiceSchema,
    handler: async (args) => {
      const { service, reason } = args;
      
      try {
        let output = '';
        
        if (reason) {
          output += `Restart reason: ${reason}\n\n`;
        }
        
        switch (service) {
          case 'mcp':
            // For MCP, we need to trigger a restart through the SSE server
            output += 'Requesting MCP process restart...\n';
            // This would need to be implemented in the SSE server
            output += 'Note: MCP restart requires SSE server support\n';
            break;
            
          case 'sse':
            const { stdout: sseRestart } = await execAsync('sudo systemctl restart sse-server');
            output += 'SSE server restarted\n';
            
            // Wait for it to come back up
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            const { stdout: sseStatus } = await execAsync('sudo systemctl status sse-server --no-pager');
            output += '\nSSE Server Status:\n' + sseStatus;
            break;
            
          case 'both':
            const { stdout: bothRestart } = await execAsync('sudo systemctl restart sse-server ansible-mcp-server');
            output += 'Both services restarted\n';
            
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            const { stdout: bothStatus } = await execAsync('sudo systemctl status sse-server ansible-mcp-server --no-pager');
            output += '\nServices Status:\n' + bothStatus;
            break;
        }
        
        return { output, success: true };
      } catch (error) {
        return {
          error: `Failed to restart service: ${error.message}`,
          success: false
        };
      }
    }
  },
  
  {
    name: 'server-logs',
    description: 'Get server logs for debugging',
    inputSchema: getLogsSchema,
    handler: async (args) => {
      const { service, lines, since } = args;
      
      try {
        let command = '';
        
        switch (service) {
          case 'mcp':
            command = `sudo journalctl -u ansible-mcp-server -n ${lines} --no-pager`;
            break;
          case 'sse':
            command = `sudo journalctl -u sse-server -n ${lines} --no-pager`;
            break;
          case 'system':
            command = `sudo journalctl -n ${lines} --no-pager`;
            break;
        }
        
        if (since) {
          command += ` --since "${since}"`;
        }
        
        const { stdout } = await execAsync(command);
        
        return {
          output: stdout,
          command: command,
          success: true
        };
      } catch (error) {
        return {
          error: `Failed to get logs: ${error.message}`,
          success: false
        };
      }
    }
  },
  
  {
    name: 'server-health',
    description: 'Check server health and dependencies',
    inputSchema: checkHealthSchema,
    handler: async (args) => {
      const { detailed } = args;
      
      try {
        let output = '=== Server Health Check ===\n\n';
        
        // Check services
        const services = ['sse-server', 'ansible-mcp-server'];
        for (const service of services) {
          try {
            const { stdout } = await execAsync(`sudo systemctl is-active ${service}`);
            output += `✓ ${service}: ${stdout.trim()}\n`;
          } catch {
            output += `✗ ${service}: inactive or not found\n`;
          }
        }
        
        output += '\n';
        
        // Check dependencies
        const commands = [
          { name: 'Node.js', cmd: 'node --version' },
          { name: 'Ansible', cmd: 'ansible --version | head -1' },
          { name: 'Terraform', cmd: 'terraform version | head -1' },
          { name: 'Python', cmd: 'python3 --version' },
          { name: 'Git', cmd: 'git --version' }
        ];
        
        output += '=== Dependencies ===\n';
        for (const { name, cmd } of commands) {
          try {
            const { stdout } = await execAsync(cmd);
            output += `✓ ${name}: ${stdout.trim()}\n`;
          } catch {
            output += `✗ ${name}: not found\n`;
          }
        }
        
        if (detailed) {
          output += '\n=== Detailed Diagnostics ===\n';
          
          // Check disk space
          try {
            const { stdout: df } = await execAsync('df -h / | tail -1');
            output += `Disk usage: ${df.trim()}\n`;
          } catch {}
          
          // Check memory
          try {
            const { stdout: mem } = await execAsync('free -h | grep Mem');
            output += `Memory: ${mem.trim()}\n`;
          } catch {}
          
          // Check load average
          try {
            const { stdout: load } = await execAsync('uptime');
            output += `System load: ${load.trim()}\n`;
          } catch {}
          
          // Check SSE port
          try {
            const { stdout: port } = await execAsync('sudo ss -tlnp | grep :3001');
            output += `\nSSE Port 3001: ${port ? 'LISTENING' : 'NOT LISTENING'}\n`;
          } catch {
            output += '\nSSE Port 3001: NOT LISTENING\n';
          }
          
          // Recent errors
          try {
            const { stdout: errors } = await execAsync('sudo journalctl -p err -n 10 --no-pager');
            output += '\n=== Recent System Errors ===\n' + errors;
          } catch {}
        }
        
        return { output, success: true };
      } catch (error) {
        return {
          error: `Health check failed: ${error.message}`,
          success: false
        };
      }
    }
  },
  
  {
    name: 'server-debug',
    description: 'Run diagnostic commands for debugging',
    inputSchema: debugCommandSchema,
    handler: async (args) => {
      const { command, safe } = args;
      
      // Whitelist of safe commands
      const safeCommands = [
        'ps aux',
        'netstat -tlnp',
        'ss -tlnp',
        'systemctl status',
        'which ansible',
        'which terraform',
        'env',
        'pwd',
        'ls -la',
        'cat /etc/os-release',
        'uname -a',
        'hostname',
        'ip addr',
        'docker ps',
        'docker-compose ps'
      ];
      
      // Check if command is safe
      if (safe) {
        const isAllowed = safeCommands.some(allowed => 
          command.startsWith(allowed) || command === allowed
        );
        
        if (!isAllowed) {
          return {
            error: 'Command not in safe list. Set safe=false to run arbitrary commands.',
            allowedCommands: safeCommands,
            success: false
          };
        }
      }
      
      try {
        const { stdout, stderr } = await execAsync(command, {
          timeout: 10000 // 10 second timeout
        });
        
        return {
          output: stdout,
          error: stderr,
          command: command,
          success: true
        };
      } catch (error) {
        return {
          error: `Command failed: ${error.message}`,
          command: command,
          success: false
        };
      }
    }
  }
];

// Export tool definitions for MCP registration
export const getServerManagementToolDefinitions = () => {
  return serverManagementTools.map(tool => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema
  }));
};