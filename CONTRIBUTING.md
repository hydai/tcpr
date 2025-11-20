# Contributing to Twitch Channel Points Monitor

Thank you for your interest in contributing to the Twitch Channel Points Monitor (TCPR)! We welcome contributions from the community and appreciate your help in making this project better.

---

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How Can I Contribute?](#how-can-i-contribute)
  - [Reporting Bugs](#reporting-bugs)
  - [Suggesting Features](#suggesting-features)
  - [Submitting Pull Requests](#submitting-pull-requests)
  - [Improving Documentation](#improving-documentation)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Development Guidelines](#development-guidelines)
  - [Code Style](#code-style)
  - [Commit Messages](#commit-messages)
  - [Testing](#testing)
- [Pull Request Process](#pull-request-process)
- [Getting Help](#getting-help)

---

## Code of Conduct

This project adheres to a code of conduct that all contributors are expected to follow. Please be respectful and considerate in your interactions with other contributors.

### Our Standards

- Be respectful and inclusive
- Welcome newcomers and help them learn
- Focus on what is best for the community
- Show empathy towards other community members
- Accept constructive criticism gracefully

---

## How Can I Contribute?

### Reporting Bugs

Before submitting a bug report:
1. **Check existing issues** - Someone may have already reported the same bug
2. **Test with the latest version** - The bug may already be fixed
3. **Gather information** - Include as much detail as possible

**When reporting a bug, include:**
- Clear, descriptive title
- Steps to reproduce the behavior
- Expected behavior vs. actual behavior
- Screenshots or error messages (if applicable)
- Your environment:
  - OS (Windows/macOS/Linux) and version
  - Node.js version
  - Application version
  - Whether using GUI or CLI mode

**Template:**
```markdown
## Bug Description
A clear description of what the bug is.

## Steps to Reproduce
1. Go to '...'
2. Click on '...'
3. See error

## Expected Behavior
What you expected to happen.

## Actual Behavior
What actually happened.

## Environment
- OS: [e.g., Windows 11, macOS 14.0]
- Node.js version: [e.g., 18.0.0]
- Application version: [e.g., 1.0.0]
- Mode: [GUI or CLI]

## Screenshots
If applicable, add screenshots to help explain your problem.

## Additional Context
Any other context about the problem.
```

### Suggesting Features

We love feature suggestions! Before submitting:
1. **Check existing feature requests** - Your idea may already be proposed
2. **Check the roadmap** - It might already be planned
3. **Consider if it fits the project scope**

**When suggesting a feature, include:**
- Clear, descriptive title
- Detailed description of the feature
- Why this feature would be useful
- How you envision it working
- Mockups or examples (if applicable)

**Template:**
```markdown
## Feature Description
A clear description of what you want to happen.

## Use Case
Explain why this feature would be useful and who would benefit from it.

## Proposed Implementation
Describe how you envision this feature working.

## Alternatives Considered
Describe any alternative solutions or features you've considered.

## Additional Context
Any other context, mockups, or examples.
```

### Submitting Pull Requests

We welcome pull requests! Here's how to submit one:

1. **Fork the repository**
2. **Create a feature branch** from `master`
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. **Make your changes** following our [development guidelines](#development-guidelines)
4. **Test your changes** thoroughly
5. **Commit your changes** with clear, descriptive commit messages
6. **Push to your fork**
   ```bash
   git push origin feature/your-feature-name
   ```
7. **Open a Pull Request** against the `master` branch

### Improving Documentation

Documentation improvements are always welcome! This includes:
- Fixing typos or grammar issues
- Clarifying confusing sections
- Adding missing information
- Improving examples
- Translating documentation

For documentation changes, you can follow the same pull request process as code changes.

---

## Development Setup

### Prerequisites

- **Node.js** 14 or higher
- **npm** (comes with Node.js)
- **Git**
- A **Twitch Developer Account** for testing

### Setup Steps

1. **Fork and clone the repository**
   ```bash
   git clone https://github.com/YOUR_USERNAME/tcpr.git
   cd tcpr
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up your configuration**
   ```bash
   cp config.example.json config.json
   # Edit config.json with your Twitch credentials
   ```

4. **Run the application**

   **CLI Mode:**
   ```bash
   npm start
   ```

   **GUI Mode (Development):**
   ```bash
   npm run gui:dev
   ```

### Development Scripts

- `npm start` - Run the CLI application
- `npm run validate` - Validate your Twitch access token
- `npm run oauth` - Start the OAuth server for token generation
- `npm run gui` - Run the GUI in production mode
- `npm run gui:dev` - Run the GUI in development mode (with DevTools)
- `npm run build` - Build installers for both Windows and macOS
- `npm run build:win` - Build Windows installer only
- `npm run build:mac` - Build macOS installer only
- `npm run build:dir` - Build unpacked directory (for testing)

---

## Project Structure

Understanding the project structure will help you navigate the codebase:

```
tcpr/
├── electron/                 # Electron main process
│   ├── main.js              # Main Electron entry point
│   ├── preload.js           # Secure IPC bridge
│   └── oauth-server-electron.js  # OAuth server for Electron
├── gui/                     # GUI renderer process
│   ├── index.html           # Main application UI
│   ├── locales/             # i18n translation files
│   ├── css/
│   │   └── styles.css       # Application styles
│   └── js/
│       └── app.js           # Application logic
├── client/                  # EventSub client modules
├── config/                  # Configuration management
├── lib/                     # Utility libraries
├── public/                  # Static assets
├── build/                   # Build resources (icons, etc.)
├── scripts/                 # Build and setup scripts
├── index.js                 # CLI entry point
├── oauth-server.js          # OAuth server for CLI
├── validateToken.js         # Token validation utility
└── package.json             # Project configuration
```

### Key Files

- **`electron/main.js`** - Main Electron process, handles app lifecycle, IPC, and EventSub
- **`electron/preload.js`** - Security bridge between main and renderer processes
- **`gui/js/app.js`** - GUI application logic and event handling
- **`gui/index.html`** - Main GUI interface
- **`index.js`** - CLI entry point and main WebSocket client logic
- **`oauth-server.js`** - OAuth server for generating access tokens
- **`validateToken.js`** - Utility for validating Twitch tokens

---

## Development Guidelines

### Code Style

- **JavaScript**: Use ES6+ features (modules, arrow functions, async/await, etc.)
- **Indentation**: Use 2 spaces (not tabs)
- **Semicolons**: Use semicolons consistently
- **Quotes**: Use single quotes for strings (except in HTML/JSON)
- **Naming Conventions**:
  - Variables and functions: `camelCase`
  - Constants: `UPPER_SNAKE_CASE`
  - Classes: `PascalCase`
- **Comments**: Write clear comments for complex logic
- **File Organization**: Keep files focused on a single responsibility

### Commit Messages

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, missing semicolons, etc.)
- `refactor:` - Code refactoring (no functional changes)
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks (dependencies, build process, etc.)

**Examples:**
```
feat(gui): add event export functionality

fix(oauth): handle token expiration correctly

docs(readme): update installation instructions

refactor(client): improve WebSocket reconnection logic
```

### Testing

Before submitting a pull request:

1. **Test your changes thoroughly**
   - Test in both GUI and CLI modes (if applicable)
   - Test on different operating systems (if possible)
   - Test edge cases and error conditions

2. **Verify no regressions**
   - Make sure existing functionality still works
   - Check that your changes don't break other features

3. **Test the build process** (for significant changes)
   ```bash
   npm run build:dir
   ```

4. **Validate tokens and configuration**
   ```bash
   npm run validate
   ```

### Security Considerations

- **Never commit credentials** - Keep `config.json` out of version control
- **Validate user input** - Always sanitize and validate input from users
- **Use secure communication** - Always use HTTPS/WSS for network requests
- **Follow OAuth best practices** - Properly handle tokens and OAuth flows
- **Avoid XSS vulnerabilities** - Be careful when rendering user-generated content in the GUI

---

## Pull Request Process

### Before Submitting

1. **Update documentation** if you've added or changed functionality
2. **Test your changes** thoroughly
3. **Follow the code style** guidelines
4. **Write clear commit messages** following Conventional Commits
5. **Rebase your branch** on the latest `master` to avoid conflicts
   ```bash
   git fetch upstream
   git rebase upstream/master
   ```

### PR Description Template

```markdown
## Description
Brief description of what this PR does.

## Type of Change
- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update

## Changes Made
- Change 1
- Change 2
- Change 3

## Testing
Describe the tests you ran and how to reproduce them:
- Test 1
- Test 2

## Screenshots (if applicable)
Add screenshots to demonstrate the changes.

## Checklist
- [ ] My code follows the project's code style
- [ ] I have tested my changes thoroughly
- [ ] I have updated the documentation accordingly
- [ ] My commits follow the Conventional Commits specification
- [ ] I have added/updated tests if applicable
```

### Review Process

1. A maintainer will review your PR
2. They may request changes or ask questions
3. Address any feedback by pushing new commits to your branch
4. Once approved, a maintainer will merge your PR

### After Your PR is Merged

1. **Delete your feature branch**
   ```bash
   git branch -d feature/your-feature-name
   git push origin --delete feature/your-feature-name
   ```

2. **Update your fork**
   ```bash
   git checkout master
   git pull upstream master
   git push origin master
   ```

---

## Getting Help

If you need help with contributing:

- **GitHub Issues** - Ask questions in a new issue
- **GitHub Discussions** - Join the community discussions
- **Documentation** - Check the [README.md](README.md)

---

## Recognition

Contributors will be recognized in:
- The project's GitHub contributors page
- Release notes (for significant contributions)
- This CONTRIBUTING.md file (for major contributors)

---

## License

By contributing to this project, you agree that your contributions will be licensed under the MIT License.

---

**Thank you for contributing to Twitch Channel Points Monitor!**
