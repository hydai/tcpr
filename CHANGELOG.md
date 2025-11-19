# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] - 2025-11-20

### Added

#### Desktop GUI
- Initial desktop GUI release for Windows and macOS
- Step-by-step setup wizard with comprehensive tutorial
- Automated OAuth 2.0 authentication flow
- Browser-based authentication with automatic token capture
- Real-time event monitoring dashboard
- Live event feed with timestamps and detailed event data
- Settings management panel for credential updates
- Configuration validation before monitoring starts
- Modern, dark-themed UI matching Twitch's branding
- Native desktop application built with Electron
- Multi-process architecture (main, renderer, preload)
- Secure IPC communication between processes
- System-level configuration storage
  - Windows: `%APPDATA%/twitch-channel-points-redemption/`
  - macOS: `~/Library/Application Support/twitch-channel-points-redemption/`
- Event count tracking and uptime monitoring
- OAuth token refresh capability from settings
- Application information display (version, config location, repository)
- Internationalization (i18n) support with translation files
- Cross-platform build support (Windows `.exe`, macOS `.dmg`)
- Portable Windows build option
- Universal macOS build (x64 and ARM64)

#### CLI Mode
- Command-line interface for advanced users and server deployments
- WebSocket client for Twitch EventSub
- Subscription to `channel.channel_points_custom_reward.add` events
- Support for all EventSub message types:
  - `session_welcome` - Initial connection with session ID
  - `session_keepalive` - Periodic heartbeat
  - `notification` - Event data delivery
  - `session_reconnect` - Server-initiated reconnection
  - `revocation` - Subscription cancellation
- Automatic reconnection support
- Built-in OAuth server for easy token generation
- Web-based OAuth flow at `http://localhost:3000`
- Token validation utility (`npm run validate`)
- Real-time console output with formatted event display
- Detailed logging with timestamps
- Graceful shutdown on `Ctrl+C`

#### Configuration
- Support for `config.json` (visible file format)
- Support for `.env` (traditional hidden file format)
- Configuration priority: builtin → .env → empty values ignored
- Build-time credential embedding via `.secret` file
- Example configuration files:
  - `config.example.json`
  - `.env.example`
  - `.secret.example`
- Secure credential storage for desktop application
- OAuth redirect URI configuration
- Custom server port configuration

#### Documentation
- Comprehensive README with GUI-first approach
- BUILD_README.md for distribution and build configuration
- CONTRIBUTING.md with contribution guidelines
- CHANGELOG.md for version history tracking
- Icon creation instructions (`build/ICONS_README.txt`)
- Inline code documentation
- Setup wizard with step-by-step instructions
- Troubleshooting guides for common issues

#### Build & Distribution
- electron-builder integration for creating installers
- Windows NSIS installer (customizable installation directory)
- macOS DMG installer with drag-to-Applications
- Portable Windows builds
- macOS ZIP archives for manual installation
- Build scripts for platform-specific builds:
  - `npm run build` - Both platforms
  - `npm run build:win` - Windows only
  - `npm run build:mac` - macOS only
  - `npm run build:dir` - Unpacked for testing
- Pre-build script for embedding credentials
- Post-install script for configuration initialization
- Custom icon support (`.ico`, `.icns`, `.png`)

#### Development
- Development mode with DevTools (`npm run gui:dev`)
- Hot reload support (renderer process)
- Detailed development logging
- ES6+ module support
- Cross-environment compatibility package (`cross-env`)
- Comprehensive npm scripts for all workflows

### Security
- OAuth 2.0 authentication flow
- Secure token storage
- Context isolation in Electron renderer process
- IPC security via preload script
- Credential files excluded from version control (`.gitignore`)
- HTTPS/WSS enforcement for network communication
- Token validation before monitoring
- Scope verification (`channel:read:redemptions`)

### Dependencies
- `electron` ^28.0.0 - Desktop application framework
- `electron-builder` ^24.13.3 - Build and distribution
- `axios` ^1.6.0 - HTTP client for API requests
- `dotenv` ^16.3.1 - Environment variable management
- `express` ^5.1.0 - OAuth server
- `ws` ^8.14.2 - WebSocket client
- `i18next` ^25.6.2 - Internationalization framework
- `i18next-browser-languagedetector` ^8.2.0 - Language detection
- `cross-env` ^7.0.3 - Cross-platform environment variables

---

## [Unreleased]

### Planned Features
- System tray integration
- Event export (CSV, JSON)
- Event filtering and search
- Custom event notifications
- Multiple channel monitoring
- Event statistics and analytics
- Dark/Light theme toggle
- Auto-update functionality
- Linux support

---

## Version History Summary

- **1.0.0** (2025-11-20) - Initial release with desktop GUI and CLI mode

---

[1.0.0]: https://github.com/hydai/tcpr/releases/tag/v1.0.0
