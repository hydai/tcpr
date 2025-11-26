/**
 * Token refresher for Twitch OAuth tokens
 *
 * Handles automatic token refresh using refresh tokens when access tokens expire.
 * According to Twitch documentation, user access tokens expire after ~4 hours.
 */

import axios from 'axios';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { TWITCH_URLS, TIMEOUTS } from '../config/constants.js';
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
        },
        timeout: TIMEOUTS.OAUTH_REQUEST
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
        const errorMessage = data.message || '';

        // Check for invalid client credentials (wrong client ID or secret)
        // Twitch OAuth token endpoint returns HTTP 400 with these error messages:
        // - "invalid client" when Client ID is wrong or doesn't exist
        // - "invalid client secret" when Client Secret is wrong or has been regenerated
        // - "Invalid refresh token" when refresh token is expired or revoked
        if (status === 400) {
          const lowerMessage = errorMessage.toLowerCase();

          // Check for specific "invalid client secret" first (more specific match)
          if (lowerMessage.includes('invalid client secret')) {
            throw new TokenRefreshError(
              'Invalid client secret',
              'invalid_client_secret',
              {
                suggestion: 'Generate a new client secret in the Twitch Developer Console',
                originalError: errorMessage
              }
            );
          }

          // Check for "invalid client" but NOT "invalid client secret" (already handled above)
          // This handles the generic "invalid client" error which indicates wrong client ID
          if (lowerMessage.includes('invalid client') && !lowerMessage.includes('invalid client secret')) {
            throw new TokenRefreshError(
              'Invalid client ID',
              'invalid_client_id',
              {
                suggestion: 'Check your client ID in the Twitch Developer Console',
                originalError: errorMessage
              }
            );
          }

          if (lowerMessage.includes('invalid refresh token')) {
            throw new TokenRefreshError(
              'Refresh token is invalid or expired',
              'invalid_refresh_token',
              {
                suggestion: 'Run "npm run oauth" to generate new tokens',
                originalError: errorMessage
              }
            );
          }
        }

        if (status === 401) {
          throw new TokenRefreshError(
            'Invalid client credentials',
            'invalid_credentials',
            {
              suggestion: 'Check TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET in config.json',
              originalError: errorMessage
            }
          );
        }

        throw new TokenRefreshError(
          `Token refresh failed: ${errorMessage || 'Unknown error'}`,
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
      invalid_client_id: [
        'Your Client ID is invalid or does not exist.',
        'Go to https://dev.twitch.tv/console/apps to verify your application.',
        'Copy the correct Client ID from your application settings.',
        'Update TWITCH_CLIENT_ID in your config.json with the correct value.'
      ],
      invalid_client_secret: [
        'Your Client Secret is invalid or has been regenerated.',
        'Go to https://dev.twitch.tv/console/apps and manage your application.',
        'Click "New Secret" to generate a new Client Secret.',
        'Update TWITCH_CLIENT_SECRET in your config.json with the new secret.',
        'After updating, run "npm run oauth" to generate new access tokens.'
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
