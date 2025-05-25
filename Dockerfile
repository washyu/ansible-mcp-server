# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Runtime stage
FROM ubuntu:22.04

# Avoid prompts from apt
ENV DEBIAN_FRONTEND=noninteractive

# Install system dependencies
RUN apt-get update && apt-get install -y \
    # Basic tools
    curl \
    wget \
    git \
    gnupg \
    software-properties-common \
    # Python and pip for Ansible
    python3 \
    python3-pip \
    python3-venv \
    # SSH client
    openssh-client \
    # Required for Node.js
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js 20
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Install Ansible
RUN pip3 install --no-cache-dir ansible

# Install Terraform
RUN wget -O- https://apt.releases.hashicorp.com/gpg | gpg --dearmor -o /usr/share/keyrings/hashicorp-archive-keyring.gpg \
    && echo "deb [signed-by=/usr/share/keyrings/hashicorp-archive-keyring.gpg] https://apt.releases.hashicorp.com $(lsb_release -cs) main" | tee /etc/apt/sources.list.d/hashicorp.list \
    && apt-get update && apt-get install -y terraform \
    && rm -rf /var/lib/apt/lists/*

# Create MCP user
RUN useradd -m -s /bin/bash mcp

# Set working directory
WORKDIR /opt/ansible-mcp-server

# Copy application files
COPY --chown=mcp:mcp . .

# Copy node_modules from builder
COPY --from=builder --chown=mcp:mcp /app/node_modules ./node_modules

# Create necessary directories
RUN mkdir -p /home/mcp/.ssh /home/mcp/.ansible /home/mcp/.terraform.d \
    && chown -R mcp:mcp /home/mcp

# Create states directory
RUN mkdir -p states terraform/cache \
    && chown -R mcp:mcp states terraform

# Set up SSH config to accept all host keys (for lab environment)
RUN echo "Host *\n  StrictHostKeyChecking no\n  UserKnownHostsFile=/dev/null" > /home/mcp/.ssh/config \
    && chmod 600 /home/mcp/.ssh/config \
    && chown mcp:mcp /home/mcp/.ssh/config

# Environment variables
ENV NODE_ENV=production \
    MCP_MODE=stdio \
    ANSIBLE_HOST_KEY_CHECKING=False \
    TF_IN_AUTOMATION=true

# Switch to MCP user
USER mcp

# Default command
CMD ["node", "src/index.js"]