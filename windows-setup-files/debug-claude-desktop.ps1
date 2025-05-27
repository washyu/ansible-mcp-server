# PowerShell script to debug Claude Desktop MCP connection

Write-Host "=== Claude Desktop MCP Debug Script ===" -ForegroundColor Cyan
Write-Host ""

# Step 1: Check Claude Desktop config
Write-Host "Step 1: Checking Claude Desktop configuration..." -ForegroundColor Yellow
$configPath = "$env:APPDATA\Claude\claude_desktop_config.json"

if (Test-Path $configPath) {
    Write-Host "✓ Config file found at: $configPath" -ForegroundColor Green
    Write-Host "Current configuration:" -ForegroundColor Cyan
    Get-Content $configPath | ConvertFrom-Json | ConvertTo-Json -Depth 10
    Write-Host ""
} else {
    Write-Host "✗ Config file not found at: $configPath" -ForegroundColor Red
    Write-Host ""
}

# Step 2: Test Node.js installation
Write-Host "Step 2: Testing Node.js..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    Write-Host "✓ Node.js version: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ Node.js not found in PATH" -ForegroundColor Red
}
Write-Host ""

# Step 3: Check if mcp-proxy-client.js exists
Write-Host "Step 3: Checking MCP proxy client..." -ForegroundColor Yellow
$clientPath = "C:\ansible-mcp\mcp-proxy-client.js"

if (Test-Path $clientPath) {
    Write-Host "✓ Proxy client found at: $clientPath" -ForegroundColor Green
} else {
    Write-Host "✗ Proxy client not found at: $clientPath" -ForegroundColor Red
}
Write-Host ""

# Step 4: Kill and restart Claude Desktop
Write-Host "Step 4: Restarting Claude Desktop..." -ForegroundColor Yellow
Write-Host "Stopping Claude Desktop processes..." -ForegroundColor Cyan

# Kill all Claude processes
Get-Process | Where-Object { $_.Name -like "*claude*" } | ForEach-Object {
    Write-Host "  Stopping process: $($_.Name) (PID: $($_.Id))"
    Stop-Process -Id $_.Id -Force
}

Start-Sleep -Seconds 2

Write-Host "Starting Claude Desktop..." -ForegroundColor Cyan
try {
    # Try common installation paths
    $claudePaths = @(
        "$env:LOCALAPPDATA\Programs\claude-desktop\Claude.exe",
        "$env:PROGRAMFILES\Claude\Claude.exe",
        "$env:PROGRAMFILES(x86)\Claude\Claude.exe"
    )
    
    $claudePath = $claudePaths | Where-Object { Test-Path $_ } | Select-Object -First 1
    
    if ($claudePath) {
        Start-Process $claudePath
        Write-Host "✓ Claude Desktop started from: $claudePath" -ForegroundColor Green
    } else {
        Write-Host "✗ Could not find Claude Desktop executable" -ForegroundColor Red
        Write-Host "  Please start Claude Desktop manually" -ForegroundColor Yellow
    }
} catch {
    Write-Host "✗ Error starting Claude Desktop: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "=== Debug Complete ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Check if 'ansible-mcp-server' appears in Claude Desktop's server list" -ForegroundColor White
Write-Host "2. If not, try using the alternative config at: claude_desktop_config_refresh.json" -ForegroundColor White
Write-Host "3. Run 'node test-mcp-connection.js' to test the connection directly" -ForegroundColor White
Write-Host ""
Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")