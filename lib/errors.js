/**
 * Custom error classes for better error handling
 * Flattened hierarchy - all errors extend Error directly
 */

/**
 * Error thrown when token validation fails
 * Consolidates ownership and scope errors via reason codes
 */
export class TokenValidationError extends Error {
  /**
   * @param {string} message - Error message
   * @param {string} reason - Validation failure reason ('ownership_mismatch', 'missing_scope', etc.)
   * @param {Object} details - Additional error details
   */
  constructor(message, reason = null, details = {}) {
    super(message);
    this.name = 'TokenValidationError';
    this.reason = reason;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Create ownership mismatch error
   * @param {string} tokenUserId - User ID from token
   * @param {string} expectedUserId - Expected broadcaster ID
   */
  static ownershipMismatch(tokenUserId, expectedUserId) {
    const message = [
      'Token mismatch!',
      `Token belongs to user ID: ${tokenUserId}`,
      `But broadcaster ID is: ${expectedUserId}`
    ].join('\n');

    return new TokenValidationError(message, 'ownership_mismatch', {
      tokenUserId,
      expectedUserId
    });
  }

  /**
   * Create missing scope error
   * @param {string[]} currentScopes - Scopes the token currently has
   * @param {string[]} requiredScopes - Required scopes
   */
  static missingScope(currentScopes, requiredScopes) {
    const message = [
      'Missing required scope!',
      `Current scopes: ${currentScopes.join(', ')}`,
      `Required: ${requiredScopes.join(' OR ')}`
    ].join('\n');

    return new TokenValidationError(message, 'missing_scope', {
      currentScopes,
      requiredScopes
    });
  }
}

/**
 * Error thrown when EventSub subscription fails
 */
export class SubscriptionError extends Error {
  /**
   * @param {string} message - Error message
   * @param {string} eventType - Event type being subscribed to
   * @param {number} statusCode - HTTP status code
   * @param {Object} response - API response
   */
  constructor(message, eventType, statusCode = null, response = null) {
    super(message);
    this.name = 'SubscriptionError';
    this.eventType = eventType;
    this.statusCode = statusCode;
    this.response = response;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Error thrown when WebSocket connection fails
 */
export class WebSocketError extends Error {
  /**
   * @param {string} message - Error message
   * @param {Error} originalError - Original error from WebSocket
   */
  constructor(message, originalError = null) {
    super(message);
    this.name = 'WebSocketError';
    this.originalError = originalError;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Error thrown when token refresh fails
 */
export class TokenRefreshError extends Error {
  /**
   * @param {string} message - Error message
   * @param {string} reason - Refresh failure reason
   * @param {Object} details - Additional error details
   */
  constructor(message, reason, details = {}) {
    super(message);
    this.name = 'TokenRefreshError';
    this.reason = reason;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Credential error detection utilities
 *
 * NOTE: A copy of this utility exists in gui/js/utils.js for use in the
 * Electron renderer process. Keep them in sync! Changes here should be
 * mirrored to gui/js/utils.js.
 *
 * Twitch OAuth token endpoint returns HTTP 400 with these error messages
 * (empirically observed behavior - Twitch API docs don't specify exact messages):
 * - "invalid client" when Client ID is wrong or doesn't exist
 * - "invalid client secret" when Client Secret is wrong or has been regenerated
 * - "Invalid refresh token" when refresh token is expired or revoked
 */
export const CredentialErrors = {
  /**
   * Check if error message indicates invalid client secret
   * @param {string} message - Error message to check
   * @returns {boolean}
   */
  isInvalidClientSecret(message) {
    return (message || '').toLowerCase().includes('invalid client secret');
  },

  /**
   * Check if error message indicates invalid client ID
   * Matches "invalid client" (Twitch's error for wrong Client ID)
   * Excludes: "invalid client secret" (handled separately)
   * @param {string} message - Error message to check
   * @returns {boolean}
   */
  isInvalidClientId(message) {
    const msgLower = (message || '').toLowerCase();
    return msgLower.includes('invalid client') && !msgLower.includes('invalid client secret');
  },

  /**
   * Check if error message indicates any invalid credential error
   * (client ID or client secret)
   * @param {string} message - Error message to check
   * @returns {boolean}
   */
  isInvalidCredentials(message) {
    const msgLower = (message || '').toLowerCase();
    return (
      msgLower.includes('invalid client secret') ||
      (msgLower.includes('invalid client') && !msgLower.includes('invalid client secret'))
    );
  }
};
