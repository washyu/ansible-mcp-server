@echo off
REM MCP Proxy Launcher for Windows
REM Usage: mcp-proxy.bat [server]
REM   server can be: production, dev, local
REM   Defaults to production if not specified

set API_ACCESS_TOKEN=75bf9cbcf951ed970c96431f77985d7588d1229d5b3f29e0555a177f628f55d5

REM Show help if requested
if "%1"=="--help" goto :help
if "%1"=="-h" goto :help
if "%1"=="/?" goto :help

REM Set default server if not provided via environment or argument
if not defined MCP_SERVER (
    if "%1"=="" (
        set MCP_SERVER=production
    ) else (
        set MCP_SERVER=%1
    )
)

echo Starting MCP Proxy for server: %MCP_SERVER%
node "%~dp0mcp-proxy-client.js" %MCP_SERVER%
goto :end

:help
echo Usage: %0 [server]
echo.
echo Available servers:
echo   production  - Production MCP Server (192.168.10.100:3001)
echo   dev         - Development MCP Server (192.168.10.102:3001)
echo   local       - Local MCP Server (localhost:3001)
echo.
echo Environment variables:
echo   MCP_SERVER         - Server name (overrides command line)
echo   API_ACCESS_TOKEN   - API token for authentication
echo.
echo Examples:
echo   %0 dev                    # Connect to dev server
echo   set MCP_SERVER=production ^& %0  # Connect to production server

:end