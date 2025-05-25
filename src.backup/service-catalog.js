// Service Catalog for MCP Server
// Curated list of services that can be deployed

export const serviceCategories = {
  'cloud-storage': {
    name: 'Cloud Storage',
    description: 'Self-hosted cloud storage solutions',
    icon: '☁️'
  },
  'dev-tools': {
    name: 'Development Tools',
    description: 'CI/CD, version control, and development platforms',
    icon: '🛠️'
  },
  'monitoring': {
    name: 'Monitoring & Observability',
    description: 'System monitoring, logging, and alerting',
    icon: '📊'
  },
  'communication': {
    name: 'Communication',
    description: 'Chat, email, and collaboration tools',
    icon: '💬'
  },
  'media': {
    name: 'Media & Entertainment',
    description: 'Media servers, streaming, and content management',
    icon: '🎬'
  },
  'network': {
    name: 'Network Services',
    description: 'DNS, VPN, proxy, and network management',
    icon: '🌐'
  },
  'security': {
    name: 'Security & Auth',
    description: 'Authentication, secrets management, and security tools',
    icon: '🔒'
  },
  'databases': {
    name: 'Databases',
    description: 'Database servers and management tools',
    icon: '🗄️'
  },
  'automation': {
    name: 'Automation',
    description: 'Home automation and workflow tools',
    icon: '🤖'
  }
};

export const serviceCatalog = {
  // Cloud Storage
  'nextcloud': {
    name: 'Nextcloud',
    category: 'cloud-storage',
    description: 'Self-hosted file sync and share with office suite',
    website: 'https://nextcloud.com',
    github: 'https://github.com/nextcloud/server',
    dockerImage: 'nextcloud:latest',
    alternatives: ['owncloud', 'seafile', 'syncthing'],
    requirements: {
      minCores: 2,
      minMemory: 2048,
      minDisk: '50G',
      ports: [80, 443]
    },
    features: [
      'File sync and share',
      'Calendar and contacts',
      'Office suite integration',
      'Video calls',
      'Extensive app ecosystem'
    ]
  },
  
  'owncloud': {
    name: 'ownCloud',
    category: 'cloud-storage',
    description: 'Original self-hosted cloud storage solution',
    website: 'https://owncloud.com',
    github: 'https://github.com/owncloud/core',
    dockerImage: 'owncloud/server:latest',
    alternatives: ['nextcloud', 'seafile'],
    requirements: {
      minCores: 2,
      minMemory: 1024,
      minDisk: '30G',
      ports: [80, 443]
    },
    features: [
      'File sync and share',
      'WebDAV support',
      'External storage support',
      'File versioning'
    ]
  },
  
  'seafile': {
    name: 'Seafile',
    category: 'cloud-storage',
    description: 'High performance file syncing and sharing',
    website: 'https://www.seafile.com',
    github: 'https://github.com/haiwen/seafile',
    dockerImage: 'seafileltd/seafile:latest',
    alternatives: ['nextcloud', 'syncthing'],
    requirements: {
      minCores: 2,
      minMemory: 2048,
      minDisk: '40G',
      ports: [80, 443]
    },
    features: [
      'High performance',
      'File encryption',
      'Version control',
      'Team collaboration'
    ]
  },
  
  'syncthing': {
    name: 'Syncthing',
    category: 'cloud-storage',
    description: 'Continuous file synchronization',
    website: 'https://syncthing.net',
    github: 'https://github.com/syncthing/syncthing',
    dockerImage: 'syncthing/syncthing:latest',
    alternatives: ['nextcloud', 'resilio'],
    requirements: {
      minCores: 1,
      minMemory: 512,
      minDisk: '10G',
      ports: [8384, 22000]
    },
    features: [
      'P2P synchronization',
      'No central server',
      'End-to-end encryption',
      'Cross-platform'
    ]
  },
  
  // Development Tools
  'gitlab': {
    name: 'GitLab',
    category: 'dev-tools',
    description: 'Complete DevOps platform with Git hosting',
    website: 'https://gitlab.com',
    github: 'https://github.com/gitlabhq/gitlabhq',
    dockerImage: 'gitlab/gitlab-ce:latest',
    alternatives: ['gitea', 'gogs', 'jenkins'],
    requirements: {
      minCores: 4,
      minMemory: 4096,
      minDisk: '50G',
      ports: [80, 443, 22]
    },
    features: [
      'Git repository hosting',
      'CI/CD pipelines',
      'Issue tracking',
      'Container registry',
      'Wiki and documentation'
    ]
  },
  
  'jenkins': {
    name: 'Jenkins',
    category: 'dev-tools',
    description: 'Leading open source automation server',
    website: 'https://jenkins.io',
    github: 'https://github.com/jenkinsci/jenkins',
    dockerImage: 'jenkins/jenkins:lts',
    alternatives: ['gitlab', 'drone', 'woodpecker'],
    requirements: {
      minCores: 2,
      minMemory: 2048,
      minDisk: '20G',
      ports: [8080, 50000]
    },
    features: [
      'Continuous integration',
      'Continuous deployment',
      'Extensive plugin ecosystem',
      'Pipeline as code',
      'Distributed builds'
    ]
  },
  
  'gitea': {
    name: 'Gitea',
    category: 'dev-tools',
    description: 'Lightweight Git hosting solution',
    website: 'https://gitea.io',
    github: 'https://github.com/go-gitea/gitea',
    dockerImage: 'gitea/gitea:latest',
    alternatives: ['gogs', 'gitlab', 'forgejo'],
    requirements: {
      minCores: 1,
      minMemory: 512,
      minDisk: '10G',
      ports: [3000, 22]
    },
    features: [
      'Git hosting',
      'Issue tracking',
      'Pull requests',
      'Wiki',
      'Lightweight and fast'
    ]
  },
  
  'drone': {
    name: 'Drone',
    category: 'dev-tools',
    description: 'Container-native continuous delivery',
    website: 'https://drone.io',
    github: 'https://github.com/harness/drone',
    dockerImage: 'drone/drone:latest',
    alternatives: ['jenkins', 'woodpecker', 'gitlab'],
    requirements: {
      minCores: 2,
      minMemory: 1024,
      minDisk: '20G',
      ports: [80, 443]
    },
    features: [
      'Container-native CI/CD',
      'YAML pipeline configuration',
      'Multiple VCS support',
      'Scalable architecture'
    ]
  },
  
  // Monitoring
  'prometheus': {
    name: 'Prometheus',
    category: 'monitoring',
    description: 'Time series database and monitoring system',
    website: 'https://prometheus.io',
    github: 'https://github.com/prometheus/prometheus',
    dockerImage: 'prom/prometheus:latest',
    alternatives: ['influxdb', 'victoria-metrics'],
    requirements: {
      minCores: 2,
      minMemory: 2048,
      minDisk: '50G',
      ports: [9090]
    },
    features: [
      'Time series database',
      'Pull-based metrics',
      'AlertManager integration',
      'Service discovery',
      'PromQL query language'
    ]
  },
  
  'grafana': {
    name: 'Grafana',
    category: 'monitoring',
    description: 'Analytics and monitoring dashboards',
    website: 'https://grafana.com',
    github: 'https://github.com/grafana/grafana',
    dockerImage: 'grafana/grafana:latest',
    alternatives: ['kibana', 'chronograf'],
    requirements: {
      minCores: 1,
      minMemory: 512,
      minDisk: '10G',
      ports: [3000]
    },
    features: [
      'Beautiful dashboards',
      'Multiple data sources',
      'Alerting',
      'Annotations',
      'Plugin ecosystem'
    ]
  },
  
  // Communication
  'matrix-synapse': {
    name: 'Matrix Synapse',
    category: 'communication',
    description: 'Decentralized communication server',
    website: 'https://matrix.org',
    github: 'https://github.com/matrix-org/synapse',
    dockerImage: 'matrixdotorg/synapse:latest',
    alternatives: ['rocketchat', 'mattermost'],
    requirements: {
      minCores: 2,
      minMemory: 2048,
      minDisk: '20G',
      ports: [8008, 8448]
    },
    features: [
      'Decentralized chat',
      'End-to-end encryption',
      'Federation support',
      'Voice/video calls',
      'Bridges to other platforms'
    ]
  },
  
  'mailserver': {
    name: 'Docker Mailserver',
    category: 'communication',
    description: 'Full-featured mail server',
    website: 'https://docker-mailserver.github.io',
    github: 'https://github.com/docker-mailserver/docker-mailserver',
    dockerImage: 'mailserver/docker-mailserver:latest',
    alternatives: ['mailu', 'iredmail', 'modoboa'],
    requirements: {
      minCores: 2,
      minMemory: 2048,
      minDisk: '50G',
      ports: [25, 587, 993, 995]
    },
    features: [
      'SMTP/IMAP/POP3',
      'Anti-spam/Anti-virus',
      'DKIM signing',
      'SPF/DMARC',
      'Webmail support'
    ]
  },
  
  // Media
  'jellyfin': {
    name: 'Jellyfin',
    category: 'media',
    description: 'Free media server',
    website: 'https://jellyfin.org',
    github: 'https://github.com/jellyfin/jellyfin',
    dockerImage: 'jellyfin/jellyfin:latest',
    alternatives: ['plex', 'emby', 'kodi'],
    requirements: {
      minCores: 2,
      minMemory: 2048,
      minDisk: '20G',
      ports: [8096]
    },
    features: [
      'Stream media anywhere',
      'No licensing fees',
      'Hardware transcoding',
      'Live TV and DVR',
      'Plugin support'
    ]
  },
  
  'plex': {
    name: 'Plex',
    category: 'media',
    description: 'Media server with premium features',
    website: 'https://plex.tv',
    github: null,
    dockerImage: 'plexinc/pms-docker:latest',
    alternatives: ['jellyfin', 'emby'],
    requirements: {
      minCores: 2,
      minMemory: 2048,
      minDisk: '20G',
      ports: [32400]
    },
    features: [
      'Polished interface',
      'Mobile sync',
      'Premium features',
      'Hardware transcoding',
      'Plex Pass benefits'
    ]
  },
  
  // Network Services
  'pihole': {
    name: 'Pi-hole',
    category: 'network',
    description: 'Network-wide ad blocker',
    website: 'https://pi-hole.net',
    github: 'https://github.com/pi-hole/pi-hole',
    dockerImage: 'pihole/pihole:latest',
    alternatives: ['adguard-home', 'blocky'],
    requirements: {
      minCores: 1,
      minMemory: 512,
      minDisk: '5G',
      ports: [53, 80, 443]
    },
    features: [
      'DNS-based ad blocking',
      'Web interface',
      'Statistics dashboard',
      'Custom blocklists',
      'DHCP server'
    ]
  },
  
  'nginx-proxy-manager': {
    name: 'Nginx Proxy Manager',
    category: 'network',
    description: 'Easy reverse proxy with Let\'s Encrypt',
    website: 'https://nginxproxymanager.com',
    github: 'https://github.com/NginxProxyManager/nginx-proxy-manager',
    dockerImage: 'jc21/nginx-proxy-manager:latest',
    alternatives: ['traefik', 'caddy', 'haproxy'],
    requirements: {
      minCores: 1,
      minMemory: 512,
      minDisk: '5G',
      ports: [80, 443, 81]
    },
    features: [
      'Easy web UI',
      'Let\'s Encrypt SSL',
      'Access lists',
      'Custom certificates',
      'Stream support'
    ]
  },
  
  'wireguard': {
    name: 'WireGuard',
    category: 'network',
    description: 'Fast, modern VPN',
    website: 'https://wireguard.com',
    github: 'https://github.com/WireGuard',
    dockerImage: 'linuxserver/wireguard:latest',
    alternatives: ['openvpn', 'tailscale'],
    requirements: {
      minCores: 1,
      minMemory: 256,
      minDisk: '1G',
      ports: [51820]
    },
    features: [
      'High performance',
      'Simple configuration',
      'Modern cryptography',
      'Cross-platform',
      'Low overhead'
    ]
  },
  
  // Security
  'keycloak': {
    name: 'Keycloak',
    category: 'security',
    description: 'Identity and access management',
    website: 'https://www.keycloak.org',
    github: 'https://github.com/keycloak/keycloak',
    dockerImage: 'quay.io/keycloak/keycloak:latest',
    alternatives: ['authentik', 'authelia'],
    requirements: {
      minCores: 2,
      minMemory: 2048,
      minDisk: '10G',
      ports: [8080]
    },
    features: [
      'Single Sign-On (SSO)',
      'Identity brokering',
      'User federation',
      'Social login',
      'Multi-factor auth'
    ]
  },
  
  'vaultwarden': {
    name: 'Vaultwarden',
    category: 'security',
    description: 'Bitwarden compatible password manager',
    website: 'https://github.com/dani-garcia/vaultwarden',
    github: 'https://github.com/dani-garcia/vaultwarden',
    dockerImage: 'vaultwarden/server:latest',
    alternatives: ['bitwarden', 'passbolt'],
    requirements: {
      minCores: 1,
      minMemory: 256,
      minDisk: '5G',
      ports: [80]
    },
    features: [
      'Bitwarden compatible',
      'Low resource usage',
      'Organizations support',
      '2FA support',
      'File attachments'
    ]
  },
  
  // Databases
  'postgresql': {
    name: 'PostgreSQL',
    category: 'databases',
    description: 'Advanced open source database',
    website: 'https://postgresql.org',
    github: 'https://github.com/postgres/postgres',
    dockerImage: 'postgres:latest',
    alternatives: ['mysql', 'mariadb'],
    requirements: {
      minCores: 2,
      minMemory: 1024,
      minDisk: '20G',
      ports: [5432]
    },
    features: [
      'ACID compliance',
      'Complex queries',
      'JSON support',
      'Extensions',
      'Replication'
    ]
  },
  
  'redis': {
    name: 'Redis',
    category: 'databases',
    description: 'In-memory data structure store',
    website: 'https://redis.io',
    github: 'https://github.com/redis/redis',
    dockerImage: 'redis:latest',
    alternatives: ['memcached', 'keydb'],
    requirements: {
      minCores: 1,
      minMemory: 512,
      minDisk: '5G',
      ports: [6379]
    },
    features: [
      'In-memory storage',
      'Pub/sub messaging',
      'Lua scripting',
      'Persistence options',
      'Clustering'
    ]
  },
  
  // Automation
  'home-assistant': {
    name: 'Home Assistant',
    category: 'automation',
    description: 'Open source home automation',
    website: 'https://home-assistant.io',
    github: 'https://github.com/home-assistant/core',
    dockerImage: 'homeassistant/home-assistant:latest',
    alternatives: ['openhab', 'domoticz'],
    requirements: {
      minCores: 2,
      minMemory: 2048,
      minDisk: '20G',
      ports: [8123]
    },
    features: [
      'Device automation',
      'Energy management',
      'Voice assistants',
      'Mobile apps',
      'Thousands of integrations'
    ]
  },
  
  'n8n': {
    name: 'n8n',
    category: 'automation',
    description: 'Workflow automation tool',
    website: 'https://n8n.io',
    github: 'https://github.com/n8n-io/n8n',
    dockerImage: 'n8nio/n8n:latest',
    alternatives: ['node-red', 'huginn'],
    requirements: {
      minCores: 1,
      minMemory: 1024,
      minDisk: '10G',
      ports: [5678]
    },
    features: [
      'Visual workflow builder',
      'API integrations',
      'Custom functions',
      'Self-hostable',
      'Fair-code license'
    ]
  }
};