#!/bin/bash

# Ansible MCP Server v1.0 Test Suite
# Run all tests before GitHub release

set -e

echo "🚀 Ansible MCP Server v1.0 Test Suite"
echo "===================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test results
TOTAL_PASSED=0
TOTAL_FAILED=0

# Function to run a test
run_test() {
    local test_name=$1
    local test_command=$2
    
    echo -e "\n${YELLOW}▶ Running: ${test_name}${NC}"
    echo "----------------------------------------"
    
    if $test_command; then
        echo -e "${GREEN}✅ ${test_name} PASSED${NC}"
        ((TOTAL_PASSED++))
    else
        echo -e "${RED}❌ ${test_name} FAILED${NC}"
        ((TOTAL_FAILED++))
    fi
}

# 1. Check dependencies
echo "📦 Checking Dependencies..."
echo ""

# Check Node.js version
NODE_VERSION=$(node --version)
echo "Node.js: $NODE_VERSION"
if [[ ! "$NODE_VERSION" =~ ^v(16|18|20|22) ]]; then
    echo -e "${RED}❌ Node.js 16+ required${NC}"
    exit 1
fi

# Check npm packages
if [ -f package.json ]; then
    echo "Installing dependencies..."
    npm install --silent
fi

# 2. Run unit tests
if [ -d tests ]; then
    # Quick regression tests
    if [ -f tests/quick-regression-check.sh ]; then
        run_test "Quick Regression Check" "bash tests/quick-regression-check.sh"
    fi
    
    # Regression tests
    if [ -f tests/regression-tests.js ]; then
        run_test "Core Regression Tests" "node tests/regression-tests.js"
    fi
    
    # SSE regression tests
    if [ -f tests/sse-regression-tests.js ]; then
        run_test "SSE Regression Tests" "node tests/sse-regression-tests.js"
    fi
fi

# 3. Run feature tests
echo -e "\n\n${YELLOW}🧪 Running Feature Tests...${NC}"
run_test "v1.0 Feature Tests" "node tests/v1-feature-tests.js"

# 4. Run AI agent scenario tests
echo -e "\n\n${YELLOW}🎭 Running AI Agent Scenarios...${NC}"
run_test "AI Agent Scenarios" "node tests/ai-agent-scenarios.js"

# 5. Test tool loading
echo -e "\n\n${YELLOW}🔧 Testing Tool Loading...${NC}"
TOOL_COUNT=$(node -e "
import { toolRegistry } from './src/tools/index.js';
console.log(toolRegistry.getAllDefinitions().length);
" 2>/dev/null)

if [ "$TOOL_COUNT" -ge 58 ]; then
    echo -e "${GREEN}✅ Tool loading test PASSED (${TOOL_COUNT} tools loaded)${NC}"
    ((TOTAL_PASSED++))
else
    echo -e "${RED}❌ Tool loading test FAILED (expected 58+, got ${TOOL_COUNT})${NC}"
    ((TOTAL_FAILED++))
fi

# 6. Syntax checks
echo -e "\n\n${YELLOW}📝 Running Syntax Checks...${NC}"

# Check all JavaScript files
JS_ERRORS=0
for file in src/*.js src/tools/*.js src/tools/services/*.js; do
    if [ -f "$file" ]; then
        if ! node --check "$file" 2>/dev/null; then
            echo -e "${RED}❌ Syntax error in $file${NC}"
            ((JS_ERRORS++))
        fi
    fi
done

if [ $JS_ERRORS -eq 0 ]; then
    echo -e "${GREEN}✅ JavaScript syntax check PASSED${NC}"
    ((TOTAL_PASSED++))
else
    echo -e "${RED}❌ JavaScript syntax check FAILED ($JS_ERRORS files with errors)${NC}"
    ((TOTAL_FAILED++))
fi

# 7. Check for sensitive data
echo -e "\n\n${YELLOW}🔐 Security Checks...${NC}"

SENSITIVE_FOUND=0
SENSITIVE_PATTERNS=(
    "password.*=.*['\"].*['\"]"
    "api[_-]?key.*=.*['\"].*['\"]"
    "secret.*=.*['\"].*['\"]"
    "192\.168\.[0-9]+\.[0-9]+"
    "10\.[0-9]+\.[0-9]+\.[0-9]+"
)

for pattern in "${SENSITIVE_PATTERNS[@]}"; do
    if grep -r -i "$pattern" src/ --exclude-dir=node_modules --exclude="*.test.js" 2>/dev/null | grep -v "example\|default\|placeholder"; then
        echo -e "${YELLOW}⚠️  Potential sensitive data found for pattern: $pattern${NC}"
        ((SENSITIVE_FOUND++))
    fi
done

if [ $SENSITIVE_FOUND -eq 0 ]; then
    echo -e "${GREEN}✅ Security check PASSED${NC}"
    ((TOTAL_PASSED++))
else
    echo -e "${YELLOW}⚠️  Security check WARNING ($SENSITIVE_FOUND patterns found)${NC}"
fi

# 8. Documentation check
echo -e "\n\n${YELLOW}📚 Documentation Check...${NC}"

REQUIRED_DOCS=(
    "README.md"
    "LICENSE"
    ".gitignore"
    "package.json"
)

DOCS_MISSING=0
for doc in "${REQUIRED_DOCS[@]}"; do
    if [ ! -f "$doc" ]; then
        echo -e "${RED}❌ Missing required file: $doc${NC}"
        ((DOCS_MISSING++))
    fi
done

if [ $DOCS_MISSING -eq 0 ]; then
    echo -e "${GREEN}✅ Documentation check PASSED${NC}"
    ((TOTAL_PASSED++))
else
    echo -e "${RED}❌ Documentation check FAILED ($DOCS_MISSING files missing)${NC}"
    ((TOTAL_FAILED++))
fi

# Final Summary
echo -e "\n\n"
echo "===================================="
echo "📊 FINAL TEST SUMMARY"
echo "===================================="
echo -e "${GREEN}✅ Passed: $TOTAL_PASSED${NC}"
echo -e "${RED}❌ Failed: $TOTAL_FAILED${NC}"
echo -e "📈 Total:  $((TOTAL_PASSED + TOTAL_FAILED))"

if [ $TOTAL_FAILED -eq 0 ]; then
    echo -e "\n${GREEN}🎉 All tests passed! Ready for v1.0 release!${NC}"
    exit 0
else
    echo -e "\n${RED}⚠️  Some tests failed. Please fix before release.${NC}"
    exit 1
fi