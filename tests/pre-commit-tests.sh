#!/bin/bash
# Pre-commit test suite
# Run this before committing to ensure core functionality works

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "================================================"
echo "Pre-Commit Test Suite"
echo "================================================"
echo ""

cd "$PROJECT_ROOT"

# Function to run a test and check result
run_test() {
    local test_name=$1
    local test_command=$2
    
    echo -n "Running $test_name... "
    if $test_command >/dev/null 2>&1; then
        echo "✅ PASSED"
        return 0
    else
        echo "❌ FAILED"
        return 1
    fi
}

# Track failures
FAILED_TESTS=0

# 1. Check syntax
echo "1. Syntax Checks"
echo "----------------"
run_test "JavaScript syntax" "node -c src/index.js" || ((FAILED_TESTS++))
run_test "SSE server syntax" "node -c src/sse-server.js" || ((FAILED_TESTS++))
run_test "MCP proxy syntax" "node -c src/mcp-proxy-client.js" || ((FAILED_TESTS++))
echo ""

# 2. Unit tests
echo "2. Unit Tests"
echo "-------------"
if [ -f "jest.config.js" ]; then
    run_test "Jest unit tests" "NODE_OPTIONS='--experimental-vm-modules' npx jest --testPathPattern='tests/unit' --silent" || ((FAILED_TESTS++))
else
    echo "⚠️  No unit tests configured"
fi
echo ""

# 3. Integration tests
echo "3. Integration Tests"
echo "-------------------"
run_test "SSE-MCP integration" "./tests/run-integration-tests.sh" || ((FAILED_TESTS++))
echo ""

# 4. Critical functionality tests
echo "4. Critical Functionality"
echo "------------------------"

# Test MCP server can start
echo -n "Testing MCP server startup... "
timeout 2s node src/index.js </dev/null >/dev/null 2>&1
if [ $? -eq 124 ]; then
    echo "✅ PASSED (server starts)"
else
    echo "❌ FAILED (server crashed)"
    ((FAILED_TESTS++))
fi

# Test SSE server can start (on different port to avoid conflicts)
echo -n "Testing SSE server startup... "
SSE_PORT=3999 timeout 2s node src/sse-server.js </dev/null >/dev/null 2>&1
if [ $? -eq 124 ]; then
    echo "✅ PASSED (server starts)"
else
    echo "❌ FAILED (server crashed)"
    ((FAILED_TESTS++))
fi

echo ""
echo "================================================"
if [ $FAILED_TESTS -eq 0 ]; then
    echo "✅ All tests passed! Safe to commit."
    echo "================================================"
    exit 0
else
    echo "❌ $FAILED_TESTS test(s) failed. Please fix before committing."
    echo "================================================"
    exit 1
fi