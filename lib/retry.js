/**
 * Retry logic with exponential backoff
 */

import { Logger } from './logger.js';
import { RETRY } from '../config/constants.js';

/**
 * Retry configuration options
 * @typedef {Object} RetryOptions
 * @property {number} maxRetries - Maximum number of retry attempts (default: 3)
 * @property {number} baseDelay - Base delay in milliseconds (default: 1000)
 * @property {number} maxDelay - Maximum delay in milliseconds (default: 30000)
 * @property {Function} shouldRetry - Function to determine if error should trigger retry
 * @property {Function} onRetry - Callback function called before each retry attempt
 */

/**
 * Execute a function with retry logic and exponential backoff
 * @param {Function} fn - Async function to execute
 * @param {RetryOptions} options - Retry configuration options
 * @returns {Promise<*>} Result from the function
 * @throws {Error} The last error if all retries fail
 */
export async function withRetry(fn, options = {}) {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 30000,
    shouldRetry = () => true,
    onRetry = null
  } = options;

  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // If this is the last attempt, throw the error
      if (attempt === maxRetries) {
        throw error;
      }

      // Check if we should retry this error
      if (!shouldRetry(error, attempt)) {
        throw error;
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);

      Logger.warn(`Attempt ${attempt + 1}/${maxRetries + 1} failed: ${error.message}`);
      Logger.debug(`Retrying in ${delay}ms...`);

      // Call onRetry callback if provided
      if (onRetry) {
        await onRetry(error, attempt, delay);
      }

      // Wait before retrying
      await sleep(delay);
    }
  }

  throw lastError;
}

/**
 * Retry only for specific HTTP status codes
 * @param {Function} fn - Async function to execute
 * @param {number[]} retryableStatusCodes - Array of status codes to retry (default: [429, 500, 502, 503, 504])
 * @param {RetryOptions} options - Additional retry options
 * @returns {Promise<*>} Result from the function
 */
export async function withHttpRetry(fn, retryableStatusCodes = [429, 500, 502, 503, 504], options = {}) {
  return withRetry(fn, {
    ...options,
    shouldRetry: (error, attempt) => {
      // Check if it's an HTTP error with a retryable status code
      if (error.response && retryableStatusCodes.includes(error.response.status)) {
        return true;
      }

      // Check if it's a network error (no response)
      if (!error.response && error.code) {
        // Network errors like ECONNRESET, ETIMEDOUT, etc.
        return true;
      }

      // Call custom shouldRetry if provided
      if (options.shouldRetry) {
        return options.shouldRetry(error, attempt);
      }

      return false;
    }
  });
}

/**
 * Sleep for a specified duration
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Predefined retry strategies
 */
export const RetryStrategies = {
  /**
   * Standard retry - balanced approach for API calls
   */
  STANDARD: {
    maxRetries: RETRY.STANDARD_MAX_RETRIES,
    baseDelay: RETRY.STANDARD_BASE_DELAY_MS,
    maxDelay: RETRY.STANDARD_MAX_DELAY_MS
  }
};
