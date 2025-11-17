/**
 * Consistent logging utility
 */

/**
 * Logger class for standardized logging across the application
 */
export class Logger {
  /**
   * Log informational messages
   * @param {string} message - The message to log
   * @param {Object} data - Optional data to include
   */
  static info(message, data = null) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${message}`);
    if (data) {
      console.log(data);
    }
  }

  /**
   * Log error messages
   * @param {string} message - The error message
   * @param {Error|Object} error - Optional error object or data
   */
  static error(message, error = null) {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] ❌ ${message}`);
    if (error) {
      if (error instanceof Error) {
        console.error(error.message);
        if (process.env.DEBUG) {
          console.error(error.stack);
        }
      } else {
        console.error(error);
      }
    }
  }

  /**
   * Log warning messages
   * @param {string} message - The warning message
   * @param {Object} data - Optional data to include
   */
  static warn(message, data = null) {
    const timestamp = new Date().toISOString();
    console.warn(`[${timestamp}] ⚠️  ${message}`);
    if (data) {
      console.warn(data);
    }
  }

  /**
   * Log success messages
   * @param {string} message - The success message
   * @param {Object} data - Optional data to include
   */
  static success(message, data = null) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ✅ ${message}`);
    if (data) {
      console.log(data);
    }
  }

  /**
   * Log debug messages (only in debug mode)
   * @param {string} message - The debug message
   * @param {Object} data - Optional data to include
   */
  static debug(message, data = null) {
    if (process.env.DEBUG) {
      const timestamp = new Date().toISOString();
      console.debug(`[${timestamp}] [DEBUG] ${message}`);
      if (data) {
        console.debug(data);
      }
    }
  }

  /**
   * Log a simple message without timestamp
   * @param {string} message - The message to log
   */
  static log(message) {
    console.log(message);
  }

  /**
   * Log a divider line
   * @param {string} char - Character to use for divider
   * @param {number} length - Length of divider
   */
  static divider(char = '─', length = 60) {
    console.log(char.repeat(length));
  }

  /**
   * Log a header with dividers
   * @param {string} title - Header title
   * @param {string} char - Character to use for dividers
   * @param {number} length - Length of dividers
   */
  static header(title, char = '═', length = 80) {
    console.log('\n' + char.repeat(length));
    console.log(title);
    console.log(char.repeat(length));
  }

  /**
   * Log EventSub message with formatted timestamp
   * @param {string} messageType - Type of EventSub message
   */
  static eventSubMessage(messageType) {
    console.log(`\n[${new Date().toISOString()}] Message Type: ${messageType}`);
  }

  /**
   * Log event notification with decorative formatting
   * @param {string} title - Event title
   * @param {Object} details - Event details to display
   */
  static eventNotification(title, details = {}) {
    console.log('\n' + title);
    Logger.divider('━', 60);

    Object.entries(details).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        console.log(`${key}: ${value}`);
      }
    });

    Logger.divider('━', 60);
  }

  /**
   * Log configuration status
   * @param {Object} config - Configuration object
   * @param {boolean} showValues - Whether to show actual values (default: false for security)
   */
  static configStatus(config, showValues = false) {
    console.log('\nConfiguration:');
    Object.entries(config).forEach(([key, value]) => {
      if (value && typeof value === 'string') {
        const display = showValues ? value : '✓ Set';
        console.log(`- ${key}: ${display}`);
      } else if (value && typeof value === 'number') {
        console.log(`- ${key}: ${value}`);
      } else {
        console.log(`- ${key}: ✗ Missing`);
      }
    });
  }

  /**
   * Log a boxed message
   * @param {string[]} lines - Array of message lines
   * @param {string} char - Border character
   */
  static box(lines, char = '=') {
    const maxLength = Math.max(...lines.map(l => l.length));
    const border = char.repeat(maxLength + 4);

    console.log('\n' + border);
    lines.forEach(line => {
      const padding = ' '.repeat(maxLength - line.length);
      console.log(`${char} ${line}${padding} ${char}`);
    });
    console.log(border + '\n');
  }
}
