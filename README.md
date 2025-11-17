# Twitch Channel Points Redemption WebSocket Client

A simple Node.js WebSocket client that subscribes to Twitch EventSub channel points redemption events in real-time.

## Features

- Connects to Twitch EventSub WebSocket
- Subscribes to `channel.channel_points_custom_reward_redemption.update` events
- Handles all EventSub message types (welcome, keepalive, notification, reconnect, revocation)
- Automatic reconnection support
- Real-time monitoring of channel points redemptions

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
   - OAuth Redirect URLs: `http://localhost:3000` (or any URL)
   - Category: Choose appropriate category
4. Click "Create"
5. Copy your **Client ID**

### 2. Generate an Access Token

You need a **User Access Token** with the `channel:read:redemptions` scope.

**Option A: Using Twitch CLI (Recommended)**
```bash
# Install Twitch CLI
# Visit: https://dev.twitch.tv/docs/cli

# Generate token
twitch token -u -s channel:read:redemptions
```

**Option B: Manual Token Generation**
1. Go to [Twitch Token Generator](https://twitchtokengenerator.com/)
2. Select `channel:read:redemptions` scope
3. Generate and copy the token

**Option C: OAuth Flow**
Construct this URL (replace `YOUR_CLIENT_ID`):
```
https://id.twitch.tv/oauth2/authorize?client_id=YOUR_CLIENT_ID&redirect_uri=http://localhost:3000&response_type=token&scope=channel:read:redemptions
```

### 3. Get Your Broadcaster User ID

**Option A: Using Twitch CLI**
```bash
twitch api get users -q login=YOUR_USERNAME
```

**Option B: Online Tool**
Visit [StreamWeasels Username to User ID Converter](https://www.streamweasels.com/tools/convert-twitch-username-to-user-id/)

### 4. Configure Environment Variables

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and fill in your credentials:
   ```env
   TWITCH_CLIENT_ID=your_client_id_here
   TWITCH_ACCESS_TOKEN=your_access_token_here
   TWITCH_BROADCASTER_ID=your_broadcaster_id_here
   ```

### 5. Install Dependencies

```bash
npm install
```

## Usage

Run the application:

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

Subscribing to channel.channel_points_custom_reward_redemption.update...
Subscription successful!
Subscription ID: 01234567-89ab-cdef-0123-456789abcdef
Status: enabled

Waiting for channel points redemption events...
```

When a channel points redemption status is updated:

```
🎉 CHANNEL POINTS REDEMPTION EVENT RECEIVED!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Reward: Highlight My Message
Cost: 300 points
Redeemed by: viewer_username (viewer_login)
Status: fulfilled
Redemption ID: 01234567-89ab-cdef-0123-456789abcdef
Timestamp: 2025-11-17T12:05:00.000Z
User Input: Hello, this is my highlighted message!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Event Triggers

The `channel.channel_points_custom_reward_redemption.update` event is triggered when:

- A redemption status changes from `unfulfilled` to `fulfilled`
- A redemption status changes from `unfulfilled` to `canceled`
- A broadcaster or moderator updates the redemption status

## Stopping the Client

Press `Ctrl+C` to gracefully shutdown the client.

## Troubleshooting

### "Missing required environment variables"
Ensure your `.env` file exists and contains all three required variables.

### "Failed to subscribe to event: 401"
Your access token is invalid or expired. Generate a new token with the `channel:read:redemptions` scope.

### "Failed to subscribe to event: 403"
- Verify the broadcaster ID is correct
- Ensure your access token has the `channel:read:redemptions` scope
- Make sure the token is authorized for the broadcaster account

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
- [Channel Points Redemption Update Subscription](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types#channelchannel_points_custom_reward_redemptionupdate)
- [EventSub Reference](https://dev.twitch.tv/docs/eventsub/eventsub-reference/)

## License

MIT
