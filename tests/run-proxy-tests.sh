#!/bin/bash
# Run Proxy Feature Tests

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "==================================="
echo "Running Proxy Feature Tests"
echo "==================================="
echo ""

# Set environment
export NODE_OPTIONS='--experimental-vm-modules'
export API_ACCESS_TOKEN='75bf9cbcf951ed970c96431f77985d7588d1229d5b3f29e0555a177f628f55d5'

# Change to project directory
cd "$PROJECT_DIR"

# Check if servers are accessible
echo "Checking server connectivity..."
echo -n "Production server (192.168.10.100): "
if timeout 2 nc -zv 192.168.10.100 3001 2>/dev/null; then
    echo "✅ Available"
else
    echo "❌ Not available"
fi

echo -n "Dev server (192.168.10.102): "
if timeout 2 nc -zv 192.168.10.102 3001 2>/dev/null; then
    echo "✅ Available"
else
    echo "❌ Not available"
fi

echo ""
echo "Running tests..."
echo ""

# Run the proxy tests
npm test -- tests/feature/proxy-switching-feature.test.js --verbose

# Check exit code
EXIT_CODE=$?

echo ""
echo "==================================="
if [ $EXIT_CODE -eq 0 ]; then
    echo "✅ All proxy tests passed!"
else
    echo "❌ Some proxy tests failed (exit code: $EXIT_CODE)"
fi
echo "==================================="

exit $EXIT_CODE