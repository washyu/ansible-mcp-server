#!/bin/bash

# Clean up root directory for v1.0 release
# Keep only essential files, move everything else to archive

echo "🧹 Cleaning up root directory for v1.0 release..."

# Create archive directory
mkdir -p archive/deployment-scripts
mkdir -p archive/test-scripts
mkdir -p archive/windows-scripts
mkdir -p archive/old-configs

# Move deployment/setup scripts to archive
echo "Moving deployment scripts..."
mv -f deploy-*.sh archive/deployment-scripts/ 2>/dev/null
mv -f setup-*.sh archive/deployment-scripts/ 2>/dev/null
mv -f push-*.sh archive/deployment-scripts/ 2>/dev/null
mv -f fix-*.sh archive/deployment-scripts/ 2>/dev/null
mv -f configure-*.sh archive/deployment-scripts/ 2>/dev/null

# Move test scripts to archive
echo "Moving test scripts..."
mv -f test-*.js archive/test-scripts/ 2>/dev/null
mv -f test-*.sh archive/test-scripts/ 2>/dev/null

# Move Windows-specific files to archive
echo "Moving Windows scripts..."
mv -f windows-*.js archive/windows-scripts/ 2>/dev/null
mv -f windows-*.ps1 archive/windows-scripts/ 2>/dev/null
mv -f windows-*.bat archive/windows-scripts/ 2>/dev/null
mv -f mcp-proxy-client-windows.js archive/windows-scripts/ 2>/dev/null
mv -f mcp-ssh-wrapper.bat archive/windows-scripts/ 2>/dev/null
mv -f run-local-windows.bat archive/windows-scripts/ 2>/dev/null

# Move old YML files to archive
echo "Moving old config files..."
mv -f fix-*.yml archive/old-configs/ 2>/dev/null
mv -f deploy-*.yml archive/old-configs/ 2>/dev/null
mv -f site.yml archive/old-configs/ 2>/dev/null

# Move other misc files
echo "Moving misc files..."
mv -f *-docker-compose.yml archive/old-configs/ 2>/dev/null
mv -f quick-*.sh archive/deployment-scripts/ 2>/dev/null
mv -f manual-*.sh archive/deployment-scripts/ 2>/dev/null
mv -f create-*.sh archive/deployment-scripts/ 2>/dev/null
mv -f cleanup-*.sh archive/deployment-scripts/ 2>/dev/null
mv -f sanitize-*.sh archive/deployment-scripts/ 2>/dev/null

# Move text files that aren't needed
mv -f *-zone.txt archive/old-configs/ 2>/dev/null
mv -f sse-server*.service archive/deployment-scripts/ 2>/dev/null

# Move old documentation
mv -f *-status*.md archive/old-configs/ 2>/dev/null
mv -f *-setup*.md archive/old-configs/ 2>/dev/null
mv -f *-guide*.md archive/old-configs/ 2>/dev/null
mv -f *-checklist*.md archive/old-configs/ 2>/dev/null
mv -f *-action-plan*.md archive/old-configs/ 2>/dev/null
mv -f *-tasks*.md archive/old-configs/ 2>/dev/null
mv -f *-alternatives*.md archive/old-configs/ 2>/dev/null
mv -f *-decision*.md archive/old-configs/ 2>/dev/null
mv -f *-options*.md archive/old-configs/ 2>/dev/null

# Keep only essential docker-compose.yml
mv -f docker-compose.yml docker-compose.yml.example 2>/dev/null

# Clean up homelab specific files
rm -rf homelab_playbook/

# Remove src.backup (created by sanitize script)
rm -rf src.backup/

# Files to KEEP in root:
# - README.md
# - LICENSE
# - RELEASE-v1.0.md
# - package.json
# - package-lock.json
# - .gitignore
# - .env.example
# - .dockerignore
# - docker-compose.yml.example
# - run-v1-tests.sh
# - src/ (directory)
# - docs/ (directory)
# - tests/ (directory)
# - scripts/ (directory)
# - inventory/ (directory)

echo ""
echo "✅ Cleanup complete!"
echo ""
echo "📁 Essential files kept in root:"
ls -la | grep -E "README|LICENSE|RELEASE|package|\.gitignore|\.env\.example|\.dockerignore|docker-compose\.yml\.example|run-v1-tests\.sh" | grep -v "^d"
echo ""
echo "📁 Directories kept:"
ls -d */ | grep -E "^(src|docs|tests|scripts|inventory)/"
echo ""
echo "📦 Archived files moved to: archive/"
echo ""
echo "To restore files: mv archive/category/filename ."