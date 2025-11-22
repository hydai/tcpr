import { loadConfig } from './config/loader.js';
import { EVENT_TYPES, MESSAGE_TYPES } from './config/constants.js';
import { Config } from './config/env.js';
import { TokenValidator } from './lib/tokenValidator.js';
import { TokenRefresher } from './lib/TokenRefresher.js';
import { Logger } from './lib/logger.js';
import { WebSocketManager } from './client/WebSocketManager.js';
import { EventSubSubscriber } from './client/EventSubSubscriber.js';
import { EventFormatter } from './client/EventFormatter.js';
import { PacketFilter } from './client/PacketFilter.js';

// Load configuration from config.json
loadConfig();

/**
 * Main EventSub client class
 */
class TwitchEventSubClient {
  /**
   * Create a new TwitchEventSubClient
   * @param {Object} config - Configuration object
   * @param {string} config.clientId - Twitch client ID (required)
   * @param {string} config.clientSecret - Twitch client secret (optional, for token refresh)
   * @param {string} config.accessToken - Twitch access token (required)
   * @param {string} config.refreshToken - Twitch refresh token (optional, for token refresh)
   * @param {string} config.broadcasterId - Broadcaster user ID (required)
   * @throws {Error} If required parameters are missing
   */
  constructor({ clientId, clientSecret, accessToken, refreshToken, broadcasterId }) {
    // Validate required parameters
    if (!clientId) {
      throw new Error('Missing required parameter: clientId. Ensure TWITCH_CLIENT_ID is set in config.json');
    }
    if (!accessToken) {
      throw new Error('Missing required parameter: accessToken. Ensure TWITCH_ACCESS_TOKEN is set in config.json');
    }
    if (!broadcasterId) {
      throw new Error('Missing required parameter: broadcasterId. Ensure TWITCH_BROADCASTER_ID is set in config.json');
    }

    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
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
   * Validate access token, attempting refresh if validation fails
   * @returns {Promise<boolean>} True if valid (or successfully refreshed)
   */
  async validateToken() {
    try {
      await TokenValidator.validate(this.accessToken, this.broadcasterId);
      return true;
    } catch (error) {
      Logger.error('Token validation failed:', error.message);

      // Attempt to refresh the token if we have refresh credentials
      if (this.refreshToken && this.clientSecret) {
        Logger.info('Attempting to refresh token...');

        try {
          const newTokens = await TokenRefresher.refreshAndSave({
            refreshToken: this.refreshToken,
            clientId: this.clientId,
            clientSecret: this.clientSecret
          });

          // Update instance with new tokens
          this.accessToken = newTokens.accessToken;
          this.refreshToken = newTokens.refreshToken;

          // Replace subscriber with new access token
          // Note: This is safe because validateToken() is called during handleWelcome(),
          // which happens BEFORE subscribeToEvents(). At this point, no subscriptions
          // have been created yet, so there's no state to preserve or clean up.
          this.subscriber = new EventSubSubscriber(this.clientId, this.accessToken);

          // Update environment variables
          TokenRefresher.updateEnvironment(newTokens);

          // Token is already validated by Twitch during the refresh operation
          Logger.success('Token refreshed successfully!');
          return true;
        } catch (refreshError) {
          Logger.error('Token refresh failed:', refreshError.message);
          const errorInfo = TokenRefresher.formatError(refreshError);
          errorInfo.solution.forEach(line => Logger.log(`  ${line}`));
        }
      } else {
        if (!this.refreshToken) {
          Logger.warn('No refresh token available - cannot auto-refresh');
        }
        if (!this.clientSecret) {
          Logger.warn('No client secret available - cannot auto-refresh');
        }
        Logger.log('💡 Add TWITCH_REFRESH_TOKEN and TWITCH_CLIENT_SECRET to config.json for auto-refresh');
      }

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
          type: EVENT_TYPES.REDEMPTION_ADD,
          version: '1',
          condition: {
            broadcaster_user_id: this.broadcasterId
          }
        },
        this.sessionId
      );

      Logger.log('\nWaiting for channel point reward redemption events...\n');
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
    if (config.refreshToken && config.clientSecret) {
      Logger.log('Auto token refresh: enabled');
    } else {
      Logger.log('Auto token refresh: disabled (missing refresh token or client secret)');
    }
    Logger.divider('─', 60);

    const client = new TwitchEventSubClient({
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      accessToken: config.accessToken,
      refreshToken: config.refreshToken,
      broadcasterId: config.broadcasterId
    });

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
