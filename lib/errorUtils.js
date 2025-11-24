/**
 * Standardized error handling utilities
 * Provides consistent error message extraction across the codebase
 */

/**
 * Safely extract error message from various error types
 * Handles Error objects, strings, and other types consistently
 * 
 * @param {Error|string|any} error - The error to extract message from
 * @returns {string} The error message
 * 
 * @example
 * safeErrorMessage(new Error('Failed')) // Returns: 'Failed'
 * safeErrorMessage('Something went wrong') // Returns: 'Something went wrong'
 * safeErrorMessage(null) // Returns: 'Unknown error'
 * 
 * @note For complex error objects with HTTP status codes or additional context,
 *       consider using formatError() or extractHttpError() instead for richer
 *       error information that's more useful for debugging.
 */
export function safeErrorMessage(error) {
  if (!error) {
    return 'Unknown error';
  }
  
  if (error instanceof Error) {
    return error.message;
  }
  
  if (typeof error === 'string') {
    return error;
  }
  
  // Fallback for other types
  return String(error);
}

/**
 * Extract error message with optional chaining support
 * Checks error?.message first, then falls back to string conversion
 * 
 * @param {Error|string|any} error - The error to extract message from
 * @returns {string} The error message
 * 
 * @example
 * getErrorMessage(new Error('Failed')) // Returns: 'Failed'
 * getErrorMessage({ message: 'Custom' }) // Returns: 'Custom'
 * getErrorMessage('Error text') // Returns: 'Error text'
 */
export function getErrorMessage(error) {
  return error?.message || String(error);
}

/**
 * Check if an error is an instance of a specific error class
 * 
 * @param {any} error - The error to check
 * @param {Function} ErrorClass - The error class to check against
 * @returns {boolean} True if error is instance of ErrorClass
 * 
 * @example
 * isErrorType(new TokenValidationError(), TokenValidationError) // Returns: true
 * isErrorType(new Error(), TokenValidationError) // Returns: false
 */
export function isErrorType(error, ErrorClass) {
  return error instanceof ErrorClass;
}

/**
 * Format error for logging with additional context
 * 
 * @param {Error|string|any} error - The error to format
 * @param {Object} [context] - Additional context to include
 * @returns {Object} Formatted error object
 * 
 * @example
 * formatError(new Error('Failed'), { operation: 'save' })
 * // Returns: { message: 'Failed', name: 'Error', context: { operation: 'save' } }
 */
export function formatError(error, context = {}) {
  return {
    message: safeErrorMessage(error),
    name: error?.name || 'Error',
    stack: error?.stack,
    context
  };
}

/**
 * Extract HTTP error details from axios error
 * 
 * @param {Error} error - Axios error object
 * @returns {Object} HTTP error details
 * 
 * @example
 * extractHttpError(axiosError)
 * // Returns: { status: 401, message: 'Unauthorized', data: {...} }
 */
export function extractHttpError(error) {
  if (error.response) {
    return {
      status: error.response.status,
      statusText: error.response.statusText,
      message: error.response.data?.message || safeErrorMessage(error),
      data: error.response.data
    };
  }
  
  if (error.request) {
    return {
      message: 'No response received from server',
      request: error.request
    };
  }
  
  return {
    message: safeErrorMessage(error)
  };
}
