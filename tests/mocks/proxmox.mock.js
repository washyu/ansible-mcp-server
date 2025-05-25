// Mock Proxmox API responses
export const proxmoxMock = {
  // Mock VM list
  getVMs: () => ({
    data: [
      {
        vmid: 100,
        name: 'test-vm-1',
        status: 'running',
        cpu: 2,
        mem: 2048,
        disk: 20480,
        node: 'proxmox-node1'
      },
      {
        vmid: 101,
        name: 'test-vm-2',
        status: 'stopped',
        cpu: 4,
        mem: 4096,
        disk: 40960,
        node: 'proxmox-node1'
      }
    ]
  }),

  // Mock node status
  getNodeStatus: () => ({
    data: {
      node: 'proxmox-node1',
      status: 'online',
      cpu: 0.15,
      memory: {
        used: 8589934592,
        total: 17179869184
      },
      uptime: 864000
    }
  }),

  // Mock storage info
  getStorage: () => ({
    data: [
      {
        storage: 'local',
        type: 'dir',
        total: 107374182400,
        used: 53687091200,
        avail: 53687091200,
        active: 1
      },
      {
        storage: 'local-lvm',
        type: 'lvmthin',
        total: 214748364800,
        used: 107374182400,
        avail: 107374182400,
        active: 1
      }
    ]
  }),

  // Mock create VM response
  createVM: (vmid, config) => ({
    data: {
      success: true,
      vmid: vmid,
      task: `UPID:proxmox-node1:0000${vmid}:00000000:00000000:qmcreate:${vmid}:root@pam:`
    }
  }),

  // Mock task status
  getTaskStatus: (taskId) => ({
    data: {
      status: 'OK',
      exitstatus: 'OK',
      type: 'qmcreate',
      upid: taskId
    }
  })
};

// Mock axios-like client
export const createProxmoxClient = () => {
  return {
    get: jest.fn((url) => {
      if (url.includes('/cluster/resources')) {
        return Promise.resolve(proxmoxMock.getVMs());
      }
      if (url.includes('/nodes/') && url.includes('/status')) {
        return Promise.resolve(proxmoxMock.getNodeStatus());
      }
      if (url.includes('/storage')) {
        return Promise.resolve(proxmoxMock.getStorage());
      }
      return Promise.reject(new Error('Not found'));
    }),
    
    post: jest.fn((url, data) => {
      if (url.includes('/qemu')) {
        return Promise.resolve(proxmoxMock.createVM(data.vmid, data));
      }
      return Promise.reject(new Error('Not found'));
    }),
    
    delete: jest.fn(() => Promise.resolve({ data: { success: true } }))
  };
};