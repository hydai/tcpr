/**
 * i18n Helper - Re-exports i18n functions for ES modules
 *
 * The main i18n.js uses window globals for compatibility with HTML onclick handlers.
 * This module provides ES module exports for use in other JS modules.
 */

/**
 * Translation function
 * @param {string} key - Translation key
 * @param {Object} [options] - Interpolation options
 * @returns {string} Translated string
 */
export function t(key, options) {
  // Use the global t function from i18n.js
  if (typeof window.t === 'function') {
    return window.t(key, options);
  }
  // Fallback if i18n not loaded
  return key;
}

/**
 * Get current language
 * @returns {string} Current language code
 */
export function getCurrentLanguage() {
  if (typeof window.getCurrentLanguage === 'function') {
    return window.getCurrentLanguage();
  }
  return 'en';
}

/**
 * Change language
 * @param {string} lang - Language code
 */
export function changeLanguage(lang) {
  if (typeof window.changeLanguage === 'function') {
    window.changeLanguage(lang);
  }
}
