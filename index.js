import { loadConfig } from './config/loader.js';
import { EVENT_TYPES, MESSAGE_TYPES } from './config/constants.js';
import { Config } from './config/env.js';
import { TokenValidator } from './lib/tokenValidator.js';
import { Logger } from './lib/logger.js';
import { WebSocketManager } from './client/WebSocketManager.js';
import { EventSubSubscriber } from './client/EventSubSubscriber.js';
import { EventFormatter } from './client/EventFormatter.js';
import { PacketFilter } from './client/PacketFilter.js';

// Load configuration from config.json or .env
loadConfig();

/**
 * Main EventSub client class
 */
class TwitchEventSubClient {
  /**
   * Create a new TwitchEventSubClient
   * @param {string} clientId - Twitch client ID
   * @param {string} accessToken - Twitch access token
   * @param {string} broadcasterId - Broadcaster user ID
   */
  constructor(clientId, accessToken, broadcasterId) {
    this.clientId = clientId;
    this.accessToken = accessToken;
    this.broadcasterId = broadcasterId;
    this.sessionId = null;

    // Initialize WebSocket manager
    this.wsManager = new WebSocketManager({
      onMessage: (message) => this.handleMessage(message),
      onClose: () => this.handleConnectionClose()
    });

    // Initialize EventSub subscriber
    this.subscriber = new EventSubSubscriber(clientId, accessToken);
  }

  /**
   * Configure packet filter options
   * @param {Object} filterOptions - Filter configuration
   */
  configureFilter(filterOptions) {
    PacketFilter.configure(filterOptions);
  }

  /**
   * Get current filter configuration
   * @returns {Object} Current filter options
   */
  getFilterConfig() {
    return PacketFilter.getConfig();
  }

  /**
   * Connect to EventSub and start listening
   * @returns {Promise<void>}
   */
  async connect() {
    await this.wsManager.connect();
  }

  /**
   * Handle incoming WebSocket messages
   * @param {Object} message - Parsed message from WebSocket
   */
  handleMessage(message) {
    const { metadata, payload } = message;

    // Apply packet filter to determine if message should be processed
    if (!PacketFilter.filter(message)) {
      Logger.debug(`Filtered out message type: ${metadata.message_type}`);
      return;
    }

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
        Logger.warn(`Unknown message type: ${metadata.message_type}`);
        Logger.log('Payload: ' + JSON.stringify(payload, null, 2));
    }
  }

  /**
   * Handle session welcome message
   * @param {Object} payload - Welcome message payload
   */
  async handleWelcome(payload) {
    this.sessionId = payload.session.id;
    EventFormatter.formatWelcome(payload.session);

    // Validate token before subscribing
    const isValid = await this.validateToken();
    if (!isValid) {
      Logger.error('Token validation failed. Exiting...');
      Logger.log('💡 Run "npm run validate" for detailed diagnostics\n');
      process.exit(1);
    }

    // Subscribe to channel points custom reward add event
    await this.subscribeToEvents();
  }

  /**
   * Validate access token
   * @returns {Promise<boolean>} True if valid
   */
  async validateToken() {
    try {
      await TokenValidator.validate(this.accessToken, this.broadcasterId);
      return true;
    } catch (error) {
      Logger.error('Token validation failed:', error);
      return false;
    }
  }

  /**
   * Subscribe to EventSub events
   * @returns {Promise<void>}
   */
  async subscribeToEvents() {
    try {
      const subscription = await this.subscriber.subscribe(
        {
          type: EVENT_TYPES.REWARD_ADD,
          version: '1',
          condition: {
            broadcaster_user_id: this.broadcasterId
          }
        },
        this.sessionId
      );

      Logger.log('\nWaiting for custom reward creation events...\n');
    } catch (error) {
      Logger.error('Failed to subscribe:', error);
      process.exit(1);
    }
  }

  /**
   * Handle event notification
   * @param {Object} payload - Notification payload
   */
  handleNotification(payload) {
    const { subscription, event } = payload;
    EventFormatter.format(subscription.type, event);
  }

  /**
   * Handle reconnect request
   * @param {Object} payload - Reconnect payload
   */
  handleReconnect(payload) {
    this.wsManager.reconnect(payload.session.reconnect_url);
  }

  /**
   * Handle subscription revocation
   * @param {Object} payload - Revocation payload
   */
  handleRevocation(payload) {
    EventFormatter.formatRevocation(payload.subscription);
    this.subscriber.handleRevocation(
      payload.subscription.id,
      payload.subscription.status
    );
  }

  /**
   * Handle connection close
   */
  handleConnectionClose() {
    // Check if we should reconnect
    const state = this.wsManager.getState();

    if (state.hasReconnectUrl) {
      Logger.info('Reconnecting to new session...');
      this.connect();
    } else {
      Logger.info('Connection closed. Exiting...');
    }
  }

  /**
   * Disconnect from EventSub
   */
  disconnect() {
    this.wsManager.disconnect();
  }
}

/**
 * Main application entry point
 */
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

    await client.connect();

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      Logger.log('\nShutting down...');
      client.disconnect();
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      Logger.log('\nShutting down...');
      client.disconnect();
      process.exit(0);
    });
  } catch (error) {
    Logger.error('Fatal error:', error);
    process.exit(1);
  }
}

// Run the application
main().catch(error => {
  Logger.error('Unhandled error:', error);
  process.exit(1);
});
