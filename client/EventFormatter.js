/**
 * Event data formatter for display
 */

import { Logger } from '../lib/logger.js';

/**
 * Formats EventSub event data for display
 */
export class EventFormatter {
  /**
   * Format a custom reward creation event
   * @param {Object} event - Event data from EventSub
   */
  static formatRewardCreated(event) {
    const details = {
      'Reward Title': event.title,
      'Cost': `${event.cost} points`,
      'Reward ID': event.id,
      'Broadcaster': `${event.broadcaster_user_name} (${event.broadcaster_user_login})`,
      'Enabled': event.is_enabled,
      'User Input Required': event.is_user_input_required
    };

    // Add optional fields if present
    if (event.prompt) {
      details['Prompt'] = event.prompt;
    }

    if (event.background_color) {
      details['Background Color'] = event.background_color;
    }

    if (event.global_cooldown_setting?.is_enabled) {
      details['Global Cooldown'] = `${event.global_cooldown_setting.global_cooldown_seconds}s`;
    }

    if (event.max_per_stream_setting?.is_enabled) {
      details['Max Per Stream'] = event.max_per_stream_setting.max_per_stream;
    }

    if (event.max_per_user_per_stream_setting?.is_enabled) {
      details['Max Per User Per Stream'] = event.max_per_user_per_stream_setting.max_per_user_per_stream;
    }

    Logger.eventNotification('🎁 CUSTOM REWARD CREATED EVENT RECEIVED!', details);

    // Show full event data
    Logger.log('\nFull event data:');
    Logger.log(JSON.stringify(event, null, 2));
    Logger.log('\n');
  }

  /**
   * Format a custom reward update event
   * @param {Object} event - Event data from EventSub
   */
  static formatRewardUpdated(event) {
    const details = {
      'Reward Title': event.title,
      'Cost': `${event.cost} points`,
      'Reward ID': event.id,
      'Broadcaster': `${event.broadcaster_user_name} (${event.broadcaster_user_login})`,
      'Enabled': event.is_enabled
    };

    Logger.eventNotification('🔄 CUSTOM REWARD UPDATED EVENT RECEIVED!', details);

    Logger.log('\nFull event data:');
    Logger.log(JSON.stringify(event, null, 2));
    Logger.log('\n');
  }

  /**
   * Format a redemption event
   * @param {Object} event - Event data from EventSub
   */
  static formatRedemption(event) {
    const details = {
      'Redemption ID': event.id,
      'Redeemer': `${event.user_name} (${event.user_login})`,
      'Redeemer User ID': event.user_id,
      'Broadcaster': `${event.broadcaster_user_name} (${event.broadcaster_user_login})`,
      'Broadcaster User ID': event.broadcaster_user_id,
      'Reward': event.reward.title,
      'Reward ID': event.reward.id,
      'Cost': `${event.reward.cost} points`,
      'Status': event.status,
      'Redeemed At': event.redeemed_at
    };

    if (event.user_input) {
      details['User Input'] = event.user_input;
    }

    Logger.eventNotification('⭐ REWARD REDEMPTION EVENT RECEIVED!', details);

    Logger.log('\nFull event data:');
    Logger.log(JSON.stringify(event, null, 2));
    Logger.log('\n');
  }

  /**
   * Format a generic event
   * @param {string} eventType - Type of event
   * @param {Object} event - Event data from EventSub
   */
  static formatGeneric(eventType, event) {
    Logger.eventNotification(`📬 EVENT RECEIVED: ${eventType}`, {
      'Event Type': eventType,
      'Event ID': event.id || 'N/A'
    });

    Logger.log('\nFull event data:');
    Logger.log(JSON.stringify(event, null, 2));
    Logger.log('\n');
  }

  /**
   * Format event based on subscription type
   * @param {string} subscriptionType - Subscription type
   * @param {Object} event - Event data
   */
  static format(subscriptionType, event) {
    switch (subscriptionType) {
      case 'channel.channel_points_custom_reward.add':
        EventFormatter.formatRewardCreated(event);
        break;

      case 'channel.channel_points_custom_reward.update':
        EventFormatter.formatRewardUpdated(event);
        break;

      case 'channel.channel_points_custom_reward_redemption.add':
      case 'channel.channel_points_custom_reward_redemption.update':
        EventFormatter.formatRedemption(event);
        break;

      default:
        EventFormatter.formatGeneric(subscriptionType, event);
    }
  }

  /**
   * Format session welcome message
   * @param {Object} session - Session data from welcome message
   */
  static formatWelcome(session) {
    Logger.info(`Session ID: ${session.id}`);
    Logger.info(`Keepalive timeout: ${session.keepalive_timeout_seconds}s`);

    if (session.reconnect_url) {
      Logger.debug(`Reconnect URL available: ${session.reconnect_url}`);
    }
  }

  /**
   * Format revocation message
   * @param {Object} subscription - Subscription data from revocation
   */
  static formatRevocation(subscription) {
    Logger.warn('Subscription revoked:');
    Logger.log(`  Type: ${subscription.type}`);
    Logger.log(`  Status: ${subscription.status}`);

    if (subscription.id) {
      Logger.log(`  ID: ${subscription.id}`);
    }
  }
}
