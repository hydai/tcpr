/**
 * Centralized constants for Twitch API integration
 */

/**
 * Twitch API URLs
 */
export const TWITCH_URLS = {
  EVENTSUB_WS: 'wss://eventsub.wss.twitch.tv/ws',
  API: 'https://api.twitch.tv/helix',
  OAUTH_AUTHORIZE: 'https://id.twitch.tv/oauth2/authorize',
  OAUTH_TOKEN: 'https://id.twitch.tv/oauth2/token',
  OAUTH_VALIDATE: 'https://id.twitch.tv/oauth2/validate'
};

/**
 * Twitch EventSub event types
 */
export const EVENT_TYPES = {
  REWARD_ADD: 'channel.channel_points_custom_reward.add',
  REWARD_UPDATE: 'channel.channel_points_custom_reward.update',
  REDEMPTION_ADD: 'channel.channel_points_custom_reward_redemption.add',
  REDEMPTION_UPDATE: 'channel.channel_points_custom_reward_redemption.update'
};

/**
 * Required OAuth scopes for channel points
 */
export const SCOPES = {
  READ_REDEMPTIONS: 'channel:read:redemptions'
};

/**
 * Array of required scopes (at least one needed)
 */
export const REQUIRED_SCOPES = [
  SCOPES.READ_REDEMPTIONS
];

/**
 * Default scopes for OAuth flow
 */
export const DEFAULT_OAUTH_SCOPES = [
  SCOPES.READ_REDEMPTIONS
];

/**
 * EventSub message types
 */
export const MESSAGE_TYPES = {
  SESSION_WELCOME: 'session_welcome',
  SESSION_KEEPALIVE: 'session_keepalive',
  NOTIFICATION: 'notification',
  SESSION_RECONNECT: 'session_reconnect',
  REVOCATION: 'revocation'
};

/**
 * Default configuration values
 */
export const DEFAULTS = {
  PORT: 3000,
  REDIRECT_URI: 'http://localhost:3000/callback',
  STATE_TOKEN_EXPIRY: 5 * 60 * 1000, // 5 minutes
  KEEPALIVE_TIMEOUT: 10 // seconds
};

/**
 * HTTP request timeout settings (in milliseconds)
 */
export const TIMEOUTS = {
  API_REQUEST: 30000,    // 30 seconds for API requests
  OAUTH_REQUEST: 15000,  // 15 seconds for OAuth requests
  WEBSOCKET: 60000       // 60 seconds for WebSocket connections
};

/**
 * Retry configuration
 */
export const RETRY = {
  MAX_ATTEMPTS: 5,
  INITIAL_BACKOFF_MS: 1000,
  MAX_BACKOFF_MS: 30000,
  // Standard retry strategy
  STANDARD_MAX_RETRIES: 3,
  STANDARD_BASE_DELAY_MS: 1000,
  STANDARD_MAX_DELAY_MS: 30000
};

/**
 * Token refresh configuration
 * Twitch tokens expire after ~4 hours, so refreshing every hour keeps us ahead
 */
export const TOKEN_REFRESH = {
  INTERVAL_MS: 60 * 60 * 1000, // 1 hour
  MAX_ATTEMPTS: 3, // Total attempts per refresh cycle: 1 initial + 2 retries
  INITIAL_BACKOFF_MS: 1000, // Starting backoff delay for retries
  MAX_CONSECUTIVE_FAILURES: 3 // Warn user after this many consecutive refresh failures
};

/**
 * Time conversion constants
 */
export const TIME = {
  SECONDS_PER_MINUTE: 60,
  SECONDS_PER_HOUR: 60 * 60,
  MS_PER_SECOND: 1000
};

/**
 * Pre-calculated derived constants
 */
export const TOKEN_REFRESH_INTERVAL_MINUTES = TOKEN_REFRESH.INTERVAL_MS / TIME.MS_PER_SECOND / TIME.SECONDS_PER_MINUTE;
