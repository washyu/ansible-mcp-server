// Security and threat assessment tools for MCP server

import { exec } from 'child_process';
import { promisify } from 'util';
import { promises as fs } from 'fs';
import path from 'path';

const execAsync = promisify(exec);

// Security assessment tools
const securityTools = [
  {
    name: 'security-scan-ports',
    description: 'Scan for open ports on specified hosts',
    inputSchema: {
      type: 'object',
      properties: {
        targets: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of hosts/IPs to scan',
          default: ['localhost']
        },
        portRange: {
          type: 'string',
          description: 'Port range to scan (e.g., "1-1000")',
          default: '1-65535'
        }
      }
    },
    handler: async ({ targets = ['localhost'], portRange = '1-65535' }) => {
      try {
        const results = [];
        
        // Check if nmap is installed
        try {
          await execAsync('which nmap');
        } catch {
          return {
            success: false,
            error: 'nmap is not installed. Install with: sudo apt-get install nmap',
            output: ''
          };
        }

        for (const target of targets) {
          try {
            // Basic port scan using nmap
            const { stdout } = await execAsync(
              `nmap -p ${portRange} --open ${target}`,
              { timeout: 300000 } // 5 minute timeout
            );
            results.push(`\n=== Port scan for ${target} ===\n${stdout}`);
          } catch (error) {
            results.push(`\n=== Error scanning ${target} ===\n${error.message}`);
          }
        }

        return {
          success: true,
          output: results.join('\n'),
          error: ''
        };
      } catch (error) {
        return {
          success: false,
          error: error.message,
          output: ''
        };
      }
    }
  },

  {
    name: 'security-check-passwords',
    description: 'Check for weak passwords and password policies',
    inputSchema: {
      type: 'object',
      properties: {
        checkPolicy: {
          type: 'boolean',
          description: 'Check password policy settings',
          default: true
        }
      }
    },
    handler: async ({ checkPolicy = true }) => {
      try {
        const results = [];

        // Check password policy
        if (checkPolicy) {
          try {
            // Check PAM password requirements
            const { stdout: pamConfig } = await execAsync(
              'cat /etc/pam.d/common-password 2>/dev/null || cat /etc/pam.d/system-auth 2>/dev/null'
            );
            results.push('=== Password Policy Configuration ===');
            results.push(pamConfig);

            // Check password aging
            const { stdout: loginDefs } = await execAsync('grep -E "^PASS_" /etc/login.defs');
            results.push('\n=== Password Aging Settings ===');
            results.push(loginDefs);
          } catch (error) {
            results.push(`Error checking password policy: ${error.message}`);
          }
        }

        // Check for users with empty passwords
        try {
          const { stdout: emptyPasswords } = await execAsync(
            'sudo awk -F: \'($2 == "") {print $1}\' /etc/shadow'
          );
          if (emptyPasswords.trim()) {
            results.push('\n⚠️  WARNING: Users with empty passwords:');
            results.push(emptyPasswords);
          } else {
            results.push('\n✅ No users with empty passwords found');
          }
        } catch {
          results.push('\n⚠️  Unable to check for empty passwords (requires sudo)');
        }

        return {
          success: true,
          output: results.join('\n'),
          error: ''
        };
      } catch (error) {
        return {
          success: false,
          error: error.message,
          output: ''
        };
      }
    }
  },

  {
    name: 'security-audit-accounts',
    description: 'Audit user accounts for security issues',
    inputSchema: {
      type: 'object',
      properties: {
        checkSudo: {
          type: 'boolean',
          description: 'Check sudo access',
          default: true
        },
        checkDefaults: {
          type: 'boolean',
          description: 'Check for default accounts',
          default: true
        }
      }
    },
    handler: async ({ checkSudo = true, checkDefaults = true }) => {
      try {
        const results = [];

        // List all user accounts with shells
        const { stdout: users } = await execAsync(
          'awk -F: \'$3 >= 1000 && $7 !~ /nologin|false/ {print $1":"$3":"$7}\' /etc/passwd'
        );
        results.push('=== User Accounts with Login Shells ===');
        results.push(users);

        // Check sudo access
        if (checkSudo) {
          try {
            const { stdout: sudoers } = await execAsync('getent group sudo wheel 2>/dev/null | cut -d: -f4');
            results.push('\n=== Users with sudo access ===');
            results.push(sudoers || 'No sudo group found');

            // Check sudoers file
            const { stdout: sudoersFile } = await execAsync('sudo cat /etc/sudoers | grep -v "^#" | grep -v "^$"');
            results.push('\n=== Sudoers Configuration ===');
            results.push(sudoersFile);
          } catch {
            results.push('\n⚠️  Unable to check sudo configuration (requires sudo)');
          }
        }

        // Check for default accounts
        if (checkDefaults) {
          const defaultAccounts = ['pi', 'ubuntu', 'debian', 'admin', 'test', 'guest'];
          results.push('\n=== Checking for common default accounts ===');
          
          for (const account of defaultAccounts) {
            try {
              await execAsync(`id ${account} 2>/dev/null`);
              results.push(`⚠️  Default account found: ${account}`);
            } catch {
              // Account doesn't exist, which is good
            }
          }
        }

        // Check for accounts with UID 0 (root privileges)
        const { stdout: uid0 } = await execAsync('awk -F: \'$3 == 0 {print $1}\' /etc/passwd');
        results.push('\n=== Accounts with UID 0 (root) ===');
        results.push(uid0);

        return {
          success: true,
          output: results.join('\n'),
          error: ''
        };
      } catch (error) {
        return {
          success: false,
          error: error.message,
          output: ''
        };
      }
    }
  },

  {
    name: 'security-check-updates',
    description: 'Check for security updates and vulnerable packages',
    inputSchema: {
      type: 'object',
      properties: {
        checkCVE: {
          type: 'boolean',
          description: 'Check for known CVEs (requires internet)',
          default: false
        }
      }
    },
    handler: async ({ checkCVE = false }) => {
      try {
        const results = [];

        // Detect package manager
        let packageManager = '';
        try {
          await execAsync('which apt-get');
          packageManager = 'apt';
        } catch {
          try {
            await execAsync('which yum');
            packageManager = 'yum';
          } catch {
            return {
              success: false,
              error: 'Unsupported package manager',
              output: ''
            };
          }
        }

        // Check for security updates
        if (packageManager === 'apt') {
          try {
            await execAsync('sudo apt-get update -qq');
            const { stdout: updates } = await execAsync(
              'apt list --upgradable 2>/dev/null | grep -i security || echo "No security updates available"'
            );
            results.push('=== Security Updates Available ===');
            results.push(updates);
          } catch (error) {
            results.push(`Error checking updates: ${error.message}`);
          }
        }

        // Check for outdated packages
        if (packageManager === 'apt') {
          const { stdout: oldPackages } = await execAsync(
            'apt list --installed 2>/dev/null | head -20'
          );
          results.push('\n=== Sample of Installed Packages ===');
          results.push(oldPackages);
        }

        // Check for CVEs if requested
        if (checkCVE) {
          results.push('\n=== CVE Checking ===');
          results.push('Note: Full CVE scanning requires specialized tools like:');
          results.push('- Trivy: https://github.com/aquasecurity/trivy');
          results.push('- Grype: https://github.com/anchore/grype');
          results.push('- OpenVAS: https://www.openvas.org/');
        }

        return {
          success: true,
          output: results.join('\n'),
          error: ''
        };
      } catch (error) {
        return {
          success: false,
          error: error.message,
          output: ''
        };
      }
    }
  },

  {
    name: 'security-check-firewall',
    description: 'Check firewall configuration and rules',
    inputSchema: {
      type: 'object',
      properties: {}
    },
    handler: async () => {
      try {
        const results = [];

        // Check UFW (Ubuntu Firewall)
        try {
          const { stdout: ufwStatus } = await execAsync('sudo ufw status verbose');
          results.push('=== UFW Firewall Status ===');
          results.push(ufwStatus);
        } catch {
          results.push('UFW not found or not accessible');
        }

        // Check iptables
        try {
          const { stdout: iptables } = await execAsync('sudo iptables -L -n -v');
          results.push('\n=== IPTables Rules ===');
          results.push(iptables);
        } catch {
          results.push('\nIPTables not accessible (requires sudo)');
        }

        // Check firewalld
        try {
          const { stdout: firewalld } = await execAsync('sudo firewall-cmd --list-all 2>/dev/null');
          results.push('\n=== Firewalld Status ===');
          results.push(firewalld);
        } catch {
          // Firewalld not installed or not running
        }

        return {
          success: true,
          output: results.join('\n'),
          error: ''
        };
      } catch (error) {
        return {
          success: false,
          error: error.message,
          output: ''
        };
      }
    }
  },

  {
    name: 'security-check-ssh',
    description: 'Audit SSH configuration for security',
    inputSchema: {
      type: 'object',
      properties: {}
    },
    handler: async () => {
      try {
        const results = [];
        const sshConfig = '/etc/ssh/sshd_config';

        // Read SSH config
        try {
          const config = await fs.readFile(sshConfig, 'utf8');
          
          results.push('=== SSH Security Configuration ===');
          
          // Check critical settings
          const checks = [
            { setting: 'PermitRootLogin', recommended: 'no' },
            { setting: 'PasswordAuthentication', recommended: 'no' },
            { setting: 'PubkeyAuthentication', recommended: 'yes' },
            { setting: 'PermitEmptyPasswords', recommended: 'no' },
            { setting: 'X11Forwarding', recommended: 'no' },
            { setting: 'Protocol', recommended: '2' }
          ];

          for (const check of checks) {
            const regex = new RegExp(`^\\s*${check.setting}\\s+(.+)`, 'mi');
            const match = config.match(regex);
            const value = match ? match[1].trim() : 'not set';
            const status = value === check.recommended ? '✅' : '⚠️';
            results.push(`${status} ${check.setting}: ${value} (recommended: ${check.recommended})`);
          }

          // Check for SSH keys
          const { stdout: authorizedKeys } = await execAsync(
            'find /home -name authorized_keys -type f 2>/dev/null | wc -l'
          );
          results.push(`\n=== SSH Keys ===`);
          results.push(`Authorized key files found: ${authorizedKeys.trim()}`);

          // Check SSH port
          const portMatch = config.match(/^\s*Port\s+(\d+)/mi);
          const sshPort = portMatch ? portMatch[1] : '22';
          results.push(`\nSSH Port: ${sshPort} ${sshPort === '22' ? '⚠️  (default port)' : '✅ (non-default)'}`);

        } catch (error) {
          results.push(`Error reading SSH config: ${error.message}`);
        }

        return {
          success: true,
          output: results.join('\n'),
          error: ''
        };
      } catch (error) {
        return {
          success: false,
          error: error.message,
          output: ''
        };
      }
    }
  },

  {
    name: 'security-quick-scan',
    description: 'Run a quick security assessment covering basic checks',
    inputSchema: {
      type: 'object',
      properties: {
        target: {
          type: 'string',
          description: 'Target host to scan',
          default: 'localhost'
        }
      }
    },
    handler: async ({ target = 'localhost' }) => {
      try {
        const results = [];
        results.push(`=== Quick Security Scan for ${target} ===\n`);

        // 1. Check common ports
        results.push('1. Checking common ports...');
        try {
          const { stdout } = await execAsync(
            `nmap -p 22,80,443,3306,5432,6379,27017,8080,8443 --open ${target}`,
            { timeout: 60000 }
          );
          results.push(stdout);
        } catch {
          results.push('⚠️  Port scanning failed (nmap may not be installed)');
        }

        // 2. Check running services
        results.push('\n2. Checking running services...');
        const { stdout: services } = await execAsync(
          'systemctl list-units --type=service --state=running | grep -E "(ssh|http|mysql|postgres|mongo|redis)" || true'
        );
        results.push(services || 'No matching services found');

        // 3. Check for updates
        results.push('\n3. Checking for security updates...');
        try {
          const { stdout: updates } = await execAsync(
            'apt list --upgradable 2>/dev/null | grep -i security | head -5 || echo "No security updates found"'
          );
          results.push(updates);
        } catch {
          results.push('Unable to check for updates');
        }

        // 4. Basic account check
        results.push('\n4. Checking user accounts...');
        const { stdout: userCount } = await execAsync(
          'awk -F: \'$3 >= 1000 && $7 !~ /nologin|false/ {print $1}\' /etc/passwd | wc -l'
        );
        results.push(`Active user accounts: ${userCount.trim()}`);

        // 5. Firewall status
        results.push('\n5. Checking firewall...');
        try {
          const { stdout: fw } = await execAsync('sudo ufw status | head -1');
          results.push(fw);
        } catch {
          results.push('Firewall status unknown');
        }

        results.push('\n✅ Quick scan complete. Run individual security tools for detailed analysis.');

        return {
          success: true,
          output: results.join('\n'),
          error: ''
        };
      } catch (error) {
        return {
          success: false,
          error: error.message,
          output: ''
        };
      }
    }
  }
];

export { securityTools };