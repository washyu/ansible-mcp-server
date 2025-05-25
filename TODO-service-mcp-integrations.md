# TODO: Service-Specific MCP Integrations

## Overview
Future enhancement to add MCP servers for each deployed service, allowing Claude to interact with and configure the services directly.

## Planned Service Integrations

### 1. Nextcloud MCP Server
- **Features:**
  - User management (create users, send invites)
  - File/folder operations
  - App management
  - Settings configuration
  - Group management
  - Share management
- **Example commands:**
  - "Create a new user with email john@example.com and send them an invite"
  - "Create a shared folder for the marketing team"
  - "Enable two-factor authentication for all users"

### 2. Nginx Proxy Manager MCP Server
- **Features:**
  - Create/manage proxy hosts
  - SSL certificate management
  - Access list management
  - Stream configuration
  - 404 page customization
- **Example commands:**
  - "Create a proxy host for the Nextcloud service called thunderfarts"
  - "Generate Let's Encrypt certificate for subdomain.example.com"
  - "Add IP whitelist for admin panel"

### 3. GitLab/Gitea MCP Server
- **Features:**
  - Repository management
  - User/group management
  - CI/CD pipeline control
  - Issue/PR management
  - Wiki operations
- **Example commands:**
  - "Create a new repository called my-project"
  - "Add user@example.com as maintainer to project X"
  - "Trigger pipeline for branch main"

### 4. Mail Server MCP Integration
- **Features:**
  - Email account management
  - Alias management
  - Domain configuration
  - Spam filter rules
  - Quota management
- **Example commands:**
  - "Create email account sales@company.com"
  - "Add alias support@company.com -> team@company.com"
  - "Set mailbox quota to 5GB for user"

### 5. Monitoring Stack MCP (Prometheus/Grafana)
- **Features:**
  - Dashboard creation/management
  - Alert rule configuration
  - Data source management
  - User/team management
- **Example commands:**
  - "Create a dashboard for monitoring Nextcloud performance"
  - "Set up alert when disk usage exceeds 80%"
  - "Add Prometheus data source"

### 6. Home Assistant MCP Server
- **Features:**
  - Device management
  - Automation creation
  - Scene configuration
  - Integration management
- **Example commands:**
  - "Create automation to turn off lights at 11 PM"
  - "Add new Zigbee device"
  - "Create scene called 'Movie Night'"

## Implementation Strategy

1. **Service Discovery**
   - Each service MCP should auto-discover when its service is deployed
   - Register with main MCP server as available tool

2. **Authentication**
   - Store service credentials securely
   - Support API tokens where available
   - Handle OAuth flows for services that require it

3. **Standardized Interface**
   - Common patterns for CRUD operations
   - Consistent error handling
   - Unified response formats

4. **Safety Features**
   - Confirmation for destructive actions
   - Dry-run mode for testing
   - Audit logging of all operations

## Technical Considerations

- Each service MCP should be a separate module
- Use official APIs/SDKs where available
- Implement rate limiting and retry logic
- Support both REST and GraphQL APIs
- Handle service version compatibility

## Priority Order
1. Nginx Proxy Manager (most requested)
2. Nextcloud (complex but high value)
3. GitLab/Gitea (developer focused)
4. Mail Server (critical infrastructure)
5. Monitoring Stack (operational visibility)
6. Home Assistant (home automation)

## Notes
- This would significantly enhance the value of the MCP server
- Would allow full infrastructure automation through natural language
- Each integration should be optional/pluggable
- Consider creating a plugin architecture for easy extension

## Additional TODOs

### 1. Ollama Model Compatibility Testing
- Test MCP server with various Ollama models (Mistral, Llama 2, Mixtral, CodeLlama)
- Document capability differences between models
- Create model-specific adaptations if needed
- Build compatibility matrix showing which features work with which models
- Not intended to replace any AI, but to ensure broad compatibility
- See `docs/ollama-integration-guide.md` for testing framework

### 2. Service Purpose Classification
- Add ability for users to update VM purposes from 'generic' to specific service types
- Create a mapping system to associate discovered VMs with catalog services
- Implement heuristics to auto-detect service types (e.g., port 80/443 = web server)
- Allow manual override of auto-detected purposes
- Store purpose metadata in inventory for better organization