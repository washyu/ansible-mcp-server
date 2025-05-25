# Ansible MCP Server Testing Guide

## Test Framework

We use **Jest** as our testing framework with the following configuration:

- **Test Runner**: Jest with ESM support (`NODE_OPTIONS='--experimental-vm-modules'`)
- **Coverage Reporting**: Built-in Jest coverage with HTML, LCOV, and text reports
- **Test Structure**: Unit tests, integration tests, and mock support
- **Timeout**: 30 seconds for async operations

## Running Tests

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch

# Run specific test file
NODE_OPTIONS='--experimental-vm-modules' npx jest tests/unit/ansible-tools.test.js

# Run old test suite (for comparison)
npm run test:old
```

## Test Structure

```
tests/
├── setup/                     # Jest setup and configuration
│   ├── globalSetup.js        # Runs once before all tests
│   ├── globalTeardown.js     # Runs once after all tests
│   └── jest.setup.js         # Runs before each test file
├── unit/                     # Unit tests for individual modules
│   ├── ansible-tools.test.js
│   ├── command-utils.test.js
│   └── infrastructure-tools.test.js
├── integration/              # Integration tests
│   └── mcp-server.test.js
├── mocks/                    # Mock implementations
│   └── proxmox.mock.js
└── test-output/             # Temporary test files (gitignored)
```

## Writing Tests

### Basic Test Structure

```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('My Tool', () => {
  let server;

  beforeEach(async () => {
    server = global.testUtils.createMCPServer();
    await global.testUtils.waitForServer(server);
  });

  afterEach(() => {
    if (server) server.kill();
  });

  it('should do something', async () => {
    const result = await global.testUtils.callMCPTool(server, 'tool-name', {
      arg1: 'value1'
    });

    expect(result.success).toBe(true);
    expect(result.output).toContain('expected text');
  });
});
```

### Test Utilities

The `global.testUtils` object provides:

- `createMCPServer()` - Creates a test MCP server instance
- `waitForServer(server)` - Waits for server to be ready
- `callMCPTool(server, toolName, args)` - Calls a tool and returns result

### Mocking

For ESM modules, use dynamic imports:

```javascript
// For mocking external dependencies
jest.mock('../../src/command-utils.js', () => ({
  spawnCommand: jest.fn()
}));

// In your test
const commandUtils = await import('../../src/command-utils.js');
commandUtils.spawnCommand.mockResolvedValue({ /* mock data */ });
```

## Coverage Goals

Current coverage thresholds (in jest.config.js):
- Branches: 10%
- Functions: 10%
- Lines: 10%
- Statements: 10%

Target for v2.0:
- All metrics: 80%+

## Test Categories

### 1. Unit Tests
- Individual tool functionality
- Input validation
- Error handling
- File operations

### 2. Integration Tests
- MCP protocol compliance
- Tool discovery
- Context persistence
- Multi-tool workflows

### 3. Mock Tests
- External service interactions (Proxmox, Pi-hole, etc.)
- Network operations
- System commands

## Current Test Coverage

As of v1.0:
- **Total Tools**: 68
- **Tools with Tests**: 17 (25%)
- **Test Files**: 4
- **Test Cases**: 20+

## Priority Testing Areas

1. **High Priority**
   - Core Ansible tools (ansible-playbook, ansible-role)
   - Terraform operations
   - Setup wizard
   - Security tools

2. **Medium Priority**
   - Service management
   - Hardware discovery
   - Environment deployment

3. **Lower Priority**
   - Utility tools
   - Migration helpers
   - Advanced features

## Known Issues

1. **Coverage Reporting**: ESM modules show 0% coverage due to Jest limitations
2. **Mocking**: ESM mocking requires special handling
3. **Async Operations**: Some tests need proper cleanup to avoid hanging

## Future Improvements

1. Add E2E tests with real infrastructure
2. Performance benchmarking
3. Load testing for concurrent operations
4. Security testing for sensitive operations
5. Automated test generation for new tools