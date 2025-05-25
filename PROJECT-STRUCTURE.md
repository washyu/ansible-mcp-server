# Ansible MCP Server v1.0 Project Structure

## Root Directory Files

### Core Files
- `README.md` - Main documentation and quick start guide
- `LICENSE` - MIT License
- `package.json` - Node.js project configuration
- `package-lock.json` - Dependency lock file
- `.gitignore` - Git ignore patterns
- `.env.example` - Environment variable template

### Docker Support
- `docker-compose.yml.example` - Example Docker Compose configuration
- `.dockerignore` - Docker ignore patterns

### Development
- `run-v1-tests.sh` - Comprehensive test suite runner
- `RELEASE-v1.0.md` - Release checklist and notes

## Directory Structure

```
ansible-mcp-server/
├── src/                    # Source code
│   ├── index.js           # Main MCP server entry point
│   ├── tools/             # Modular tool system
│   │   ├── index.js       # Tool registry and loader
│   │   ├── ansible-tools.js
│   │   ├── terraform-tools.js
│   │   ├── infrastructure-tools.js
│   │   ├── hardware-discovery-tools.js
│   │   ├── security-tools.js
│   │   ├── service-tools.js
│   │   ├── environment-tools.js
│   │   ├── external-server-tools.js
│   │   ├── ansible-enhanced-tools.js
│   │   └── services/      # Service-specific tools
│   │       └── pihole-tools.js
│   ├── command-utils.js   # Command execution utilities
│   ├── setup-tools.js     # Setup and configuration tools
│   ├── server-management-tools.js
│   ├── service-catalog.js # Service definitions
│   ├── sse-server.js      # SSE server for Windows support
│   └── mcp-proxy-client.js # Windows client proxy
│
├── docs/                   # Documentation
│   ├── integration.md
│   ├── hardware-inventory-guide.md
│   ├── modular-tools.md
│   ├── claude-playbook-fix.md
│   ├── windows-claude-desktop-setup.md
│   ├── windows-sse-setup.md
│   └── generic-migration-guide.md
│
├── tests/                  # Test suite
│   ├── v1-feature-tests.js # Comprehensive feature tests
│   ├── ai-agent-scenarios.js # AI agent workflow tests
│   ├── regression-tests.js
│   ├── sse-regression-tests.js
│   └── quick-regression-check.sh
│
├── scripts/                # Utility scripts
│   ├── install.sh         # Installation script
│   ├── uninstall.sh       # Uninstallation script
│   └── install-dependencies.sh
│
├── inventory/              # Ansible inventory files
│   ├── hosts.yml.example
│   └── hardware-inventory.json
│
└── archive/                # Archived development files
    ├── deployment-scripts/ # Old deployment scripts
    ├── test-scripts/      # Development test scripts
    ├── windows-scripts/   # Windows-specific scripts
    ├── claude-configs/    # Example Claude configurations
    └── old-configs/       # Historical configuration files
```

## Key Features by Directory

### `/src/tools/`
- **58 tools** organized by category
- Modular architecture for easy extension
- Dynamic tool loading system
- Service-specific tool support

### `/docs/`
- Comprehensive setup guides
- Integration documentation
- Troubleshooting guides
- Migration documentation

### `/tests/`
- Feature-level testing
- AI agent scenario testing
- Regression test suite
- ~31 total test cases

## Clean Structure Benefits

1. **Organized** - All files in logical locations
2. **Minimal Root** - Only essential files at root level
3. **Archived** - Development files preserved but not cluttering
4. **Documented** - Clear documentation structure
5. **Testable** - Comprehensive test coverage
6. **Extensible** - Easy to add new tools and services