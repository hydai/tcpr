/**
 * OAuth state token management with automatic cleanup
 */

import crypto from 'crypto';
import { Logger } from './logger.js';
import { DEFAULTS } from '../config/constants.js';

/**
 * State token data structure
 * @typedef {Object} StateTokenData
 * @property {number} timestamp - Creation timestamp
 * @property {number} expiresAt - Expiration timestamp
 * @property {Object} [metadata] - Optional metadata
 */

/**
 * Manages OAuth state tokens with automatic cleanup
 */
export class StateTokenManager {
  /**
   * Create a new StateTokenManager
   * @param {Object} options - Configuration options
   * @param {number} [options.ttl] - Time to live in milliseconds (default: 5 minutes)
   * @param {number} [options.cleanupInterval] - Cleanup interval in milliseconds (default: 1 minute)
   * @param {number} [options.tokenLength] - Token length in bytes (default: 16)
   */
  constructor(options = {}) {
    this.ttl = options.ttl || DEFAULTS.STATE_TOKEN_EXPIRY;
    this.cleanupInterval = options.cleanupInterval || 60 * 1000; // 1 minute
    this.tokenLength = options.tokenLength || 16;
    this.tokens = new Map();
    this.cleanupTimer = null;

    // Start automatic cleanup
    this.startCleanup();
  }

  /**
   * Create a new state token
   * @param {Object} [metadata] - Optional metadata to associate with the token
   * @returns {string} The generated state token
   */
  create(metadata = null) {
    const token = crypto.randomBytes(this.tokenLength).toString('hex');
    const now = Date.now();

    this.tokens.set(token, {
      timestamp: now,
      expiresAt: now + this.ttl,
      metadata
    });

    Logger.debug(`Created state token: ${token.substring(0, 8)}... (expires in ${this.ttl}ms)`);

    return token;
  }

  /**
   * Validate and consume a state token
   * @param {string} token - The state token to validate
   * @returns {StateTokenData|null} Token data if valid, null if invalid or expired
   */
  validate(token) {
    const data = this.tokens.get(token);

    if (!data) {
      Logger.debug(`State token not found: ${token.substring(0, 8)}...`);
      return null;
    }

    // Check expiration
    if (data.expiresAt < Date.now()) {
      Logger.debug(`State token expired: ${token.substring(0, 8)}...`);
      this.tokens.delete(token);
      return null;
    }

    Logger.debug(`State token validated: ${token.substring(0, 8)}...`);
    return data;
  }

  /**
   * Validate and consume a state token (removes after validation)
   * @param {string} token - The state token to validate
   * @returns {StateTokenData|null} Token data if valid, null if invalid or expired
   */
  consume(token) {
    const data = this.validate(token);

    if (data) {
      this.tokens.delete(token);
      Logger.debug(`State token consumed: ${token.substring(0, 8)}...`);
    }

    return data;
  }

  /**
   * Check if a token exists and is valid
   * @param {string} token - The state token to check
   * @returns {boolean} True if token is valid
   */
  has(token) {
    return this.validate(token) !== null;
  }

  /**
   * Manually delete a token
   * @param {string} token - The state token to delete
   * @returns {boolean} True if token was deleted
   */
  delete(token) {
    return this.tokens.delete(token);
  }

  /**
   * Get metadata associated with a token
   * @param {string} token - The state token
   * @returns {Object|null} Metadata if token exists, null otherwise
   */
  getMetadata(token) {
    const data = this.validate(token);
    return data ? data.metadata : null;
  }

  /**
   * Cleanup expired tokens
   * @returns {number} Number of tokens cleaned up
   */
  cleanup() {
    const now = Date.now();
    let cleaned = 0;

    for (const [token, data] of this.tokens.entries()) {
      if (data.expiresAt < now) {
        this.tokens.delete(token);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      Logger.debug(`Cleaned up ${cleaned} expired state token(s)`);
    }

    return cleaned;
  }

  /**
   * Start automatic cleanup timer
   */
  startCleanup() {
    if (this.cleanupTimer) {
      return; // Already started
    }

    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.cleanupInterval);

    // Ensure cleanup timer doesn't prevent process from exiting
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }

    Logger.debug(`Started automatic state token cleanup (interval: ${this.cleanupInterval}ms)`);
  }

  /**
   * Stop automatic cleanup timer
   */
  stopCleanup() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
      Logger.debug('Stopped automatic state token cleanup');
    }
  }

  /**
   * Get current token count
   * @returns {number} Number of active tokens
   */
  size() {
    return this.tokens.size;
  }

  /**
   * Clear all tokens
   */
  clear() {
    const count = this.tokens.size;
    this.tokens.clear();
    Logger.debug(`Cleared all state tokens (${count} tokens)`);
  }

  /**
   * Get statistics about token storage
   * @returns {Object} Statistics object
   */
  getStats() {
    const now = Date.now();
    let expired = 0;
    let active = 0;

    for (const data of this.tokens.values()) {
      if (data.expiresAt < now) {
        expired++;
      } else {
        active++;
      }
    }

    return {
      total: this.tokens.size,
      active,
      expired,
      ttl: this.ttl,
      cleanupInterval: this.cleanupInterval
    };
  }

  /**
   * Destroy the manager and cleanup resources
   */
  destroy() {
    this.stopCleanup();
    this.clear();
    Logger.debug('StateTokenManager destroyed');
  }
}
