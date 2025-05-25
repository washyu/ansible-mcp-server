#!/bin/bash

# Test script for Ollama models with MCP server
# This script helps test different Ollama models with the MCP server

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default values
OLLAMA_MODEL="${OLLAMA_MODEL:-mistral}"
MCP_SERVER_URL="${MCP_SERVER_URL:-http://localhost:3000}"

echo -e "${GREEN}Ollama MCP Server Compatibility Test${NC}"
echo "======================================="
echo "Model: $OLLAMA_MODEL"
echo "MCP Server: $MCP_SERVER_URL"
echo ""

# Check if Ollama is installed
if ! command -v ollama &> /dev/null; then
    echo -e "${RED}Error: Ollama is not installed${NC}"
    echo "Install from: https://ollama.ai"
    exit 1
fi

# Check if model is available
echo -e "${YELLOW}Checking if model is available...${NC}"
if ! ollama list | grep -q "$OLLAMA_MODEL"; then
    echo -e "${YELLOW}Model $OLLAMA_MODEL not found. Pulling...${NC}"
    ollama pull "$OLLAMA_MODEL"
fi

# Create test prompts file
cat > /tmp/mcp-test-prompts.txt << 'EOF'
# Test 1: Basic tool usage
Can you use the browse-services tool to show me all available services?

# Test 2: Filtered browse
Use the browse-services tool to show me only dev-tools category services

# Test 3: Service details
Get details about the jenkins service using the service-details tool

# Test 4: Complex query
I want to deploy a Git server. Can you help me find the best option and show me how to deploy it?

# Test 5: Infrastructure discovery
Use the discover-proxmox tool to show me all VMs on the Proxmox server

# Test 6: Inventory generation
Generate an Ansible inventory from the discovered Proxmox VMs
EOF

# Create a simple test runner
cat > /tmp/test-ollama-mcp.py << 'EOF'
import json
import subprocess
import sys

def test_mcp_with_ollama(model, prompt):
    """Test MCP server with Ollama model"""
    
    # Create a system prompt that explains MCP tools
    system_prompt = """You are an AI assistant with access to MCP (Model Context Protocol) tools.
    
Available tools:
- browse-services: Browse available services (params: category, search, showAlternatives)
- service-details: Get service details (params: serviceName)
- deploy-service: Deploy a service (params: serviceName, vmName, ip, customConfig)
- discover-proxmox: Discover VMs on Proxmox (params: host, user, password, node)
- generate-inventory: Generate Ansible inventory (params: vms, outputPath, groupBy)

When asked to use a tool, respond with a JSON structure like:
{
  "tool": "tool-name",
  "parameters": {
    "param1": "value1"
  }
}
"""
    
    # Combine prompts
    full_prompt = f"{system_prompt}\n\nUser: {prompt}\n\nAssistant:"
    
    # Call Ollama
    cmd = ['ollama', 'run', model, full_prompt]
    result = subprocess.run(cmd, capture_output=True, text=True)
    
    return result.stdout

def main():
    model = sys.argv[1] if len(sys.argv) > 1 else "mistral"
    
    # Read test prompts
    with open('/tmp/mcp-test-prompts.txt', 'r') as f:
        prompts = [line.strip() for line in f if line.strip() and not line.startswith('#')]
    
    print(f"Testing {model} with MCP tools\n")
    
    for i, prompt in enumerate(prompts, 1):
        print(f"Test {i}: {prompt}")
        print("-" * 50)
        
        response = test_mcp_with_ollama(model, prompt)
        print(f"Response: {response}")
        
        # Try to detect if the model understood tool usage
        if "tool" in response and "parameters" in response:
            print("✓ Model appears to understand tool format")
        else:
            print("✗ Model may not understand tool format")
        
        print("\n")

if __name__ == "__main__":
    main()
EOF

# Run the test
echo -e "${GREEN}Running MCP compatibility tests...${NC}"
echo ""

python3 /tmp/test-ollama-mcp.py "$OLLAMA_MODEL"

echo ""
echo -e "${GREEN}Test complete!${NC}"
echo ""
echo "Notes for improving compatibility:"
echo "1. Smaller models may need more explicit instructions"
echo "2. Consider creating simplified tool schemas"
echo "3. Add more examples in tool descriptions"
echo "4. Some models work better with specific prompt formats"

# Cleanup
rm -f /tmp/mcp-test-prompts.txt /tmp/test-ollama-mcp.py