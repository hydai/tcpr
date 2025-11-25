/**
 * Event Handling and Display
 */

import { state } from './state.js';
import { MAX_EVENTS_IN_MEMORY, MAX_EVENTS_DISPLAY } from './utils.js';
import { t } from './i18n-helper.js';

// Keepalive message detection patterns
const KEEPALIVE_PATTERNS = [
  'session_keepalive',
  'Keepalive received'
];

// Cached preference for showing keepalive logs
let showKeepaliveLogsCache = null;

/**
 * Get the cached preference for showing keepalive logs
 * @returns {boolean} True if keepalive logs should be shown
 */
export function getShowKeepaliveLogs() {
  if (showKeepaliveLogsCache === null) {
    showKeepaliveLogsCache = localStorage.getItem('showKeepaliveLogs') === 'true';
  }
  return showKeepaliveLogsCache;
}

/**
 * Update the cached preference for showing keepalive logs
 * @param {boolean} value - New preference value
 */
export function setShowKeepaliveLogs(value) {
  showKeepaliveLogsCache = value;
  localStorage.setItem('showKeepaliveLogs', value);
}

/**
 * Create an event item element
 * @param {string} typeText - Event type text
 * @param {string} typeColor - CSS color for type
 * @param {string} timeText - Time string
 * @param {string} messageText - Message content
 * @returns {HTMLElement} Event item element
 */
function createEventItem(typeText, typeColor, timeText, messageText) {
  const eventItem = document.createElement('div');
  eventItem.className = 'event-item';

  const header = document.createElement('div');
  header.className = 'event-header';

  const typeSpan = document.createElement('span');
  typeSpan.className = 'event-type';
  typeSpan.style.color = typeColor;
  typeSpan.textContent = typeText;

  const timeSpan = document.createElement('span');
  timeSpan.className = 'event-time';
  timeSpan.textContent = timeText;

  header.appendChild(typeSpan);
  header.appendChild(timeSpan);

  const details = document.createElement('div');
  details.className = 'event-details';

  const pre = document.createElement('pre');
  pre.className = 'event-message';
  pre.textContent = messageText;

  details.appendChild(pre);

  eventItem.appendChild(header);
  eventItem.appendChild(details);

  return eventItem;
}

/**
 * Create empty state element
 * @returns {HTMLElement} Empty state element
 */
function createEmptyState() {
  const emptyDiv = document.createElement('div');
  emptyDiv.className = 'empty-state';

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '64');
  svg.setAttribute('height', '64');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('opacity', '0.3');

  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z');
  svg.appendChild(path);

  const p = document.createElement('p');
  p.className = 'empty-message';
  p.textContent = t('dashboard.emptyState');

  emptyDiv.appendChild(svg);
  emptyDiv.appendChild(p);

  return emptyDiv;
}

/**
 * Display error notification directly (avoids recursion)
 * @param {string} message - Error message
 */
export function displayErrorNotification(message) {
  const eventsList = document.getElementById('eventsList');

  const emptyState = eventsList.querySelector('.empty-state');
  if (emptyState) {
    emptyState.remove();
  }

  const displayTime = new Date().toLocaleTimeString();
  const typeText = '\u274C ' + t('dashboard.eventTypes.error');
  const eventItem = createEventItem(typeText, 'var(--error)', displayTime, message);

  eventsList.insertBefore(eventItem, eventsList.firstChild);

  state.eventCount++;
  document.getElementById('eventCount').textContent = state.eventCount;

  while (eventsList.children.length > MAX_EVENTS_DISPLAY) {
    eventsList.removeChild(eventsList.lastChild);
  }
}

/**
 * Handle EventSub Log
 * @param {Object} data - Log data from EventSub
 */
export function handleEventSubLog(data) {
  console.log('EventSub log:', data);

  // Filter keepalive messages if disabled (default: hidden)
  if (!getShowKeepaliveLogs() && isKeepaliveMessage(data.message)) {
    return;
  }

  const eventsList = document.getElementById('eventsList');

  const emptyState = eventsList.querySelector('.empty-state');
  if (emptyState) {
    emptyState.remove();
  }

  if (!data.timestamp) {
    console.warn('EventSub log missing timestamp from main process - ignoring event:', data);
    return;
  }

  const timestamp = data.timestamp;
  const displayTime = new Date(timestamp).toLocaleTimeString();
  const isError = data.type === 'error';

  const typeText = isError
    ? '\u274C ' + t('dashboard.eventTypes.error')
    : '\uD83D\uDCE2 ' + t('dashboard.eventTypes.event');
  const typeColor = isError ? 'var(--error)' : 'var(--success)';

  const eventItem = createEventItem(typeText, typeColor, displayTime, data.message);
  eventsList.insertBefore(eventItem, eventsList.firstChild);

  while (eventsList.children.length > MAX_EVENTS_DISPLAY) {
    eventsList.removeChild(eventsList.lastChild);
  }

  if (!data.internal) {
    state.allEvents.push({
      timestamp: timestamp,
      type: data.type || 'info',
      message: data.message
    });

    if (state.allEvents.length > MAX_EVENTS_IN_MEMORY) {
      state.allEvents.shift();
    }
  }

  state.eventCount++;
  document.getElementById('eventCount').textContent = state.eventCount;
}

/**
 * Clear Events from UI and memory
 */
export function clearEvents() {
  const eventsList = document.getElementById('eventsList');

  // Clear all children and add empty state
  eventsList.replaceChildren(createEmptyState());

  state.eventCount = 0;
  state.allEvents = [];
  document.getElementById('eventCount').textContent = '0';
}

/**
 * Check if a message is a keepalive log
 * @param {string} message - Log message
 * @returns {boolean} True if keepalive message
 */
function isKeepaliveMessage(message) {
  if (!message) return false;
  return KEEPALIVE_PATTERNS.some(pattern => message.includes(pattern));
}
