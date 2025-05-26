# VM Lifecycle Feature Test Suite

A comprehensive test suite for validating the complete VM lifecycle management through the MCP (Model Context Protocol) server and SSE (Server-Sent Events) proxy.

## Overview

This test suite validates the entire infrastructure management workflow:

1. **VM Creation** - Creates a VM from a Proxmox template
2. **Service Installation** - Installs Jenkins on the VM
3. **Service Verification** - Verifies Jenkins is running and accessible
4. **Service Removal** - Stops and removes Jenkins
5. **VM Deletion** - Deletes the VM from Proxmox
6. **Context Verification** - Ensures MCP context is properly updated

## Test Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Test Runner   │───▶│   MCP Server    │───▶│   Proxmox VE    │
│                 │    │   (SSE Proxy)   │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │              ┌─────────────────┐              │
         └─────────────▶│  Target VM      │◀─────────────┘
                        │  (Jenkins)      │
                        └─────────────────┘
```

## Quick Start

### Basic Usage

```bash
# Run tests in development environment
./tests/run-feature-tests.sh dev

# Run tests in QA environment with verbose output
./tests/run-feature-tests.sh --verbose qa

# Run tests with custom environment variables
PROXMOX_HOST=10.0.1.100 TEST_VM_ID=999 ./tests/run-feature-tests.sh prod
```

### Environment-Specific Testing

```bash
# Development (uses local network)
./tests/run-feature-tests.sh dev

# QA (uses QA network and credentials)
./tests/run-feature-tests.sh qa

# Staging (uses staging infrastructure)
./tests/run-feature-tests.sh staging

# Production (uses production infrastructure)
./tests/run-feature-tests.sh prod
```

## Configuration

### Environment Files

Environment-specific configurations are stored in `tests/config/environments/`:

- `dev.json` - Development environment
- `qa.json` - QA environment  
- `staging.json` - Staging environment
- `prod.json` - Production environment

### Configuration Structure

```json
{
  "environment": "dev",
  "description": "Development environment for local testing",
  "mcp": {
    "sseUrl": "http://192.168.10.100:3001/sse",
    "apiToken": "your-mcp-api-token"
  },
  "proxmox": {
    "host": "192.168.10.200",
    "apiTokenId": "root@pam!token-name",
    "apiTokenSecret": "token-secret",
    "node": "proxmox",
    "templateId": 9000
  },
  "test": {
    "vmId": 500,
    "vmIP": "192.168.10.200",
    "network": {
      "gateway": "192.168.10.1",
      "subnet": "192.168.10.0/24"
    },
    "timeout": 600,
    "retries": 3
  },
  "target": {
    "sshUser": "username",
    "sshPassword": "password",
    "sudoPassword": "password"
  }
}
```

### Environment Variables

You can override any configuration using environment variables:

#### MCP Configuration
```bash
export MCP_SSE_URL="http://your-mcp-server:3001/sse"
export MCP_API_TOKEN="your-api-token"
```

#### Proxmox Configuration
```bash
export PROXMOX_HOST="10.0.1.100"
export PROXMOX_API_TOKEN_ID="root@pam!ansible"
export PROXMOX_API_TOKEN_SECRET="your-token-secret"
export PROXMOX_NODE="pve"
export PROXMOX_TEMPLATE_ID="9000"
```

#### Test Configuration
```bash
export TEST_VM_ID="999"
export TEST_VM_IP="10.0.1.199"
export TEST_GATEWAY="10.0.1.1"
export TEST_SUBNET="10.0.1.0/24"
export TEST_TIMEOUT="900"
export TEST_RETRIES="5"
```

#### Target VM Configuration
```bash
export TARGET_SSH_USER="testuser"
export TARGET_SSH_PASSWORD="testpass"
export TARGET_SUDO_PASSWORD="testpass"
```

## Test Scenarios

### Standard VM Lifecycle Test

Tests the complete workflow:

1. **Initialize MCP Connection**
   - Establishes SSE connection to MCP server
   - Authenticates with API token

2. **Create VM**
   - Clones VM from Proxmox template
   - Configures network and resources
   - Starts VM and waits for SSH

3. **Verify VM**
   - Tests ping connectivity
   - Tests SSH connectivity

4. **Install Jenkins**
   - Runs Jenkins installation playbook
   - Configures Jenkins service

5. **Verify Jenkins**
   - Tests HTTP connectivity on port 8080
   - Verifies Jenkins web interface

6. **Stop Jenkins**
   - Stops Jenkins service
   - Verifies service is stopped

7. **Delete VM**
   - Stops VM if running
   - Deletes VM from Proxmox

8. **Verify Cleanup**
   - Confirms VM no longer exists
   - Checks MCP context is updated

### Custom Test Scenarios

You can extend the test suite for specific scenarios:

```javascript
// Add custom test steps
this.steps.push({
  name: 'custom-verification',
  description: 'Custom verification step'
});
```

## Running Tests

### Test Runner Options

```bash
./tests/run-feature-tests.sh [OPTIONS] [ENVIRONMENT]

Options:
  -h, --help              Show help message
  -v, --verbose           Enable verbose output
  -e, --env ENVIRONMENT   Specify environment
  -c, --config FILE       Use custom config file
  -r, --report-dir DIR    Directory for test reports
  -l, --log-file FILE     Log output to file
  --no-cleanup           Don't cleanup on failure
  --dry-run              Show what would run
```

### Direct Node.js Execution

```bash
# Run test directly with Node.js
node tests/feature/vm-lifecycle-feature.test.js dev

# With environment variables
PROXMOX_HOST=10.0.1.100 node tests/feature/vm-lifecycle-feature.test.js qa
```

### CI/CD Integration

```yaml
# GitHub Actions example
- name: Run VM Lifecycle Tests
  run: |
    export PROXMOX_HOST="${{ secrets.PROXMOX_HOST }}"
    export PROXMOX_API_TOKEN_ID="${{ secrets.PROXMOX_TOKEN_ID }}"
    export PROXMOX_API_TOKEN_SECRET="${{ secrets.PROXMOX_TOKEN_SECRET }}"
    export MCP_API_TOKEN="${{ secrets.MCP_API_TOKEN }}"
    ./tests/run-feature-tests.sh qa

# Jenkins Pipeline example
stage('VM Lifecycle Tests') {
    steps {
        withCredentials([
            string(credentialsId: 'proxmox-host', variable: 'PROXMOX_HOST'),
            string(credentialsId: 'proxmox-token-id', variable: 'PROXMOX_API_TOKEN_ID'),
            string(credentialsId: 'proxmox-token-secret', variable: 'PROXMOX_API_TOKEN_SECRET'),
            string(credentialsId: 'mcp-api-token', variable: 'MCP_API_TOKEN')
        ]) {
            sh './tests/run-feature-tests.sh staging'
        }
    }
}
```

## Troubleshooting

### Common Issues

#### 1. SSE Connection Timeout
```
Error: SSE connection failed
```

**Solution**: Check MCP server is running and accessible:
```bash
curl -H "Authorization: Bearer $MCP_API_TOKEN" http://your-mcp-server:3001/health
```

#### 2. Proxmox Authentication Failure
```
Error: HTTP Error 401: authentication failure
```

**Solution**: Verify Proxmox API token:
```bash
curl -k -H "Authorization: PVEAPIToken=$TOKEN_ID=$TOKEN_SECRET" \
  https://your-proxmox:8006/api2/json/version
```

#### 3. VM Creation Failure
```
Error: unable to find configuration file for VM template
```

**Solution**: Check template exists:
```bash
# List available templates
curl -k -H "Authorization: PVEAPIToken=$TOKEN_ID=$TOKEN_SECRET" \
  https://your-proxmox:8006/api2/json/nodes/pve/qemu | jq '.data[] | select(.template == 1)'
```

#### 4. Network Connectivity Issues
```
Error: Test VM connectivity failed
```

**Solution**: 
- Verify network configuration in environment config
- Check VM has correct IP assignment
- Verify gateway and DNS settings

### Debug Mode

Enable verbose logging for detailed troubleshooting:

```bash
./tests/run-feature-tests.sh --verbose --log-file debug.log dev
```

### Test Reports

Test reports are automatically generated in `tests/reports/` with:
- Test execution timeline
- Step-by-step results
- Error details and stack traces
- Environment configuration used

## Development

### Adding New Test Steps

1. Add step definition to `steps` array:
```javascript
this.steps.push({
  name: 'new-step',
  description: 'Description of new step'
});
```

2. Add step execution logic:
```javascript
case 'new-step':
  await this.sendMessage({
    jsonrpc: '2.0',
    method: 'tools/call',
    params: {
      name: 'tool-name',
      arguments: { /* tool args */ }
    },
    id: this.messageId++
  });
  break;
```

### Creating New Environment Configs

1. Create new config file: `tests/config/environments/myenv.json`
2. Follow the existing structure
3. Test with: `./tests/run-feature-tests.sh myenv`

### Extending for Other Services

The test framework can be extended for other services beyond Jenkins:

```javascript
// Add service-specific configuration
"services": {
  "nextcloud": {
    "port": 80,
    "healthCheckPath": "/status.php",
    "startupTime": 120
  }
}
```

## Security Considerations

### Credential Management

- **Never commit passwords or tokens to version control**
- Use environment variables for sensitive data
- Consider using secret management tools in CI/CD
- Rotate API tokens regularly

### Network Security

- Test environments should be isolated
- Use VPNs or private networks when possible
- Limit API token permissions to minimum required

### VM Security

- Test VMs should use temporary credentials
- Clean up test VMs promptly
- Monitor for orphaned test resources

## Best Practices

### Test Isolation

- Each test run uses unique VM IDs
- Clean up resources after each test
- Use separate IP ranges per environment

### Resource Management

- Set appropriate timeouts for each environment
- Implement retry logic for flaky operations
- Monitor resource usage during tests

### Maintenance

- Regularly update template VMs
- Keep environment configs in sync
- Review and update credentials periodically

## Support

For issues or questions:

1. Check the troubleshooting section
2. Review test logs with `--verbose` option
3. Verify environment configuration
4. Check MCP and Proxmox server status

## Contributing

When adding new features:

1. Update test steps and documentation
2. Add appropriate error handling
3. Test across multiple environments
4. Update configuration examples