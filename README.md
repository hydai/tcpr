# Twitch Channel Points Custom Reward WebSocket Client

A Node.js WebSocket client that subscribes to Twitch EventSub custom reward creation events in real-time.

## 🖥️ Desktop GUI Available!

**New!** We now offer a beautiful, user-friendly desktop application for Windows and macOS with:
- 🧙‍♂️ **Step-by-step setup wizard** - no technical knowledge required
- 🔐 **Automated OAuth flow** - secure authentication made easy
- 📊 **Real-time dashboard** - monitor events with a clean interface
- ⚙️ **Settings management** - easily update your configuration

**[📖 Read the GUI Documentation](GUI_README.md)** | **[⬇️ Download GUI Release](#)**

### Quick Start with GUI

```bash
# Install dependencies
npm install

# Launch the desktop application
npm run gui
```

The GUI will guide you through the entire setup process automatically!

---

## Features (CLI Mode)

- Connects to Twitch EventSub WebSocket
- Subscribes to `channel.channel_points_custom_reward.add` events
- Handles all EventSub message types (welcome, keepalive, notification, reconnect, revocation)
- Automatic reconnection support
- Real-time monitoring of custom reward creation

## Prerequisites

1. A Twitch account
2. A registered Twitch application
3. Node.js (version 14 or higher)

## Setup

### 1. Register a Twitch Application

1. Go to [Twitch Developer Console](https://dev.twitch.tv/console/apps)
2. Click "Register Your Application"
3. Fill in the required information:
   - Name: Choose any name for your application
   - OAuth Redirect URLs: `http://localhost:3000/callback` (required for OAuth flow)
   - Category: Choose appropriate category
4. Click "Create"
5. Copy your **Client ID** and **Client Secret**

### 2. Generate an Access Token

You need a **User Access Token** with the `channel:read:redemptions` scope.

**Option A: Using OAuth Web Server (Recommended)**

This repository includes a built-in OAuth server that makes it easy to generate access tokens:

```bash
# 1. Install dependencies
npm install

# 2. Configure your application credentials
cp config.example.json config.json
# Edit config.json and add your TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET
# (Alternatively, you can use .env file: cp .env.example .env)

# 3. Start the OAuth server
npm run oauth

# 4. Open your browser and navigate to http://localhost:3000
# 5. Click "Connect with Twitch"
# 6. Authorize the application
# 7. Copy the access token displayed on the success page
# 8. Add it to your config.json file as TWITCH_ACCESS_TOKEN
```

The OAuth server will also display your broadcaster user ID, which you'll need for the next step.

**Option B: Using Twitch CLI**
```bash
# Install Twitch CLI
# Visit: https://dev.twitch.tv/docs/cli

# Generate token with required scope
twitch token -u -s "channel:read:redemptions"
```

**Option C: Manual Token Generation**
1. Go to [Twitch Token Generator](https://twitchtokengenerator.com/)
2. Select `channel:read:redemptions` scope
3. Generate and copy the token

### 3. Get Your Broadcaster User ID

**Option A: Using Twitch CLI**
```bash
twitch api get users -q login=YOUR_USERNAME
```

**Option B: Online Tool**
Visit [StreamWeasels Username to User ID Converter](https://www.streamweasels.com/tools/convert-twitch-username-to-user-id/)

### 4. Configure Environment Variables

You can use either a visible `config.json` file (recommended) or the traditional `.env` file:

**Option A: config.json (Recommended - Visible file)**

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

**Option B: .env (Traditional - Hidden file)**

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and fill in your credentials:
   ```env
   # Required for main application
   TWITCH_CLIENT_ID=your_client_id_here
   TWITCH_ACCESS_TOKEN=your_access_token_here
   TWITCH_BROADCASTER_ID=your_broadcaster_id_here

   # Required only for OAuth server (npm run oauth)
   TWITCH_CLIENT_SECRET=your_client_secret_here
   REDIRECT_URI=http://localhost:3000/callback
   PORT=3000
   ```

   **Note:** If you used the OAuth web server (Option A in step 2), you'll already have these values!

### 5. Install Dependencies

```bash
npm install
```

## Usage

### OAuth Server (Optional)

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

### Validate Your Configuration (Recommended)

Before running the application, validate your access token and configuration:

```bash
npm run validate
```

This will check:
- Token validity and expiration
- Required scope (`channel:read:redemptions`)
- Token ownership (must match the broadcaster ID)

### Run the Application

```bash
npm start
```

The client will:
1. Connect to Twitch EventSub WebSocket
2. Receive a welcome message with session ID
3. Subscribe to channel points redemption update events
4. Listen for and display redemption events in real-time

### Expected Output

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

## Event Triggers

The `channel.channel_points_custom_reward.add` event is triggered when:

- A new custom channel points reward is created in the channel
- This happens when the broadcaster creates a reward through the Twitch dashboard or API

## Stopping the Client

Press `Ctrl+C` to gracefully shutdown the client.

## Troubleshooting

### "Missing required environment variables"
Ensure your `.env` file exists and contains all three required variables.

### "Failed to subscribe to event: 401"
Your access token is invalid or expired. Generate a new token with the `channel:read:redemptions` scope.

### "Failed to subscribe to event: 403" (subscription missing proper authorization)
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

### "Connection closed unexpectedly"
- Check your internet connection
- Ensure you subscribed to an event within 10 seconds of receiving the welcome message
- The client will attempt to reconnect if a reconnect URL is provided

## Technical Details

### Message Types

- **session_welcome**: Initial message containing session ID
- **session_keepalive**: Periodic heartbeat to keep connection alive
- **notification**: Contains event data when a redemption occurs
- **session_reconnect**: Server requesting client to reconnect to new URL
- **revocation**: Subscription has been cancelled

### Connection Limits

- Maximum 3 WebSocket connections per user access token
- Up to 300 enabled subscriptions per connection
- Combined subscription cost limit of 10

## References

- [Twitch EventSub WebSocket Documentation](https://dev.twitch.tv/docs/eventsub/handling-websocket-events/)
- [Channel Points Custom Reward Add Subscription](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types#channelchannel_points_custom_rewardadd)
- [EventSub Reference](https://dev.twitch.tv/docs/eventsub/eventsub-reference/)

## License

MIT
