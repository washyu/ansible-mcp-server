# PowerShell script to force Claude Desktop to refresh MCP server tools
# This script stops Claude, clears cache, updates config, and restarts

Write-Host "=== Claude Desktop Tool Refresh Script ===" -ForegroundColor Cyan
Write-Host ""

# Step 1: Stop Claude Desktop
Write-Host "1. Stopping Claude Desktop..." -ForegroundColor Yellow
Get-Process "Claude" -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2

# Step 2: Clear potential cache locations
Write-Host "2. Clearing potential cache locations..." -ForegroundColor Yellow
$cachePaths = @(
    "$env:APPDATA\Claude\Cache",
    "$env:APPDATA\Claude\GPUCache",
    "$env:LOCALAPPDATA\Claude\Cache",
    "$env:TEMP\Claude*"
)

foreach ($path in $cachePaths) {
    if (Test-Path $path) {
        Write-Host "   Clearing: $path" -ForegroundColor Gray
        Remove-Item -Path $path -Recurse -Force -ErrorAction SilentlyContinue
    }
}

# Step 3: Backup current config
Write-Host "3. Backing up current configuration..." -ForegroundColor Yellow
$configPath = "$env:APPDATA\Claude\claude_desktop_config.json"
$backupPath = "$env:APPDATA\Claude\claude_desktop_config.backup.json"

if (Test-Path $configPath) {
    Copy-Item -Path $configPath -Destination $backupPath -Force
    Write-Host "   Config backed up to: $backupPath" -ForegroundColor Green
}

# Step 4: Copy new config with different server name
Write-Host "4. Installing refreshed configuration..." -ForegroundColor Yellow
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$newConfigPath = Join-Path $scriptDir "claude_desktop_config_refresh.json"

if (Test-Path $newConfigPath) {
    Copy-Item -Path $newConfigPath -Destination $configPath -Force
    Write-Host "   New config installed successfully" -ForegroundColor Green
} else {
    Write-Host "   ERROR: New config file not found at: $newConfigPath" -ForegroundColor Red
    Write-Host "   Please ensure claude_desktop_config_refresh.json exists in the same directory" -ForegroundColor Red
    exit 1
}

# Step 5: Clear any MCP-related temp files
Write-Host "5. Clearing MCP temporary files..." -ForegroundColor Yellow
$mcpTempPaths = @(
    "$env:TEMP\mcp-*",
    "$env:LOCALAPPDATA\Temp\mcp-*"
)

foreach ($path in $mcpTempPaths) {
    Get-ChildItem -Path (Split-Path $path) -Filter (Split-Path -Leaf $path) -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force
}

# Step 6: Wait a moment for cleanup to complete
Write-Host "6. Waiting for cleanup to complete..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

# Step 7: Start Claude Desktop
Write-Host "7. Starting Claude Desktop..." -ForegroundColor Yellow
$claudePath = @(
    "$env:LOCALAPPDATA\Programs\claude\Claude.exe",
    "$env:ProgramFiles\Claude\Claude.exe",
    "${env:ProgramFiles(x86)}\Claude\Claude.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1

if ($claudePath) {
    Start-Process $claudePath
    Write-Host "   Claude Desktop started successfully" -ForegroundColor Green
} else {
    Write-Host "   ERROR: Could not find Claude.exe" -ForegroundColor Red
    Write-Host "   Please start Claude Desktop manually" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== Refresh Complete ===" -ForegroundColor Green
Write-Host ""
Write-Host "IMPORTANT: After Claude Desktop opens:" -ForegroundColor Cyan
Write-Host "1. Wait for it to fully load (10-15 seconds)" -ForegroundColor White
Write-Host "2. Start a new conversation" -ForegroundColor White
Write-Host "3. Type: /tools" -ForegroundColor White
Write-Host "4. Look for 'list-hosts' in the tool list" -ForegroundColor White
Write-Host ""
Write-Host "If tools still don't appear:" -ForegroundColor Yellow
Write-Host "- Check the SSE server is running (http://10.0.30.50:3001/api/mcp/available)" -ForegroundColor Gray
Write-Host "- Run the test script: node test-sse-server.js" -ForegroundColor Gray
Write-Host "- Check Claude's developer console for errors (Ctrl+Shift+I)" -ForegroundColor Gray
Write-Host ""
Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")