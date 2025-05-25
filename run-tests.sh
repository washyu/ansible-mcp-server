#!/bin/bash
# Run all MCP server tests

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}MCP Server Test Suite${NC}"
echo "====================="
echo

# Check dependencies
echo "Checking dependencies..."
if ! command -v node &> /dev/null; then
    echo -e "${RED}Error: Node.js is not installed${NC}"
    exit 1
fi

if ! command -v ansible &> /dev/null; then
    echo -e "${RED}Error: Ansible is not installed${NC}"
    exit 1
fi

# Install npm dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

# Test 1: Unit tests
echo
echo -e "${YELLOW}Running unit tests...${NC}"
if npm test; then
    echo -e "${GREEN}✓ Unit tests passed${NC}"
else
    echo -e "${RED}✗ Unit tests failed${NC}"
    exit 1
fi

# Test 2: Direct functional tests
echo
echo -e "${YELLOW}Running direct functional tests...${NC}"
if node tests/functional-test.js; then
    echo -e "${GREEN}✓ Direct functional tests passed${NC}"
else
    echo -e "${RED}✗ Direct functional tests failed${NC}"
    exit 1
fi

# Test 3: SSE functional tests (if SSE server is running)
echo
echo -e "${YELLOW}Checking SSE server...${NC}"
if curl -s http://localhost:3001/health > /dev/null 2>&1; then
    echo "SSE server is running, executing SSE tests..."
    
    # Use the API token from .env if available
    if [ -f .env ]; then
        export $(grep -v '^#' .env | xargs)
    fi
    
    if node tests/sse-functional-test.js; then
        echo -e "${GREEN}✓ SSE functional tests passed${NC}"
    else
        echo -e "${RED}✗ SSE functional tests failed${NC}"
        exit 1
    fi
else
    echo -e "${YELLOW}SSE server not running, skipping SSE tests${NC}"
    echo "To run SSE tests, start the server with: npm run start:sse"
fi

# Test 4: Regression tests (requires sudo)
echo
echo -e "${YELLOW}Running regression tests...${NC}"
if [ "$EUID" -eq 0 ] || [ -n "$SUDO_USER" ]; then
    if node tests/regression-tests.js; then
        echo -e "${GREEN}✓ Regression tests passed${NC}"
    else
        echo -e "${RED}✗ Regression tests failed${NC}"
        echo "Some regression tests failed - these are critical issues that were previously fixed"
        exit 1
    fi
else
    echo -e "${YELLOW}Skipping regression tests (requires sudo)${NC}"
    echo "To run regression tests: sudo ./run-tests.sh"
fi

# Test 5: SSE regression tests (if SSE server is running)
if curl -s http://localhost:3001/health > /dev/null 2>&1; then
    echo
    echo -e "${YELLOW}Running SSE regression tests...${NC}"
    if node tests/sse-regression-tests.js; then
        echo -e "${GREEN}✓ SSE regression tests passed${NC}"
    else
        echo -e "${RED}✗ SSE regression tests failed${NC}"
        exit 1
    fi
fi

# Test 4: Validate configuration
echo
echo -e "${YELLOW}Validating configuration...${NC}"

# Check if .env exists
if [ -f .env ]; then
    echo "✓ .env file exists"
    
    # Check required variables
    required_vars=("PROXMOX_HOST" "PROXMOX_USER" "DEFAULT_GATEWAY")
    missing_vars=()
    
    for var in "${required_vars[@]}"; do
        if ! grep -q "^${var}=" .env; then
            missing_vars+=($var)
        fi
    done
    
    if [ ${#missing_vars[@]} -eq 0 ]; then
        echo "✓ All required variables are set"
    else
        echo -e "${YELLOW}Warning: Missing variables: ${missing_vars[*]}${NC}"
    fi
else
    echo -e "${YELLOW}Warning: .env file not found${NC}"
fi

# Test 5: Check file permissions
echo
echo -e "${YELLOW}Checking file permissions...${NC}"
executable_files=("deploy-sse-server.sh" "push-sse-updates.sh" "setup.sh")
all_executable=true

for file in "${executable_files[@]}"; do
    if [ -x "$file" ]; then
        echo "✓ $file is executable"
    else
        echo -e "${RED}✗ $file is not executable${NC}"
        all_executable=false
    fi
done

if [ "$all_executable" = true ]; then
    echo -e "${GREEN}✓ All scripts have correct permissions${NC}"
fi

# Summary
echo
echo "====================="
echo -e "${GREEN}All tests completed successfully!${NC}"
echo
echo "To run specific test suites:"
echo "  npm test                    # Unit tests"
echo "  node tests/functional-test.js    # Direct functional tests"
echo "  node tests/sse-functional-test.js # SSE tests (requires SSE server)"
echo
echo "For continuous testing during development:"
echo "  npm run dev                 # Run MCP server with auto-reload"
echo "  npm run dev:sse            # Run SSE server with auto-reload"