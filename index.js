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

// Token refresh interval: 1 hour (in milliseconds)
// Twitch tokens expire after ~4 hours, so refreshing every hour keeps us ahead
const TOKEN_REFRESH_INTERVAL_MS = 60 * 60 * 1000;

/**
 * Main EventSub client class
 */
class TwitchEventSubClient {
  /**
   * Create a new TwitchEventSubClient
   * Supports both object-style and positional parameters for backward compatibility.
   *
   * Object style (recommended):
   * @param {Object} config - Configuration object
   * @param {string} config.clientId - Twitch client ID (required)
   * @param {string} config.clientSecret - Twitch client secret (optional, for token refresh)
   * @param {string} config.accessToken - Twitch access token (required)
   * @param {string} config.refreshToken - Twitch refresh token (optional, for token refresh)
   * @param {string} config.broadcasterId - Broadcaster user ID (required)
   *
   * Positional style (legacy, deprecated):
   * @param {string} clientId - Twitch client ID
   * @param {string} accessToken - Twitch access token
   * @param {string} broadcasterId - Broadcaster user ID
   *
   * @throws {Error} If required parameters are missing
   */
  constructor(arg1, arg2, arg3) {
    let clientId, clientSecret, accessToken, refreshToken, broadcasterId;

    // Support both object-style and positional parameters
    if (typeof arg1 === 'object' && arg1 !== null && Object.hasOwn(arg1, 'clientId')) {
      // Object style (new)
      ({ clientId, clientSecret, accessToken, refreshToken, broadcasterId } = arg1);
    } else {
      // Positional style (legacy) - clientId, accessToken, broadcasterId
      clientId = arg1;
      accessToken = arg2;
      broadcasterId = arg3;
      // Note: clientSecret and refreshToken not available in legacy style
    }

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
    this.tokenRefreshTimer = null;
    this._consecutiveRefreshFailures = 0;

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
   *
   * IMPORTANT: The order of operations here matters for token refresh safety.
   * validateToken() must be called BEFORE subscribeToEvents() because token
   * refresh may replace the subscriber instance. If subscriptions existed,
   * they would be lost during replacement.
   *
   * @param {Object} payload - Welcome message payload
   */
  async handleWelcome(payload) {
    this.sessionId = payload.session.id;
    EventFormatter.formatWelcome(payload.session);

    // Validate token before subscribing (order matters - see JSDoc above)
    const isValid = await this.validateToken();
    if (!isValid) {
      Logger.error('Token validation failed. Exiting...');
      Logger.log('💡 Run "npm run validate" for detailed diagnostics\n');
      process.exit(1);
    }

    // Subscribe to channel points custom reward add event
    await this.subscribeToEvents();

    // Start periodic token refresh to prevent expiration during active sessions
    this.startTokenRefreshTimer();
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
      Logger.error('Token validation failed:', error?.message || String(error));

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
          // Defensive check: warn if subscriptions exist (shouldn't happen in normal flow)
          let existingSubscriptions = 0;
          if (this.subscriber && typeof this.subscriber.getSubscriptionCount === 'function') {
            try {
              existingSubscriptions = this.subscriber.getSubscriptionCount();
            } catch {
              // Ignore errors - this is just a defensive check
            }
          }
          if (existingSubscriptions > 0) {
            Logger.warn(`Replacing subscriber with ${existingSubscriptions} existing subscription(s) - they will be lost`);
          }
          this.subscriber = new EventSubSubscriber(this.clientId, this.accessToken);

          // Update environment variables
          TokenRefresher.updateEnvironment(newTokens);

          // Token is already validated by Twitch during the refresh operation
          Logger.success('Token refreshed successfully!');
          return true;
        } catch (refreshError) {
          Logger.error('Token refresh failed:', refreshError?.message || String(refreshError));
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
   * Start periodic token refresh timer
   * Refreshes token every hour to prevent expiration during active sessions
   * Uses recursive setTimeout to prevent overlapping executions
   */
  startTokenRefreshTimer() {
    // Only start if we have refresh credentials
    if (!this.refreshToken || !this.clientSecret) {
      Logger.info('Token refresh timer not started (missing refresh credentials)');
      return;
    }

    // Clear any existing timer
    this.stopTokenRefreshTimer();

    // Reset consecutive failure counter
    this._consecutiveRefreshFailures = 0;

    Logger.info(`Starting token refresh timer (interval: ${TOKEN_REFRESH_INTERVAL_MS / 1000 / 60} minutes)`);

    // Use recursive setTimeout to prevent overlapping executions
    // Wrapped in try-catch to ensure timer chain continues even on errors
    const scheduleNextRefresh = async () => {
      try {
        await this.refreshTokenPeriodically();
      } catch (error) {
        // Log unexpected errors but don't break the timer chain
        Logger.error('Unexpected error in token refresh:', error?.message || String(error));
      }
      // Schedule next run only after previous completes (always, even on error)
      this.tokenRefreshTimer = setTimeout(scheduleNextRefresh, TOKEN_REFRESH_INTERVAL_MS);
      this.tokenRefreshTimer.unref();
    };

    // Check if token needs immediate refresh based on expiration time
    this.checkAndScheduleRefresh(scheduleNextRefresh);
  }

  /**
   * Check token expiration and schedule refresh appropriately
   * @param {Function} scheduleNextRefresh - Function to call for refresh
   */
  async checkAndScheduleRefresh(scheduleNextRefresh) {
    try {
      const tokenData = await TokenValidator.quickCheck(this.accessToken);

      if (tokenData && tokenData.expires_in) {
        const expiresInMs = tokenData.expires_in * 1000;

        // If token expires within the refresh interval, refresh immediately
        if (expiresInMs <= TOKEN_REFRESH_INTERVAL_MS) {
          Logger.info(`Token expires in ${Math.round(tokenData.expires_in / 60)} minutes, refreshing now...`);
          await scheduleNextRefresh();
        } else {
          // Token is fresh enough, schedule next refresh after interval
          Logger.info(`Token valid for ${Math.round(tokenData.expires_in / 3600)} hours, scheduling refresh in ${TOKEN_REFRESH_INTERVAL_MS / 1000 / 60} minutes`);
          this.tokenRefreshTimer = setTimeout(scheduleNextRefresh, TOKEN_REFRESH_INTERVAL_MS);
          this.tokenRefreshTimer.unref();
        }
      } else {
        // Couldn't check expiration, refresh immediately to be safe
        Logger.warn('Could not check token expiration, refreshing now...');
        await scheduleNextRefresh();
      }
    } catch (error) {
      // On error, refresh immediately to be safe
      Logger.warn('Error checking token expiration, refreshing now...');
      await scheduleNextRefresh();
    }
  }

  /**
   * Stop the periodic token refresh timer
   */
  stopTokenRefreshTimer() {
    if (this.tokenRefreshTimer) {
      clearTimeout(this.tokenRefreshTimer);
      this.tokenRefreshTimer = null;
    }
  }

  /**
   * Perform periodic token refresh
   * Called by the refresh timer to proactively renew tokens before expiration
   * Implements retry logic with exponential backoff
   */
  async refreshTokenPeriodically() {
    Logger.info('Periodic token refresh: checking token...');

    const MAX_RETRIES = 3;
    const INITIAL_BACKOFF_MS = 1000;

    let attempt = 0;
    let lastError = null;

    while (attempt < MAX_RETRIES) {
      try {
        const newTokens = await TokenRefresher.refreshAndSave({
          refreshToken: this.refreshToken,
          clientId: this.clientId,
          clientSecret: this.clientSecret
        });

        // Update instance with new tokens
        this.accessToken = newTokens.accessToken;
        this.refreshToken = newTokens.refreshToken;

        // Update the subscriber's token (preserves existing subscriptions)
        this.subscriber.updateToken(this.accessToken);

        // Update environment variables
        TokenRefresher.updateEnvironment(newTokens);

        Logger.success('Periodic token refresh completed successfully');
        this._consecutiveRefreshFailures = 0;
        return; // Success - exit the method
      } catch (error) {
        lastError = error;
        attempt++;
        if (attempt < MAX_RETRIES) {
          const backoffMs = INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1);
          Logger.warn(`Token refresh attempt ${attempt} failed. Retrying in ${backoffMs / 1000}s...`);
          await new Promise(resolve => setTimeout(resolve, backoffMs));
        }
      }
    }

    // All retries exhausted
    Logger.error('Periodic token refresh failed after multiple attempts:', lastError?.message || String(lastError));
    const errorInfo = TokenRefresher.formatError(lastError);
    errorInfo.solution.forEach(line => Logger.log(`  ${line}`));

    this._consecutiveRefreshFailures++;
    if (this._consecutiveRefreshFailures >= 3) {
      Logger.warn(`Token refresh has failed ${this._consecutiveRefreshFailures} consecutive times. Token may expire soon.`);
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
    this.stopTokenRefreshTimer();
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
