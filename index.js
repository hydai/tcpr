import WebSocket from 'ws';
import axios from 'axios';
import dotenv from 'dotenv';
import { TWITCH_URLS, EVENT_TYPES, MESSAGE_TYPES } from './config/constants.js';
import { Config } from './config/env.js';
import { TokenValidator } from './lib/tokenValidator.js';
import { Logger } from './lib/logger.js';
import { SubscriptionError } from './lib/errors.js';

dotenv.config();

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
    const url = this.reconnectUrl || TWITCH_URLS.EVENTSUB_WS;
    Logger.info(`Connecting to ${url}...`);

    this.ws = new WebSocket(url);

    this.ws.on('open', () => {
      Logger.info('WebSocket connection established');
    });

    this.ws.on('message', (data) => {
      this.handleMessage(JSON.parse(data.toString()));
    });

    this.ws.on('error', (error) => {
      Logger.error('WebSocket error:', error);
    });

    this.ws.on('close', () => {
      Logger.info('WebSocket connection closed');
      // Attempt to reconnect if we have a reconnect URL
      if (this.reconnectUrl) {
        Logger.info('Reconnecting to new session...');
        this.connect();
      } else {
        Logger.info('Connection closed. Exiting...');
      }
    });
  }

  handleMessage(message) {
    const { metadata, payload } = message;

    Logger.eventSubMessage(metadata.message_type);

    switch (metadata.message_type) {
      case MESSAGE_TYPES.SESSION_WELCOME:
        this.handleWelcome(payload);
        break;

      case MESSAGE_TYPES.SESSION_KEEPALIVE:
        Logger.info('Keepalive received');
        break;

      case MESSAGE_TYPES.NOTIFICATION:
        this.handleNotification(payload);
        break;

      case MESSAGE_TYPES.SESSION_RECONNECT:
        this.handleReconnect(payload);
        break;

      case MESSAGE_TYPES.REVOCATION:
        this.handleRevocation(payload);
        break;

      default:
        Logger.warn('Unknown message type:', metadata.message_type);
        Logger.log('Payload: ' + JSON.stringify(payload, null, 2));
    }
  }

  async handleWelcome(payload) {
    this.sessionId = payload.session.id;
    Logger.info(`Session ID: ${this.sessionId}`);
    Logger.info(`Keepalive timeout: ${payload.session.keepalive_timeout_seconds}s`);

    // Validate token before subscribing
    const isValid = await this.validateToken();
    if (!isValid) {
      Logger.error('Token validation failed. Exiting...');
      Logger.log('💡 Run "npm run validate" for detailed diagnostics\n');
      process.exit(1);
    }

    // Subscribe to channel points custom reward add event
    await this.subscribeToEvent();
  }

  async validateToken() {
    try {
      await TokenValidator.validate(this.accessToken, this.broadcasterId);
      return true;
    } catch (error) {
      Logger.error('Token validation failed:', error);
      return false;
    }
  }

  async subscribeToEvent() {
    Logger.info('\nSubscribing to channel.channel_points_custom_reward.add...');

    const subscriptionData = {
      type: EVENT_TYPES.REWARD_ADD,
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
        `${TWITCH_URLS.API}/eventsub/subscriptions`,
        subscriptionData,
        {
          headers: {
            'Client-ID': this.clientId,
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      Logger.success('Subscription successful!');
      Logger.log('Subscription ID: ' + response.data.data[0].id);
      Logger.log('Status: ' + response.data.data[0].status);
      Logger.log('\nWaiting for custom reward creation events...\n');
    } catch (error) {
      Logger.error('Failed to subscribe to event:');
      if (error.response) {
        Logger.log('Status: ' + error.response.status);
        Logger.log('Error: ' + JSON.stringify(error.response.data, null, 2));
      } else {
        Logger.error(error.message);
      }

      throw new SubscriptionError(
        'Failed to create EventSub subscription',
        EVENT_TYPES.REWARD_ADD,
        error.response?.status,
        error.response?.data
      );
    }
  }

  handleNotification(payload) {
    const event = payload.event;

    const details = {
      'Reward Title': event.title,
      'Cost': `${event.cost} points`,
      'Reward ID': event.id,
      'Broadcaster': `${event.broadcaster_user_name} (${event.broadcaster_user_login})`,
      'Enabled': event.is_enabled,
      'User Input Required': event.is_user_input_required
    };

    if (event.prompt) {
      details['Prompt'] = event.prompt;
    }

    if (event.background_color) {
      details['Background Color'] = event.background_color;
    }

    if (event.global_cooldown_setting && event.global_cooldown_setting.is_enabled) {
      details['Global Cooldown'] = `${event.global_cooldown_setting.global_cooldown_seconds}s`;
    }

    if (event.max_per_stream_setting && event.max_per_stream_setting.is_enabled) {
      details['Max Per Stream'] = event.max_per_stream_setting.max_per_stream;
    }

    if (event.max_per_user_per_stream_setting && event.max_per_user_per_stream_setting.is_enabled) {
      details['Max Per User Per Stream'] = event.max_per_user_per_stream_setting.max_per_user_per_stream;
    }

    Logger.eventNotification('🎁 CUSTOM REWARD CREATED EVENT RECEIVED!', details);

    Logger.log('\nFull event data:');
    Logger.log(JSON.stringify(event, null, 2));
    Logger.log('\n');
  }

  handleReconnect(payload) {
    Logger.info('Reconnect requested');
    this.reconnectUrl = payload.session.reconnect_url;
    Logger.info(`New reconnect URL: ${this.reconnectUrl}`);

    // Close current connection and reconnect
    this.ws.close();
  }

  handleRevocation(payload) {
    Logger.info('Subscription revoked:');
    Logger.log('Subscription type: ' + payload.subscription.type);
    Logger.log('Reason: ' + payload.subscription.status);
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

// Main execution
async function main() {
  try {
    // Load and validate configuration
    const config = Config.loadForClient();

    Logger.log('Starting Twitch EventSub WebSocket Client...');
    Logger.log(`Broadcaster ID: ${config.broadcasterId}`);
    Logger.divider('─', 60);

    const client = new TwitchEventSubClient(
      config.clientId,
      config.accessToken,
      config.broadcasterId
    );
    client.connect();

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      Logger.log('\nShutting down...');
      client.disconnect();
      process.exit(0);
    });
  } catch (error) {
    Logger.error('Configuration error:', error);
    process.exit(1);
  }
}

main().catch(error => {
  Logger.error('Fatal error:', error);
  process.exit(1);
});
