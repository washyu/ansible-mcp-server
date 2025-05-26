#!/bin/bash
# Run SSE-MCP integration tests

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "================================================"
echo "Running SSE-MCP Integration Tests"
echo "================================================"
echo ""

cd "$PROJECT_ROOT"

# Check if EventSource is installed
if ! npm list eventsource >/dev/null 2>&1; then
    echo "Installing eventsource dependency..."
    npm install --save-dev eventsource
fi

# Run the integration test
echo "Starting integration test..."
node tests/integration/sse-mcp-integration-runner.cjs

echo ""
echo "================================================"
echo "Integration tests completed!"
echo "================================================"