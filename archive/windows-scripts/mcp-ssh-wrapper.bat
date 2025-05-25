@echo off
ssh -i C:\Users\washy\.ssh\mcp_key -o StrictHostKeyChecking=no -o ServerAliveInterval=60 -o ServerAliveCountMax=10 mcp@192.168.10.100 /home/mcp/mcp-wrapper.sh