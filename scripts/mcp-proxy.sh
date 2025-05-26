#!/bin/bash
# MCP Proxy Launcher Script

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Available servers
show_usage() {
    echo "Usage: $0 [server]"
    echo ""
    echo "Available servers:"
    echo "  production  - Production MCP Server (192.168.10.100:3001)"
    echo "  dev         - Development MCP Server (192.168.10.102:3001)"
    echo "  local       - Local MCP Server (localhost:3001)"
    echo ""
    echo "Environment variables:"
    echo "  MCP_SERVER         - Server name (overrides command line)"
    echo "  API_ACCESS_TOKEN   - API token for authentication"
    echo ""
    echo "Examples:"
    echo "  $0 dev                    # Connect to dev server"
    echo "  MCP_SERVER=production $0  # Connect to production server"
    echo "  API_ACCESS_TOKEN=mytoken $0 local  # Connect with custom token"
}

# Check for help flag
if [[ "$1" == "-h" || "$1" == "--help" ]]; then
    show_usage
    exit 0
fi

# Set default server if not provided
SERVER=${1:-${MCP_SERVER:-production}}

echo "Starting MCP Proxy for server: $SERVER"
echo "Project directory: $PROJECT_DIR"

# Change to project directory and run the proxy
cd "$PROJECT_DIR"
exec node src/mcp-proxy-client.js "$SERVER"