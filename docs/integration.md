# Integration Guide

## Integrating with Claude Desktop

To use this MCP server with Claude Desktop, add the following to your Claude Desktop configuration:

```json
{
  "mcpServers": {
    "ansible": {
      "command": "node",
      "args": ["/opt/ansible-mcp-server/src/index.js"]
    }
  }
}
```

Or if running from the project directory:

```json
{
  "mcpServers": {
    "ansible": {
      "command": "npm",
      "args": ["run", "start"],
      "cwd": "/home/user/ansible-mcp-server"
    }
  }
}
```

## Example Usage in Claude

Once integrated, you can use natural language to execute Ansible commands:

```
"Run the webserver playbook against the production inventory"
```

Claude will translate this to:
```json
{
  "tool": "ansible-playbook",
  "arguments": {
    "playbook": "webserver.yml",
    "inventory": "inventories/production"
  }
}
```

## API Examples

### Running a Playbook with Extra Variables

```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "id": 1,
  "params": {
    "name": "ansible-playbook",
    "arguments": {
      "playbook": "/home/user/playbooks/deploy.yml",
      "inventory": "/home/user/inventory/hosts",
      "extraVars": {
        "app_version": "2.1.0",
        "deploy_env": "staging"
      },
      "limit": "webservers",
      "check": true
    }
  }
}
```

### Listing Inventory

```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "id": 2,
  "params": {
    "name": "ansible-inventory",
    "arguments": {
      "inventory": "/home/user/inventory/hosts",
      "list": true
    }
  }
}
```

### Installing a Galaxy Role

```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "id": 3,
  "params": {
    "name": "ansible-galaxy",
    "arguments": {
      "action": "install",
      "name": "geerlingguy.mysql",
      "force": true
    }
  }
}
```

## Error Handling

The server provides detailed error information:

```json
{
  "success": false,
  "error": "Command failed with exit code 1: ERROR! the playbook: doesnt-exist.yml could not be found",
  "details": "Stack trace here..."
}
```

## Best Practices

1. **Use Absolute Paths**: Always provide absolute paths for playbooks and inventory files
2. **Check Mode First**: Run with `"check": true` to preview changes
3. **Limit Scope**: Use the `limit` parameter to target specific hosts
4. **Structured Inventory**: Organize inventory files in a consistent structure
5. **Error Recovery**: Check the error details to understand and fix issues

## Extending the Server

To add new Ansible tools:

1. Add the schema in `src/index.js`
2. Add the tool to the tools list
3. Implement the handler in the switch statement
4. Update tests and documentation

Example:
```javascript
const AnsibleVaultSchema = z.object({
  action: z.enum(['encrypt', 'decrypt', 'view']),
  file: z.string(),
  vaultPassword: z.string().optional()
});

// In tools/list
{
  name: 'ansible-vault',
  description: 'Manage Ansible vault encrypted files',
  inputSchema: AnsibleVaultSchema,
}

// In tools/call handler
case 'ansible-vault': {
  const validatedArgs = AnsibleVaultSchema.parse(args);
  // Implementation here
}
```