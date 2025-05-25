
terraform {
  required_providers {
    proxmox = {
      source = "Telmate/proxmox"
      version = "~> 2.9"
    }
  }
}

provider "proxmox" {
  pm_api_url      = var.proxmox_api_url
  pm_api_token_id = var.proxmox_api_token_id
  pm_api_token_secret = var.proxmox_api_token_secret
  pm_tls_insecure = true
}

variable "proxmox_api_url" {
  description = "Proxmox API URL"
  type        = string
}

variable "proxmox_api_token_id" {
  description = "Proxmox API Token ID"
  type        = string
}

variable "proxmox_api_token_secret" {
  description = "Proxmox API Token Secret"
  type        = string
  sensitive   = true
}

resource "proxmox_vm_qemu" "test-vm" {
  name        = "test-vm"
  target_node = "pve"
  vmid        = 999
  
  clone       = "ubuntu-cloud-init-template"
  full_clone  = true
  
  cores       = 4
  memory      = 8192
  
  disk {
    size    = "100G"
    type    = "scsi"
    storage = "local-lvm"
  }
  
  network {
    model  = "virtio"
    bridge = "vmbr0"
  }
  
  
  ipconfig0 = "ip=192.168.1.99/24,gw=192.168.1.1"
  nameserver = "8.8.8.8"
  
  
  lifecycle {
    ignore_changes = [
      network,
    ]
  }
}

output "test-vm_ip" {
  value = proxmox_vm_qemu.test-vm.default_ipv4_address
}
