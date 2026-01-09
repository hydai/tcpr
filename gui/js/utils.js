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

/**
 * Format current date as YYYYMMDD string for filenames
 * @param {Date} [date] - Date to format (defaults to now)
 * @returns {string} Formatted date string
 */
export function formatDateForFilename(date = new Date()) {
  return date.toISOString().split('T')[0].replace(/-/g, '');
}

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
 * ARCHITECTURE NOTE: This is intentionally duplicated from lib/errors.js.
 *
 * Why duplicate?
 * - Electron renderer process cannot import Node.js modules directly
 * - These functions are called synchronously in loops (e.g., checking recent events)
 * - Using IPC for each check would add unnecessary async complexity
 *
 * The canonical implementation is in lib/errors.js - sync changes there.
 * An async IPC version is also available via window.electronAPI for new code.
 *
 * Twitch OAuth error messages (empirically observed):
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

/**
 * Extract JSON object from a string by tracking brace depth
 * This avoids greedy regex matching issues when multiple JSON objects exist
 *
 * Note on Unicode escapes: Sequences like \uXXXX are handled correctly because
 * we skip the character after any backslash. The \uXXXX in JSON source is NOT
 * a literal character - it's an escape sequence that JSON.parse() converts later.
 * @param {string} str - String potentially containing JSON
 * @returns {string|null} Extracted JSON string or null
 */
function extractJsonObject(str) {
  if (typeof str !== 'string') return null;
  const startIndex = str.indexOf('{');
  if (startIndex === -1) return null;

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = startIndex; i < str.length; i++) {
    const char = str[i];

    if (escape) {
      escape = false;
      continue;
    }

    if (char === '\\' && inString) {
      escape = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (!inString) {
      if (char === '{') depth++;
      else if (char === '}') {
        depth--;
        if (depth === 0) {
          return str.substring(startIndex, i + 1);
        }
      }
    }
  }

  return null;
}

// Memoization cache for parseRedemptionFromMessage to improve performance
// with large event datasets (avoids re-parsing identical messages)
const parseCache = new Map();
const PARSE_CACHE_MAX_SIZE = 10000;
// Evict 10% of cache entries when full for better performance than single-entry eviction
const PARSE_CACHE_EVICT_COUNT = Math.floor(PARSE_CACHE_MAX_SIZE * 0.1);

/**
 * Parse redemption event data from message string
 * Results are memoized to improve performance for large datasets
 * @param {string} message - Event message containing embedded JSON
 * @returns {Object|null} Parsed redemption data or null
 */
export function parseRedemptionFromMessage(message) {
  // Early exit: skip expensive parsing if message doesn't contain "reward"
  if (!message || !message.includes('"reward"')) return null;

  // Check cache first
  if (parseCache.has(message)) {
    return parseCache.get(message);
  }

  // Extract JSON object using brace-depth tracking to avoid greedy matching
  const jsonStr = extractJsonObject(message);
  if (!jsonStr) return null;

  try {
    const result = JSON.parse(jsonStr);
    // Cache the result (with size limit to prevent memory issues)
    if (parseCache.size >= PARSE_CACHE_MAX_SIZE) {
      // Batch eviction: remove oldest 10% of entries for better performance
      // Use iterator directly to avoid creating full array of 10,000 keys
      const keyIter = parseCache.keys();
      for (let i = 0; i < PARSE_CACHE_EVICT_COUNT; i++) {
        const next = keyIter.next();
        if (next.done) break;
        parseCache.delete(next.value);
      }
    }
    parseCache.set(message, result);
    return result;
  } catch (error) {
    // Log parse errors at debug level for troubleshooting without noise
    console.debug('JSON parse failed for redemption message:', error.message);
    return null;
  }
}

/**
 * Convert UTC timestamp to JST (Asia/Tokyo) formatted string
 * Uses Intl.DateTimeFormat for proper timezone handling
 *
 * ARCHITECTURE NOTE: This is intentionally duplicated from electron/main.js.
 * See CredentialErrors above for rationale on intentional duplication.
 * An async IPC version is also available via window.electronAPI.formatToJST()
 *
 * @param {string} isoString - ISO 8601 timestamp
 * @returns {string} Formatted datetime in JST (YYYY-MM-DD HH:mm:ss)
 */
export function formatToJST(isoString) {
  if (!isoString) {
    return '';
  }

  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) {
      return isoString;
    }

    const formatter = new Intl.DateTimeFormat('ja-JP', {
      timeZone: 'Asia/Tokyo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    const parts = formatter.formatToParts(date);
    const get = (type, fallback) => parts.find(p => p.type === type)?.value ?? fallback;

    return `${get('year', '0000')}-${get('month', '00')}-${get('day', '00')} ${get('hour', '00')}:${get('minute', '00')}:${get('second', '00')}`;
  } catch (error) {
    return isoString;
  }
}

/**
 * Format user name for display
 * Uses exact match comparison to preserve user's display name preference.
 * Twitch user_login is always lowercase from the API, while user_name
 * preserves user-specified casing. When names differ only by case
 * (e.g., "UserName" vs "username"), showing both helps identify users
 * who customized their display name.
 * @param {string} user_name - Display name (user-specified casing)
 * @param {string} user_login - Login name (always lowercase, may be empty)
 * @returns {string} user_name if user_login is empty or exact match, otherwise "user_name (user_login)"
 */
export function formatUserName(user_name, user_login) {
  if (!user_login || user_name === user_login) {
    return user_name;
  }
  return `${user_name} (${user_login})`;
}

/**
 * Combine log entries with the same timestamp
 * Fixes issue where TCPR splits a single event across multiple log entries
 * due to stdout buffering in child process communication
 * @param {Array} events - Events array
 * @returns {Array} Combined events
 */
export function combineEntriesByTimestamp(events) {
  const combined = [];
  let currentGroup = null;

  for (const entry of events) {
    if (!currentGroup || currentGroup.timestamp !== entry.timestamp) {
      if (currentGroup) combined.push(currentGroup);
      currentGroup = {
        timestamp: entry.timestamp,
        type: entry.type,
        message: entry.message || ''
      };
    } else {
      const newMessage = entry.message || '';
      if (newMessage) {
        if (currentGroup.message) {
          currentGroup.message += '\n' + newMessage;
        } else {
          currentGroup.message = newMessage;
        }
      }
    }
  }
  if (currentGroup) combined.push(currentGroup);

  return combined;
}

/**
 * Filter events for specific reward title
 * @param {Array} events - Events array
 * @param {string} rewardTitle - Reward title to filter
 * @returns {Array} Filtered redemption data with all fields separated
 */
export function filterRedemptionEvents(events, rewardTitle) {
  const redemptions = [];

  // Pre-process: combine entries with same timestamp
  // This handles cases where TCPR splits a single event across multiple log entries
  const combinedEvents = combineEntriesByTimestamp(events);

  for (const event of combinedEvents) {
    const data = parseRedemptionFromMessage(event.message);
    // Validate required fields to prevent incomplete data export
    if (data &&
      data.reward?.title === rewardTitle &&
      data.redeemed_at &&
      data.user_name &&
      data.id) {
      redemptions.push({
        redeemed_at: data.redeemed_at,
        reward_title: data.reward.title,
        user_name: data.user_name,
        user_id: data.user_id ?? '',
        user_login: data.user_login ?? '',
        user_input: data.user_input ?? '',
        status: data.status ?? '',
        redemption_id: data.id
      });
    }
  }

  return redemptions;
}
