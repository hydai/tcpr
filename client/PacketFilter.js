/**
 * PacketFilter - Filter keepalive and points events
 *
 * This module provides filtering capabilities for WebSocket messages,
 * allowing selective processing of keepalive and points-related events.
 */

import { MESSAGE_TYPES, EVENT_TYPES } from '../config/constants.js';

/**
 * Filter options configuration
 * @typedef {Object} FilterOptions
 * @property {boolean} allowKeepalive - Whether to allow keepalive messages (default: false)
 * @property {boolean} allowRewardAdd - Whether to allow reward add events (default: true)
 * @property {boolean} allowRewardUpdate - Whether to allow reward update events (default: true)
 * @property {boolean} allowRedemptionAdd - Whether to allow redemption add events (default: true)
 * @property {boolean} allowRedemptionUpdate - Whether to allow redemption update events (default: true)
 */

export class PacketFilter {
  /**
   * Default filter configuration
   * @private
   */
  static defaultOptions = {
    allowKeepalive: false,
    allowRewardAdd: true,
    allowRewardUpdate: true,
    allowRedemptionAdd: true,
    allowRedemptionUpdate: true,
  };

  /**
   * Current filter options
   * @private
   */
  static options = { ...PacketFilter.defaultOptions };

  /**
   * Configure filter options
   * @param {FilterOptions} newOptions - Filter configuration options
   */
  static configure(newOptions) {
    this.options = { ...this.options, ...newOptions };
  }

  /**
   * Reset filter options to defaults
   */
  static reset() {
    this.options = { ...this.defaultOptions };
  }

  /**
   * Get current filter configuration
   * @returns {FilterOptions} Current filter options
   */
  static getConfig() {
    return { ...this.options };
  }

  /**
   * Filter session keepalive messages
   * @param {Object} message - The message object
   * @returns {boolean} true if message should be processed
   */
  static shouldProcessKeepalive(message) {
    return this.options.allowKeepalive;
  }

  /**
   * Filter points/reward events based on event type
   * @param {string} eventType - The event subscription type
   * @returns {boolean} true if event should be processed
   */
  static shouldProcessPointsEvent(eventType) {
    switch (eventType) {
      case EVENT_TYPES.REWARD_ADD:
        return this.options.allowRewardAdd;

      case EVENT_TYPES.REWARD_UPDATE:
        return this.options.allowRewardUpdate;

      case EVENT_TYPES.REDEMPTION_ADD:
        return this.options.allowRedemptionAdd;

      case EVENT_TYPES.REDEMPTION_UPDATE:
        return this.options.allowRedemptionUpdate;

      default:
        // Allow non-points events by default
        return true;
    }
  }

  /**
   * Main filter method - determines if a message should be processed
   * @param {Object} message - Full message with metadata and payload
   * @returns {boolean} true if message should be processed
   */
  static filter(message) {
    const { metadata, payload } = message;

    // Filter keepalive messages
    if (metadata.message_type === MESSAGE_TYPES.SESSION_KEEPALIVE) {
      return this.shouldProcessKeepalive(message);
    }

    // Filter notification events (including points events)
    if (metadata.message_type === MESSAGE_TYPES.NOTIFICATION) {
      const eventType = payload?.subscription?.type;
      return this.shouldProcessPointsEvent(eventType);
    }

    // Allow all other message types (welcome, reconnect, revocation)
    return true;
  }

  /**
   * Check if a message type is a keepalive
   * @param {Object} message - The message object
   * @returns {boolean} true if message is keepalive
   */
  static isKeepalive(message) {
    return message?.metadata?.message_type === MESSAGE_TYPES.SESSION_KEEPALIVE;
  }

  /**
   * Check if an event type is a points-related event
   * @param {string} eventType - The event subscription type
   * @returns {boolean} true if event is points-related
   */
  static isPointsEvent(eventType) {
    return Object.values(EVENT_TYPES).includes(eventType);
  }
}

export default PacketFilter;
