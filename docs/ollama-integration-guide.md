# Ollama Integration Guide for MCP Server

## Overview
This guide helps you test and use the Ansible MCP Server with Ollama models.

## Quick Start

1. **Install Ollama**
   ```bash
   curl -fsSL https://ollama.ai/install.sh | sh
   ```

2. **Pull a model**
   ```bash
   # Recommended models for MCP usage
   ollama pull mistral        # 7B, good balance
   ollama pull mixtral        # 8x7B, better for complex tasks
   ollama pull codellama      # Optimized for code/config
   ```

3. **Run the compatibility test**
   ```bash
   ./test-ollama-mcp.sh
   ```

## Setting up Ollama with MCP

### Option 1: Direct CLI Usage
```bash
# Example: Browse services
ollama run mistral "You have access to MCP tools. Use browse-services to show dev-tools"

# Example: Get service details  
ollama run mistral "Use service-details tool to get info about jenkins"
```

### Option 2: Create an MCP-aware Modelfile
Create `Modelfile.mcp`:
```
FROM mistral

SYSTEM """
You are an infrastructure automation assistant with access to MCP tools:

TOOLS AVAILABLE:
- browse-services: Browse service catalog (params: category, search)
- service-details: Get service info (params: serviceName)
- deploy-service: Deploy services (params: serviceName, vmName)
- discover-proxmox: Find existing VMs
- generate-inventory: Create Ansible inventory

Always respond with tool calls in this format:
{"tool": "tool-name", "parameters": {...}}
"""

PARAMETER temperature 0.7
PARAMETER top_p 0.9
```

Build and use:
```bash
ollama create mcp-assistant -f Modelfile.mcp
ollama run mcp-assistant "Show me all monitoring services"
```

## Model Recommendations

### For Basic Tasks (browse, query)
- **Mistral 7B**: Fast, understands tool formats well
- **Llama 2 7B**: Good general understanding
- **Phi-2**: Very fast, good for simple queries

### For Complex Tasks (deploy, configure)
- **Mixtral 8x7B**: Best open-source option
- **CodeLlama 13B+**: Excellent for configuration files
- **Llama 2 70B**: Most capable but slower

### For Code/Config Generation
- **CodeLlama**: Purpose-built for code
- **DeepSeek Coder**: Good alternative
- **WizardCoder**: Strong configuration understanding

## Integration Patterns

### 1. Simple Tool Calls
```python
import ollama

def call_mcp_tool(tool_name, parameters):
    prompt = f"""Use the {tool_name} MCP tool with these parameters:
    {json.dumps(parameters)}
    
    Respond only with the tool call in JSON format."""
    
    response = ollama.chat(model='mistral', messages=[
        {'role': 'user', 'content': prompt}
    ])
    
    return response['message']['content']
```

### 2. Conversational Interface
```python
def mcp_chat(query):
    system = """You are an MCP assistant. Available tools:
    - browse-services (category, search)
    - service-details (serviceName)
    - deploy-service (serviceName, vmName)
    
    Respond naturally but include tool calls as JSON when needed."""
    
    response = ollama.chat(
        model='mixtral',
        messages=[
            {'role': 'system', 'content': system},
            {'role': 'user', 'content': query}
        ]
    )
    
    return response['message']['content']
```

## Limitations and Workarounds

### Common Issues

1. **Tool Format Confusion**
   - Smaller models may not output proper JSON
   - Solution: Use more explicit prompts
   ```
   Instead of: "Browse services"
   Use: "Call the browse-services tool and format as JSON: {tool: ..., parameters: ...}"
   ```

2. **Parameter Confusion**
   - Models may miss required parameters
   - Solution: List parameters explicitly in prompt

3. **Multi-step Tasks**
   - Smaller models struggle with planning
   - Solution: Break into single steps

### Model-Specific Tips

**Mistral**
- Excellent tool format understanding
- May need reminders for complex parameters

**Llama 2**
- Prefers conversational style
- Benefits from examples in prompt

**CodeLlama**
- Excels at generating configurations
- May over-explain; ask for concise responses

## Testing Your Setup

1. **Basic Test**
   ```bash
   echo "List all services" | ollama run mistral
   ```

2. **Advanced Test**
   ```bash
   ./test-ollama-mcp.sh
   ```

3. **Custom Test**
   Create `test-prompt.txt`:
   ```
   Find a Git hosting solution and show me deployment options
   ```
   Run:
   ```bash
   ollama run mixtral < test-prompt.txt
   ```

## Performance Optimization

1. **Model Loading**
   ```bash
   # Keep model in memory
   ollama run mistral --keep-alive 3600
   ```

2. **Batch Processing**
   ```bash
   # Process multiple commands
   cat commands.txt | ollama run mistral
   ```

3. **GPU Acceleration**
   - Ensure CUDA/ROCm is properly configured
   - Use `nvidia-smi` or `rocm-smi` to verify

## Troubleshooting

### Model won't load
```bash
# Check available memory
free -h

# Try smaller model
ollama pull phi
```

### Poor tool usage
- Add examples to prompts
- Use more explicit instructions
- Try different temperature settings

### Slow responses
- Use smaller models for simple tasks
- Enable GPU acceleration
- Reduce context length

## Example Workflows

### Discover and Catalog Infrastructure
```bash
ollama run mcp-assistant << 'EOF'
1. Use discover-proxmox to find all VMs
2. Generate an inventory grouped by OS type
3. Show me the results
EOF
```

### Deploy a Service
```bash
ollama run mcp-assistant << 'EOF'
I need a Git server. Please:
1. Show me Git hosting options
2. Recommend the best lightweight option
3. Show me how to deploy it
EOF
```

## Contributing

Help improve Ollama compatibility:
1. Test with different models
2. Document what works/doesn't work
3. Submit prompt improvements
4. Share model configurations