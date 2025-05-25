# Jenkins Support Analysis for Ansible MCP Server

## Investigation Summary

### 1. Jenkins is Already Supported

Jenkins is defined in the service catalog at `/src/service-catalog.js` (lines 167-188):
- Category: `dev-tools`
- Docker image: `jenkins/jenkins:lts`
- Requirements: 2 cores, 2048MB RAM, 20GB disk
- Ports: 8080, 50000

### 2. The Core Issues

#### Issue 1: Service Lookup Bug in `deploy-service` Tool
In `/src/tools/service-tools.js` (line 118), there's a bug:
```javascript
const service = serviceCatalog.find(s => 
  s.name.toLowerCase() === validatedArgs.serviceName.toLowerCase()
);
```

The problem: `serviceCatalog` is an object, not an array. The code should use:
```javascript
const service = serviceCatalog[validatedArgs.serviceName.toLowerCase()];
```

This bug causes the tool to fail to find ANY service, not just Jenkins.

#### Issue 2: `homelab-deploy` Tool is a Stub
In `/src/tools/infrastructure-tools.js` (lines 507-537), the `homelab-deploy` handler is just a placeholder that returns mock output. It doesn't actually:
- Create Terraform configuration
- Deploy VMs
- Run Ansible playbooks

#### Issue 3: Service Name Case Sensitivity
The service catalog uses lowercase keys ('jenkins'), but the lookup might be case-sensitive in some places.

## Recommendations

### 1. Fix the `deploy-service` Tool
```javascript
// Fix in /src/tools/service-tools.js
const service = serviceCatalog[validatedArgs.serviceName.toLowerCase()] || 
                Object.values(serviceCatalog).find(s => 
                  s.name.toLowerCase() === validatedArgs.serviceName.toLowerCase()
                );
```

### 2. Implement the `homelab-deploy` Tool
The tool needs actual implementation to:
1. Generate Terraform configuration using the service requirements
2. Execute `terraform apply` to create the VM
3. Generate and run Ansible playbooks for service deployment
4. Handle service-specific configurations

### 3. Add Service Validation
Add a schema enum that includes all valid service names:
```javascript
const validServices = Object.keys(serviceCatalog);
const DeployServiceSchema = z.object({
  serviceName: z.enum(validServices).describe('Service to deploy from catalog'),
  // ... rest of schema
});
```

### 4. Improve Error Messages
Instead of failing silently, tools should provide clear error messages:
- "Service 'xyz' not found. Available services: ..."
- "Tool not implemented yet"
- "Missing required configuration"

## Testing Recommendations

1. Add unit tests for service catalog lookups
2. Test with various case combinations (Jenkins, jenkins, JENKINS)
3. Add integration tests that verify the full deployment flow
4. Mock external dependencies (Terraform, Ansible) for testing

## Available Services (for reference)
- Cloud Storage: nextcloud, owncloud, seafile, syncthing
- Dev Tools: gitlab, **jenkins**, gitea, drone
- Monitoring: prometheus, grafana
- Communication: matrix-synapse, mailserver
- Media: jellyfin, plex
- Network: pihole, nginx-proxy-manager, wireguard
- Security: keycloak, vaultwarden
- Databases: postgresql, redis
- Automation: home-assistant, n8n