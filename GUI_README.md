# Twitch Channel Points Monitor - Desktop GUI

A beautiful, user-friendly desktop application for Windows and macOS for monitoring Twitch channel points custom reward events in real-time.

## Features

### 🎯 Intuitive Setup Wizard
- **Step-by-step tutorial** guides you through the entire setup process
- **Automated OAuth flow** - no manual token copying required
- **Configuration validation** ensures everything is set up correctly
- **First-run detection** automatically launches the wizard for new users

### 💻 Modern Desktop Experience
- **Native desktop application** built with Electron for Windows and macOS
- **Clean, dark-themed interface** matching Twitch's branding
- **Real-time event monitoring** with live dashboard
- **System tray integration** (coming soon)

### 🔐 Secure Configuration Management
- **Encrypted storage** of sensitive credentials
- **OAuth 2.0 authentication** with Twitch
- **Built-in token validation** before monitoring starts
- **Easy credential management** through settings panel

### 📊 Event Monitoring Dashboard
- **Live event feed** showing channel points activities
- **Event count tracking** and uptime monitoring
- **Filterable event log** with timestamps
- **Export capabilities** (coming soon)

## Installation

### Option 1: Download Pre-built Package (Recommended)

**For Windows:**
1. Go to the [Releases](https://github.com/hydai/tcpr/releases) page
2. Download the latest `.exe` installer for Windows
3. Run the installer and follow the prompts
4. Launch "Twitch Channel Points Monitor" from your Start Menu

**For macOS:**
1. Go to the [Releases](https://github.com/hydai/tcpr/releases) page
2. Download the latest `.dmg` file for macOS
3. Open the DMG and drag the app to your Applications folder
4. Launch "Twitch Channel Points Monitor" from Applications (you may need to right-click and select "Open" on first launch)

### Option 2: Build from Source

#### Prerequisites
- Node.js 14 or higher
- npm or yarn
- Git

#### Steps

1. **Clone the repository**
   ```bash
   git clone https://github.com/hydai/tcpr.git
   cd tcpr
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Run the GUI in development mode**
   ```bash
   npm run gui:dev
   ```

4. **Build for your platform**
   ```bash
   # Build for both Windows and macOS
   npm run build

   # Or build for specific platform
   npm run build:win   # Windows only
   npm run build:mac   # macOS only
   ```

   The installer will be created in the `dist/` directory.

## First-Time Setup

When you launch the application for the first time, you'll be guided through a comprehensive setup wizard:

### Step 1: Welcome Screen
- Overview of features and capabilities
- Introduction to the setup process

### Step 2: Create Twitch Application
The wizard will guide you to:
1. Visit the [Twitch Developer Console](https://dev.twitch.tv/console/apps)
2. Register a new application
3. Set the OAuth redirect URL to `http://localhost:3000/callback`
4. Copy your Client ID and Client Secret

### Step 3: OAuth Authentication
- Click "Authenticate with Twitch"
- Your browser will open automatically
- Authorize the application
- Return to the desktop app (token is saved automatically)

### Step 4: Review Configuration
- Verify all your settings
- Review scopes and permissions
- Confirm broadcaster ID

### Step 5: Validation
- Automatic token validation
- Scope verification
- Permission checks

### Step 6: Complete!
- You're ready to start monitoring
- Access the dashboard to begin

## Using the Application

### Starting Monitoring

1. From the dashboard, click **"Start Monitoring"**
2. The application will connect to Twitch EventSub
3. Events will appear in real-time as they occur
4. View event details, timestamps, and data

### Viewing Events

The dashboard displays:
- **Event type** (e.g., channel.channel_points_custom_reward.add)
- **Timestamp** of when the event occurred
- **Event data** in a formatted view
- **Event count** and uptime statistics

### Managing Settings

Click the **gear icon** in the top-right to:
- Update your Twitch credentials
- Refresh your OAuth token
- Change server port settings
- View application information

### Stopping Monitoring

Click **"Stop Monitoring"** to:
- Disconnect from EventSub
- Stop receiving events
- Preserve event history (until cleared)

## Project Structure

```
tcpr/
├── electron/                 # Electron main process
│   ├── main.js              # Main Electron entry point
│   ├── preload.js           # Secure IPC bridge
│   └── oauth-server-electron.js  # OAuth server for Electron
├── gui/                     # GUI renderer process
│   ├── index.html           # Main application UI
│   ├── css/
│   │   └── styles.css       # Application styles
│   └── js/
│       └── app.js           # Application logic
├── client/                  # EventSub client modules
├── config/                  # Configuration management
├── lib/                     # Utility libraries
├── public/                  # Static assets
├── build/                   # Build resources (icons, etc.)
├── package.json             # Project configuration
└── GUI_README.md           # This file
```

## Development

### Available Scripts

- `npm run gui` - Run the GUI in production mode
- `npm run gui:dev` - Run the GUI in development mode (with DevTools)
- `npm run build` - Build installers for both Windows and macOS
- `npm run build:win` - Build Windows installer only
- `npm run build:mac` - Build macOS installer only
- `npm run build:dir` - Build unpacked directory (for testing)
- `npm run dist` - Build for all configured platforms

### Development Mode

In development mode, you get:
- **Automatic DevTools** for debugging
- **Hot reload** for quick iteration (manual restart required for main process changes)
- **Detailed logging** in the console

### Adding Custom Icons

1. Create or obtain icon files:
   - `icon.ico` (256x256 for Windows)
   - `icon.icns` (512x512+ for macOS)
   - `icon.png` (512x512 for the app window)

2. Place them in the `build/` directory

3. Rebuild the application:
   ```bash
   npm run build
   ```

See `build/ICONS_README.txt` for more details and platform-specific icon creation instructions.

## Configuration Files

### Configuration Location

The application supports both `config.json` (visible) and `.env` (hidden) configuration files:

- **Windows**: `%APPDATA%/twitch-channel-points-redemption/` (config.json or .env)
- **macOS**: `~/Library/Application Support/twitch-channel-points-redemption/` (config.json or .env)
- **Development**: `<project-root>/` (config.json or .env)

### Configuration Format

**Option 1: config.json (Recommended - Visible file)**
```json
{
  "TWITCH_CLIENT_ID": "your_client_id_here",
  "TWITCH_CLIENT_SECRET": "your_client_secret_here",
  "TWITCH_ACCESS_TOKEN": "your_access_token_here",
  "TWITCH_BROADCASTER_ID": "your_broadcaster_id_here",
  "REDIRECT_URI": "http://localhost:3000/callback",
  "PORT": 3000
}
```

**Option 2: .env (Traditional - Hidden file)**
```env
TWITCH_CLIENT_ID=your_client_id_here
TWITCH_CLIENT_SECRET=your_client_secret_here
TWITCH_ACCESS_TOKEN=your_access_token_here
TWITCH_BROADCASTER_ID=your_broadcaster_id_here
REDIRECT_URI=http://localhost:3000/callback
PORT=3000
```

### Security Notes

- Never commit your `config.json` or `.env` files to version control
- The GUI stores credentials in your user data directory
- Credentials are only accessible to your user account
- Use the built-in OAuth flow to generate tokens securely

## Troubleshooting

### Application won't start
- **Check Node.js version**: Must be 14 or higher
- **Verify installation**: Reinstall from the latest release
- **Check logs**: Look in `%APPDATA%/twitch-channel-points-redemption/logs/`

### OAuth flow fails
- **Check firewall**: Ensure port 3000 is not blocked
- **Verify redirect URI**: Must be `http://localhost:3000/callback`
- **Clear browser cache**: Sometimes helps with OAuth issues
- **Check credentials**: Verify Client ID and Secret are correct

### Events not appearing
- **Verify token**: Use Settings → Refresh OAuth
- **Check scopes**: Token must have `channel:read:redemptions`
- **Confirm broadcaster ID**: Must match the token owner
- **Test connection**: Stop and restart monitoring

### Configuration issues
- **Reset config**: Delete the `config.json` (or `.env`) file and run the wizard again
- **Check permissions**: Ensure write access to config directory
- **Validate manually**: Use `npm run validate` from the command line

## Building for Distribution

### Prerequisites for Building

1. **Install build tools**:
   ```bash
   npm install --save-dev electron-builder
   ```

2. **Prepare icons** (optional but recommended):
   - Add `icon.ico` to `build/` directory for Windows (256x256 or larger)
   - Add `icon.icns` to `build/` directory for macOS (512x512 or larger)

3. **Update version** in `package.json`

### Build Commands

**Windows Installer (NSIS)**:
```bash
npm run build:win
```
Creates: `dist/Twitch Channel Points Monitor Setup X.X.X.exe`

**macOS Installer (DMG)**:
```bash
npm run build:mac
```
Creates: `dist/Twitch Channel Points Monitor-X.X.X.dmg` and `dist/Twitch Channel Points Monitor-X.X.X-mac.zip`

**Both Platforms**:
```bash
npm run build
```
Creates installers for both Windows and macOS

**Test Build (unpacked)**:
```bash
npm run build:dir
```
Creates: `dist/win-unpacked/` and `dist/mac/` (for testing without installation)

### Distribution Checklist

- [ ] Update version in `package.json`
- [ ] Test application thoroughly
- [ ] Create icons for Windows (.ico) and macOS (.icns)
- [ ] Build for Windows
- [ ] Build for macOS
- [ ] Test Windows installer
- [ ] Test Windows portable version
- [ ] Test macOS DMG installer
- [ ] Create release notes
- [ ] Upload to GitHub Releases

## Architecture

### Electron Architecture

The application uses Electron's multi-process architecture:

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

1. **Configuration Loading**: Main process reads `.env` file
2. **Process Forking**: EventSub client runs in child process
3. **Event Streaming**: Events piped to main process via stdout
4. **Event Broadcasting**: Main process sends events to renderer
5. **UI Update**: Renderer displays events in real-time

## Contributing

We welcome contributions! Here's how you can help:

1. **Report Bugs**: Open an issue with details and steps to reproduce
2. **Suggest Features**: Describe the feature and use case
3. **Submit PRs**: Fork, create a branch, make changes, and submit
4. **Improve Docs**: Help make documentation clearer and more comprehensive

### Development Guidelines

- Follow existing code style
- Test thoroughly before submitting
- Update documentation for new features
- Keep commits focused and well-described

## License

MIT License - See [LICENSE](LICENSE) file for details

## Credits

- Built with [Electron](https://www.electronjs.org/)
- Uses [Twitch EventSub](https://dev.twitch.tv/docs/eventsub) for real-time events
- Twitch branding and assets belong to Twitch Interactive, Inc.

## Support

- **Documentation**: See this README and the main project README
- **Issues**: [GitHub Issues](https://github.com/hydai/tcpr/issues)
- **Discussions**: [GitHub Discussions](https://github.com/hydai/tcpr/discussions)

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

### Version History

**v1.0.0** (Current)
- Initial GUI release
- Setup wizard with tutorial
- OAuth integration
- Real-time event monitoring
- Windows and macOS desktop applications
- Cross-platform support

---

**Made with ❤️ for the Twitch community**
