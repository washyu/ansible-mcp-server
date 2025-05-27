#!/usr/bin/env node
import { spawn } from 'child_process';

console.log('Deploying Ollama VM using MCP tools...\n');

const mcp = spawn('node', ['src/index.js'], {
  cwd: process.cwd(),
  stdio: ['pipe', 'pipe', 'pipe']
});

let responseBuffer = '';
let requestId = 0;
const pendingRequests = new Map();

mcp.stdout.on('data', (data) => {
  responseBuffer += data.toString();
  const lines = responseBuffer.split('\n');
  responseBuffer = lines.pop() || '';
  
  for (const line of lines) {
    if (line.trim()) {
      try {
        const response = JSON.parse(line);
        if (response.id !== undefined && pendingRequests.has(response.id)) {
          const { resolve } = pendingRequests.get(response.id);
          pendingRequests.delete(response.id);
          resolve(response);
        }
      } catch (e) {
        // Ignore non-JSON output
      }
    }
  }
});

mcp.stderr.on('data', (data) => {
  const message = data.toString();
  if (!message.includes('Initialized with') && !message.includes('Loaded')) {
    console.error('MCP:', message);
  }
});

function sendRequest(method, params = {}) {
  const id = requestId++;
  const request = { jsonrpc: '2.0', method, params, id };
  
  console.log(`→ ${method}`);
  mcp.stdin.write(JSON.stringify(request) + '\n');
  
  return new Promise((resolve) => {
    pendingRequests.set(id, { resolve });
    setTimeout(() => {
      if (pendingRequests.has(id)) {
        pendingRequests.delete(id);
        resolve({ error: { message: 'Timeout waiting for response' } });
      }
    }, 30000);
  });
}

async function main() {
  try {
    // Initialize MCP
    console.log('1. Initializing MCP...');
    const initResponse = await sendRequest('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'ollama-deployer', version: '1.0.0' }
    });
    
    if (initResponse.error) {
      throw new Error(`Failed to initialize: ${JSON.stringify(initResponse.error)}`);
    }
    console.log('✓ MCP initialized\n');
    
    // Check existing VMs
    console.log('2. Checking existing VMs...');
    const listResponse = await sendRequest('tools/call', {
      name: 'ansible-task',
      arguments: {
        task: 'shell pvesh get /nodes/proxmox/qemu --output-format json | jq -r ".[] | select(.name | contains(\\"ollama\\")) | \\"\\\\(.vmid): \\\\(.name) (\\\\(.status))\\"" || echo "No Ollama VMs found"',
        hosts: 'proxmox',
        inventory: 'inventory/proxmox-hosts.yml'
      }
    });
    
    if (listResponse.result?.content?.[0]?.text) {
      const output = JSON.parse(listResponse.result.content[0].text);
      console.log('Existing Ollama VMs:', output.output || 'None found');
    }
    
    // Check template availability
    console.log('\n3. Checking template 9000...');
    const templateResponse = await sendRequest('tools/call', {
      name: 'ansible-task',
      arguments: {
        task: 'shell pvesh get /nodes/proxmox/qemu/9000/status/current --output-format json || echo "Template not found"',
        hosts: 'proxmox',
        inventory: 'inventory/proxmox-hosts.yml'
      }
    });
    
    if (templateResponse.result?.content?.[0]?.text) {
      const output = JSON.parse(templateResponse.result.content[0].text);
      console.log('Template 9000:', output.output.includes('not found') ? 'Not available' : 'Available');
    }
    
    // Create VM from template
    console.log('\n4. Creating Ollama VM from template...');
    const createResponse = await sendRequest('tools/call', {
      name: 'ansible-playbook',
      arguments: {
        playbook: 'playbooks/create-ollama-vm.yml',
        inventory: 'inventory/proxmox-hosts.yml',
        verbose: true
      }
    });
    
    if (createResponse.result?.content?.[0]?.text) {
      const output = JSON.parse(createResponse.result.content[0].text);
      console.log('VM Creation result:', output.output);
    }
    
    console.log('\n✅ Deployment process completed!');
    
  } catch (error) {
    console.error('\n❌ Deployment failed:', error.message);
  } finally {
    mcp.kill();
    process.exit(0);
  }
}

main();