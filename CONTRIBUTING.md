# Contributing to Ansible MCP Server

First off, thank you for considering contributing to Ansible MCP Server! It's people like you that make this tool better for everyone.

## 🤝 How Can You Contribute?

### 1. **Test and Report Issues**
- Try the tools in your environment
- Report bugs or unexpected behavior
- Suggest improvements to existing tools

### 2. **Improve Documentation**
- Fix typos or clarify confusing sections
- Add examples for tools
- Write tutorials or guides
- Translate documentation

### 3. **Code Contributions**
- Fix bugs (see issues labeled `bug`)
- Add new tools
- Improve existing tools
- Add tests (we need to go from 25% to 80% coverage!)
- Optimize performance

### 4. **Feature Ideas**
- Suggest new tools that would be useful
- Propose improvements to the architecture
- Share your use cases

## 🚀 Getting Started

1. **Fork the repository**
2. **Clone your fork**
   ```bash
   git clone https://github.com/YOUR_USERNAME/ansible-mcp-server.git
   cd ansible-mcp-server
   ```

3. **Install dependencies**
   ```bash
   npm install
   ```

4. **Create a branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

5. **Make your changes**
   - Write code
   - Add tests
   - Update documentation

6. **Test your changes**
   ```bash
   npm test
   ```

7. **Commit with a clear message**
   ```bash
   git commit -m "feat: add amazing new feature"
   ```

8. **Push and create a PR**
   ```bash
   git push origin feature/your-feature-name
   ```

## 📝 Pull Request Guidelines

- **One feature per PR** - Keep PRs focused and easy to review
- **Write tests** - All new tools should have tests
- **Update docs** - If you change behavior, update the docs
- **Follow existing style** - Match the code style of the project
- **Write clear commit messages** - Use conventional commits if possible

## 🧪 Testing

- Run `npm test` to execute the test suite
- New tools need at least 3 test cases:
  - Valid parameters test
  - Missing required parameters test
  - Invalid parameter types test

## 💡 Tool Ideas We'd Love Help With

Check out our [GitHub Issues](https://github.com/washyu/ansible-mcp-server/issues) for:
- 🏷️ `good first issue` - Great for newcomers
- 🏷️ `help wanted` - We especially need help here
- 🏷️ `enhancement` - New features and improvements

### High Priority Areas:
1. **Windows Support** (#1) - WMI-based hardware discovery
2. **Test Coverage** (#2) - We have 51 untested tools!
3. **Docker Support** (#12) - Containerize the server
4. **CI/CD Pipeline** (#13) - GitHub Actions workflow

## 🤔 Questions or Ideas?

- Open a [Discussion](https://github.com/washyu/ansible-mcp-server/discussions)
- Join our community (coming soon!)
- Tag @washyu in issues

## 🏆 Recognition

Contributors will be:
- Added to the README contributors section
- Mentioned in release notes
- Given credit in commit messages

## 📜 Code of Conduct

Please note that this project is released with a Contributor Code of Conduct. By participating in this project you agree to abide by its terms.

## 🙏 Thank You!

Every contribution, no matter how small, makes a difference. Whether it's fixing a typo, adding a test, or implementing a new feature, we appreciate your help in making Ansible MCP Server better for everyone.

Ready to contribute? Check out our [open issues](https://github.com/washyu/ansible-mcp-server/issues) and let's build something awesome together! 🚀