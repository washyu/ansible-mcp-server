# Testing Guidelines for MCP Server

## Testing Philosophy

**Feature-First Testing**: We focus on comprehensive end-to-end feature tests that validate real-world workflows rather than isolated unit tests that miss integration issues.

### Why We Chose This Approach

Our previous test suite had **59 test files** that completely missed critical VM lifecycle functionality. The tests were:
- ❌ **Too isolated** - Tested individual functions without real infrastructure
- ❌ **Mock-heavy** - Used fake data instead of real Proxmox/MCP interactions  
- ❌ **Not representative** - Didn't catch actual deployment and integration issues
- ❌ **Maintenance burden** - Large test suite that provided false confidence

### Our New Approach

✅ **Feature Tests** - Test complete workflows end-to-end
✅ **Real Infrastructure** - Use actual Proxmox, MCP, and VM instances
✅ **Environment-Aware** - Tests work across dev/qa/staging/prod
✅ **Failure-Focused** - Tests catch real issues that matter to users

## Test Types

### 1. Feature Tests (Primary)

**Location**: `tests/feature/`

**Purpose**: Validate complete user workflows through real infrastructure

**Characteristics**:
- Test entire feature from start to finish
- Use real MCP server, Proxmox, and VMs
- Include multiple related operations
- Validate context management
- Test error scenarios and recovery

**Example**: VM Lifecycle Test
```javascript
// Tests: create VM → install service → verify → remove service → delete VM
await createVM() → installJenkins() → verifyJenkins() → removeJenkins() → deleteVM()
```

### 2. Integration Tests (Secondary)

**Location**: `tests/integration/`

**Purpose**: Test interactions between major components

**When to Use**:
- Testing MCP ↔ Proxmox API integration
- SSE proxy ↔ MCP server communication
- Critical protocol implementations

#### SSE-MCP Response Capture Test
**File**: `tests/integration/sse-mcp-integration-runner.cjs`

**Purpose**: Ensures the SSE proxy properly captures and forwards MCP server responses, preventing timeout issues.

**What it validates**:
1. SSE server accepts connections with proper authentication
2. MCP server processes spawn correctly
3. JSON messages are properly parsed and forwarded
4. Responses arrive within acceptable time limits (no timeout)
5. Complex JSON structures are handled correctly

**Running locally**:
```bash
# Start SSE server
npm run start:sse

# In another terminal, run the test
node tests/integration/sse-mcp-integration-runner.cjs
```

**CI/CD**: Runs automatically on every push/PR to prevent regression of the SSE timeout bug.

### 3. Unit Tests (Minimal)

**Location**: `tests/unit/`

**Purpose**: Test isolated utility functions only

**When to Use**:
- Pure functions with no external dependencies
- Data transformation utilities
- Configuration parsing functions

**What NOT to unit test**:
- Functions that call external APIs
- Functions that require real infrastructure
- Complex integration logic

## Feature Test Structure

### Standard Pattern

```javascript
class FeatureTest {
  constructor(environment) {
    this.environment = environment;
    this.config = null;
    this.steps = [
      { name: 'setup', description: 'Initialize test environment' },
      { name: 'action', description: 'Perform main feature action' },
      { name: 'verify', description: 'Verify action succeeded' },
      { name: 'cleanup', description: 'Clean up test resources' }
    ];
  }

  async loadConfig() {
    // Load environment-specific configuration
  }

  async executeStep() {
    // Execute individual test steps
  }

  async cleanup() {
    // Ensure resources are cleaned up
  }
}
```

### Required Elements

1. **Environment Configuration**
   - Support dev/qa/staging/prod environments
   - Environment variable overrides
   - Credential management

2. **Real Infrastructure**
   - Use actual MCP server
   - Use actual Proxmox instance
   - Create and destroy real VMs

3. **Error Handling**
   - Graceful failure handling
   - Automatic cleanup on failure
   - Clear error reporting

4. **Progress Reporting**
   - Step-by-step progress
   - Timing information
   - Detailed logs

## Writing New Feature Tests

### 1. Identify the Feature Workflow

Map out the complete user workflow:
```
User Story: Deploy Nextcloud instance
Steps: Create VM → Install Docker → Deploy Nextcloud → Configure SSL → Verify Access
```

### 2. Create Environment Configs

Add configurations for each environment:
```json
// tests/config/environments/dev.json
{
  "test": {
    "vmId": 600,
    "vmIP": "192.168.10.202"
  },
  "services": {
    "nextcloud": {
      "port": 80,
      "domain": "nextcloud.local"
    }
  }
}
```

### 3. Write the Feature Test

```javascript
// tests/feature/nextcloud-deployment.test.js
class NextcloudDeploymentTest {
  constructor(environment) {
    this.steps = [
      { name: 'create-vm', description: 'Create VM for Nextcloud' },
      { name: 'install-docker', description: 'Install Docker' },
      { name: 'deploy-nextcloud', description: 'Deploy Nextcloud container' },
      { name: 'verify-access', description: 'Verify Nextcloud is accessible' },
      { name: 'cleanup', description: 'Remove VM and resources' }
    ];
  }
}
```

### 4. Add to Test Runner

```bash
# Add npm script
"test:nextcloud": "./tests/run-feature-tests.sh nextcloud dev"
```

## Environment Management

### Configuration Priority

1. **Command line arguments**: `--config custom.json`
2. **Environment variables**: `PROXMOX_HOST=10.0.1.100`
3. **Environment config files**: `tests/config/environments/dev.json`
4. **Default fallbacks**: Built-in defaults

### Environment Variables

Always support environment variable overrides:
```javascript
const config = {
  proxmox: {
    host: process.env.PROXMOX_HOST || defaultConfig.proxmox.host,
    apiTokenId: process.env.PROXMOX_API_TOKEN_ID || defaultConfig.proxmox.apiTokenId
  }
};
```

### Security

- **Never commit credentials** to configuration files
- Use `${VARIABLE}` placeholders in environment configs
- Support secret management systems in CI/CD
- Rotate test credentials regularly

## Test Infrastructure Requirements

### MCP Server
- Must be running and accessible
- Must have SSE proxy enabled
- Must have current tool definitions loaded

### Proxmox Server
- Must have API tokens configured
- Must have VM templates available
- Must have sufficient resources for test VMs

### Network
- Test VMs must be accessible from test runner
- Test IP ranges must not conflict with production
- DNS resolution must work for test domains

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Feature Tests
on: [push, pull_request]

jobs:
  feature-tests:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        environment: [qa, staging]
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Run Feature Tests
        env:
          PROXMOX_HOST: ${{ secrets.PROXMOX_HOST }}
          PROXMOX_API_TOKEN_ID: ${{ secrets.PROXMOX_TOKEN_ID }}
          PROXMOX_API_TOKEN_SECRET: ${{ secrets.PROXMOX_TOKEN_SECRET }}
          MCP_API_TOKEN: ${{ secrets.MCP_API_TOKEN }}
        run: npm run test:${{ matrix.environment }}
```

### Jenkins Pipeline Example

```groovy
pipeline {
    agent any
    
    parameters {
        choice(
            name: 'ENVIRONMENT',
            choices: ['dev', 'qa', 'staging'],
            description: 'Test environment'
        )
    }
    
    stages {
        stage('Feature Tests') {
            steps {
                withCredentials([
                    string(credentialsId: 'proxmox-host', variable: 'PROXMOX_HOST'),
                    string(credentialsId: 'mcp-token', variable: 'MCP_API_TOKEN')
                ]) {
                    sh "npm run test:${params.ENVIRONMENT}"
                }
            }
        }
    }
    
    post {
        always {
            archiveArtifacts artifacts: 'tests/reports/**/*', allowEmptyArchive: true
        }
    }
}
```

## Debugging Failed Tests

### Verbose Mode

```bash
./tests/run-feature-tests.sh --verbose --log-file debug.log dev
```

### Common Issues

1. **SSE Connection Timeout**
   ```bash
   # Check MCP server status
   curl -H "Authorization: Bearer $TOKEN" http://mcp-server:3001/health
   ```

2. **Proxmox Authentication Failure**
   ```bash
   # Test API token
   curl -k -H "Authorization: PVEAPIToken=$TOKEN_ID=$SECRET" \
     https://proxmox:8006/api2/json/version
   ```

3. **VM Creation Failure**
   ```bash
   # Check available templates
   curl -k -H "Authorization: PVEAPIToken=$TOKEN_ID=$SECRET" \
     https://proxmox:8006/api2/json/nodes/pve/qemu | jq '.data[] | select(.template == 1)'
   ```

4. **Network Connectivity**
   ```bash
   # Test VM connectivity
   ping $TEST_VM_IP
   ssh $SSH_USER@$TEST_VM_IP echo "Connection test"
   ```

## Best Practices

### Test Design

- **One feature per test file**
- **Complete workflows only** - No partial testing
- **Real infrastructure always** - No mocking of external systems
- **Environment-agnostic** - Work across all environments
- **Idempotent** - Can run multiple times safely

### Resource Management

- **Unique test resources** - Use timestamps/UUIDs in names
- **Automatic cleanup** - Always clean up on success AND failure
- **Resource limits** - Set timeouts to prevent runaway tests
- **Parallel safety** - Tests should not interfere with each other

### Error Handling

- **Graceful failures** - Handle infrastructure issues gracefully
- **Clear error messages** - Make failures easy to diagnose
- **Retry logic** - Handle transient infrastructure issues
- **Failure context** - Include environment info in error reports

### Maintenance

- **Environment parity** - Keep all environments in sync
- **Credential rotation** - Update test credentials regularly
- **Infrastructure updates** - Update tests when infrastructure changes
- **Documentation** - Keep test documentation current

## When NOT to Write Tests

### Avoid Testing

- **Third-party APIs** - Don't test Proxmox API directly
- **Framework internals** - Don't test Express.js routing
- **Environmental issues** - Don't test network connectivity
- **Configuration files** - Don't test JSON parsing

### Instead, Focus On

- **User workflows** - How users actually use the system
- **Integration points** - Where our code meets external systems  
- **Business logic** - Features that provide user value
- **Error scenarios** - How the system handles failures

## Future Test Development

As we add new features, we'll create corresponding feature tests:

1. **Service Deployment Tests** - Nextcloud, Grafana, etc.
2. **Security Tests** - User management, access controls
3. **Backup Tests** - VM backup and restore workflows
4. **Migration Tests** - Moving services between VMs
5. **Scaling Tests** - Adding/removing resources
6. **Disaster Recovery Tests** - Full system recovery scenarios

Each feature test will follow the same pattern:
- Environment-configurable
- End-to-end workflow testing
- Real infrastructure usage
- Comprehensive error handling
- Automatic cleanup

This approach ensures that our tests catch real issues and provide confidence in actual deployments.