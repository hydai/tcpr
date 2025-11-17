# Quick Start Guide - Desktop GUI

Get started with the Twitch Channel Points Monitor desktop application in 5 minutes!

## Installation

### Option 1: Download Installer (Easiest)

1. Download the latest release from [GitHub Releases](#)
2. Run `Twitch Channel Points Monitor Setup.exe`
3. Follow the installation wizard
4. Launch from Start Menu

### Option 2: Run from Source

```bash
# Clone the repository
git clone https://github.com/hydai/tcpr.git
cd tcpr

# Install dependencies
npm install

# Launch the GUI
npm run gui
```

## First-Time Setup

### 1. Welcome Screen
When you first launch the app, you'll see a welcome screen explaining the features. Click **"Get Started"** to begin.

### 2. Create Twitch Application

The wizard will guide you through creating a Twitch application:

1. Click the link to open the [Twitch Developer Console](https://dev.twitch.tv/console/apps)
2. Click **"Register Your Application"**
3. Fill in the details:
   - **Name**: `My Channel Points Monitor` (or any name you like)
   - **OAuth Redirect URLs**: `http://localhost:3000/callback`
   - **Category**: Application Integration
4. Click **"Create"**
5. Click **"Manage"** on your new application
6. Copy your **Client ID**
7. Click **"New Secret"** to generate a **Client Secret** and copy it

### 3. Enter Credentials

Back in the desktop app:
1. Paste your **Client ID**
2. Paste your **Client Secret**
3. Click **"Continue"**

### 4. Authenticate with Twitch

1. Click **"Authenticate with Twitch"**
2. Your browser will open automatically
3. Click **"Authorize"** to allow the application access
4. Return to the desktop app
5. Your access token will be saved automatically!

### 5. Review & Save

1. Review your configuration
2. Click **"Save & Continue"**

### 6. Validation

The app will automatically validate your token and permissions. This takes just a few seconds.

### 7. Complete!

You're all set! Click **"Go to Dashboard"** to start monitoring.

## Using the Dashboard

### Start Monitoring

1. Click the **"Start Monitoring"** button
2. The status will change to **"Active"**
3. Events will appear in real-time as they occur

### View Events

Events are displayed in a scrollable list showing:
- Event type and icon
- Timestamp
- Event data and details

### Stop Monitoring

Click **"Stop Monitoring"** to disconnect from Twitch EventSub.

### Clear Events

Click **"Clear"** to remove all events from the display.

## Managing Settings

Click the **⚙️ gear icon** in the top-right corner to access settings:

### Update Credentials

You can change:
- Client ID
- Client Secret
- Access Token
- Broadcaster ID
- Redirect URI
- Server Port

### Refresh OAuth

Click **"Refresh OAuth"** to start a new authentication flow if your token expires.

### View App Info

See:
- Application version
- Configuration file location
- Project repository link

## Troubleshooting

### Application won't start
**Solution**: Make sure you have Node.js 14+ installed

### OAuth fails
**Solution**:
- Check that port 3000 is not in use
- Verify your redirect URI is exactly `http://localhost:3000/callback`
- Try refreshing OAuth from Settings

### No events appearing
**Solution**:
- Stop and restart monitoring
- Verify your token has the correct scopes
- Check that your broadcaster ID matches the token owner

### Events log is slow
**Solution**: Click "Clear" to remove old events

## Tips & Tricks

### Keeping the App Running
The application will stay open as long as the window is open. Minimize it to keep monitoring in the background.

### Configuration Location
Your settings are saved in:
- Windows: `%APPDATA%/twitch-channel-points-redemption/.env`

### Event History
Events are kept in memory while the app is running. They'll be cleared when you restart the app or click "Clear".

### Testing Events
To test that monitoring works:
1. Start monitoring
2. Go to your Twitch dashboard
3. Create a new channel points custom reward
4. The event should appear immediately in the app!

## Getting Help

- **Documentation**: [GUI_README.md](GUI_README.md)
- **Issues**: [GitHub Issues](https://github.com/hydai/tcpr/issues)
- **Main README**: [README.md](README.md)

## Next Steps

Now that you're set up:
- Experiment with the dashboard
- Try creating custom rewards on Twitch
- Explore the settings panel
- Consider building from source to contribute!

---

**Happy Monitoring! 🎉**
