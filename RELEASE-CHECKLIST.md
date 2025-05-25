# Release Checklist for v1.0

## Pre-Release Tasks

### 1. Code Cleanup
- [ ] Run cleanup script: `./cleanup-for-github.sh`
- [ ] Run sanitization: `./sanitize-files.sh`
- [ ] Review all changes: `git diff`
- [ ] Check for sensitive data:
  ```bash
  grep -r "192.168" . --exclude-dir=node_modules --exclude-dir=.git
  grep -r "password" . --exclude-dir=node_modules --exclude-dir=.git
  grep -r "token" . --exclude-dir=node_modules --exclude-dir=.git
  ```

### 2. Testing
- [ ] Run all tests: `./run-tests.sh`
- [ ] Test Docker build: `docker build -t test .`
- [ ] Test fresh installation
- [ ] Test Windows SSE proxy connection

### 3. Documentation
- [ ] Update README.md
- [ ] Verify all example IPs use 10.0.0.0/8 range
- [ ] Check that .env.example has generic values
- [ ] Ensure setup guides are accurate

### 4. Version Management
- [ ] Update version in package.json
- [ ] Create CHANGELOG.md entry
- [ ] Tag the release: `git tag -a v1.0.0 -m "Initial release"`

### 5. Repository Structure
```
ansible-mcp-server/
├── src/                    # Source code
├── tests/                  # Test suites
├── scripts/                # Installation scripts
├── docs/                   # Documentation
├── homelab_playbook/       # Example playbooks
├── inventory/              # Example inventory
├── .github/                # CI/CD workflows
├── Dockerfile             # Docker configuration
├── docker-compose.yml     # Docker Compose
├── package.json           # Node.js config
├── .env.example           # Environment template
├── .gitignore             # Git ignore rules
├── LICENSE                # MIT License
└── README.md              # Project documentation
```

### 6. Final Checks
- [ ] No .env files in repository
- [ ] No real IP addresses (192.168.x.x)
- [ ] No real passwords or tokens
- [ ] No personal information
- [ ] All scripts are executable
- [ ] CI/CD workflows are valid

## Release Process

1. **Create Release Branch**
   ```bash
   git checkout -b release/v1.0.0
   ```

2. **Run Final Cleanup**
   ```bash
   ./cleanup-for-github.sh
   ./sanitize-files.sh
   git add -A
   git commit -m "Prepare for v1.0.0 release"
   ```

3. **Create Pull Request**
   - Title: "Release v1.0.0"
   - Description: Include changelog
   - Wait for CI checks to pass

4. **Merge and Tag**
   ```bash
   git checkout main
   git merge release/v1.0.0
   git tag -a v1.0.0 -m "Initial public release"
   git push origin main --tags
   ```

5. **Create GitHub Release**
   - Go to Releases → New Release
   - Choose tag v1.0.0
   - Title: "v1.0.0 - Initial Release"
   - Attach:
     - Source code (automatic)
     - Docker image instructions
     - Windows setup script

## Post-Release

- [ ] Verify GitHub Actions completed
- [ ] Check that release artifacts are available
- [ ] Test installation from released version
- [ ] Update any external documentation
- [ ] Announce release (if applicable)

## Rollback Plan

If issues are found:
1. Delete the release (keep tag)
2. Fix issues on a hotfix branch
3. Re-release as v1.0.1

## Security Incident Response

If sensitive data is accidentally released:
1. Immediately delete the release
2. Force push to remove from history
3. Rotate any exposed credentials
4. Create new release after cleanup