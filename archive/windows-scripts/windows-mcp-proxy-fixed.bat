@echo off
cd /d "%~dp0"
node mcp-proxy-client.js --sse-url="http://192.168.10.100:3001/sse" --api-token="75bf9cbcf951ed970c96431f77985d7588d1229d5b3f29e0555a177f628f55d5" %*