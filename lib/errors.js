/**
 * Custom error classes for better error handling
 */

/**
 * Base error class for Twitch-related errors
 */
export class TwitchError extends Error {
  constructor(message) {
    super(message);
    this.name = 'TwitchError';
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Error thrown when Twitch API calls fail
 */
export class TwitchApiError extends TwitchError {
  /**
   * @param {string} message - Error message
   * @param {number} statusCode - HTTP status code
   * @param {Object} response - API response data
   */
  constructor(message, statusCode = null, response = null) {
    super(message);
    this.name = 'TwitchApiError';
    this.statusCode = statusCode;
    this.response = response;
  }
}

/**
 * Error thrown when token validation fails
 */
export class TokenValidationError extends TwitchError {
  /**
   * @param {string} message - Error message
   * @param {string} reason - Validation failure reason
   * @param {Object} details - Additional error details
   */
  constructor(message, reason = null, details = {}) {
    super(message);
    this.name = 'TokenValidationError';
    this.reason = reason;
    this.details = details;
  }
}

/**
 * Error thrown when token has incorrect ownership
 */
export class TokenOwnershipError extends TokenValidationError {
  /**
   * @param {string} tokenUserId - User ID from token
   * @param {string} expectedUserId - Expected broadcaster ID
   */
  constructor(tokenUserId, expectedUserId) {
    const message = [
      'Token mismatch!',
      `Token belongs to user ID: ${tokenUserId}`,
      `But broadcaster ID is: ${expectedUserId}`
    ].join('\n');

    super(message, 'ownership_mismatch', { tokenUserId, expectedUserId });
    this.name = 'TokenOwnershipError';
    this.tokenUserId = tokenUserId;
    this.expectedUserId = expectedUserId;
  }
}

/**
 * Error thrown when token is missing required scopes
 */
export class TokenScopeError extends TokenValidationError {
  /**
   * @param {string[]} currentScopes - Scopes the token currently has
   * @param {string[]} requiredScopes - Required scopes
   */
  constructor(currentScopes, requiredScopes) {
    const message = [
      'Missing required scope!',
      `Current scopes: ${currentScopes.join(', ')}`,
      `Required: ${requiredScopes.join(' OR ')}`
    ].join('\n');

    super(message, 'missing_scope', { currentScopes, requiredScopes });
    this.name = 'TokenScopeError';
    this.currentScopes = currentScopes;
    this.requiredScopes = requiredScopes;
  }
}

/**
 * Error thrown when environment configuration is invalid
 */
export class ConfigurationError extends Error {
  /**
   * @param {string} message - Error message
   * @param {string[]} missingFields - List of missing configuration fields
   */
  constructor(message, missingFields = []) {
    super(message);
    this.name = 'ConfigurationError';
    this.missingFields = missingFields;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Error thrown when EventSub subscription fails
 */
export class SubscriptionError extends TwitchApiError {
  /**
   * @param {string} message - Error message
   * @param {string} eventType - Event type being subscribed to
   * @param {number} statusCode - HTTP status code
   * @param {Object} response - API response
   */
  constructor(message, eventType, statusCode = null, response = null) {
    super(message, statusCode, response);
    this.name = 'SubscriptionError';
    this.eventType = eventType;
  }
}

/**
 * Error thrown when WebSocket connection fails
 */
export class WebSocketError extends TwitchError {
  /**
   * @param {string} message - Error message
   * @param {Error} originalError - Original error from WebSocket
   */
  constructor(message, originalError = null) {
    super(message);
    this.name = 'WebSocketError';
    this.originalError = originalError;
  }
}
