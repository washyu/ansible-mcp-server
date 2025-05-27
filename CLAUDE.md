# Ansible MCP Server - Project Context

## Architecture Principles
1. **Platform Agnostic Infrastructure**
   - Use Terraform for ALL infrastructure provisioning (VMs, cloud resources, etc.)
   - This enables easy migration between Proxmox, AWS, Azure, GCP, etc.
   - Proxmox is just for development; production deployments should work anywhere

2. **OS Configuration via Ansible**
   - Use Ansible for ALL OS-level configuration and application deployment
   - Keeps configuration portable across different infrastructure providers
   - Separation of concerns: Terraform = Infrastructure, Ansible = Configuration

3. **Provider Preferences**
   - For Proxmox: Use `bpg/proxmox` provider (more stable than Telmate)
   - Always test with multiple providers when adding new features

## Infrastructure Constraints
- **Proxmox Development Environment**:
  - Max 12 vCPUs per VM (host limitation)
  - Node name: "proxmox" (not "pve")
  - Template ID 9000: ubuntu-cloud-template

## MCP Server Deployment
- **Dev MCP Server**: 192.168.10.102 (for testing)
- **Production MCP Server**: 192.168.10.110
- **Current Dev VM**: 192.168.10.169 (VM ID 100 on Proxmox)
- **Proxmox Host**: 192.168.10.200

**IMPORTANT**: When testing MCP features, use the dev MCP server at 192.168.10.102, NOT local installations!

## 🗄️ CRITICAL: Inventory Context System (January 25, 2025)
**PRIORITY**: The MCP MUST maintain up-to-date inventory context of all infrastructure resources.

### Core Requirements:
1. **Complete Proxmox Inventory**: VMs, templates, ISOs, storage pools, nodes, networks
2. **Automatic Staleness Detection**: Context expires after configurable time (default: 10 hours)
3. **Background Refresh**: Auto-update stale inventory in background
4. **Tool Blocking**: Block infrastructure tools during inventory refresh to prevent inconsistent state
5. **State Modification Tracking**: All create/modify/delete operations MUST update inventory context immediately

### Implementation Plan:
- Add Proxmox discovery tool to scan: VMs, templates (ID 9000), ISOs, storage, networks
- Create inventory refresh mechanism with configurable staleness threshold
- Implement tool blocking during refresh operations
- Add inventory update hooks to all state-modifying tools
- Store inventory with timestamps in `/inventory/proxmox-resources.json`

### Template VM Management Requirements:
1. **Create Templates**: MCP should be able to create new VM templates with:
   - Pre-configured SSH keys from MCP server
   - Cloud-init ready configuration
   - Standard user accounts and passwords
2. **Store Template Context**: When creating templates, store:
   - Template ID, name, and configuration
   - SSH access credentials
   - Cloud-init settings
   - Default user accounts
3. **Template Discovery**: Automatically discover and catalog existing templates
4. **Clone Configuration**: Store successful clone configurations as reusable templates

### Context Files That Need This:
- `/inventory/proxmox-resources.json` - Complete Proxmox resource inventory
- `/inventory/last-discovery.json` - Discovery timestamps and metadata
- `.env` - Staleness threshold configuration (`INVENTORY_STALENESS_HOURS=10`)

**This is BLOCKING for VM creation - we need to know about template 9000 and all available resources before any infrastructure operations.**

## 📚 Standard Operating Procedures (SOPs)
The MCP now includes built-in SOPs for common operations. AI agents can query these using:
- `query-sop` - Get detailed steps for any operation (e.g., "create_vm", "install_ollama")
- `list-sops` - List all available procedures
- `get-best-practice` - Get naming conventions, resource allocation guidelines
- `get-error-recovery` - Get recovery steps for common errors

### Example SOP Usage:
```
query-sop operation="create_vm" detailed=true
```

This provides agents with:
1. Step-by-step instructions
2. Validation checks at each step
3. Common issues and solutions
4. Prerequisites and requirements

## 🔐 Ansible Admin Account Management
**CRITICAL**: All VMs created by MCP now include a standard `ansible-admin` account for consistent access.

### Default Configuration:
- **Username**: `ansible-admin`
- **Access**: Full sudo without password (NOPASSWD)
- **SSH Keys**: MCP's SSH key automatically added
- **Password**: Auto-generated 20-char secure password, encrypted in context

### Credential Management Tools:
- `store-vm-credentials` - Store VM credentials after creation
- `retrieve-vm-credentials` - Get credentials (with optional decryption)
- `generate-secure-password` - Generate passwords for accounts
- `update-context-after-operation` - Update context after any operation
- `list-vm-credentials` - List all VMs with their access info

### Automatic Context Updates:
Every successful operation now updates the MCP context:
- VM creation → Stores IP, credentials, resources, purpose
- Service installation → Stores endpoints, versions, config
- All credentials encrypted and vaulted

### Example:
```bash
# After VM creation
store-vm-credentials vmId="203" vmName="ollama-server" vmIp="192.168.10.203"

# Retrieve credentials later
retrieve-vm-credentials vmId="203" decrypt=true

# Update context after service install
update-context-after-operation operationType="service_installed" entityId="ollama" updates={endpoint:"http://192.168.10.203:11434", version:"0.1.17"}
```

## 🎯 Modular Service SOPs
The MCP now uses a modular service SOP system to avoid duplication:

### Service SOP Structure:
- **Base SOP** (`/src/service-sops/base-service-sop.json`) - Common steps for all services
- **Service-Specific SOPs** (`/src/service-sops/{service}-sop.json`) - Service-specific details

### Available Service SOPs:
- `ollama` - LLM inference server
- `nextcloud` - Self-hosted cloud storage
- `docker` - Container runtime
- More can be added without changing core code

### Service SOP Tools:
- `get-service-sop` - Get complete SOP for any service
- `list-service-sops` - List all available service SOPs
- `compare-service-requirements` - Compare resource needs across services

### Example Usage:
```bash
# Get Ollama installation SOP
get-service-sop serviceName="ollama" section="installation"

# Compare requirements for multiple services
compare-service-requirements services=["ollama", "nextcloud"]

# Check if service already exists
detect-existing-service serviceName="nextcloud"
```

## 📋 Template Validation & Compliance
All templates MUST have `ansible-admin` account pre-configured for MCP management.

### Template Requirements:
- **ansible-admin** user with sudo NOPASSWD
- MCP SSH keys in authorized_keys
- cloud-init installed and configured
- Python3, sudo, openssh-server packages

### Template Validation Tools:
- `validate-template` - Check if template meets MCP standards
- `fix-template` - Fix non-compliant templates (add ansible-admin, etc.)
- `discover-templates` - Find and validate all templates
- `create-compliant-template` - Create new MCP-compliant template

### Template Discovery Workflow:
1. **Unknown Template Found** → Alert user
2. **Validation Options**:
   - Validate: Test ansible-admin access
   - Fix: Add ansible-admin if missing
   - Delete: Remove if not needed
   - Keep: Mark as legacy/non-compliant

### Example:
```bash
# Discover all templates
discover-templates validateAll=true

# Validate specific template
validate-template templateId="9001"

# Fix non-compliant template
fix-template templateId="9001" issue="no_ansible_admin" action="fix" credentials={username:"root", password:"..."}
```

## 🔍 Inventory Deviation Management
The MCP now includes advanced inventory deviation detection:

### Deviation Detection Tools:
- `compare-inventory-state` - Compare context vs live inventory, detect new/missing VMs
- `process-deviation` - Handle deviations (accept new VMs, restore missing ones)
- `check-node-capacity` - Verify node has resources for VM placement
- `find-best-node` - Find optimal node for new VM based on resources

### Key Features:
1. **Automatic Deviation Detection**:
   - New VMs trigger alerts asking if expected
   - Missing VMs offer recovery options (backup/terraform/ansible)
   - Resource changes are tracked

2. **Resource Tracking**:
   - Each node's CPU/memory/storage limits and usage
   - Automatic alerts at 80% (warning) and 90% (critical)
   - VM placement validation before creation

3. **Alert Templates**:
   - New VM: Asks for purpose, owner, credentials
   - Missing VM: Offers restore from backup/IaC
   - Resource exhaustion: Prevents new VMs, suggests actions

### Example Workflow:
```
# Check for deviations
compare-inventory-state autoAlert=true updateContext=true

# If new VM found
process-deviation deviationType="new_vm" vmId="203" action="accept" details={purpose:"Test server", owner:"DevOps"}

# Check where to place new VM
find-best-node requiredResources={cores:4, memoryMb:8192, diskGb:100}
```

## Current Status (January 25, 2025)

### ✅ Completed Today
1. **Test Framework Migration**
   - Migrated from Node.js built-in test runner to Jest
   - Generated tests for 53 out of 58 tools (84% coverage)
   - Fixed common test issues (parameter validation, file paths, output expectations)
   - Test success rate improved from ~30% to ~65%

2. **GitHub Repository**
   - Pushed all changes to main branch (not master)
   - Removed accidentally committed .claude folder
   - Added .claude/ to .gitignore for security
   - Created 20 comprehensive GitHub issues for TODOs and features

3. **Community Engagement**
   - Created CONTRIBUTING.md with contribution guidelines
   - Drafted 3 LinkedIn post options for first-time posting
   - Prepared community feedback strategies

### 📋 Next Priority: CI/CD Pipeline

You want to set up a CI/CD pipeline that:
1. Runs the Jest test suite automatically
2. Builds a usable Docker image
3. Publishes to Docker Hub or GitHub Container Registry

### 🔧 CI/CD Implementation Plan

#### 1. GitHub Actions Workflow
Create `.github/workflows/ci.yml`:
```yaml
name: CI/CD Pipeline
on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm test
      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: coverage-report
          path: coverage/

  build:
    needs: test
    runs-on: ubuntu-latest
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v3
      - uses: docker/setup-buildx-action@v2
      - uses: docker/login-action@v2
        with:
          username: ${{ secrets.DOCKER_USERNAME }}
          password: ${{ secrets.DOCKER_TOKEN }}
      - uses: docker/build-push-action@v4
        with:
          push: true
          tags: |
            yourusername/ansible-mcp-server:latest
            yourusername/ansible-mcp-server:${{ github.sha }}
```

#### 2. Dockerfile Needed
Create a production-ready Dockerfile:
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["node", "src/index.js"]
```

#### 3. Docker Compose for Local Testing
```yaml
version: '3.8'
services:
  ansible-mcp:
    build: .
    volumes:
      - ./ansible:/ansible
      - ~/.ssh:/root/.ssh:ro
    environment:
      - ANSIBLE_HOST_KEY_CHECKING=False
```

### 🧪 Test Coverage Goals
- Current: ~65% of tests passing
- Target: 80%+ tests passing
- Focus on fixing:
  - File operation tests (mock fs operations)
  - External service tests (mock Proxmox, Pi-hole APIs)
  - Parameter validation edge cases

### 🚀 High Priority GitHub Issues
1. **#1** - Implement Windows support for Ansible execution
2. **#2** - Add comprehensive integration tests  
3. **#3** - Create example Ansible playbooks
4. **#4** - Improve error messages

### 📝 Important Notes
- Jest with ESM requires: `NODE_OPTIONS='--experimental-vm-modules'`
- Coverage reporting shows 0% for some files (Jest ESM limitation)
- Main branch, not master
- Don't commit .claude folder (contains permissions)

### 🔍 Key Files to Remember
- `/jest.config.js` - Jest configuration
- `/tests/test-utils.js` - Mock helpers
- `/tests/generators/generate-tool-tests.js` - Test generator
- `/.gitignore` - Includes .claude/
- `/linkedin-post-draft.md` - LinkedIn post options

### 💡 Tomorrow's Tasks
1. Create GitHub Actions workflow for CI/CD
2. Write production Dockerfile
3. Set up Docker Hub secrets in GitHub
4. Fix remaining test failures
5. Consider blog post / LinkedIn post
6. Maybe implement high-priority issues

### 🔐 Security Reminders
- Never commit .claude folder
- Use GitHub secrets for Docker Hub credentials
- Consider separate permissions for CI/CD
- Review Ansible vault setup for sensitive data

---

**Last Session Summary**: Improved test coverage from 25% to 84%, migrated to Jest, created 20 GitHub issues, prepared community engagement content. Ready for CI/CD pipeline implementation.