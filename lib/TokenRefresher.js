/**
 * Token refresher for Twitch OAuth tokens
 *
 * Handles automatic token refresh using refresh tokens when access tokens expire.
 * According to Twitch documentation, user access tokens expire after ~4 hours.
 */

import axios from 'axios';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { TWITCH_URLS } from '../config/constants.js';
import { CONFIG_JSON_PATH } from '../config/loader.js';
import { Logger } from './logger.js';
import { TokenRefreshError } from './errors.js';

// Re-export TokenRefreshError for backward compatibility
export { TokenRefreshError };

/**
 * Token refresher class
 */
export class TokenRefresher {
  /**
   * Refresh an access token using a refresh token
   *
   * @param {Object} options - Refresh options
   * @param {string} options.refreshToken - The refresh token
   * @param {string} options.clientId - Twitch client ID
   * @param {string} options.clientSecret - Twitch client secret
   * @returns {Promise<Object>} New token data including access_token and refresh_token
   * @throws {TokenRefreshError} If refresh fails
   */
  static async refresh({ refreshToken, clientId, clientSecret }) {
    if (!refreshToken) {
      throw new TokenRefreshError(
        'No refresh token available',
        'missing_refresh_token',
        { suggestion: 'Run "npm run oauth" to generate new tokens' }
      );
    }

    if (!clientId || !clientSecret) {
      throw new TokenRefreshError(
        'Missing client credentials',
        'missing_credentials',
        { suggestion: 'Ensure TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET are set in config.json' }
      );
    }

    try {
      Logger.info('Attempting to refresh access token...');

      // Build form data for the request body
      const formData = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'refresh_token',
        refresh_token: refreshToken
      });

      const response = await axios.post(TWITCH_URLS.OAUTH_TOKEN, formData.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      const { access_token, refresh_token, expires_in, scope, token_type } = response.data;

      Logger.success('Token refreshed successfully!');
      Logger.info(`New token expires in: ${expires_in} seconds (~${Math.round(expires_in / 3600)} hours)`);

      return {
        accessToken: access_token,
        refreshToken: refresh_token,
        expiresIn: expires_in,
        scope: scope,
        tokenType: token_type
      };
    } catch (error) {
      // Handle specific error cases
      if (error.response) {
        const { status, data } = error.response;

        if (status === 400 && data.message?.includes('Invalid refresh token')) {
          throw new TokenRefreshError(
            'Refresh token is invalid or expired',
            'invalid_refresh_token',
            {
              suggestion: 'Run "npm run oauth" to generate new tokens',
              originalError: data.message
            }
          );
        }

        if (status === 401) {
          throw new TokenRefreshError(
            'Invalid client credentials',
            'invalid_credentials',
            {
              suggestion: 'Check TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET in config.json',
              originalError: data.message
            }
          );
        }

        throw new TokenRefreshError(
          `Token refresh failed: ${data.message || 'Unknown error'}`,
          'api_error',
          { statusCode: status, data }
        );
      }

      // Network or other errors
      const errorMsg = error?.message || String(error);
      throw new TokenRefreshError(
        `Token refresh error: ${errorMsg}`,
        'network_error',
        { originalError: errorMsg }
      );
    }
  }

  /**
   * Refresh token and save to config.json
   *
   * @param {Object} options - Refresh options
   * @param {string} options.refreshToken - The refresh token
   * @param {string} options.clientId - Twitch client ID
   * @param {string} options.clientSecret - Twitch client secret
   * @returns {Promise<Object>} New token data
   * @throws {TokenRefreshError} If refresh or save fails
   */
  static async refreshAndSave({ refreshToken, clientId, clientSecret }) {
    // First, refresh the token
    const newTokens = await TokenRefresher.refresh({ refreshToken, clientId, clientSecret });

    // Then save to config.json
    try {
      TokenRefresher.saveTokensToConfig(newTokens);
      Logger.success('New tokens saved to config.json');
    } catch (saveError) {
      Logger.warn('Could not save tokens to config.json:', saveError?.message || String(saveError));
      Logger.log('Please manually update your config.json with the new tokens');
    }

    return newTokens;
  }

  /**
   * Save new tokens to config.json
   *
   * @param {Object} tokens - Token data
   * @param {string} tokens.accessToken - New access token
   * @param {string} tokens.refreshToken - New refresh token
   */
  static saveTokensToConfig({ accessToken, refreshToken }) {
    if (!existsSync(CONFIG_JSON_PATH)) {
      throw new Error('config.json not found');
    }

    let config;
    try {
      const configData = readFileSync(CONFIG_JSON_PATH, 'utf8');
      config = JSON.parse(configData);
    } catch (error) {
      throw new Error(`Failed to parse config.json: ${error?.message || String(error)}`);
    }

    // Update tokens
    config.TWITCH_ACCESS_TOKEN = accessToken;
    if (refreshToken) {
      config.TWITCH_REFRESH_TOKEN = refreshToken;
    }

    // Write back to file with pretty formatting
    try {
      writeFileSync(CONFIG_JSON_PATH, JSON.stringify(config, null, 2) + '\n', 'utf8');
    } catch (error) {
      throw new Error(`Failed to write to config.json: ${error?.message || String(error)}`);
    }
  }

  /**
   * Update process environment variables with new tokens
   *
   * Note: This updates the in-memory environment for the current process only.
   * These changes do NOT persist across process restarts. For persistence,
   * use saveTokensToConfig() which writes to config.json.
   *
   * This is useful for keeping the current process's environment in sync
   * after a token refresh, so any code that reads from process.env will
   * get the updated values without needing to reload the config file.
   *
   * @param {Object} tokens - Token data
   * @param {string} tokens.accessToken - New access token
   * @param {string} tokens.refreshToken - New refresh token (optional)
   */
  static updateEnvironment({ accessToken, refreshToken }) {
    process.env.TWITCH_ACCESS_TOKEN = accessToken;
    if (refreshToken) {
      process.env.TWITCH_REFRESH_TOKEN = refreshToken;
    }
  }

  /**
   * Format refresh error for user display
   *
   * @param {TokenRefreshError} error - The refresh error
   * @returns {Object} Formatted error info with message and solution
   */
  static formatError(error) {
    if (!(error instanceof TokenRefreshError)) {
      return {
        message: error?.message || String(error),
        solution: ['Check your configuration and try again']
      };
    }

    const solutions = {
      missing_refresh_token: [
        'No refresh token is available in your configuration.',
        'To generate new tokens: stop this application, run "npm run oauth",',
        'complete the OAuth flow in your browser, then restart the application.',
        'The new tokens will be saved to config.json automatically.'
      ],
      missing_credentials: [
        'Client ID and/or Client Secret are missing.',
        'Add TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET to your config.json',
        'You can find these at https://dev.twitch.tv/console/apps'
      ],
      invalid_refresh_token: [
        'Your refresh token has expired or been revoked.',
        'Run "npm run oauth" to generate new tokens.',
        'Save both the access token and refresh token to config.json'
      ],
      invalid_credentials: [
        'Your client credentials are invalid.',
        'Check TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET in config.json',
        'Make sure they match your Twitch application settings'
      ],
      api_error: [
        'The Twitch API returned an error.',
        error.details?.data?.message || 'Verify your client credentials and try again.',
        'Check Twitch API status at https://devstatus.twitch.tv'
      ],
      network_error: [
        'Network error while refreshing token.',
        'Check your internet connection and try again'
      ]
    };

    return {
      message: error.message,
      solution: solutions[error.reason] || ['Check your configuration and try again']
    };
  }
}
