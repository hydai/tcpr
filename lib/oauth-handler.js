/**
 * Shared OAuth handler logic for both CLI and Electron OAuth servers
 *
 * This module provides the core OAuth functionality used by both
 * oauth-server.js and electron/oauth-server-electron.js
 */

import axios from 'axios';
import { TWITCH_URLS, DEFAULT_OAUTH_SCOPES, DEFAULTS } from '../config/constants.js';
import { Logger } from './logger.js';

/**
 * Parse scope value from Twitch API response into an array
 * @param {string|string[]|undefined|null} scope - Scope value from API
 * @returns {string[]} Array of scopes
 */
function parseScopes(scope) {
  if (Array.isArray(scope)) {
    return scope;
  }
  if (scope) {
    return scope.split(' ');
  }
  return [];
}

/**
 * Parse and validate port value for OAuth server configuration.
 * Handles string, number, undefined, or invalid inputs and returns a valid port number.
 * Validates that the port is within the valid TCP port range (0-65535).
 * Port 0 is valid and tells the OS to assign an available ephemeral port.
 *
 * @param {number|string|undefined|null} port - Port value to parse (can be string from env, number, or undefined/null)
 * @returns {number} Valid port number, defaults to DEFAULTS.PORT (3000) if input is invalid or out of range
 * @example
 * parsePort(8080)      // returns 8080
 * parsePort('3001')    // returns 3001
 * parsePort(0)         // returns 0 (OS assigns available port)
 * parsePort(undefined) // returns 3000 (default)
 * parsePort('invalid') // returns 3000 (default)
 * parsePort(99999)     // returns 3000 (default, out of range)
 */
export function parsePort(port) {
  const portValue = parseInt(port ?? DEFAULTS.PORT, 10);
  if (isNaN(portValue) || portValue < 0 || portValue > 65535) {
    return DEFAULTS.PORT;
  }
  return portValue;
}

/**
 * OAuth handler configuration
 * @typedef {Object} OAuthConfig
 * @property {string} clientId - Twitch Client ID
 * @property {string} clientSecret - Twitch Client Secret
 * @property {string} redirectUri - OAuth redirect URI
 * @property {string[]} [scopes] - OAuth scopes (defaults to DEFAULT_OAUTH_SCOPES)
 */

/**
 * Token exchange result
 * @typedef {Object} TokenResult
 * @property {string} accessToken - Access token
 * @property {string} refreshToken - Refresh token
 * @property {number} expiresIn - Token expiration time in seconds
 * @property {string[]} scopes - Granted scopes
 * @property {string} tokenType - Token type
 */

/**
 * User info from token validation
 * @typedef {Object} UserInfo
 * @property {string} userId - User ID
 * @property {string} login - User login name
 * @property {string} clientId - Client ID
 * @property {string[]} scopes - Token scopes
 */

/**
 * Build Twitch OAuth authorization URL
 * @param {OAuthConfig} config - OAuth configuration
 * @param {string} state - CSRF state token
 * @returns {string} Authorization URL
 */
export function buildAuthUrl(config, state) {
  const scopes = config.scopes || DEFAULT_OAUTH_SCOPES;

  const authParams = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: scopes.join(' '),
    state: state
  });

  return `${TWITCH_URLS.OAUTH_AUTHORIZE}?${authParams.toString()}`;
}

/**
 * Exchange authorization code for access token
 * @param {OAuthConfig} config - OAuth configuration
 * @param {string} code - Authorization code from callback
 * @returns {Promise<TokenResult>} Token data
 * @throws {Error} If token exchange fails
 */
export async function exchangeCodeForToken(config, code) {
  Logger.info('Exchanging authorization code for access token...');

  const response = await axios.post(TWITCH_URLS.OAUTH_TOKEN, null, {
    params: {
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code: code,
      grant_type: 'authorization_code',
      redirect_uri: config.redirectUri
    },
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  });

  const { access_token, refresh_token, expires_in, scope, token_type } = response.data;

  Logger.success('Successfully obtained access token!');
  Logger.log(`Token Type: ${token_type}`);
  Logger.log(`Expires In: ${expires_in} seconds`);
  Logger.log(`Scopes: ${scope}`);

  return {
    accessToken: access_token,
    refreshToken: refresh_token,
    expiresIn: expires_in,
    scopes: parseScopes(scope),
    tokenType: token_type
  };
}

/**
 * Validate token and get user information
 * @param {string} accessToken - Access token to validate
 * @returns {Promise<UserInfo>} User information
 * @throws {Error} If validation fails
 */
export async function validateAndGetUserInfo(accessToken) {
  const response = await axios.get(TWITCH_URLS.OAUTH_VALIDATE, {
    headers: {
      'Authorization': `OAuth ${accessToken}`
    }
  });

  const { client_id, login, user_id, scopes } = response.data;

  Logger.success('Token validated successfully!');
  Logger.log(`User Login: ${login}`);
  Logger.log(`User ID: ${user_id}`);
  Logger.log(`Client ID: ${client_id}`);

  return {
    userId: user_id,
    login,
    clientId: client_id,
    scopes
  };
}

/**
 * Build error redirect URL
 * @param {string} error - Error code
 * @param {string} [description] - Error description
 * @returns {string} Redirect URL with error parameters
 */
export function buildErrorRedirect(error, description = '') {
  const params = new URLSearchParams({
    error: error,
    error_description: description
  });
  return `/?${params.toString()}`;
}

/**
 * Build success redirect URL
 * @param {Object} params - Redirect parameters
 * @param {string} params.accessToken - Access token
 * @param {string} [params.userId] - User ID
 * @param {string} [params.username] - Username
 * @returns {string} Redirect URL with success parameters
 */
export function buildSuccessRedirect(params) {
  const urlParams = new URLSearchParams();

  if (params.accessToken) {
    urlParams.set('access_token', params.accessToken);
  }
  if (params.userId) {
    urlParams.set('user_id', params.userId);
  }
  if (params.username) {
    urlParams.set('username', params.username);
  }
  if (params.success !== undefined) {
    urlParams.set('success', String(params.success));
  }

  return `/?${urlParams.toString()}`;
}

/**
 * Log token information to console (for CLI mode)
 * @param {TokenResult} tokens - Token data
 * @param {UserInfo} userInfo - User information
 */
export function logTokenInfo(tokens, userInfo) {
  Logger.header('TWITCH OAUTH SUCCESSFUL', '=', 80);
  Logger.log('\n⚠️  WARNING: Access token will be displayed. Do not share or commit this token!\n');
  Logger.log('Add these values to your config.json file:\n');
  Logger.log(`TWITCH_ACCESS_TOKEN=${tokens.accessToken}`);
  Logger.log(`TWITCH_BROADCASTER_ID=${userInfo.userId}`);
  if (tokens.refreshToken) {
    Logger.log(`TWITCH_REFRESH_TOKEN=${tokens.refreshToken}`);
  }
  Logger.log('\nUser Information:');
  Logger.log(`Username: ${userInfo.login}`);
  Logger.log(`User ID: ${userInfo.userId}`);
  Logger.log(`Scopes: ${userInfo.scopes.join(', ')}`);
  Logger.divider('=', 80);
  Logger.log('');
}

/**
 * Get health check response data
 * @param {OAuthConfig} config - OAuth configuration
 * @param {Object} stateTokenStats - State token manager statistics
 * @returns {Object} Health check response
 */
export function getHealthCheckResponse(config, stateTokenStats) {
  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
    config: {
      clientId: config.clientId ? '✓ Set' : '✗ Missing',
      clientSecret: config.clientSecret ? '✓ Set' : '✗ Missing',
      redirectUri: config.redirectUri
    },
    stateTokens: {
      total: stateTokenStats.total,
      active: stateTokenStats.active,
      expired: stateTokenStats.expired
    }
  };
}
