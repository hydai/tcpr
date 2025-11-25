/**
 * Modal Management
 */

import { t } from './i18n-helper.js';

/**
 * Create SVG icon for notifications
 * @param {string} type - 'success', 'error', or 'info'
 * @returns {Object} Object with color and elements
 */
function getIconConfig(type) {
  switch (type) {
    case 'success':
      return {
        color: 'var(--success)',
        elements: [
          { tag: 'path', attrs: { d: 'M22 11.08V12a10 10 0 1 1-5.93-9.14' } },
          { tag: 'polyline', attrs: { points: '22 4 12 14.01 9 11.01' } }
        ]
      };
    case 'error':
      return {
        color: 'var(--error)',
        elements: [
          { tag: 'circle', attrs: { cx: '12', cy: '12', r: '10' } },
          { tag: 'line', attrs: { x1: '15', y1: '9', x2: '9', y2: '15' } },
          { tag: 'line', attrs: { x1: '9', y1: '9', x2: '15', y2: '15' } }
        ]
      };
    case 'info':
    default:
      return {
        color: 'var(--primary)',
        elements: [
          { tag: 'circle', attrs: { cx: '12', cy: '12', r: '10' } },
          { tag: 'line', attrs: { x1: '12', y1: '16', x2: '12', y2: '12' } },
          { tag: 'line', attrs: { x1: '12', y1: '8', x2: '12.01', y2: '8' } }
        ]
      };
  }
}

/**
 * Show Delete Logs Modal
 */
export function showDeleteLogsModal() {
  const modal = document.getElementById('deleteLogsModal');
  modal.style.display = 'flex';
}

/**
 * Close Delete Logs Modal
 */
export function closeDeleteLogsModal() {
  const modal = document.getElementById('deleteLogsModal');
  modal.style.display = 'none';
}

/**
 * Show Notification Modal
 * @param {string} type - 'success', 'error', or 'info'
 * @param {string} title - Modal title
 * @param {string} message - Modal message
 */
export function showNotification(type, title, message) {
  const modal = document.getElementById('notificationModal');
  const iconElement = document.getElementById('notificationIcon');
  const titleElement = document.getElementById('notificationTitle');
  const messageElement = document.getElementById('notificationMessage');

  titleElement.textContent = title;
  messageElement.textContent = message;

  const config = getIconConfig(type);
  iconElement.setAttribute('stroke', config.color);

  // Clear existing children
  while (iconElement.firstChild) {
    iconElement.removeChild(iconElement.firstChild);
  }

  // Add new SVG elements
  for (const el of config.elements) {
    const svgEl = document.createElementNS('http://www.w3.org/2000/svg', el.tag);
    for (const [attr, value] of Object.entries(el.attrs)) {
      svgEl.setAttribute(attr, value);
    }
    iconElement.appendChild(svgEl);
  }

  modal.style.display = 'flex';
}

/**
 * Close Notification Modal
 */
export function closeNotificationModal() {
  const modal = document.getElementById('notificationModal');
  modal.style.display = 'none';
}

/**
 * Show Token Error Modal
 * @param {string} message - Error message
 */
export function showTokenErrorModal(message) {
  const modal = document.getElementById('tokenErrorModal');
  const messageElement = document.getElementById('tokenErrorMessage');

  if (message) {
    messageElement.textContent = message;
  }

  modal.style.display = 'flex';
}

/**
 * Close Token Error Modal
 */
export function closeTokenErrorModal() {
  const modal = document.getElementById('tokenErrorModal');
  modal.style.display = 'none';
}
