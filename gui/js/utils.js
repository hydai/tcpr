/**
 * Shared Utilities
 */

// Time constants
export const OAUTH_TIMEOUT_MS = 300000; // 5 minutes
export const MAX_EVENTS_IN_MEMORY = 10000;
export const MAX_EVENTS_DISPLAY = 100;
export const HOUR_MS = 3600000;
export const MINUTE_MS = 60000;
export const SECOND_MS = 1000;
export const TOKEN_WARNING_THRESHOLD_MS = 10 * MINUTE_MS;

// SVG icon definitions for alert messages
const ALERT_ICONS = {
  success: {
    paths: [
      { element: 'path', d: 'M22 11.08V12a10 10 0 1 1-5.93-9.14' },
      { element: 'polyline', points: '22 4 12 14.01 9 11.01' }
    ]
  },
  error: {
    paths: [
      { element: 'circle', cx: '12', cy: '12', r: '10' },
      { element: 'line', x1: '15', y1: '9', x2: '9', y2: '15' },
      { element: 'line', x1: '9', y1: '9', x2: '15', y2: '15' }
    ]
  }
};

/**
 * Create an alert element with icon and message
 * @param {string} type - 'success' or 'error'
 * @param {string} message - Alert message text
 * @returns {HTMLElement} Alert div element
 */
export function createAlertElement(type, message) {
  const alertDiv = document.createElement('div');
  alertDiv.className = `alert alert-${type}`;

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '20');
  svg.setAttribute('height', '20');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');

  const iconDef = ALERT_ICONS[type];
  if (iconDef) {
    for (const pathDef of iconDef.paths) {
      const el = document.createElementNS('http://www.w3.org/2000/svg', pathDef.element);
      for (const [attr, value] of Object.entries(pathDef)) {
        if (attr !== 'element') {
          el.setAttribute(attr, value);
        }
      }
      svg.appendChild(el);
    }
  }

  const span = document.createElement('span');
  span.textContent = message;

  alertDiv.appendChild(svg);
  alertDiv.appendChild(span);

  return alertDiv;
}

/**
 * Format duration from milliseconds
 * @param {number} elapsed - Elapsed time in ms
 * @returns {string} Formatted duration string
 */
export function formatDuration(elapsed) {
  const hours = Math.floor(elapsed / HOUR_MS);
  const minutes = Math.floor((elapsed % HOUR_MS) / MINUTE_MS);
  const seconds = Math.floor((elapsed % MINUTE_MS) / SECOND_MS);

  const parts = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  parts.push(`${seconds}s`);

  return parts.join(' ');
}

/**
 * Escape HTML to prevent XSS
 * @param {string} unsafe - Unsafe string
 * @returns {string} Escaped string
 */
export function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Escapes a value for CSV output according to RFC 4180
 * @param {*} field - Field value
 * @returns {string} Escaped CSV field
 */
export function escapeCSVField(field) {
  const str = String(field).replace(/"/g, '""');
  return `"${str}"`;
}

/**
 * Convert events to CSV format
 * @param {Array} events - Events array
 * @returns {string} CSV content
 */
export function convertToCSV(events) {
  const headers = ['Timestamp', 'Type', 'Message'];
  const rows = [headers.map(escapeCSVField).join(',')];

  events.forEach(event => {
    rows.push([event.timestamp, event.type, event.message].map(escapeCSVField).join(','));
  });

  return rows.join('\r\n');
}

/**
 * Credential error detection utilities for the renderer process
 *
 * NOTE: This is a copy of CredentialErrors from lib/errors.js for use in the
 * renderer process. Keep these in sync! The canonical implementation is in
 * lib/errors.js - any changes should be made there first, then mirrored here.
 *
 * Twitch OAuth token endpoint returns HTTP 400 with these error messages
 * (empirically observed behavior - Twitch API docs don't specify exact messages):
 * - "invalid client" when Client ID is wrong or doesn't exist
 * - "invalid client secret" when Client Secret is wrong or has been regenerated
 */
export const CredentialErrors = {
  /**
   * Check if error message indicates invalid client secret
   * @param {string} message - Error message to check
   * @returns {boolean}
   */
  isInvalidClientSecret(message) {
    return (message || '').toLowerCase().includes('invalid client secret');
  },

  /**
   * Check if error message indicates invalid client ID
   * Matches:
   * - "invalid client" (Twitch's error for wrong Client ID)
   * - "invalid client id" (our own error message format)
   * Excludes: "invalid client secret" (handled separately)
   * @param {string} message - Error message to check
   * @returns {boolean}
   */
  isInvalidClientId(message) {
    const msgLower = (message || '').toLowerCase();
    return msgLower.includes('invalid client') && !msgLower.includes('invalid client secret');
  },

  /**
   * Check if error message indicates any invalid credential error
   * (client ID or client secret)
   * @param {string} message - Error message to check
   * @returns {boolean}
   */
  isInvalidCredentials(message) {
    const msgLower = (message || '').toLowerCase();
    return (
      msgLower.includes('invalid client secret') ||
      msgLower.includes('invalid client id') ||
      (msgLower.includes('invalid client') && !msgLower.includes('invalid client secret'))
    );
  }
};
