import WebSocket from 'ws';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const TWITCH_EVENTSUB_WS_URL = 'wss://eventsub.wss.twitch.tv/ws';
const TWITCH_API_URL = 'https://api.twitch.tv/helix';

class TwitchEventSubClient {
  constructor(clientId, accessToken, broadcasterId) {
    this.clientId = clientId;
    this.accessToken = accessToken;
    this.broadcasterId = broadcasterId;
    this.ws = null;
    this.sessionId = null;
    this.reconnectUrl = null;
  }

  connect() {
    const url = this.reconnectUrl || TWITCH_EVENTSUB_WS_URL;
    console.log(`Connecting to ${url}...`);

    this.ws = new WebSocket(url);

    this.ws.on('open', () => {
      console.log('WebSocket connection established');
    });

    this.ws.on('message', (data) => {
      this.handleMessage(JSON.parse(data.toString()));
    });

    this.ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });

    this.ws.on('close', () => {
      console.log('WebSocket connection closed');
      // Attempt to reconnect if we have a reconnect URL
      if (this.reconnectUrl) {
        console.log('Reconnecting to new session...');
        this.connect();
      } else {
        console.log('Connection closed. Exiting...');
      }
    });
  }

  handleMessage(message) {
    const { metadata, payload } = message;

    console.log(`\n[${new Date().toISOString()}] Message Type: ${metadata.message_type}`);

    switch (metadata.message_type) {
      case 'session_welcome':
        this.handleWelcome(payload);
        break;

      case 'session_keepalive':
        console.log('Keepalive received');
        break;

      case 'notification':
        this.handleNotification(payload);
        break;

      case 'session_reconnect':
        this.handleReconnect(payload);
        break;

      case 'revocation':
        this.handleRevocation(payload);
        break;

      default:
        console.log('Unknown message type:', metadata.message_type);
        console.log('Payload:', JSON.stringify(payload, null, 2));
    }
  }

  async handleWelcome(payload) {
    this.sessionId = payload.session.id;
    console.log(`Session ID: ${this.sessionId}`);
    console.log(`Keepalive timeout: ${payload.session.keepalive_timeout_seconds}s`);

    // Subscribe to channel points redemption update event
    await this.subscribeToEvent();
  }

  async subscribeToEvent() {
    console.log('\nSubscribing to channel.channel_points_custom_reward_redemption.update...');

    const subscriptionData = {
      type: 'channel.channel_points_custom_reward_redemption.update',
      version: '1',
      condition: {
        broadcaster_user_id: this.broadcasterId
      },
      transport: {
        method: 'websocket',
        session_id: this.sessionId
      }
    };

    try {
      const response = await axios.post(
        `${TWITCH_API_URL}/eventsub/subscriptions`,
        subscriptionData,
        {
          headers: {
            'Client-ID': this.clientId,
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('Subscription successful!');
      console.log('Subscription ID:', response.data.data[0].id);
      console.log('Status:', response.data.data[0].status);
      console.log('\nWaiting for channel points redemption events...\n');
    } catch (error) {
      console.error('Failed to subscribe to event:');
      if (error.response) {
        console.error('Status:', error.response.status);
        console.error('Error:', JSON.stringify(error.response.data, null, 2));
      } else {
        console.error(error.message);
      }
      process.exit(1);
    }
  }

  handleNotification(payload) {
    console.log('\n🎉 CHANNEL POINTS REDEMPTION EVENT RECEIVED!');
    console.log('━'.repeat(60));

    const event = payload.event;

    console.log(`Reward: ${event.reward.title}`);
    console.log(`Cost: ${event.reward.cost} points`);
    console.log(`Redeemed by: ${event.user_name} (${event.user_login})`);
    console.log(`Status: ${event.status}`);
    console.log(`Redemption ID: ${event.id}`);
    console.log(`Timestamp: ${event.redeemed_at}`);

    if (event.user_input) {
      console.log(`User Input: ${event.user_input}`);
    }

    console.log('━'.repeat(60));
    console.log('\nFull event data:');
    console.log(JSON.stringify(event, null, 2));
    console.log('\n');
  }

  handleReconnect(payload) {
    console.log('Reconnect requested');
    this.reconnectUrl = payload.session.reconnect_url;
    console.log(`New reconnect URL: ${this.reconnectUrl}`);

    // Close current connection and reconnect
    this.ws.close();
  }

  handleRevocation(payload) {
    console.log('Subscription revoked:');
    console.log('Subscription type:', payload.subscription.type);
    console.log('Reason:', payload.subscription.status);
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

// Main execution
async function main() {
  const clientId = process.env.TWITCH_CLIENT_ID;
  const accessToken = process.env.TWITCH_ACCESS_TOKEN;
  const broadcasterId = process.env.TWITCH_BROADCASTER_ID;

  // Validate environment variables
  if (!clientId || !accessToken || !broadcasterId) {
    console.error('Error: Missing required environment variables');
    console.error('Please ensure the following are set in your .env file:');
    console.error('  - TWITCH_CLIENT_ID');
    console.error('  - TWITCH_ACCESS_TOKEN');
    console.error('  - TWITCH_BROADCASTER_ID');
    process.exit(1);
  }

  console.log('Starting Twitch EventSub WebSocket Client...');
  console.log(`Broadcaster ID: ${broadcasterId}`);
  console.log('─'.repeat(60));

  const client = new TwitchEventSubClient(clientId, accessToken, broadcasterId);
  client.connect();

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\nShutting down...');
    client.disconnect();
    process.exit(0);
  });
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
