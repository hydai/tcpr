# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

---

## [1.3.0] - 2025-11-26

### Added
- Setting to show/hide keepalive logs in GUI settings panel
- Testing infrastructure with Vitest for unit testing
- Claude Code Review and PR Assistant GitHub Actions workflows

### Changed
- Modularize GUI into separate ES modules for better maintainability
- Simplify Electron code and remove unused IPC handlers
- Remove unused code from `config/`, `client/`, and `lib/` modules
- Extract keepalive preference into cached utility function
- Replace polling with event-driven promise for graceful shutdown
- Improve path validation and code maintainability
- Extract promise cleanup helpers and clarify comments
- Initialize promise handlers to null for defensive programming
- Extract `parseScopes` and `parsePort` helper functions into `lib/oauth-handler.js` for better code reuse
- Improve constants consistency and pre-calculate derived values (`TIME` constants, `TOKEN_REFRESH_INTERVAL_MINUTES`)
- Replace magic number with `MAX_EVENTS_DISPLAY` constant
- Improve error handling and use modern DOM APIs

### Fixed
- Prevent false error dialog when user manually stops monitoring
- Add null safety for keepalive message check
- Improve keepalive filter logic for edge cases
- Remove calls to non-existent SessionLogger methods
- Correct promise resolution order to prevent race conditions
- Prevent concurrent retry race condition
- Resolve promise race condition and hanging waiters
- Correct path comparison to preserve case in relative paths
- Add TCP port range validation (0-65535) to `parsePort` function
- Use nullish coalescing for port parsing to properly support port 0
- Add null checks for scope and port fallback values

### Security
- Improve path validation to handle symlinks and case-insensitive filesystems
- Resolve symlink bypass vulnerability in path validation

### CI/CD
- Add Claude Code Review workflow for automated PR reviews
- Add Claude PR Assistant workflow for PR management
- Prevent duplicate CI builds on PRs from claude branches
- Add concurrency control to prevent duplicate PR reviews

---

## [1.2.0] - 2025-11-23

### Added
- Token expiration timer on dashboard showing remaining time until token expires
- Delete all logs button in settings menu for easy log management
- Automatic token refresh when access token expires to maintain uninterrupted sessions
- Custom modal dialogs for delete confirmations (replacing native dialogs)

### Fixed
- Token expiration timer not updating correctly after token refresh
- Token saving in Electron by passing CONFIG_PATH to child process environment
- Localized error messages and handle partial deletion failures gracefully
- Timer rescheduling issues after stop and double scheduling bugs
- Token refresh timer chain reliability to ensure continuous operation
- Token expiration check before first refresh and proper cleanup
- Token refresh reliability and subscriber handling improvements
- Hourly token auto-refresh to prevent expiration during active monitoring sessions
- Refresh token preservation when saving config in GUI settings
- Subscription count check made more defensive to handle edge cases

### Changed
- Allow keepalive messages through the packet filter by default for detailed connection monitoring
- Use structured IPC messaging for token refresh notification between processes
- Extract token expiry timeout cleanup into helper function for better maintainability
- Optimize token expiry timer updates and display rendering
- Extract time constants for better code readability and maintenance
- Replace native dialogs with custom modals for delete logs operations
- Improve token refresh with setTimeout and retry logic for better reliability
- Improve code robustness and backward compatibility across versions
- Improve error messages with actionable guidance for users
- Improve TokenRefresher code quality and structure

---

## [1.1.0] - 2025-11-21

### Fixed
- Subscribe to redemption events (`channel.channel_points_custom_reward_redemption.add`) instead of reward creation events for proper channel points monitoring
- Update error messages to reference `config.json` instead of environment variables for clarity

### Changed
- OAuth token refresh polling now starts immediately instead of after 1-second delay for better responsiveness
- Message formatting moved from JavaScript code to translation files for better internationalization
- Remove all dotenv references from codebase in favor of `config.json` configuration

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
- Automatic event log saving with NDJSON format and session-based validation
- Session management with exponential backoff retry logic
- OAuth token refresh capability from settings
- Application information display (version, config location, repository)
- Session ID display in settings panel for debugging and support
- Event export functionality (CSV and JSON formats)
- Folder opening buttons to access event logs and configuration directories
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
- Keepalive packet filtering to reduce event display noise
- Built-in OAuth server for easy token generation
- Web-based OAuth flow at `http://localhost:3000`
- Token validation utility (`npm run validate`)
- Real-time console output with formatted event display
- Detailed logging with timestamps
- Graceful shutdown on `Ctrl+C`

#### Configuration
- Support for `config.json` (visible file format)
- Support for `.env` (traditional hidden file format)
- Example configuration files:
  - `config.example.json`
  - `.env.example`
- Secure credential storage for desktop application
- OAuth redirect URI configuration
- Custom server port configuration

#### Documentation
- Comprehensive README with GUI-first approach
- CONTRIBUTING.md with contribution guidelines
- CHANGELOG.md for version history tracking
- Event logs storage location documentation
  - Windows: `%APPDATA%/twitch-channel-points-redemption/event_logs/`
  - macOS: `~/Library/Application Support/twitch-channel-points-redemption/event_logs/`
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
- XSS vulnerability fixes in internationalization implementation
- Data sanitization for user-facing content
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

## Future Releases

See the [Roadmap](README.md#roadmap) section in README.md for planned features and upcoming enhancements.
