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
  READ_REDEMPTIONS: 'channel:read:redemptions',
  MANAGE_REDEMPTIONS: 'channel:manage:redemptions'
};

/**
 * Array of required scopes (at least one needed)
 */
export const REQUIRED_SCOPES = [
  SCOPES.READ_REDEMPTIONS,
  SCOPES.MANAGE_REDEMPTIONS
];

/**
 * Default scopes for OAuth flow
 */
export const DEFAULT_OAUTH_SCOPES = [
  SCOPES.READ_REDEMPTIONS,
  SCOPES.MANAGE_REDEMPTIONS
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
