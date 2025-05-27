#!/usr/bin/env node
// Script to deploy Ollama VM using MCP tools
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';

console.log('Deploying Ollama VM with GPU support using MCP tools...\n');

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
  if (!message.includes('Initialized with') && !message.includes('Loaded service modules')) {
    console.error('MCP Error:', message);
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
    }, 60000); // 60 second timeout for Terraform operations
  });
}

async function main() {
  try {
    // Initialize MCP
    console.log('1. Initializing MCP connection...');
    const initResponse = await sendRequest('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'ollama-deployer', version: '1.0.0' }
    });
    
    if (initResponse.error) {
      throw new Error(`Failed to initialize: ${JSON.stringify(initResponse.error)}`);
    }
    console.log('✓ MCP initialized\n');
    
    // Check if we need to discover GPU devices first
    console.log('2. Checking Proxmox host for GPU devices...');
    const hardwareResponse = await sendRequest('tools/call', {
      name: 'ansible-task',
      arguments: {
        task: 'shell lspci | grep -i "AMD.*Instinct\\|Radeon.*MI50"',
        hosts: 'proxmox',
        inventory: 'inventory/proxmox-hosts.yml'
      }
    });
    
    if (hardwareResponse.result?.content?.[0]?.text) {
      console.log('✓ Found GPU devices:');
      console.log(hardwareResponse.result.content[0].text);
    }
    
    // Setup Terraform variables
    console.log('\n3. Setting up Terraform configuration...');
    const tfvarPath = path.join(process.cwd(), 'terraform/ollama-gpu-vm/terraform.tfvars');
    
    // Check if tfvars exists
    try {
      await fs.access(tfvarPath);
      console.log('✓ terraform.tfvars already exists');
    } catch {
      console.log('! terraform.tfvars not found. Please create it from terraform.tfvars.example');
      console.log('  Required variables:');
      console.log('  - proxmox_api_token_id');
      console.log('  - proxmox_api_token_secret');
      console.log('  - proxmox_api_url');
      process.exit(1);
    }
    
    // Initialize Terraform
    console.log('\n4. Initializing Terraform...');
    const initTfResponse = await sendRequest('tools/call', {
      name: 'ansible-task',
      arguments: {
        task: 'shell cd terraform/ollama-gpu-vm && terraform init',
        hosts: 'localhost'
      }
    });
    
    if (initTfResponse.error) {
      console.error('✗ Terraform init failed:', initTfResponse.error);
    } else {
      console.log('✓ Terraform initialized');
    }
    
    // Plan the deployment
    console.log('\n5. Creating Terraform plan...');
    const planResponse = await sendRequest('tools/call', {
      name: 'terraform-plan',
      arguments: {
        directory: 'terraform/ollama-gpu-vm'
      }
    });
    
    if (planResponse.result?.content?.[0]?.text) {
      const output = planResponse.result.content[0].text;
      if (output.includes('Plan:')) {
        console.log('✓ Terraform plan created successfully');
        console.log(output.match(/Plan: .*/)?.[0] || '');
      } else {
        console.log('Plan output:', output);
      }
    }
    
    // Ask for confirmation
    console.log('\n6. Ready to deploy the Ollama VM with:');
    console.log('   - 16 CPU cores (host passthrough)');
    console.log('   - 32GB RAM');
    console.log('   - 100GB SSD storage');
    console.log('   - 2x AMD MI50 GPUs');
    console.log('   - IP: 192.168.10.200');
    console.log('\nWould you like to proceed? (yes/no): ');
    
    // Wait for user input
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    
    const answer = await new Promise(resolve => {
      process.stdin.once('data', data => {
        resolve(data.toString().trim().toLowerCase());
      });
    });
    
    if (answer !== 'yes' && answer !== 'y') {
      console.log('Deployment cancelled.');
      process.exit(0);
    }
    
    // Apply the configuration
    console.log('\n7. Deploying VM with Terraform...');
    const applyResponse = await sendRequest('tools/call', {
      name: 'terraform-apply',
      arguments: {
        directory: 'terraform/ollama-gpu-vm',
        autoApprove: true
      }
    });
    
    if (applyResponse.result?.content?.[0]?.text) {
      const output = applyResponse.result.content[0].text;
      if (output.includes('Apply complete!')) {
        console.log('✓ VM deployed successfully!');
        
        // Extract IP if available
        const ipMatch = output.match(/ollama_vm_ip = "(.+)"/);
        if (ipMatch) {
          console.log(`\nVM IP Address: ${ipMatch[1]}`);
        }
      } else {
        console.log('Apply output:', output);
      }
    }
    
    // Wait for VM to be ready
    console.log('\n8. Waiting for VM to be ready (this may take a few minutes)...');
    await new Promise(resolve => setTimeout(resolve, 60000)); // Wait 60 seconds
    
    // Run Ansible playbook to configure Ollama
    console.log('\n9. Configuring Ollama on the VM...');
    const playbookResponse = await sendRequest('tools/call', {
      name: 'ansible-playbook',
      arguments: {
        playbook: 'playbooks/ollama-setup/setup-ollama.yml',
        inventory: 'playbooks/ollama-setup/inventory.ini',
        verbose: true
      }
    });
    
    if (playbookResponse.result?.content?.[0]?.text) {
      console.log('✓ Ollama configuration completed');
    }
    
    console.log('\n🎉 Deployment complete!');
    console.log('\nYour Ollama server is ready at:');
    console.log('- API: http://192.168.10.200:11434');
    console.log('- SSH: ssh ollama@192.168.10.200');
    console.log('\nTest with: curl http://192.168.10.200:11434/api/tags');
    
  } catch (error) {
    console.error('\n✗ Deployment failed:', error.message);
  } finally {
    mcp.kill();
    process.exit(0);
  }
}

main();