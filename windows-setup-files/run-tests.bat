@echo off
echo Running MCP Connection Tests...
echo.

echo Test 1: Testing proxy connection
echo ================================
node test-mcp-connection.js
echo.
echo.

echo Test 2: Testing SSE server directly
echo ===================================
node test-sse-direct.js
echo.
echo.

echo Tests complete. Press any key to exit...
pause >nul