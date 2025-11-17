/**
 * Environment configuration loader and validator
 */

import { DEFAULTS } from './constants.js';

/**
 * Configuration class for managing environment variables
 */
export class Config {
  /**
   * Load and validate environment configuration
   * @param {Object} options - Options for config loading
   * @param {boolean} options.requireClientSecret - Whether client secret is required
   * @returns {Object} Validated configuration object
   * @throws {Error} If required variables are missing
   */
  static load(options = {}) {
    const { requireClientSecret = false } = options;

    const config = {
      clientId: process.env.TWITCH_CLIENT_ID,
      clientSecret: process.env.TWITCH_CLIENT_SECRET,
      accessToken: process.env.TWITCH_ACCESS_TOKEN,
      broadcasterId: process.env.TWITCH_BROADCASTER_ID,
      redirectUri: process.env.REDIRECT_URI || DEFAULTS.REDIRECT_URI,
      port: parseInt(process.env.PORT || String(DEFAULTS.PORT), 10)
    };

    // Validate required fields based on context
    const requiredFields = ['clientId'];

    if (requireClientSecret) {
      requiredFields.push('clientSecret');
    }

    Config.validate(config, requiredFields);

    return config;
  }

  /**
   * Load configuration for main EventSub client
   * @returns {Object} Validated configuration
   */
  static loadForClient() {
    const config = Config.load();

    // For the main client, we need all three core fields
    const required = ['clientId', 'accessToken', 'broadcasterId'];
    const missing = required.filter(key => !config[key]);

    if (missing.length > 0) {
      const errorMsg = [
        'Error: Missing required environment variables',
        'Please ensure the following are set in your .env file:',
        ...missing.map(key => {
          const envName = Config.getEnvName(key);
          return `  - ${envName}`;
        })
      ].join('\n');

      throw new Error(errorMsg);
    }

    return config;
  }

  /**
   * Load configuration for OAuth server
   * @returns {Object} Validated configuration
   */
  static loadForOAuth() {
    const config = Config.load({ requireClientSecret: true });

    // OAuth server needs client ID and secret at minimum
    const required = ['clientId', 'clientSecret'];
    const missing = required.filter(key => !config[key]);

    if (missing.length > 0) {
      const errorMsg = [
        'Server configuration error:',
        ...missing.map(key => {
          const envName = Config.getEnvName(key);
          return `Missing ${envName} in .env file`;
        })
      ].join(' ');

      throw new Error(errorMsg);
    }

    return config;
  }

  /**
   * Load configuration for validation utility
   * @returns {Object} Validated configuration
   */
  static loadForValidation() {
    const config = Config.load();

    // Validation needs these three fields
    const required = ['clientId', 'accessToken', 'broadcasterId'];
    const missing = required.filter(key => !config[key]);

    if (missing.length > 0) {
      return { valid: false, missing, config };
    }

    return { valid: true, config };
  }

  /**
   * Validate configuration object
   * @param {Object} config - Configuration object to validate
   * @param {string[]} requiredFields - List of required field names
   * @throws {Error} If validation fails
   */
  static validate(config, requiredFields = []) {
    const missing = requiredFields.filter(field => !config[field]);

    if (missing.length > 0) {
      throw new Error(
        `Missing required configuration: ${missing.map(Config.getEnvName).join(', ')}`
      );
    }

    // Validate port is a valid number
    if (config.port && (isNaN(config.port) || config.port < 1 || config.port > 65535)) {
      throw new Error('PORT must be a valid number between 1 and 65535');
    }
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
      redirectUri: 'REDIRECT_URI',
      port: 'PORT'
    };

    return mapping[key] || key.toUpperCase();
  }

  /**
   * Check if configuration is complete for a specific use case
   * @param {'client' | 'oauth' | 'validation'} type - Use case type
   * @returns {Object} Status object with isComplete and missing fields
   */
  static checkComplete(type = 'client') {
    try {
      switch (type) {
        case 'client':
          Config.loadForClient();
          return { isComplete: true, missing: [] };
        case 'oauth':
          Config.loadForOAuth();
          return { isComplete: true, missing: [] };
        case 'validation':
          const result = Config.loadForValidation();
          return { isComplete: result.valid, missing: result.missing || [] };
        default:
          throw new Error(`Unknown config type: ${type}`);
      }
    } catch (error) {
      // Parse missing fields from error message
      return { isComplete: false, missing: [], error: error.message };
    }
  }
}
