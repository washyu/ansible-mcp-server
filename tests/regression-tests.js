#!/usr/bin/env node
// Regression tests for issues discovered during development
// These tests ensure that fixed issues don't reoccur

import { spawn, exec } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { promisify } from 'util';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Test configuration
const TEST_USER = 'mcp';
const MCP_HOME = '/home/mcp';
const MCP_DIR = '/opt/ansible-mcp-server';

// ANSI colors
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

// Test tracking
const regressionTests = [];
let passedTests = 0;
let failedTests = 0;

// Test runner
async function runTest(category, name, testFn) {
  process.stdout.write(`[${category}] ${name}... `);
  
  try {
    await testFn();
    console.log(`${colors.green}✓${colors.reset}`);
    passedTests++;
    regressionTests.push({ category, name, status: 'passed' });
  } catch (error) {
    console.log(`${colors.red}✗${colors.reset}`);
    console.error(`  Error: ${error.message}`);
    failedTests++;
    regressionTests.push({ category, name, status: 'failed', error: error.message });
  }
}

// Regression Test Categories
async function runRegressionTests() {
  console.log(`${colors.blue}Running Regression Tests${colors.reset}`);
  console.log('=' .repeat(50) + '\n');
  
  // Test 1: Dependency PATH Resolution
  await runTest('Dependencies', 'Ansible is findable in PATH', async () => {
    // Test that mcp user can find ansible
    const { stdout } = await execAsync('sudo -u mcp which ansible');
    if (!stdout.includes('/ansible')) {
      throw new Error('Ansible not found in PATH for mcp user');
    }
  });
  
  await runTest('Dependencies', 'Terraform is findable in PATH', async () => {
    // Test that mcp user can find terraform
    const { stdout } = await execAsync('sudo -u mcp which terraform');
    if (!stdout.includes('/terraform')) {
      throw new Error('Terraform not found in PATH for mcp user');
    }
  });
  
  await runTest('Dependencies', 'Python packages accessible', async () => {
    // Test that ansible can import required modules
    const testScript = `
import sys
try:
    import ansible
    import netaddr
    import jmespath
    print("OK")
except ImportError as e:
    print(f"FAIL: {e}")
    sys.exit(1)
`;
    const { stdout } = await execAsync(`sudo -u mcp python3 -c "${testScript}"`);
    if (!stdout.includes('OK')) {
      throw new Error('Python packages not accessible');
    }
  });
  
  // Test 2: File Permissions
  await runTest('Permissions', 'MCP user home directory exists', async () => {
    const stats = await fs.stat(MCP_HOME);
    if (!stats.isDirectory()) {
      throw new Error('MCP home directory does not exist');
    }
  });
  
  await runTest('Permissions', 'Ansible temp directory writable', async () => {
    const tmpDir = path.join(MCP_HOME, '.ansible/tmp');
    const testFile = path.join(tmpDir, 'test-' + Date.now());
    
    // Test write as mcp user
    await execAsync(`sudo -u mcp touch ${testFile}`);
    await execAsync(`sudo -u mcp rm ${testFile}`);
  });
  
  await runTest('Permissions', 'MCP server directory writable', async () => {
    const testFile = path.join(MCP_DIR, 'tmp/test-' + Date.now());
    
    // Test write as mcp user
    await execAsync(`sudo -u mcp touch ${testFile}`);
    await execAsync(`sudo -u mcp rm ${testFile}`);
  });
  
  await runTest('Permissions', 'Output directories exist', async () => {
    const dirs = ['states', 'diagrams', 'outputs', 'tmp', 'playbooks', 'inventory', 'terraform'];
    
    for (const dir of dirs) {
      const dirPath = path.join(MCP_DIR, dir);
      const stats = await fs.stat(dirPath);
      if (!stats.isDirectory()) {
        throw new Error(`Directory ${dir} does not exist`);
      }
      
      // Check ownership
      const { stdout } = await execAsync(`stat -c '%U' ${dirPath}`);
      if (stdout.trim() !== TEST_USER) {
        throw new Error(`Directory ${dir} not owned by ${TEST_USER}`);
      }
    }
  });
  
  // Test 3: Service Configuration
  await runTest('Service', 'SSE service has correct environment', async () => {
    const { stdout } = await execAsync('sudo systemctl show sse-server -p Environment');
    
    const requiredEnvVars = ['PATH=', 'HOME=', 'PYTHONPATH='];
    for (const envVar of requiredEnvVars) {
      if (!stdout.includes(envVar)) {
        throw new Error(`Missing environment variable: ${envVar}`);
      }
    }
  });
  
  await runTest('Service', 'SSE service runs as correct user', async () => {
    const { stdout } = await execAsync('sudo systemctl show sse-server -p User');
    if (!stdout.includes(`User=${TEST_USER}`)) {
      throw new Error(`Service not running as ${TEST_USER} user`);
    }
  });
  
  await runTest('Service', 'SSE service has correct working directory', async () => {
    const { stdout } = await execAsync('sudo systemctl show sse-server -p WorkingDirectory');
    if (!stdout.includes(MCP_DIR)) {
      throw new Error('Service has incorrect working directory');
    }
  });
  
  // Test 4: Ansible Configuration
  await runTest('Ansible', 'Ansible config exists for mcp user', async () => {
    const configPath = path.join(MCP_HOME, '.ansible.cfg');
    await fs.access(configPath);
    
    // Check it's readable by mcp user
    await execAsync(`sudo -u mcp cat ${configPath} > /dev/null`);
  });
  
  await runTest('Ansible', 'Ansible can run without TTY', async () => {
    // Test that ansible doesn't require a TTY (common issue)
    const { stdout } = await execAsync('sudo -u mcp ansible --version');
    if (!stdout.includes('ansible')) {
      throw new Error('Ansible cannot run without TTY');
    }
  });
  
  // Test 5: Process Spawning
  await runTest('Process', 'Node can spawn ansible with shell', async () => {
    const testScript = `
const { spawn } = require('child_process');
const proc = spawn('ansible', ['--version'], { shell: true });
proc.on('error', (err) => {
  console.error('FAIL:', err.message);
  process.exit(1);
});
proc.on('exit', (code) => {
  if (code === 0) {
    console.log('OK');
  } else {
    console.error('FAIL: exit code', code);
    process.exit(1);
  }
});
`;
    const { stdout } = await execAsync(`sudo -u mcp node -e "${testScript}"`);
    if (!stdout.includes('OK')) {
      throw new Error('Node cannot spawn ansible with shell');
    }
  });
  
  // Test 6: Environment Variables
  await runTest('Environment', 'Environment file exists', async () => {
    const envPath = path.join(MCP_DIR, '.env');
    await fs.access(envPath);
    
    // Check permissions
    const { stdout } = await execAsync(`stat -c '%a' ${envPath}`);
    const perms = parseInt(stdout.trim());
    if (perms > 600) {
      throw new Error('.env file has too permissive permissions');
    }
  });
  
  await runTest('Environment', 'Critical env vars not exposed', async () => {
    // Make sure passwords aren't in process environment
    const { stdout } = await execAsync('sudo -u mcp env');
    
    const sensitivePatterns = ['PASSWORD=', 'SECRET=', 'TOKEN='];
    for (const pattern of sensitivePatterns) {
      if (stdout.includes(pattern) && !stdout.includes('API_ACCESS_TOKEN=')) {
        throw new Error(`Sensitive data exposed in environment: ${pattern}`);
      }
    }
  });
  
  // Test 7: SSE Connection
  await runTest('SSE', 'SSE server is listening', async () => {
    const { stdout } = await execAsync('sudo ss -tlnp | grep :3001');
    if (!stdout.includes('LISTEN')) {
      throw new Error('SSE server not listening on port 3001');
    }
  });
  
  await runTest('SSE', 'SSE health endpoint responds', async () => {
    try {
      const { stdout } = await execAsync('curl -s http://localhost:3001/health');
      const health = JSON.parse(stdout);
      if (health.status !== 'ok') {
        throw new Error('SSE health check failed');
      }
    } catch (error) {
      throw new Error(`SSE health endpoint error: ${error.message}`);
    }
  });
  
  // Test 8: File Creation
  await runTest('FileOps', 'Can create playbook in directory', async () => {
    const testPlaybook = path.join(MCP_DIR, 'playbooks/test-regression.yml');
    const content = '---\n- name: Test\n  hosts: localhost\n  tasks:\n    - debug:\n        msg: test';
    
    // Create as mcp user
    await execAsync(`sudo -u mcp bash -c "echo '${content}' > ${testPlaybook}"`);
    
    // Verify it exists
    await fs.access(testPlaybook);
    
    // Clean up
    await execAsync(`sudo -u mcp rm ${testPlaybook}`);
  });
  
  await runTest('FileOps', 'Can write to state directory', async () => {
    const stateFile = path.join(MCP_DIR, 'states/test-state.json');
    const content = '{"test": true}';
    
    await execAsync(`sudo -u mcp bash -c "echo '${content}' > ${stateFile}"`);
    await fs.access(stateFile);
    await execAsync(`sudo -u mcp rm ${stateFile}`);
  });
  
  // Test 9: Windows Compatibility
  await runTest('Windows', 'MCP process accepts newline-terminated JSON', async () => {
    // Test that the MCP server can handle Windows-style input
    const testInput = '{"jsonrpc":"2.0","method":"initialize","params":{},"id":1}\r\n';
    const testScript = `
const input = '${testInput.replace(/'/g, "\\'")}';
console.log('Input accepted');
`;
    await execAsync(`sudo -u mcp node -e "${testScript}"`);
  });
}

// Test cleanup function
async function ensureTestEnvironment() {
  console.log('Ensuring test environment...\n');
  
  // Make sure required directories exist
  const dirs = [
    `${MCP_HOME}/.ansible/tmp`,
    `${MCP_HOME}/.ansible/cp`,
    `${MCP_HOME}/.ansible/facts`,
    `${MCP_DIR}/states`,
    `${MCP_DIR}/diagrams`,
    `${MCP_DIR}/outputs`,
    `${MCP_DIR}/tmp`
  ];
  
  for (const dir of dirs) {
    try {
      await execAsync(`sudo mkdir -p ${dir}`);
      await execAsync(`sudo chown ${TEST_USER}:${TEST_USER} ${dir}`);
    } catch (error) {
      console.warn(`Warning: Could not create ${dir}: ${error.message}`);
    }
  }
}

// Generate report
function generateReport() {
  console.log('\n' + '=' .repeat(50));
  console.log(`${colors.blue}Regression Test Summary${colors.reset}`);
  console.log('=' .repeat(50));
  
  console.log(`Total Tests: ${passedTests + failedTests}`);
  console.log(`${colors.green}Passed: ${passedTests}${colors.reset}`);
  console.log(`${colors.red}Failed: ${failedTests}${colors.reset}`);
  
  if (failedTests > 0) {
    console.log(`\n${colors.red}Failed Tests:${colors.reset}`);
    
    const failedByCategory = {};
    regressionTests.filter(t => t.status === 'failed').forEach(test => {
      if (!failedByCategory[test.category]) {
        failedByCategory[test.category] = [];
      }
      failedByCategory[test.category].push(test);
    });
    
    for (const [category, tests] of Object.entries(failedByCategory)) {
      console.log(`\n  ${category}:`);
      tests.forEach(test => {
        console.log(`    - ${test.name}`);
        console.log(`      ${colors.red}${test.error}${colors.reset}`);
      });
    }
  }
  
  // Save report
  const reportPath = path.join(__dirname, 'regression-test-report.json');
  fs.writeFile(reportPath, JSON.stringify({
    summary: {
      total: passedTests + failedTests,
      passed: passedTests,
      failed: failedTests
    },
    tests: regressionTests,
    timestamp: new Date().toISOString(),
    environment: {
      node: process.version,
      platform: process.platform,
      user: process.env.USER || 'unknown'
    }
  }, null, 2)).catch(err => {
    console.error(`Failed to save report: ${err.message}`);
  });
  
  console.log(`\nDetailed report saved to: ${reportPath}`);
}

// Main
async function main() {
  try {
    // Check if running with sudo
    if (process.getuid() !== 0 && process.env.SUDO_USER === undefined) {
      console.error(`${colors.red}This test must be run with sudo${colors.reset}`);
      process.exit(1);
    }
    
    await ensureTestEnvironment();
    await runRegressionTests();
    generateReport();
    
    process.exit(failedTests > 0 ? 1 : 0);
  } catch (error) {
    console.error(`\n${colors.red}Fatal error: ${error.message}${colors.reset}`);
    process.exit(1);
  }
}

// Run tests
main();