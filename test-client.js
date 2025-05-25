#!/usr/bin/env node
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { spawn } from 'child_process';

async function testServer() {
  console.log('Starting Ansible MCP server test...');
  
  const serverProcess = spawn('node', ['src/index.js'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    cwd: process.cwd()
  });

  const transport = new StdioClientTransport({
    command: 'node',
    args: ['src/index.js'],
    process: serverProcess
  });

  const client = new Client({
    name: 'test-client',
    version: '1.0.0'
  }, {
    capabilities: {}
  });

  try {
    await client.connect(transport);
    console.log('Connected to server');

    // List tools
    const toolsResponse = await client.listTools();
    console.log('\nAvailable tools:');
    toolsResponse.tools.forEach(tool => {
      console.log(`- ${tool.name}: ${tool.description}`);
    });

    // Test ansible version command
    console.log('\nTesting ansible-command tool...');
    const result = await client.callTool('ansible-command', {
      command: 'ansible --version'
    });
    
    console.log('\nResult:');
    console.log(result.content[0].text);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
    serverProcess.kill();
  }
}

testServer().catch(console.error);