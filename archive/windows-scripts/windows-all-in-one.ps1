# Windows All-in-One Setup Script for MCP Proxy Client
# This file contains everything needed - just save and run on Windows

Write-Host "MCP Proxy Client Setup for Windows" -ForegroundColor Green
Write-Host "=================================" -ForegroundColor Green

# Check if Node.js is installed
try {
    $nodeVersion = node --version
    Write-Host "Node.js $nodeVersion found" -ForegroundColor Yellow
} catch {
    Write-Host "Node.js not found. Please install Node.js from https://nodejs.org/" -ForegroundColor Red
    exit 1
}

# Get MCP server details
$mcpServerIP = Read-Host "Enter MCP server IP address (e.g., 192.168.10.100)"
$mcpServerPort = Read-Host "Enter SSE server port (default: 3001)"
$apiToken = Read-Host "Enter API access token" -AsSecureString

if ([string]::IsNullOrEmpty($mcpServerPort)) {
    $mcpServerPort = "3001"
}

# Convert secure string to plain text
$BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($apiToken)
$apiTokenPlain = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)

# Create directory for MCP proxy
$mcpDir = "$env:USERPROFILE\.mcp-proxy"
New-Item -ItemType Directory -Force -Path $mcpDir | Out-Null

Write-Host "`nCreating MCP proxy client..." -ForegroundColor Yellow

# Create the proxy client file
$proxyClientCode = @'
#!/usr/bin/env node
// MCP Proxy Client - Bridges stdio (for Claude Desktop) to SSE (remote server)

import { createInterface } from 'readline';
import EventSource from 'eventsource';
import http from 'http';
import https from 'https';

const SSE_URL = process.env.MCP_SSE_URL || 'http://192.168.10.100:3001/sse';
const API_TOKEN = process.env.API_ACCESS_TOKEN || 'your-secure-token';

let sessionId = null;
let eventSource = null;

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

// Connect to SSE server
function connect() {
  console.error('Connecting to SSE server:', SSE_URL);
  
  eventSource = new EventSource(SSE_URL, {
    headers: {
      'Authorization': `Bearer ${API_TOKEN}`
    }
  });

  eventSource.onopen = () => {
    console.error('SSE connection established');
  };

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      
      switch (data.type) {
        case 'session':
          sessionId = data.sessionId;
          console.error('Session ID:', sessionId);
          break;
          
        case 'message':
          // Forward MCP message to stdout for Claude Desktop
          process.stdout.write(JSON.stringify(data.data) + '\n');
          break;
          
        case 'error':
          console.error('MCP server error:', data.error);
          break;
          
        case 'close':
          console.error('MCP server closed with code:', data.code);
          process.exit(data.code || 0);
          break;
      }
    } catch (e) {
      console.error('Failed to parse SSE message:', e);
    }
  };

  eventSource.onerror = (error) => {
    console.error('SSE connection error:', error);
    if (eventSource.readyState === EventSource.CLOSED) {
      console.error('Connection closed, exiting...');
      process.exit(1);
    }
  };
}

// Send input to MCP server via HTTP POST
async function sendInput(data) {
  if (!sessionId) {
    console.error('No session ID, waiting for connection...');
    return;
  }

  const url = new URL(`/sessions/${sessionId}/input`, SSE_URL);
  const protocol = url.protocol === 'https:' ? https : http;

  return new Promise((resolve, reject) => {
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_TOKEN}`,
        'Content-Length': Buffer.byteLength(data)
      }
    };

    const req = protocol.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve();
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${body}`));
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// Handle stdin from Claude Desktop
rl.on('line', async (line) => {
  try {
    // Wait for session to be established
    let retries = 0;
    while (!sessionId && retries < 50) {
      await new Promise(resolve => setTimeout(resolve, 100));
      retries++;
    }

    if (!sessionId) {
      throw new Error('Failed to establish session');
    }

    await sendInput(line);
  } catch (error) {
    console.error('Failed to send input:', error);
    const errorResponse = {
      jsonrpc: '2.0',
      error: {
        code: -32603,
        message: error.message
      },
      id: null
    };
    process.stdout.write(JSON.stringify(errorResponse) + '\n');
  }
});

// Start connection
connect();

// Cleanup on exit
process.on('SIGINT', () => {
  console.error('Shutting down proxy client...');
  if (eventSource) {
    eventSource.close();
  }
  process.exit(0);
});
'@

$proxyClientCode | Set-Content -Path "$mcpDir\mcp-proxy-client.js" -Encoding UTF8
Write-Host "Proxy client created" -ForegroundColor Green

# Create package.json
$packageJson = @{
    name = "mcp-proxy-client"
    version = "1.0.0"
    type = "module"
    dependencies = @{
        eventsource = "^2.0.2"
    }
} | ConvertTo-Json -Depth 10

$packageJson | Set-Content -Path "$mcpDir\package.json" -Encoding UTF8

# Install dependencies
Write-Host "`nInstalling dependencies..." -ForegroundColor Yellow
Push-Location $mcpDir
npm install
Pop-Location

# Create batch wrapper
$batchWrapper = @"
@echo off
set MCP_SSE_URL=http://${mcpServerIP}:${mcpServerPort}/sse
set API_ACCESS_TOKEN=$apiTokenPlain
node "%~dp0mcp-proxy-client.js" %*
"@

$batchWrapper | Set-Content -Path "$mcpDir\mcp-proxy.bat" -Encoding ASCII

# Create Claude Desktop configuration
$claudeConfigDir = "$env:APPDATA\Claude"
New-Item -ItemType Directory -Force -Path $claudeConfigDir | Out-Null

$claudeConfig = @{
    mcpServers = @{
        "ansible-mcp" = @{
            command = "cmd"
            args = @("/c", "$mcpDir\mcp-proxy.bat")
        }
    }
} | ConvertTo-Json -Depth 10

# Check if config already exists
if (Test-Path "$claudeConfigDir\claude_desktop_config.json") {
    Write-Host "`nExisting Claude Desktop config found!" -ForegroundColor Yellow
    Write-Host "Current config will be backed up to: claude_desktop_config.backup.json" -ForegroundColor Yellow
    Copy-Item "$claudeConfigDir\claude_desktop_config.json" "$claudeConfigDir\claude_desktop_config.backup.json"
}

$claudeConfig | Set-Content -Path "$claudeConfigDir\claude_desktop_config.json" -Encoding UTF8

Write-Host "`n=================================" -ForegroundColor Green
Write-Host "Setup complete!" -ForegroundColor Green
Write-Host "=================================" -ForegroundColor Green
Write-Host ""
Write-Host "Configuration saved to:" -ForegroundColor Yellow
Write-Host "  Config: $claudeConfigDir\claude_desktop_config.json" -ForegroundColor White
Write-Host "  Proxy: $mcpDir\mcp-proxy.bat" -ForegroundColor White
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Restart Claude Desktop" -ForegroundColor White
Write-Host "2. Look for 'ansible-mcp' in the MCP servers list" -ForegroundColor White
Write-Host ""
Write-Host "To test the connection manually:" -ForegroundColor Yellow
Write-Host "  $mcpDir\mcp-proxy.bat" -ForegroundColor White
Write-Host ""
Write-Host "If you encounter issues, check:" -ForegroundColor Yellow
Write-Host "  - MCP server is running: curl http://${mcpServerIP}:${mcpServerPort}/health" -ForegroundColor White
Write-Host "  - Firewall allows port $mcpServerPort" -ForegroundColor White
Write-Host "  - API token matches server configuration" -ForegroundColor White