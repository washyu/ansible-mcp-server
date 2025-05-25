@echo off
echo Setting environment variables...
set MCP_SSE_URL=http://192.168.10.100:3001/sse
set API_ACCESS_TOKEN=75bf9cbcf951ed970c96431f77985d7588d1229d5b3f29e0555a177f628f55d5

echo MCP_SSE_URL=%MCP_SSE_URL%
echo API_ACCESS_TOKEN=%API_ACCESS_TOKEN%
echo.
echo Starting proxy client...
node "%~dp0mcp-proxy-client.js" %*