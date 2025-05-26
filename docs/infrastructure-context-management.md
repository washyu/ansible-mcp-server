# Infrastructure Context Management with Ansible MCP

The ansible-mcp-server provides persistent context storage that allows agents to maintain long-term knowledge about your infrastructure. This enables intelligent decision-making based on historical data and current state.

## How It Works

Context is stored in `.mcp-context.json` and persists across server restarts. The context system is designed to store:
- Infrastructure state and history
- Service deployments and configurations
- Resource utilization trends
- Network topology
- Decision history

## Core Context Tools

### 1. Store Context
```javascript
// Store infrastructure state
await set-mcp-context({
  key: "infrastructure",
  value: {
    lastUpdated: new Date().toISOString(),
    nodes: {
      "proxmox1": {
        ip: "192.168.10.10",
        resources: {
          cpu: { cores: 32, used: 18 },
          memory: { total: 128, used: 96 },
          storage: { total: 2000, used: 1200 }
        },
        vms: ["jenkins", "gitlab", "monitoring"]
      },
      "proxmox2": {
        ip: "192.168.10.11",
        resources: {
          cpu: { cores: 24, used: 8 },
          memory: { total: 64, used: 24 },
          storage: { total: 1000, used: 300 }
        },
        vms: ["test-env1", "test-env2"]
      }
    },
    services: {
      jenkins: {
        vm: "jenkins-vm",
        ip: "192.168.10.178",
        deployedAt: "2024-05-25",
        resources: { cpu: 4, memory: 8 },
        status: "running"
      }
    }
  }
});
```

### 2. Retrieve Context
```javascript
// Get all context
const context = await get-mcp-context({});

// Get specific context
const infrastructure = await get-mcp-context({ key: "infrastructure" });
```

## Recommended Context Structure

### 1. Infrastructure State
```json
{
  "infrastructure": {
    "nodes": {
      "node-name": {
        "ip": "192.168.10.10",
        "type": "proxmox",
        "resources": {
          "cpu": { "cores": 32, "used": 18, "allocated": 24 },
          "memory": { "total": 128, "used": 96, "allocated": 112 },
          "storage": { "total": 2000, "used": 1200 }
        },
        "vms": ["vm1", "vm2"],
        "lastHealthCheck": "2024-05-25T10:00:00Z"
      }
    },
    "network": {
      "subnets": {
        "management": "192.168.10.0/24",
        "services": "192.168.20.0/24",
        "dmz": "192.168.30.0/24"
      },
      "gateway": "192.168.10.1",
      "dns": ["192.168.10.5", "8.8.8.8"]
    }
  }
}
```

### 2. Service Registry
```json
{
  "services": {
    "jenkins": {
      "type": "ci/cd",
      "vm": {
        "name": "jenkins-vm",
        "node": "proxmox1",
        "ip": "192.168.10.178",
        "resources": { "cpu": 4, "memory": 8, "disk": 100 }
      },
      "deployedAt": "2024-05-25T10:00:00Z",
      "version": "2.426.1",
      "dependencies": ["ldap", "gitlab"],
      "metrics": {
        "avgCpuUsage": 45,
        "avgMemoryUsage": 6.2,
        "jobsPerDay": 150
      }
    }
  }
}
```

### 3. Decision History
```json
{
  "decisions": [
    {
      "timestamp": "2024-05-25T10:00:00Z",
      "type": "deployment",
      "service": "jenkins",
      "decision": "Deploy on proxmox1",
      "reasoning": "proxmox2 has higher memory utilization (87% vs 75%)",
      "outcome": "success"
    }
  ]
}
```

### 4. Resource Trends
```json
{
  "resourceTrends": {
    "proxmox1": {
      "cpu": [
        { "timestamp": "2024-05-25T00:00:00Z", "usage": 45 },
        { "timestamp": "2024-05-25T06:00:00Z", "usage": 62 },
        { "timestamp": "2024-05-25T12:00:00Z", "usage": 78 }
      ]
    }
  }
}
```

## Implementation Example: Intelligent Service Deployment

Here's how an agent can use context for intelligent decision making:

```javascript
// 1. Load current infrastructure state
const { infrastructure, services } = await get-mcp-context({ key: "infrastructure" });

// 2. Analyze resource availability
function findBestNode(requiredCpu, requiredMemory) {
  let bestNode = null;
  let lowestUtilization = 100;
  
  for (const [nodeName, node] of Object.entries(infrastructure.nodes)) {
    const cpuAvailable = node.resources.cpu.cores - node.resources.cpu.used;
    const memoryAvailable = node.resources.memory.total - node.resources.memory.used;
    
    if (cpuAvailable >= requiredCpu && memoryAvailable >= requiredMemory) {
      const utilization = (node.resources.cpu.used / node.resources.cpu.cores + 
                          node.resources.memory.used / node.resources.memory.total) / 2;
      
      if (utilization < lowestUtilization) {
        lowestUtilization = utilization;
        bestNode = nodeName;
      }
    }
  }
  
  return bestNode;
}

// 3. Make deployment decision
const jenkinsRequirements = { cpu: 4, memory: 8 };
const targetNode = findBestNode(jenkinsRequirements.cpu, jenkinsRequirements.memory);

if (!targetNode) {
  // Check if we can migrate VMs to make space
  const migrationPlan = analyzeMigrationOptions(infrastructure, jenkinsRequirements);
  
  if (migrationPlan) {
    return {
      action: "migrate-then-deploy",
      plan: migrationPlan
    };
  } else {
    return {
      action: "scale-out",
      reason: "No node has sufficient resources",
      recommendation: "Add new Proxmox node or upgrade existing hardware"
    };
  }
}

// 4. Store the decision
const decisions = await get-mcp-context({ key: "decisions" }) || [];
decisions.push({
  timestamp: new Date().toISOString(),
  type: "deployment",
  service: "jenkins",
  decision: `Deploy on ${targetNode}`,
  reasoning: `Selected based on lowest resource utilization (${(lowestUtilization * 100).toFixed(1)}%)`,
  outcome: "pending"
});
await set-mcp-context({ key: "decisions", value: decisions });
```

## Automated Context Updates

You can create scheduled tasks or triggers to automatically update context:

1. **Resource Monitoring** - Periodic hardware scans
2. **Service Health Checks** - Regular service status updates
3. **Trend Analysis** - Calculate resource usage patterns
4. **Capacity Planning** - Predict when resources will be exhausted

## Example: Starting a Session with Context

When Claude starts a new session:

```javascript
// Agent initialization
const context = await get-mcp-context({});

// Check what we know
if (context.infrastructure) {
  console.log(`I have knowledge of ${Object.keys(context.infrastructure.nodes).length} nodes`);
  console.log(`Managing ${Object.keys(context.services).length} services`);
  
  // Check for any alerts or issues
  const alerts = checkForIssues(context);
  if (alerts.length > 0) {
    console.log(`⚠️ ${alerts.length} issues need attention`);
  }
}

// User: "Hey, can we add a Jenkins server?"
// Agent can now intelligently respond:
// "I see we already have Jenkins running on proxmox1 at 192.168.10.178. 
//  It's currently using 45% CPU on average. Did you want to:
//  1. Scale the existing Jenkins (add more resources)
//  2. Add a Jenkins agent/slave for distributed builds
//  3. Deploy a separate Jenkins instance for a different team?"
```

## Best Practices

1. **Update Context After Changes** - Always update context after deployments, migrations, etc.
2. **Version Your Context Structure** - Include a schema version for future migrations
3. **Regular Snapshots** - Use `capture-state` tool to create periodic snapshots
4. **Context Validation** - Validate context data before major decisions
5. **Audit Trail** - Keep decision history for learning and compliance

This context system enables your MCP server to act as an intelligent infrastructure assistant that remembers past decisions, understands current state, and can make informed recommendations.