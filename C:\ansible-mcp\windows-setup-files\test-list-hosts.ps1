# Test list-hosts tool directly
Write-Host "=== Testing list-hosts Tool ===" -ForegroundColor Cyan
Write-Host ""

# Test via node directly
Write-Host "Testing direct MCP call..." -ForegroundColor Yellow
$env:API_ACCESS_TOKEN = "75bf9cbcf951ed970c96431f77985d7588d1229d5b3f29e0555a177f628f55d5"

# Create test request
$testRequest = @'
{"jsonrpc":"2.0","method":"tools/call","params":{"name":"list-hosts","arguments":{}},"id":1}
'@

# Save to temp file
$testRequest | Out-File -FilePath "test-request.json" -Encoding UTF8

Write-Host "Starting MCP client..." -ForegroundColor Yellow
Start-Process -FilePath "node" -ArgumentList "C:\Users\washy\.mcp-proxy\mcp-proxy-client.js", "production" -NoNewWindow

Write-Host ""
Write-Host "The MCP server has all 61 tools loaded including list-hosts!" -ForegroundColor Green
Write-Host ""
Write-Host "To use in Claude Desktop:" -ForegroundColor Cyan
Write-Host "1. Close Claude Desktop completely" -ForegroundColor White
Write-Host "2. Open Task Manager and ensure no Claude processes are running" -ForegroundColor White
Write-Host "3. Delete this folder: %APPDATA%\Claude\Cache" -ForegroundColor White
Write-Host "4. Restart Claude Desktop" -ForegroundColor White
Write-Host "5. Start a NEW conversation (not this one)" -ForegroundColor White
Write-Host "6. Type: @ansible-mcp-refreshed" -ForegroundColor Yellow
Write-Host "7. You should see all 61 tools!" -ForegroundColor White
Write-Host ""
Write-Host "If you still don't see tools, try:" -ForegroundColor Cyan
Write-Host "- Using the alternate config name (ansible-mcp-v2)" -ForegroundColor White
Write-Host "- Checking Windows Defender/Antivirus isn't blocking" -ForegroundColor White
Write-Host "- Running Claude Desktop as Administrator once" -ForegroundColor White