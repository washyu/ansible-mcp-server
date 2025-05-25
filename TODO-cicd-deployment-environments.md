# TODO: CI/CD Deployment Environments and Strategies

## Overview
Implement proper CI/CD deployment strategies with environment management to support test, staging, and production deployments without overwriting existing systems.

## Environment Management Strategy

### Environment Types
- **Test Server** - Development and feature testing
- **Staging Server** - Pre-production validation and acceptance testing
- **Production Server** - Live production deployment
- **Acceptance Server** - Temporary deployment for acceptance testing

### Deployment Protection
- Never overwrite existing test servers during production deployments
- Environment-specific configurations and naming
- Deployment approval workflows
- Automatic rollback capabilities

## New MCP Tools Needed

### Environment Management
- `list-environments`: Show all configured environments
- `create-environment`: Set up new deployment environment
- `deploy-to-environment`: Deploy service to specific environment
- `promote-environment`: Promote from test → staging → production
- `protect-environment`: Enable/disable deployment protection

### CI/CD Pipeline Tools
- `create-acceptance-deployment`: Deploy temporary acceptance testing environment
- `run-acceptance-tests`: Execute acceptance tests against deployment
- `cleanup-acceptance`: Remove temporary acceptance deployments
- `blue-green-deploy`: Blue/green deployment strategy
- `canary-deploy`: Canary deployment for gradual rollout

### Deployment Strategies
- `deploy-parallel`: Deploy to multiple environments simultaneously
- `deploy-sequential`: Deploy through pipeline (test → staging → prod)
- `rollback-deployment`: Rollback to previous version
- `compare-environments`: Compare configurations between environments

## Implementation Schemas

### Environment Configuration Schema
```javascript
const EnvironmentSchema = z.object({
  name: z.string().describe('Environment name (test, staging, production)'),
  type: z.enum(['test', 'staging', 'production', 'acceptance']).describe('Environment type'),
  description: z.string().optional().describe('Environment description'),
  network: z.object({
    subnet: z.string().describe('Network subnet for this environment'),
    gateway: z.string().describe('Gateway IP'),
    dnsServers: z.array(z.string()).optional().describe('DNS servers')
  }),
  proxmox: z.object({
    host: z.string().describe('Proxmox host for this environment'),
    node: z.string().describe('Proxmox node name'),
    storage: z.string().describe('Storage backend'),
    vmIdRange: z.object({
      start: z.number().describe('Starting VM ID'),
      end: z.number().describe('Ending VM ID')
    })
  }),
  protection: z.object({
    enabled: z.boolean().default(true).describe('Enable deployment protection'),
    requireApproval: z.boolean().default(false).describe('Require manual approval'),
    allowOverwrite: z.boolean().default(false).describe('Allow overwriting existing VMs')
  }),
  variables: z.record(z.any()).optional().describe('Environment-specific variables')
});
```

### Deployment Strategy Schema
```javascript
const DeploymentStrategySchema = z.object({
  strategy: z.enum(['direct', 'blue-green', 'canary', 'rolling']).describe('Deployment strategy'),
  service: z.string().describe('Service to deploy'),
  environments: z.array(z.string()).describe('Target environments'),
  configuration: z.object({
    testFirst: z.boolean().default(true).describe('Deploy to test environment first'),
    requireTests: z.boolean().default(true).describe('Require tests to pass before promotion'),
    autoPromote: z.boolean().default(false).describe('Auto-promote after successful tests'),
    cleanupOnFailure: z.boolean().default(true).describe('Cleanup failed deployments')
  }),
  rollback: z.object({
    enabled: z.boolean().default(true).describe('Enable automatic rollback'),
    healthCheckTimeout: z.number().default(300).describe('Health check timeout in seconds'),
    rollbackStrategy: z.enum(['previous', 'stable', 'manual']).default('previous')
  })
});
```

### Acceptance Testing Schema  
```javascript
const AcceptanceTestSchema = z.object({
  testSuite: z.string().describe('Test suite name'),
  service: z.string().describe('Service to test'),
  environment: z.string().describe('Environment to deploy for testing'),
  configuration: z.object({
    createNewVM: z.boolean().default(true).describe('Create new VM for testing'),
    vmNamePrefix: z.string().default('acceptance-test').describe('VM name prefix'),
    cleanupAfterTests: z.boolean().default(true).describe('Cleanup VM after tests'),
    testTimeout: z.number().default(1800).describe('Test timeout in seconds')
  }),
  tests: z.array(z.object({
    name: z.string().describe('Test name'),
    type: z.enum(['health', 'functional', 'performance', 'security']).describe('Test type'),
    command: z.string().describe('Test command to execute'),
    expectedExitCode: z.number().default(0).describe('Expected exit code'),
    timeout: z.number().default(300).describe('Individual test timeout')
  }))
});
```

## Environment Configuration Examples

### Test Environment
```yaml
name: test
type: test
description: "Development and feature testing environment"
network:
  subnet: "192.168.1.0/24"
  gateway: "192.168.1.1"
  dnsServers: ["8.8.8.8", "1.1.1.1"]
proxmox:
  host: "192.168.1.100"
  node: "pve-test"
  storage: "local-lvm"
  vmIdRange:
    start: 1000
    end: 1099
protection:
  enabled: true
  requireApproval: false
  allowOverwrite: true
variables:
  environment: "test"
  debug: true
  logLevel: "debug"
```

### Staging Environment
```yaml
name: staging
type: staging  
description: "Pre-production validation environment"
network:
  subnet: "192.168.2.0/24"
  gateway: "192.168.2.1"
proxmox:
  host: "192.168.1.100"
  node: "pve-staging"
  storage: "local-lvm"
  vmIdRange:
    start: 2000
    end: 2099
protection:
  enabled: true
  requireApproval: true
  allowOverwrite: false
variables:
  environment: "staging"
  debug: false
  logLevel: "info"
```

### Production Environment
```yaml
name: production
type: production
description: "Live production environment"
network:
  subnet: "192.168.3.0/24"
  gateway: "192.168.3.1"
proxmox:
  host: "192.168.1.101"
  node: "pve-prod"
  storage: "ceph-ssd"
  vmIdRange:
    start: 3000
    end: 3099
protection:
  enabled: true
  requireApproval: true
  allowOverwrite: false
variables:
  environment: "production"
  debug: false
  logLevel: "warn"
  backup: true
  monitoring: true
```

## Deployment Workflows

### Development Workflow
```bash
# 1. Deploy to test environment
deploy-to-environment --service="nextcloud" --environment="test" --vmName="nextcloud-test"

# 2. Run acceptance tests
run-acceptance-tests --service="nextcloud" --environment="test"

# 3. If tests pass, promote to staging
promote-environment --service="nextcloud" --from="test" --to="staging"
```

### Production Deployment Workflow
```bash
# 1. Create acceptance testing deployment
create-acceptance-deployment --service="nextcloud" --testSuite="nextcloud-acceptance"

# 2. Run full acceptance tests
run-acceptance-tests --testSuite="nextcloud-acceptance"

# 3. If tests pass, deploy to production
deploy-to-environment --service="nextcloud" --environment="production" --strategy="blue-green"

# 4. Cleanup acceptance environment
cleanup-acceptance --testSuite="nextcloud-acceptance"
```

### Blue/Green Deployment
```bash
# 1. Deploy new version to "green" environment
blue-green-deploy --service="nextcloud" --environment="production" --target="green"

# 2. Run health checks
run-acceptance-tests --environment="production-green" --testSuite="health-check"

# 3. Switch traffic to green (automatic if tests pass)
# 4. Keep blue environment as instant rollback option
```

## Protection Features

### Environment Protection
- **VM ID Ranges**: Each environment gets specific VM ID ranges to prevent conflicts
- **Network Isolation**: Separate subnets for each environment
- **Approval Workflows**: Staging/Production require manual approval
- **Overwrite Protection**: Prevent accidental overwrites of existing VMs

### Deployment Safety
- **Health Checks**: Verify service health before completing deployment
- **Automatic Rollback**: Rollback on deployment failure
- **Backup Before Deploy**: Automatic backup of current state
- **Smoke Tests**: Quick validation after deployment

## Example Usage

### Deploy to Test Server (Your Current Use Case)
```bash
# This deploys to your test environment safely
deploy-to-environment \
  --service="nextcloud" \
  --environment="test" \
  --vmName="nextcloud-test-v2" \
  --ip="192.168.1.110"
```

### Deploy Production-Ready for Acceptance Testing
```bash
# This creates a production-like deployment for testing
create-acceptance-deployment \
  --service="nextcloud" \
  --environment="acceptance" \
  --configuration="production" \
  --testSuite="nextcloud-full-acceptance"
```

### Safe Production Deployment
```bash
# This deploys to production with all safety features
deploy-to-environment \
  --service="nextcloud" \
  --environment="production" \
  --strategy="blue-green" \
  --requireApproval=true
```

## Benefits

### For Development
- **Test Server Protection**: Your test server never gets overwritten
- **Multiple Test Environments**: Can have test-v1, test-v2, etc.
- **Safe Experimentation**: Create/destroy acceptance environments easily

### For Production  
- **Zero Downtime**: Blue/green deployments
- **Instant Rollback**: Keep previous version running
- **Approval Gates**: Manual approval for critical deployments
- **Compliance**: Audit trail of all deployments

### For CI/CD
- **Pipeline Integration**: Works with Jenkins, GitLab CI, GitHub Actions
- **Automated Testing**: Run tests as part of deployment
- **Environment Promotion**: Automated promotion through environments
- **Quality Gates**: Prevent bad deployments from reaching production

This approach gives you professional CI/CD capabilities while protecting your existing test server and enabling proper acceptance testing workflows.