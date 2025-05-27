#!/usr/bin/env node
// Use the dev MCP server to create Ollama VM

const http = require('http');

const MCP_HOST = '192.168.10.102';
const MCP_PORT = 3001;

// Create the Ansible playbook content
const playbookContent = `---
- name: Create Ollama GPU VM via MCP
  hosts: localhost
  vars:
    proxmox_api_host: "192.168.10.200"
    proxmox_api_user: "root@pam"
    proxmox_api_password: "Tenchi01!"
    
  tasks:
    - name: Create VM from template
      community.general.proxmox_kvm:
        api_host: "{{ proxmox_api_host }}"
        api_user: "{{ proxmox_api_user }}"
        api_password: "{{ proxmox_api_password }}"
        validate_certs: no
        
        vmid: 202
        name: ollama-gpu-server
        node: proxmox
        
        clone: ubuntu-cloud-template
        full: yes
        
        cores: 12
        memory: 32768
        cpu: host
        
        virtio:
          virtio0: "local-lvm:100"
          
        net:
          net0: "virtio,bridge=vmbr0"
          
        ipconfig:
          ipconfig0: "ip=192.168.10.200/24,gw=192.168.10.1"
        nameservers: "8.8.8.8"
        
        state: present
      register: vm_result
      
    - name: Start the VM
      community.general.proxmox_kvm:
        api_host: "{{ proxmox_api_host }}"
        api_user: "{{ proxmox_api_user }}"
        api_password: "{{ proxmox_api_password }}"
        validate_certs: no
        vmid: 202
        state: started
      
    - name: Display result
      debug:
        msg: "VM 202 (ollama-gpu-server) created at 192.168.10.200"
`;

// First, create the playbook on the MCP server
console.log('Creating Ollama VM using dev MCP server at', MCP_HOST);

// We'll use the create-playbook-flexible tool to create the playbook
const createPlaybookRequest = {
  tool: 'create-playbook-flexible',
  args: {
    name: 'create-ollama-vm-temp.yml',
    content: playbookContent,
    directory: 'playbooks'
  }
};

// Then run it
const runPlaybookRequest = {
  tool: 'ansible-playbook',
  args: {
    playbook: 'playbooks/create-ollama-vm-temp.yml',
    verbose: true
  }
};

function makeRequest(data) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(data);
    
    const options = {
      hostname: MCP_HOST,
      port: MCP_PORT,
      path: '/execute',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    
    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve({ error: 'Failed to parse response', raw: data });
        }
      });
    });
    
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function main() {
  try {
    // Step 1: Create the playbook
    console.log('\n1. Creating playbook on MCP server...');
    const createResult = await makeRequest(createPlaybookRequest);
    if (createResult.error) {
      console.error('Failed to create playbook:', createResult);
      return;
    }
    console.log('✓ Playbook created');
    
    // Step 2: Run the playbook
    console.log('\n2. Running playbook to create VM...');
    const runResult = await makeRequest(runPlaybookRequest);
    
    if (runResult.output) {
      console.log('\nOutput:');
      console.log(runResult.output);
    }
    
    if (runResult.error) {
      console.error('\nError:', runResult.error);
    }
    
    if (runResult.success) {
      console.log('\n✅ VM created successfully!');
      console.log('   VM ID: 202');
      console.log('   Name: ollama-gpu-server');
      console.log('   IP: 192.168.10.200');
      console.log('\nNext steps:');
      console.log('1. Add GPU passthrough in Proxmox UI');
      console.log('2. Run Ansible playbook to install Ollama');
    }
    
  } catch (error) {
    console.error('Request failed:', error.message);
  }
}

main();