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
 * Create a retry wrapper for API calls
 * @param {Object} axiosInstance - Axios instance or config
 * @param {RetryOptions} defaultOptions - Default retry options
 * @returns {Function} Wrapper function for API calls
 */
export function createRetryWrapper(axiosInstance, defaultOptions = {}) {
  return async (requestConfig, retryOptions = {}) => {
    const options = { ...defaultOptions, ...retryOptions };

    return withHttpRetry(
      () => axiosInstance(requestConfig),
      options.retryableStatusCodes,
      options
    );
  };
}

/**
 * Retry with jitter (randomized delay) to prevent thundering herd
 * @param {Function} fn - Async function to execute
 * @param {RetryOptions} options - Retry configuration options
 * @returns {Promise<*>} Result from the function
 */
export async function withRetryAndJitter(fn, options = {}) {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 30000,
    jitterFactor = 0.3,
    ...restOptions
  } = options;

  return withRetry(fn, {
    ...restOptions,
    maxRetries,
    baseDelay,
    maxDelay,
    onRetry: async (error, attempt, delay) => {
      // Add jitter (random variation) to prevent all clients retrying at once
      const jitter = delay * jitterFactor * Math.random();
      const jitteredDelay = delay + jitter;

      Logger.debug(`Adding jitter: ${jitter.toFixed(0)}ms (total: ${jitteredDelay.toFixed(0)}ms)`);

      // Wait with jittered delay
      await sleep(jitteredDelay - delay);

      // Call original onRetry if provided
      if (options.onRetry) {
        await options.onRetry(error, attempt, jitteredDelay);
      }
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
 * 
 * Note: Currently only STANDARD strategy is actively used in EventSubSubscriber.
 * Other strategies (AGGRESSIVE, CONSERVATIVE, NETWORK) are provided for future use
 * or can be imported when needed for specific retry scenarios.
 */
export const RetryStrategies = {
  /**
   * Aggressive retry - more retries, shorter delays
   */
  AGGRESSIVE: {
    maxRetries: RETRY.AGGRESSIVE_MAX_RETRIES,
    baseDelay: RETRY.AGGRESSIVE_BASE_DELAY_MS,
    maxDelay: RETRY.AGGRESSIVE_MAX_DELAY_MS
  },

  /**
   * Conservative retry - fewer retries, longer delays
   */
  CONSERVATIVE: {
    maxRetries: RETRY.CONSERVATIVE_MAX_RETRIES,
    baseDelay: RETRY.CONSERVATIVE_BASE_DELAY_MS,
    maxDelay: RETRY.CONSERVATIVE_MAX_DELAY_MS
  },

  /**
   * Standard retry - balanced approach
   */
  STANDARD: {
    maxRetries: RETRY.STANDARD_MAX_RETRIES,
    baseDelay: RETRY.STANDARD_BASE_DELAY_MS,
    maxDelay: RETRY.STANDARD_MAX_DELAY_MS
  },

  /**
   * Network retry - optimized for network failures
   */
  NETWORK: {
    maxRetries: 4,
    baseDelay: 1000,
    maxDelay: 30000,
    shouldRetry: (error) => {
      // Retry on network errors
      return !error.response || error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT';
    }
  }
};
