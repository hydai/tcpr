/**
 * Environment configuration loader and validator
 */

import { DEFAULTS } from './constants.js';

/**
 * Predefined required field sets for different use cases
 * @type {Object.<string, string[]>}
 * @property {string[]} client - Full client mode: requires credentials to connect to Twitch EventSub
 * @property {string[]} oauth - OAuth server mode: requires credentials for token generation
 * @property {string[]} minimal - Minimal validation: only requires client ID for basic operations
 */
const REQUIRED_FIELDS = {
  client: ['clientId', 'accessToken', 'broadcasterId'],
  oauth: ['clientId', 'clientSecret'],
  minimal: ['clientId']
};

/**
 * Configuration class for managing environment variables
 */
export class Config {
  /**
   * Load and validate environment configuration
   *
   * @param {Object} options - Options for config loading
   * @param {string|string[]} options.required - Required fields preset ('client', 'oauth', 'minimal') or array of field names
   * @param {boolean} options.returnValidationResult - If true, returns { valid, config, missing } instead of throwing
   * @returns {Object} Validated configuration object or validation result
   * @throws {Error} If required variables are missing (unless returnValidationResult is true)
   *
   * @example
   * // For main client
   * const config = Config.load({ required: 'client' });
   *
   * @example
   * // For OAuth server
   * const config = Config.load({ required: 'oauth' });
   *
   * @example
   * // For validation (returns result object)
   * const result = Config.load({ required: 'client', returnValidationResult: true });
   * if (!result.valid) console.log('Missing:', result.missing);
   */
  static load(options = {}) {
    const { required = 'minimal', returnValidationResult = false } = options;

    // Build config object from environment
    const config = {
      clientId: process.env.TWITCH_CLIENT_ID,
      clientSecret: process.env.TWITCH_CLIENT_SECRET,
      accessToken: process.env.TWITCH_ACCESS_TOKEN,
      broadcasterId: process.env.TWITCH_BROADCASTER_ID,
      refreshToken: process.env.TWITCH_REFRESH_TOKEN,
      redirectUri: process.env.REDIRECT_URI || DEFAULTS.REDIRECT_URI,
      port: process.env.PORT ? parseInt(process.env.PORT, 10) : DEFAULTS.PORT
    };

    // Resolve required fields
    const requiredFields = Array.isArray(required)
      ? required
      : (REQUIRED_FIELDS[required] || REQUIRED_FIELDS.minimal);

    // Find missing fields
    const missing = requiredFields.filter(key => !config[key]);

    // Validate port
    if (config.port && (isNaN(config.port) || config.port < 1 || config.port > 65535)) {
      if (returnValidationResult) {
        return { valid: false, config, missing, error: 'Invalid PORT' };
      }
      throw new Error('PORT must be a valid number between 1 and 65535');
    }

    // Return validation result if requested
    if (returnValidationResult) {
      return { valid: missing.length === 0, config, missing };
    }

    // Throw if missing required fields
    if (missing.length > 0) {
      const errorMsg = [
        'Error: Missing required configuration',
        'Please ensure the following are set in your config.json file:',
        ...missing.map(key => `  - ${Config.getEnvName(key)}`)
      ].join('\n');
      throw new Error(errorMsg);
    }

    return config;
  }

  /**
   * Convert config key to environment variable name
   * @param {string} key - Config key
   * @returns {string} Environment variable name
   */
  static getEnvName(key) {
    const mapping = {
      clientId: 'TWITCH_CLIENT_ID',
      clientSecret: 'TWITCH_CLIENT_SECRET',
      accessToken: 'TWITCH_ACCESS_TOKEN',
      broadcasterId: 'TWITCH_BROADCASTER_ID',
      refreshToken: 'TWITCH_REFRESH_TOKEN',
      redirectUri: 'REDIRECT_URI',
      port: 'PORT'
    };

    return mapping[key] || key.toUpperCase();
  }
}
