# Modular Tool System

The MCP server now supports a modular tool architecture that allows:

1. **Dynamic tool loading/unloading** - Load service-specific tools when needed
2. **Persistent context storage** - Remember configurations between sessions
3. **Service-specific tools** - Each service can have its own tool module

## Architecture

```
src/
├── tools/
│   ├── index.js              # Tool registry and loader
│   ├── ansible-tools.js      # Ansible-specific tools
│   ├── terraform-tools.js    # Terraform tools
│   ├── infrastructure-tools.js # Infrastructure discovery
│   ├── service-tools.js      # Service catalog tools
│   ├── environment-tools.js  # CI/CD environment tools
│   └── services/            # Service-specific tools
│       ├── pihole-tools.js
│       ├── nextcloud-tools.js (future)
│       └── grafana-tools.js (future)
```

## Using Context Storage

The MCP now remembers information between sessions:

```bash
# Store context
claude "Remember that my Pi-hole is at YOUR_GATEWAY_IP0"

# Retrieved automatically in future sessions
claude "Check my Pi-hole stats"
```

## Loading Service Tools

When you install a new service, load its tools:

```bash
# After installing Pi-hole
claude "Load Pi-hole tools"

# Now Pi-hole-specific commands are available
claude "Show Pi-hole statistics"
claude "Blacklist ads.example.com on Pi-hole"
```

## Available Context Tools

- `get-mcp-context` - Retrieve stored context
- `set-mcp-context` - Store information for future sessions
- `load-service-tools` - Load tools for a specific service
- `unload-service-tools` - Unload service tools
- `list-loaded-tools` - See all available tools

## Creating New Service Tools

To add tools for a new service:

1. Create `src/tools/services/{service}-tools.js`
2. Export `toolDefinitions` and `toolHandlers`
3. Load with: `load-service-tools serviceName`

Example structure:

```javascript
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

const serviceTools = [
  {
    name: 'service-action',
    description: 'Perform service action',
    inputSchema: z.object({
      // Define parameters
    }),
    handler: async (args) => {
      // Implement action
      return {
        success: true,
        output: 'Result',
        error: ''
      };
    }
  }
];

export const toolDefinitions = serviceTools.map(tool => ({
  name: tool.name,
  description: tool.description,
  inputSchema: zodToJsonSchema(tool.inputSchema)
}));

export const toolHandlers = Object.fromEntries(
  serviceTools.map(tool => [tool.name, tool.handler])
);
```

## Benefits

1. **Reduced complexity** - Only load tools you need
2. **Better organization** - Tools grouped by service
3. **Persistent memory** - MCP remembers your infrastructure
4. **Extensible** - Easy to add new service integrations