# Tool Context Management Architecture

## Overview

All infrastructure tools should automatically manage the MCP context to ensure it always reflects the actual state of the infrastructure. This is achieved through a base class that provides automatic context management capabilities.

## BaseInfrastructureTool Class

### Core Principles

1. **Atomic Operations**: Each tool operation is atomic - either both the action AND context update succeed, or neither do
2. **Automatic Context Management**: Tools don't need to manually manage context - it happens automatically
3. **Consistent Interface**: All infrastructure tools follow the same pattern
4. **Failure Safety**: If the action fails, context remains unchanged

### Architecture

```javascript
class MyTool extends BaseInfrastructureTool {
  constructor() {
    super('tool-name', 'Description', ZodSchema);
  }

  // Implement the actual action (required)
  async executeAction(validatedArgs) {
    // Perform the actual infrastructure operation
    // Return { success: boolean, output: string, error: string }
  }

  // Define what context updates should happen (required)
  getContextUpdates(validatedArgs, actionResult) {
    // Return array of context update operations
    // Only called if executeAction succeeds
  }
}
```

### Context Update Operations

The base class supports these context operations:

```javascript
// Set a value
{ action: 'set', path: 'infrastructure.services.jenkins', value: {...} }

// Remove a value  
{ action: 'remove', path: 'infrastructure.services.jenkins' }

// Merge with existing object
{ action: 'merge', path: 'infrastructure.services.jenkins', value: {...} }

// Append to array
{ action: 'append', path: 'infrastructure.deploymentHistory', value: {...} }
```

## Common Context Update Patterns

### VM Creation
```javascript
getContextUpdates(validatedArgs, actionResult) {
  return BaseInfrastructureTool.createVMContextUpdate(
    validatedArgs.vmId,
    validatedArgs.vmName, 
    validatedArgs.vmIP,
    validatedArgs.serviceName,
    'running'
  );
}
```

### VM Deletion
```javascript
getContextUpdates(validatedArgs, actionResult) {
  return BaseInfrastructureTool.createVMDeletionContextUpdate(
    validatedArgs.vmIP,
    validatedArgs.serviceName
  );
}
```

### Service Status Update
```javascript
getContextUpdates(validatedArgs, actionResult) {
  return BaseInfrastructureTool.createServiceContextUpdate(
    validatedArgs.serviceName,
    {
      status: actionResult.serviceStatus,
      lastAction: validatedArgs.action,
      actionTimestamp: new Date().toISOString()
    }
  );
}
```

## Migration Guide for Existing Tools

### Step 1: Convert Tool Structure

**Before:**
```javascript
export const myTool = {
  name: 'my-tool',
  description: 'Does something',
  inputSchema: MySchema,
  handler: async (args) => {
    // Tool logic here
    // Manual context management
  }
};
```

**After:**
```javascript
class MyTool extends BaseInfrastructureTool {
  constructor() {
    super('my-tool', 'Does something', MySchema);
  }

  async executeAction(validatedArgs) {
    // Move existing tool logic here
    // Remove manual context management
  }

  getContextUpdates(validatedArgs, actionResult) {
    // Define context updates here
  }
}
```

### Step 2: Separate Action from Context

Move context management code from the action logic into `getContextUpdates()`:

**Before:**
```javascript
handler: async (args) => {
  // Do the action
  const result = await doSomething(args);
  
  // Manual context update
  const context = await loadContext();
  context.infrastructure.services[args.service] = {...};
  await saveContext(context);
  
  return result;
}
```

**After:**
```javascript
async executeAction(validatedArgs) {
  // Only do the action
  return await doSomething(validatedArgs);
}

getContextUpdates(validatedArgs, actionResult) {
  return [{
    action: 'set',
    path: `infrastructure.services.${validatedArgs.service}`,
    value: {...}
  }];
}
```

### Step 3: Register the Tool

```javascript
const myTool = new MyTool();

export const myToolDefinitions = [{
  name: myTool.name,
  description: myTool.description,
  inputSchema: zodToJsonSchema(myTool.inputSchema)
}];

export const myToolHandlers = {
  [myTool.name]: myTool.handler.bind(myTool)
};
```

## Benefits

1. **Consistency**: All tools manage context the same way
2. **Reliability**: Context always reflects reality
3. **Debugging**: Easy to trace what changed context and when
4. **Testing**: Can test action and context updates separately
5. **Maintainability**: Context logic is centralized

## Context Structure

The context should follow this structure:

```json
{
  "infrastructure": {
    "lastUpdated": "2025-01-26T00:00:00.000Z",
    "nodes": {
      "proxmox": {
        "ip": "192.168.10.200",
        "type": "proxmox"
      }
    },
    "services": {
      "jenkins": {
        "ip": "192.168.10.178",
        "vmid": 101,
        "status": "running",
        "deployed": "2025-01-26T00:00:00.000Z"
      }
    },
    "ipAllocation": {
      "192.168.10.178": {
        "type": "vm",
        "name": "jenkins",
        "vmid": 101,
        "service": "jenkins",
        "status": "running"
      }
    },
    "deploymentHistory": [
      {
        "timestamp": "2025-01-26T00:00:00.000Z",
        "action": "vm-created",
        "service": "jenkins",
        "ip": "192.168.10.178"
      }
    ]
  }
}
```

## Testing

Tools can be tested in isolation:

```javascript
const tool = new MyTool();

// Test action only
const result = await tool.executeAction(args);

// Test context updates
const updates = tool.getContextUpdates(args, result);

// Test full integration
const fullResult = await tool.handler(args);
```