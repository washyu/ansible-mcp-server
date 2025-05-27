#!/bin/bash
# Script to discover AMD MI50 GPU PCI IDs on Proxmox host

echo "Discovering AMD MI50 GPU PCI IDs..."
echo "=================================="

# Check for AMD GPUs
echo -e "\nSearching for AMD GPUs:"
lspci | grep -E "AMD|ATI" | grep -E "Instinct|MI50|Radeon Pro"

echo -e "\nDetailed GPU information:"
for gpu in $(lspci | grep -E "AMD|ATI" | grep -E "Instinct|MI50|Radeon Pro" | cut -d' ' -f1); do
    echo -e "\nDevice $gpu:"
    lspci -vvs $gpu | grep -E "Device:|Subsystem:|Region|VGA compatible"
done

echo -e "\nIOMMU Groups (for passthrough):"
find /sys/kernel/iommu_groups/ -type l | sort -V | while read group; do
    devices=$(ls -1 "$group"/devices/)
    if [ -n "$devices" ]; then
        for device in $devices; do
            if lspci -s "${device##*/}" | grep -qE "AMD|ATI"; then
                echo "IOMMU Group $(basename $(dirname $group)):"
                for dev in $(ls -1 "$group"/devices/); do
                    echo "  $(lspci -nns ${dev##*/})"
                done
                echo
            fi
        done
    fi
done

echo -e "\nRecommended PCI IDs for Proxmox configuration:"
echo "=============================================="
lspci -nn | grep -E "AMD|ATI" | grep -E "Instinct|MI50|Radeon Pro" | while read line; do
    pci_id=$(echo $line | cut -d' ' -f1)
    echo "hostpci line: $pci_id,pcie=1,x-vga=1"
done