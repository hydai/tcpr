/**
 * EventSub subscription manager
 */

import axios from 'axios';
import { TWITCH_URLS } from '../config/constants.js';
import { Logger } from '../lib/logger.js';
import { SubscriptionError } from '../lib/errors.js';
import { withHttpRetry, RetryStrategies } from '../lib/retry.js';

/**
 * Subscription configuration
 * @typedef {Object} SubscriptionConfig
 * @property {string} type - Event type to subscribe to
 * @property {string} version - Event version
 * @property {Object} condition - Subscription condition
 */

/**
 * Manages EventSub subscriptions
 */
export class EventSubSubscriber {
  /**
   * Create a new EventSubSubscriber
   * @param {string} clientId - Twitch client ID
   * @param {string} accessToken - Twitch access token
   */
  constructor(clientId, accessToken) {
    this.clientId = clientId;
    this.accessToken = accessToken;
    this.subscriptions = new Map();
  }

  /**
   * Subscribe to an EventSub event
   * @param {SubscriptionConfig} config - Subscription configuration
   * @param {string} sessionId - WebSocket session ID
   * @param {Object} [options] - Additional options
   * @param {boolean} [options.retry] - Enable retry on failure (default: true)
   * @returns {Promise<Object>} Subscription data from API
   * @throws {SubscriptionError} If subscription fails
   */
  async subscribe(config, sessionId, options = {}) {
    const { retry = true } = options;

    Logger.info(`Subscribing to ${config.type}...`);

    const subscriptionData = {
      type: config.type,
      version: config.version,
      condition: config.condition,
      transport: {
        method: 'websocket',
        session_id: sessionId
      }
    };

    const makeRequest = async () => {
      try {
        const response = await axios.post(
          `${TWITCH_URLS.API}/eventsub/subscriptions`,
          subscriptionData,
          {
            headers: {
              'Client-ID': this.clientId,
              'Authorization': `Bearer ${this.accessToken}`,
              'Content-Type': 'application/json'
            }
          }
        );

        const subscription = response.data.data[0];

        // Store subscription
        this.subscriptions.set(subscription.id, {
          ...subscription,
          config
        });

        Logger.success('Subscription successful!');
        Logger.log(`Subscription ID: ${subscription.id}`);
        Logger.log(`Status: ${subscription.status}`);

        return subscription;
      } catch (error) {
        Logger.error('Failed to subscribe to event:');

        if (error.response) {
          Logger.log(`Status: ${error.response.status}`);
          Logger.log(`Error: ${JSON.stringify(error.response.data, null, 2)}`);

          throw new SubscriptionError(
            `Failed to subscribe to ${config.type}`,
            config.type,
            error.response.status,
            error.response.data
          );
        }

        throw new SubscriptionError(
          `Failed to subscribe to ${config.type}: ${error.message}`,
          config.type
        );
      }
    };

    // Use retry if enabled
    if (retry) {
      return withHttpRetry(
        makeRequest,
        [429, 500, 502, 503, 504], // Retry on these status codes
        {
          ...RetryStrategies.STANDARD,
          onRetry: (error, attempt, delay) => {
            Logger.warn(`Subscription attempt failed, retrying...`);
          }
        }
      );
    }

    return makeRequest();
  }

  /**
   * Unsubscribe from an event
   * @param {string} subscriptionId - Subscription ID to remove
   * @returns {Promise<void>}
   */
  async unsubscribe(subscriptionId) {
    try {
      await axios.delete(
        `${TWITCH_URLS.API}/eventsub/subscriptions?id=${subscriptionId}`,
        {
          headers: {
            'Client-ID': this.clientId,
            'Authorization': `Bearer ${this.accessToken}`
          }
        }
      );

      this.subscriptions.delete(subscriptionId);
      Logger.success(`Unsubscribed from ${subscriptionId}`);
    } catch (error) {
      Logger.error(`Failed to unsubscribe from ${subscriptionId}:`, error);
      throw error;
    }
  }

  /**
   * Get all active subscriptions
   * @returns {Promise<Array>} List of subscriptions
   */
  async getSubscriptions() {
    try {
      const response = await axios.get(
        `${TWITCH_URLS.API}/eventsub/subscriptions`,
        {
          headers: {
            'Client-ID': this.clientId,
            'Authorization': `Bearer ${this.accessToken}`
          }
        }
      );

      return response.data.data;
    } catch (error) {
      Logger.error('Failed to get subscriptions:', error);
      throw error;
    }
  }

  /**
   * Delete all subscriptions
   * @returns {Promise<void>}
   */
  async deleteAll() {
    const subscriptions = await this.getSubscriptions();

    for (const sub of subscriptions) {
      await this.unsubscribe(sub.id);
    }

    Logger.success('All subscriptions deleted');
  }

  /**
   * Handle subscription revocation
   * @param {string} subscriptionId - Revoked subscription ID
   * @param {string} reason - Revocation reason
   */
  handleRevocation(subscriptionId, reason) {
    Logger.warn(`Subscription ${subscriptionId} revoked: ${reason}`);
    this.subscriptions.delete(subscriptionId);
  }

  /**
   * Get subscription by ID
   * @param {string} subscriptionId - Subscription ID
   * @returns {Object|null} Subscription data or null
   */
  getSubscription(subscriptionId) {
    return this.subscriptions.get(subscriptionId) || null;
  }

  /**
   * Get all stored subscriptions
   * @returns {Array} Array of subscriptions
   */
  getAllSubscriptions() {
    return Array.from(this.subscriptions.values());
  }

  /**
   * Get subscription count
   * @returns {number} Number of active subscriptions
   */
  getSubscriptionCount() {
    return this.subscriptions.size;
  }
}
