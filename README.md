# Twitch Channel Points Monitor

![Version](https://img.shields.io/badge/version-1.3.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Node](https://img.shields.io/badge/node-%3E%3D14-brightgreen.svg)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg)

A beautiful, user-friendly application for monitoring Twitch channel points custom reward events in real-time. Available as both a **desktop GUI** (Windows/macOS) and **command-line interface**.

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Quick Start](#quick-start)
  - [Desktop GUI (Recommended)](#desktop-gui-recommended)
  - [CLI Mode](#cli-mode)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
  - [GUI Installation](#gui-installation)
  - [CLI Installation](#cli-installation)
- [First-Time Setup](#first-time-setup)
- [Configuration](#configuration)
  - [Register a Twitch Application](#1-register-a-twitch-application)
  - [Generate an Access Token](#2-generate-an-access-token)
  - [Get Your Broadcaster User ID](#3-get-your-broadcaster-user-id)
  - [Configure Environment](#4-configure-environment-variables)
- [Usage](#usage)
  - [Desktop GUI](#desktop-gui)
  - [CLI Mode](#cli-mode-1)
- [Project Structure](#project-structure)
- [Architecture](#architecture)
- [Troubleshooting](#troubleshooting)
- [Building & Distribution](#building--distribution)
- [Development](#development)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License & Credits](#license--credits)

---

## Overview

**Twitch Channel Points Monitor** (TCPR) is a Node.js application that connects to Twitch EventSub WebSocket to monitor custom channel points reward creation events in real-time.

### What is TCPR?

TCPR provides two interfaces to monitor Twitch channel points events:

1. **Desktop GUI** - A beautiful Electron-based desktop application with a step-by-step setup wizard, automated OAuth flow, and real-time dashboard (Windows/macOS)
2. **CLI Mode** - A lightweight command-line interface for advanced users and server deployments

### Why Use TCPR?

- **Easy Setup**: Step-by-step wizard guides you through the entire configuration process
- **Secure Authentication**: Built-in OAuth 2.0 flow with automatic token management
- **Real-time Monitoring**: Live dashboard displaying channel points events as they happen
- **Cross-platform**: Works on Windows, macOS, and Linux
- **Flexible**: Choose between GUI for ease of use or CLI for automation

---

## Features

### Desktop GUI Features

- **Setup Wizard** - Step-by-step tutorial guides you through the entire setup process
- **Automated OAuth Flow** - No manual token copying required; browser-based authentication
- **Configuration Validation** - Ensures everything is set up correctly before monitoring
- **Real-time Dashboard** - Live event feed with timestamps and detailed event data
- **Settings Management** - Easy credential management through a settings panel
- **Modern UI** - Clean, dark-themed interface matching Twitch's branding
- **Native Desktop App** - Built with Electron for a native feel on Windows and macOS

### CLI Mode Features

- Connects to Twitch EventSub WebSocket
- Subscribes to `channel.channel_points_custom_reward.add` events
- Handles all EventSub message types (welcome, keepalive, notification, reconnect, revocation)
- Automatic reconnection support
- Built-in OAuth server for easy token generation
- Token validation utility
- Real-time monitoring with detailed console output

---

## Quick Start

### Desktop GUI (Recommended)

**Get started in 5 minutes!**

#### Windows
1. Download the latest `.exe` installer from [Releases](https://github.com/hydai/tcpr/releases)
2. Run the installer and follow the prompts
3. Launch "Twitch Channel Points Monitor" from your Start Menu
4. Follow the setup wizard

#### macOS
1. Download the latest `.dmg` file from [Releases](https://github.com/hydai/tcpr/releases)
2. Open the DMG and drag the app to your Applications folder
3. Launch from Applications (right-click and select "Open" on first launch)
4. Follow the setup wizard

#### From Source
```bash
# Clone the repository
git clone https://github.com/hydai/tcpr.git
cd tcpr

# Install dependencies
npm install

# Launch the desktop application
npm run gui
```

The GUI will guide you through the entire setup process automatically!

### CLI Mode

**For advanced users and server deployments:**

```bash
# 1. Clone and install
git clone https://github.com/hydai/tcpr.git
cd tcpr
npm install

# 2. Configure credentials (see Configuration section)
cp config.example.json config.json
# Edit config.json with your Twitch credentials

# 3. Start the application
npm start
```

---

## Prerequisites

Before you begin, you'll need:

1. **A Twitch account** - Your broadcaster account
2. **A registered Twitch application** - Created in the Twitch Developer Console
3. **Node.js** - Version 14 or higher ([Download Node.js](https://nodejs.org/))

---

## Installation

### GUI Installation

#### Option 1: Download Pre-built Package (Recommended)

**For Windows:**
1. Go to the [Releases](https://github.com/hydai/tcpr/releases) page
2. Download the latest `.exe` installer for Windows
3. Run the installer and follow the prompts
4. Launch "Twitch Channel Points Monitor" from your Start Menu

**For macOS:**
1. Go to the [Releases](https://github.com/hydai/tcpr/releases) page
2. Download the latest `.dmg` file for macOS
3. Open the DMG and drag the app to your Applications folder
4. Launch "Twitch Channel Points Monitor" from Applications
   - On first launch, you may need to right-click the app and select "Open" to bypass Gatekeeper

#### Option 2: Build from Source

```bash
# 1. Clone the repository
git clone https://github.com/hydai/tcpr.git
cd tcpr

# 2. Install dependencies
npm install

# 3. Run the GUI in development mode
npm run gui:dev

# 4. (Optional) Build for your platform
npm run build        # Build for both Windows and macOS
npm run build:win    # Windows only
npm run build:mac    # macOS only
```

The installer will be created in the `dist/` directory.

### CLI Installation

```bash
# 1. Clone the repository
git clone https://github.com/hydai/tcpr.git
cd tcpr

# 2. Install dependencies
npm install

# 3. Configure your credentials (see Configuration section)
```

---

## First-Time Setup

### Desktop GUI Setup Wizard

When you launch the application for the first time, you'll be guided through a comprehensive 7-step setup wizard:

#### Step 1: Welcome Screen
- Overview of features and capabilities
- Introduction to the setup process
- Click **"Get Started"** to begin

#### Step 2: Create Twitch Application
The wizard will guide you to:
1. Visit the [Twitch Developer Console](https://dev.twitch.tv/console/apps)
2. Click **"Register Your Application"**
3. Fill in the details:
   - **Name**: `My Channel Points Monitor` (or any name you prefer)
   - **OAuth Redirect URLs**: `http://localhost:3000/callback`
   - **Category**: Application Integration
4. Click **"Create"**
5. Click **"Manage"** on your new application
6. Copy your **Client ID**
7. Click **"New Secret"** to generate a **Client Secret** and copy it

#### Step 3: Enter Credentials
Back in the desktop app:
1. Paste your **Client ID**
2. Paste your **Client Secret**
3. Click **"Continue"**

#### Step 4: Authenticate with Twitch
1. Click **"Authenticate with Twitch"**
2. Your browser will open automatically
3. Click **"Authorize"** to allow the application access
4. Return to the desktop app
5. Your access token and broadcaster ID will be saved automatically!

#### Step 5: Review Configuration
- Verify all your settings
- Review scopes and permissions
- Confirm broadcaster ID
- Click **"Save & Continue"**

#### Step 6: Validation
- Automatic token validation
- Scope verification (checks for `channel:read:redemptions`)
- Permission checks

#### Step 7: Complete!
- You're ready to start monitoring
- Click **"Go to Dashboard"** to begin

### CLI Setup

For CLI mode, you'll need to manually configure your credentials. See the [Configuration](#configuration) section below.

---

## Configuration

### 1. Register a Twitch Application

1. Go to [Twitch Developer Console](https://dev.twitch.tv/console/apps)
2. Click **"Register Your Application"**
3. Fill in the required information:
   - **Name**: Choose any name for your application
   - **OAuth Redirect URLs**: `http://localhost:3000/callback` (required for OAuth flow)
   - **Category**: Choose appropriate category
4. Click **"Create"**
5. Copy your **Client ID** and **Client Secret**

### 2. Generate an Access Token

You need a **User Access Token** with the `channel:read:redemptions` scope.

#### Option A: Using OAuth Web Server (Recommended)

This repository includes a built-in OAuth server that makes it easy to generate access tokens:

```bash
# 1. Install dependencies
npm install

# 2. Configure your application credentials
cp config.example.json config.json
# Edit config.json and add your TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET

# 3. Start the OAuth server
npm run oauth

# 4. Open your browser and navigate to http://localhost:3000
# 5. Click "Connect with Twitch"
# 6. Authorize the application
# 7. Copy the access token displayed on the success page
# 8. Add it to your config.json file as TWITCH_ACCESS_TOKEN
```

The OAuth server will also display your broadcaster user ID, which you'll need for the next step.

#### Option B: Using Twitch CLI
```bash
# Install Twitch CLI
# Visit: https://dev.twitch.tv/docs/cli

# Generate token with required scope
twitch token -u -s "channel:read:redemptions"
```

#### Option C: Manual Token Generation
1. Go to [Twitch Token Generator](https://twitchtokengenerator.com/)
2. Select `channel:read:redemptions` scope
3. Generate and copy the token

### 3. Get Your Broadcaster User ID

#### Option A: Using the OAuth Server
If you used the OAuth web server from the token generation step (Option A in step 2), your broadcaster ID will be displayed automatically.

#### Option B: Using Twitch CLI
```bash
twitch api get users -q login=YOUR_USERNAME
```

#### Option C: Online Tool
Visit [StreamWeasels Username to User ID Converter](https://www.streamweasels.com/tools/convert-twitch-username-to-user-id/)

### 4. Configure Environment Variables

1. Copy the example configuration file:
   ```bash
   cp config.example.json config.json
   ```

2. Edit `config.json` and fill in your credentials:
   ```json
   {
     "TWITCH_CLIENT_ID": "your_client_id_here",
     "TWITCH_ACCESS_TOKEN": "your_access_token_here",
     "TWITCH_BROADCASTER_ID": "your_broadcaster_id_here",
     "TWITCH_CLIENT_SECRET": "your_client_secret_here",
     "REDIRECT_URI": "http://localhost:3000/callback",
     "PORT": 3000
   }
   ```

**Note:** If you used the OAuth web server (Option A in step 2), you'll already have these values!

#### Configuration Location

For the desktop GUI, configuration is stored in:
- **Windows**: `%APPDATA%/twitch-channel-points-redemption/config.json`
- **macOS**: `~/Library/Application Support/twitch-channel-points-redemption/config.json`
- **Development**: `<project-root>/config.json`

---

## Usage

### Desktop GUI

#### Starting Monitoring

1. Launch the application
2. From the dashboard, click **"Start Monitoring"**
3. The application will connect to Twitch EventSub
4. Events will appear in real-time as they occur
5. View event details, timestamps, and data

#### Viewing Events

The dashboard displays:
- **Event type** (e.g., channel.channel_points_custom_reward.add)
- **Timestamp** of when the event occurred
- **Event data** in a formatted view
- **Event count** and uptime statistics

#### Managing Settings

Click the **gear icon** in the top-right to:
- Update your Twitch credentials
- Refresh your OAuth token
- Change server port settings
- View application information

#### Stopping Monitoring

Click **"Stop Monitoring"** to:
- Disconnect from EventSub
- Stop receiving events
- Preserve event history (until cleared)

#### Testing Events

To test that monitoring works:
1. Start monitoring
2. Go to your Twitch dashboard
3. Create a new channel points custom reward
4. The event should appear immediately in the app!

### CLI Mode

#### Validate Your Configuration (Recommended)

Before running the application, validate your access token and configuration:

```bash
npm run validate
```

This will check:
- Token validity and expiration
- Required scope (`channel:read:redemptions`)
- Token ownership (must match the broadcaster ID)

#### Run the Application

```bash
npm start
```

The client will:
1. Connect to Twitch EventSub WebSocket
2. Receive a welcome message with session ID
3. Subscribe to channel points redemption update events
4. Listen for and display redemption events in real-time

#### Expected Output

```
Starting Twitch EventSub WebSocket Client...
Broadcaster ID: 123456789
────────────────────────────────────────────────────────────
Connecting to wss://eventsub.wss.twitch.tv/ws...
WebSocket connection established

[2025-11-17T12:00:00.000Z] Message Type: session_welcome
Session ID: AQoQILE...
Keepalive timeout: 10s

Subscribing to channel.channel_points_custom_reward.add...
Subscription successful!
Subscription ID: 01234567-89ab-cdef-0123-456789abcdef
Status: enabled

Waiting for custom reward creation events...
```

When a custom reward is created:

```
🎁 CUSTOM REWARD CREATED EVENT RECEIVED!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Reward Title: Highlight My Message
Cost: 300 points
Reward ID: 01234567-89ab-cdef-0123-456789abcdef
Broadcaster: broadcaster_name (broadcaster_login)
Enabled: true
User Input Required: true
Prompt: Enter your message to be highlighted
Background Color: #9147FF
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

#### OAuth Server (Optional)

If you need to generate or refresh your access token, use the built-in OAuth server:

```bash
npm run oauth
```

This will:
1. Start a web server on `http://localhost:3000`
2. Provide a user-friendly interface to connect with Twitch
3. Handle the complete OAuth authorization flow
4. Display your access token and broadcaster ID
5. Provide instructions for adding the token to your configuration file

**Important:** Make sure to add `http://localhost:3000/callback` as an OAuth Redirect URL in your Twitch application settings.

#### Stopping the Client

Press `Ctrl+C` to gracefully shutdown the client.

---

## Project Structure

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
├── package.json             # Project configuration
├── CONTRIBUTING.md          # Contribution guidelines
├── CHANGELOG.md             # Version history
└── README.md               # This file
```

---

## Architecture

### Electron Architecture (Desktop GUI)

The desktop application uses Electron's multi-process architecture:

**Main Process** (`electron/main.js`):
- Manages application lifecycle
- Creates and manages windows
- Handles IPC communication
- Manages EventSub and OAuth processes
- Stores configuration securely

**Renderer Process** (`gui/`):
- Renders the user interface
- Handles user interactions
- Communicates with main process via IPC
- Updates UI based on events

**Preload Script** (`electron/preload.js`):
- Exposes safe IPC methods to renderer
- Provides security through context isolation
- Bridges main and renderer processes

### Communication Flow

```
User Action (Renderer)
    ↓
IPC Call (Preload)
    ↓
Handler (Main Process)
    ↓
Execute Action (Node.js/System)
    ↓
Response (Main Process)
    ↓
IPC Response (Preload)
    ↓
Update UI (Renderer)
```

### EventSub Integration

1. **Configuration Loading**: Main process reads `config.json` file
2. **Process Forking**: EventSub client runs in child process
3. **Event Streaming**: Events piped to main process via stdout
4. **Event Broadcasting**: Main process sends events to renderer
5. **UI Update**: Renderer displays events in real-time

### Event Triggers

The `channel.channel_points_custom_reward.add` event is triggered when:
- A new custom channel points reward is created in the channel
- This happens when the broadcaster creates a reward through the Twitch dashboard or API

### Technical Details

#### Message Types

- **session_welcome**: Initial message containing session ID
- **session_keepalive**: Periodic heartbeat to keep connection alive
- **notification**: Contains event data when a redemption occurs
- **session_reconnect**: Server requesting client to reconnect to new URL
- **revocation**: Subscription has been cancelled

#### Connection Limits

- Maximum 3 WebSocket connections per user access token
- Up to 300 enabled subscriptions per connection
- Combined subscription cost limit of 10

---

## Troubleshooting

### Desktop GUI Issues

#### Application won't start
- **Check Node.js version**: Must be 14 or higher
- **Verify installation**: Reinstall from the latest release
- **Check logs**: Look in `%APPDATA%/twitch-channel-points-redemption/logs/` (Windows) or `~/Library/Application Support/twitch-channel-points-redemption/logs/` (macOS)

#### OAuth flow fails
- **Check firewall**: Ensure port 3000 is not blocked
- **Verify redirect URI**: Must be exactly `http://localhost:3000/callback` in your Twitch application settings
- **Clear browser cache**: Sometimes helps with OAuth issues
- **Check credentials**: Verify Client ID and Secret are correct
- **Try refreshing OAuth**: Use Settings → Refresh OAuth

#### Events not appearing
- **Verify token**: Use Settings → Refresh OAuth
- **Check scopes**: Token must have `channel:read:redemptions` scope
- **Confirm broadcaster ID**: Must match the token owner
- **Test connection**: Stop and restart monitoring

#### Configuration issues
- **Reset config**: Delete the `config.json` file and run the wizard again
- **Check permissions**: Ensure write access to config directory
- **Validate manually**: Use `npm run validate` from the command line

### CLI Mode Issues

#### "Missing required configuration"
Ensure your `config.json` file exists and contains all required variables.

#### "Failed to subscribe to event: 401"
Your access token is invalid or expired. Generate a new token with the `channel:read:redemptions` scope.

#### "Failed to subscribe to event: 403" (subscription missing proper authorization)
This is the most common error. Run `npm run validate` to diagnose the issue. Common causes:

1. **Token doesn't have required scope**
   - The token MUST have `channel:read:redemptions` scope
   - Generate a new token with: `twitch token -u -s channel:read:redemptions`

2. **Token belongs to wrong account**
   - The access token MUST be generated by the broadcaster account
   - `TWITCH_BROADCASTER_ID` must match the user ID of the token owner
   - Solution: Generate a new token while logged in as the broadcaster

3. **Incorrect broadcaster ID**
   - Verify the broadcaster ID matches the token owner's user ID
   - Use `twitch api get users -q login=YOUR_USERNAME` to check

**Quick Fix:**
```bash
# 1. Run validation to see the exact issue
npm run validate

# 2. If token belongs to wrong user, either:
#    a) Generate new token as broadcaster, OR
#    b) Update TWITCH_BROADCASTER_ID to match the token owner's ID
```

#### "Connection closed unexpectedly"
- Check your internet connection
- Ensure you subscribed to an event within 10 seconds of receiving the welcome message
- The client will attempt to reconnect if a reconnect URL is provided

---

## Building & Distribution

### Quick Build Commands

```bash
# Build for both Windows and macOS
npm run build

# Build Windows installer only
npm run build:win

# Build macOS installer only
npm run build:mac

# Build unpacked directory (for testing)
npm run build:dir
```

### Prerequisites for Building

1. Node.js 14 or higher
2. electron-builder (installed via `npm install`)
3. (Optional) Custom icons in `build/` directory:
   - `icon.ico` (256x256 for Windows)
   - `icon.icns` (512x512+ for macOS)
   - `icon.png` (512x512 for the app window)

See `build/ICONS_README.txt` for icon creation instructions.

---

## Development

### Available Scripts

- `npm start` - Run the CLI application
- `npm run validate` - Validate your Twitch access token
- `npm run oauth` - Start the OAuth server for token generation
- `npm run gui` - Run the GUI in production mode
- `npm run gui:dev` - Run the GUI in development mode (with DevTools)
- `npm run build` - Build installers for both Windows and macOS
- `npm run build:win` - Build Windows installer only
- `npm run build:mac` - Build macOS installer only
- `npm run build:dir` - Build unpacked directory (for testing)
- `npm run dist` - Build for all configured platforms

### Development Mode

In development mode (`npm run gui:dev`), you get:
- **Automatic DevTools** for debugging
- **Hot reload** for quick iteration (manual restart required for main process changes)
- **Detailed logging** in the console

### Development Guidelines

- Follow existing code style
- Test thoroughly before submitting
- Update documentation for new features
- Keep commits focused and well-described

---

## Roadmap

### Planned Features

- [ ] System tray integration
- [ ] Event export (CSV, JSON)
- [ ] Event filtering and search
- [ ] Custom event notifications
- [ ] Multiple channel monitoring
- [ ] Event statistics and analytics
- [ ] Dark/Light theme toggle
- [ ] Auto-update functionality
- [ ] Linux support

---

## Contributing

We welcome contributions! Please see **[CONTRIBUTING.md](CONTRIBUTING.md)** for detailed guidelines on how to contribute to this project.

### Ways to Contribute

1. **Report Bugs** - Open an issue with details and steps to reproduce
2. **Suggest Features** - Describe the feature and use case
3. **Submit Pull Requests** - Fork, create a branch, make changes, and submit
4. **Improve Documentation** - Help make documentation clearer and more comprehensive

---

## License & Credits

### License

This project is licensed under the **MIT License**. See the [LICENSE](LICENSE) file for details.

### Credits

- Built with [Electron](https://www.electronjs.org/)
- Uses [Twitch EventSub](https://dev.twitch.tv/docs/eventsub) for real-time events
- Twitch branding and assets belong to Twitch Interactive, Inc.

### Support

- **Documentation**: This README
- **Issues**: [GitHub Issues](https://github.com/hydai/tcpr/issues)
- **Discussions**: [GitHub Discussions](https://github.com/hydai/tcpr/discussions)

### References

- [Twitch EventSub WebSocket Documentation](https://dev.twitch.tv/docs/eventsub/handling-websocket-events/)
- [Channel Points Custom Reward Add Subscription](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types#channelchannel_points_custom_rewardadd)
- [EventSub Reference](https://dev.twitch.tv/docs/eventsub/eventsub-reference/)

---

**Made with ❤️ for the Twitch community**
