@echo off
REM Test MCP Proxy Connection

echo Testing MCP Proxy Connection...
echo.

set API_ACCESS_TOKEN=75bf9cbcf951ed970c96431f77985d7588d1229d5b3f29e0555a177f628f55d5

echo 1. Testing production server connectivity...
curl -H "Authorization: Bearer %API_ACCESS_TOKEN%" http://192.168.10.100:3001/health
echo.

echo 2. Running proxy client in test mode...
cd /d "%~dp0"
echo Current directory: %CD%
echo.

echo 3. Checking if mcp-proxy-client.js exists...
if exist mcp-proxy-client.js (
    echo Found mcp-proxy-client.js
) else (
    echo ERROR: mcp-proxy-client.js not found!
    echo Please ensure you copied all files from windows-setup-files
)
echo.

echo 4. Checking Node.js installation...
node --version
echo.

echo 5. Checking dependencies...
if exist package.json (
    echo Found package.json
    if exist node_modules (
        echo Found node_modules directory
    ) else (
        echo ERROR: node_modules not found!
        echo Please run: npm install
    )
) else (
    echo ERROR: package.json not found!
)
echo.

echo 6. Running proxy client with verbose output...
node mcp-proxy-client.js production

pause