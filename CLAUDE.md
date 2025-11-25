# CLAUDE.md - AI Assistant Guide for TCPR

This document provides essential information for AI assistants working on the Twitch Channel Points Monitor (TCPR) codebase.

## Project Overview

**TCPR** is a Node.js application that monitors Twitch channel points custom reward events in real-time using the Twitch EventSub WebSocket API. It offers:

- **Desktop GUI** (Electron) - Windows/macOS app with setup wizard and real-time dashboard
- **CLI Mode** - Lightweight command-line interface for server deployments

**Current Version:** 1.3.0

## Tech Stack

| Category | Technology |
|----------|------------|
| Runtime | Node.js v14+ (ES Modules) |
| Desktop Framework | Electron 39.2.3 |
| Build Tool | electron-builder 24.13.3 |
| HTTP Server | Express 5.1.0 |
| WebSocket | ws 8.14.2 |
| HTTP Client | axios 1.6.0 |
| i18n | i18next 25.6.2 |

## Directory Structure

```
tcpr/
├── electron/                    # Electron main process
│   ├── main.js                  # Window management, IPC handlers, EventSub/OAuth lifecycle
│   ├── preload.js               # Secure IPC bridge (context isolation)
│   └── oauth-server-electron.js # OAuth server for GUI mode
│
├── gui/                         # Electron renderer (frontend)
│   ├── index.html               # Main UI with setup wizard and dashboard
│   ├── css/styles.css           # Dark theme styles
│   ├── js/app.js                # Frontend state management and logic
│   └── locales/{en,ja}/         # Internationalization files
│
├── client/                      # EventSub client modules
│   ├── WebSocketManager.js      # WebSocket connection lifecycle
│   ├── EventSubSubscriber.js    # Subscription management
│   ├── EventFormatter.js        # Event data formatting
│   └── PacketFilter.js          # Message filtering
│
├── config/                      # Configuration management
│   ├── constants.js             # Twitch URLs, event types, scopes, defaults
│   ├── env.js                   # Config class for validation
│   └── loader.js                # Load config.json to process.env
│
├── lib/                         # Utility libraries
│   ├── logger.js                # Structured logging with colors
│   ├── tokenValidator.js        # Token validation against Twitch API
│   ├── TokenRefresher.js        # Automatic token refresh
│   ├── StateTokenManager.js     # OAuth CSRF protection
│   ├── oauth-handler.js         # Shared OAuth logic (URL building, token exchange)
│   ├── errors.js                # Custom error classes
│   └── retry.js                 # Exponential backoff retry logic
│
├── public/                      # OAuth web server static assets
├── build/                       # App icons and build resources
│
├── index.js                     # CLI entry point (TwitchEventSubClient)
├── oauth-server.js              # Standalone OAuth server
├── validateToken.js             # Token validation utility
└── config.example.json          # Configuration template
```

## Key Entry Points

| File | Purpose | Mode |
|------|---------|------|
| `index.js` | Main EventSub client | CLI |
| `electron/main.js` | Electron main process | GUI |
| `gui/js/app.js` | Frontend application | GUI |
| `oauth-server.js` | OAuth token generation | CLI |
| `validateToken.js` | Token validation | CLI |

## Development Commands

```bash
npm start          # Run CLI client
npm run validate   # Validate Twitch tokens
npm run oauth      # Start OAuth server (port 3000)
npm run gui        # Run Electron app
npm run gui:dev    # Run Electron with DevTools
npm run build      # Build for Windows and macOS
npm run build:win  # Build Windows only
npm run build:mac  # Build macOS only
npm run build:dir  # Build unpacked (for testing)
```

## Code Conventions

### Naming
- **Classes:** `PascalCase` (e.g., `WebSocketManager`, `TokenValidator`)
- **Functions/Variables:** `camelCase` (e.g., `loadConfig`, `startMonitoring`)
- **Constants:** `UPPER_SNAKE_CASE` (e.g., `TOKEN_REFRESH_INTERVAL_MS`)

### Style
- ES6+ features (modules, async/await, arrow functions)
- 2 spaces indentation
- Single quotes for strings (except JSON/HTML)
- Semicolons required
- JSDoc comments for public methods

### Commit Messages (Conventional Commits)
```
feat(gui): add event export functionality
fix(oauth): handle token expiration correctly
docs(readme): update installation instructions
refactor(client): improve WebSocket reconnection logic
chore(deps): upgrade electron to 39.2.3
```

## Architecture Patterns

### 1. Configuration Flow
```javascript
// Load config.json into process.env
loadConfig();
// Get validated config with presets: 'client', 'oauth', or 'minimal'
const config = Config.load({ required: 'client' });
// Or with validation result instead of throwing
const result = Config.load({ required: 'client', returnValidationResult: true });
```

### 2. Error Hierarchy
```
Error
├── TokenValidationError (with reason codes: ownership_mismatch, missing_scope, invalid_token, etc.)
├── SubscriptionError
├── WebSocketError
└── TokenRefreshError
```

### 3. IPC Communication (Electron)
```javascript
// Renderer (gui/js/app.js)
const result = await window.electronAPI.startEventSub();

// Preload (electron/preload.js)
contextBridge.exposeInMainWorld('electronAPI', {
  startEventSub: () => ipcRenderer.invoke('eventsub:start')
});

// Main (electron/main.js)
ipcMain.handle('eventsub:start', async () => { /* ... */ });
```

### 4. Message Pipeline
```
WebSocket Message → PacketFilter → EventFormatter → Logger/UI
```

### 5. Token Lifecycle
```
Load → Validate → Auto-refresh (60 min) → Save to config → Update env
```

## Configuration Files

### config.json (User credentials)
```json
{
  "TWITCH_CLIENT_ID": "...",
  "TWITCH_CLIENT_SECRET": "...",
  "TWITCH_ACCESS_TOKEN": "...",
  "TWITCH_REFRESH_TOKEN": "...",
  "TWITCH_BROADCASTER_ID": "...",
  "REDIRECT_URI": "http://localhost:3000/callback",
  "PORT": 3000
}
```

**Location:**
- CLI: Project root (`./config.json`)
- GUI Windows: `%APPDATA%/twitch-channel-points-redemption/config.json`
- GUI macOS: `~/Library/Application Support/twitch-channel-points-redemption/config.json`

## Important Files to Understand

| Task | Files to Read |
|------|---------------|
| Adding new EventSub events | `client/EventSubSubscriber.js`, `config/constants.js` |
| Modifying UI | `gui/index.html`, `gui/js/app.js`, `gui/css/styles.css` |
| Adding translations | `gui/locales/en/translation.json`, `gui/locales/ja/translation.json` |
| Electron IPC | `electron/main.js`, `electron/preload.js` |
| Token handling | `lib/tokenValidator.js`, `lib/TokenRefresher.js` |
| OAuth flow | `lib/oauth-handler.js`, `lib/StateTokenManager.js` |
| Error handling | `lib/errors.js` |
| Logging | `lib/logger.js` |

## Testing Approach

**No automated test framework is configured.** Manual testing workflow:

1. Set up test Twitch application
2. Run `npm run validate` to verify config
3. Test CLI: `npm start`
4. Test GUI: `npm run gui:dev`
5. Create/redeem channel points rewards to verify events

## Security Considerations

- **Never commit `config.json`** - Contains secrets
- Electron uses **context isolation** - All IPC goes through preload bridge
- OAuth uses **state tokens** for CSRF protection
- Always use **HTTPS/WSS** for network requests
- Validate user input to prevent XSS in GUI

## Common Tasks

### Adding a new EventSub subscription type
1. Add event type to `config/constants.js` (`EVENT_TYPES`)
2. Update `client/EventSubSubscriber.js` to subscribe
3. Update `client/EventFormatter.js` to format the event
4. Update GUI in `gui/js/app.js` if needed

### Adding a new IPC handler
1. Add handler in `electron/main.js` using `ipcMain.handle()`
2. Expose method in `electron/preload.js` via `contextBridge`
3. Call from renderer in `gui/js/app.js` via `window.electronAPI`

### Adding translations
1. Add key to `gui/locales/en/translation.json`
2. Add translation to `gui/locales/ja/translation.json`
3. Use in HTML: `<span data-i18n="your.key">`
4. Use in JS: `i18next.t('your.key')`

## Build Outputs

| Platform | Targets | Location |
|----------|---------|----------|
| Windows | NSIS installer, Portable exe | `dist/` |
| macOS | DMG, ZIP (x64 + arm64) | `dist/` |

## Useful Links

- [Twitch EventSub WebSocket](https://dev.twitch.tv/docs/eventsub/handling-websocket-events)
- [Twitch OAuth](https://dev.twitch.tv/docs/authentication)
- [Electron Documentation](https://www.electronjs.org/docs)
- [i18next Documentation](https://www.i18next.com/)
