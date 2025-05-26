#!/bin/bash
# Run All Feature Tests Against Dev Server

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "=========================================="
echo "Running All Feature Tests Against Dev Server"
echo "=========================================="
echo ""

# Set environment for dev server
export NODE_OPTIONS='--experimental-vm-modules'
export API_ACCESS_TOKEN='75bf9cbcf951ed970c96431f77985d7588d1229d5b3f29e0555a177f628f55d5'
export MCP_SSE_URL='http://192.168.10.102:3001/sse'
export MCP_SERVER='dev'

# Environment configuration for dev
export PROXMOX_API_HOST='192.168.10.200'
export PROXMOX_API_TOKEN_ID='root@pam!asable-mcp'
export PROXMOX_API_TOKEN_SECRET='34772c72-4c3a-4f65-b67d-25620f1cb628'

# Change to project directory
cd "$PROJECT_DIR"

echo "Target Server: Development (192.168.10.102)"
echo "API Token: ${API_ACCESS_TOKEN:0:10}..."
echo ""

# Check server connectivity
echo "Checking server connectivity..."
echo -n "Dev MCP server (192.168.10.102:3001): "
if timeout 2 nc -zv 192.168.10.102 3001 2>/dev/null; then
    echo "✅ Available"
else
    echo "❌ Not available"
    exit 1
fi

echo -n "Proxmox server (192.168.10.200:8006): "
if timeout 2 nc -zv 192.168.10.200 8006 2>/dev/null; then
    echo "✅ Available"
else
    echo "❌ Not available"
fi

echo ""
echo "Running feature tests..."
echo ""

# Track test results
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Function to run a test and track results
run_test() {
    local test_name="$1"
    local test_file="$2"
    
    echo "=========================================="
    echo "Running: $test_name"
    echo "=========================================="
    
    if [ "$test_file" == "proxy-integration" ]; then
        # Special handling for integration test
        MCP_SERVER=dev node tests/proxy-integration-test.js
    elif [ "$test_file" == "proxy-restart" ]; then
        # Special handling for restart test
        node tests/proxy-restart-test.js
    else
        # Jest tests
        npm test -- "$test_file" --verbose
    fi
    
    local exit_code=$?
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    if [ $exit_code -eq 0 ]; then
        echo "✅ PASSED: $test_name"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo "❌ FAILED: $test_name (exit code: $exit_code)"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
    
    echo ""
    return $exit_code
}

# Run all feature tests
echo "1. VM Lifecycle Feature Test"
run_test "VM Lifecycle (Create/Install/Delete)" "tests/feature/vm-lifecycle-feature.test.js"

echo "2. Proxy Switching Feature Test"
run_test "Proxy Server Switching" "tests/feature/proxy-switching-feature.test.js"

echo "3. Proxy Integration Test"
run_test "Proxy Integration (Standalone)" "proxy-integration"

echo "4. Proxy Restart Test"
run_test "Proxy Restart Scenarios" "proxy-restart"

# Summary
echo ""
echo "=========================================="
echo "Test Summary"
echo "=========================================="
echo "Total Tests Run: $TOTAL_TESTS"
echo "Passed: $PASSED_TESTS ✅"
echo "Failed: $FAILED_TESTS ❌"
echo ""

if [ $FAILED_TESTS -eq 0 ]; then
    echo "🎉 All tests passed! Ready to push to main."
    exit 0
else
    echo "⚠️  Some tests failed. Please fix before pushing to main."
    exit 1
fi