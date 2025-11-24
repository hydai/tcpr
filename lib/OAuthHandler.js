import axios from 'axios';
import { TWITCH_URLS, TIMEOUTS } from '../config/constants.js';
import { Logger } from './logger.js';
import { StateTokenManager } from './StateTokenManager.js';

/**
 * Shared OAuth flow handler for both standalone and Electron servers
 * Eliminates code duplication between oauth-server.js and oauth-server-electron.js
 */
export class OAuthHandler {
  /**
   * @param {Object} config
   * @param {string} config.clientId - Twitch Client ID
   * @param {string} config.clientSecret - Twitch Client Secret
   * @param {string} config.redirectUri - OAuth redirect URI
   * @param {Array<string>} config.scopes - OAuth scopes
   */
  constructor(config) {
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.redirectUri = config.redirectUri;
    this.scopes = config.scopes;
    this.stateTokenManager = new StateTokenManager();
  }

  /**
   * Validate input parameters from OAuth callback
   * @param {Object} query - Request query parameters
   * @returns {Object} Validation result with error or null
   */
  validateCallbackParams(query) {
    const { code, state, error, error_description } = query;

    // Validate parameter types to prevent injection attacks
    if (code && typeof code !== 'string') {
      Logger.error('Invalid code parameter type');
      return {
        error: 'invalid_request',
        error_description: encodeURIComponent('Invalid parameter type')
      };
    }
    if (state && typeof state !== 'string') {
      Logger.error('Invalid state parameter type');
      return {
        error: 'invalid_request',
        error_description: encodeURIComponent('Invalid parameter type')
      };
    }

    // Handle OAuth errors from Twitch
    if (error) {
      Logger.error('OAuth Error:', { error, error_description });
      return {
        error,
        error_description: encodeURIComponent(error_description || '')
      };
    }

    // Validate required parameters
    if (!code || !state) {
      Logger.error('Missing code or state parameter');
      return {
        error: 'invalid_request',
        error_description: encodeURIComponent('Missing code or state parameter')
      };
    }

    // Verify and consume state token (CSRF protection)
    if (!this.stateTokenManager.consume(state)) {
      Logger.error('Invalid state token');
      return {
        error: 'invalid_state',
        error_description: encodeURIComponent('State token is invalid or expired')
      };
    }

    return null; // No errors
  }

  /**
   * Generate authorization URL for OAuth flow
   * @returns {Object} Object containing state token and auth URL
   */
  generateAuthUrl() {
    // Validate configuration
    if (!this.clientId || !this.clientSecret) {
      throw new Error('Missing CLIENT_ID or CLIENT_SECRET');
    }

    // Generate a state token for CSRF protection
    const state = this.stateTokenManager.create();

    // Build authorization URL
    const authParams = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: this.scopes.join(' '),
      state: state
    });

    const authUrl = `${TWITCH_URLS.OAUTH_AUTHORIZE}?${authParams.toString()}`;

    Logger.info('Generated OAuth authorization URL');
    Logger.debug('Authorization URL:', authUrl);

    return { state, authUrl };
  }

  /**
   * Exchange authorization code for access token
   * @param {string} code - Authorization code from Twitch
   * @returns {Promise<Object>} Token response data
   */
  async exchangeCodeForToken(code) {
    Logger.info('Exchanging authorization code for access token...');

    const tokenResponse = await axios.post(TWITCH_URLS.OAUTH_TOKEN, null, {
      params: {
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: this.redirectUri
      },
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      timeout: TIMEOUTS.OAUTH_REQUEST
    });

    const { access_token, refresh_token, expires_in, scope, token_type } = tokenResponse.data;

    Logger.success('Successfully obtained access token!');
    Logger.log(`Token Type: ${token_type}`);
    Logger.log(`Expires In: ${expires_in} seconds`);
    Logger.log(`Scopes: ${scope}`);

    return {
      accessToken: access_token,
      refreshToken: refresh_token,
      expiresIn: expires_in,
      scopes: scope,
      tokenType: token_type
    };
  }

  /**
   * Validate token and get user information
   * @param {string} accessToken - Access token to validate
   * @returns {Promise<Object>} User information
   */
  async validateToken(accessToken) {
    const validateResponse = await axios.get(TWITCH_URLS.OAUTH_VALIDATE, {
      headers: {
        'Authorization': `OAuth ${accessToken}`
      },
      timeout: TIMEOUTS.OAUTH_REQUEST
    });

    const { client_id, login, user_id, scopes } = validateResponse.data;

    Logger.success('Token validated successfully!');
    Logger.log(`User Login: ${login}`);
    Logger.log(`User ID: ${user_id}`);

    return {
      clientId: client_id,
      login: login,
      userId: user_id,
      scopes: scopes
    };
  }

  /**
   * Get state token manager statistics
   * @returns {Object} State token statistics
   */
  getStats() {
    return this.stateTokenManager.getStats();
  }
}
