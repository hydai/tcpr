/**
 * EventSub Monitoring Controls
 */

import { state, resetMonitoringState, resetTokenExpiryState } from './state.js';
import { HOUR_MS, MINUTE_MS, SECOND_MS, TOKEN_WARNING_THRESHOLD_MS } from './utils.js';
import { t } from './i18n-helper.js';

/**
 * Start Monitoring
 */
export async function startMonitoring() {
  try {
    const result = await window.electronAPI.startEventSub();

    if (result.success) {
      state.monitoringActive = true;
      state.startTime = Date.now();

      document.getElementById('startMonitorBtn').style.display = 'none';
      document.getElementById('stopMonitorBtn').style.display = 'inline-flex';
      document.getElementById('monitorStatus').textContent = t('dashboard.status.active');
      document.getElementById('monitorStatus').className = 'status-badge status-active';

      updateUptime();
      state.uptimeInterval = setInterval(updateUptime, 1000);

      fetchAndStartTokenExpiryTimer();
    } else {
      alert(t('messages.monitoring.startFailed', { error: result.error }));
    }
  } catch (error) {
    console.error('Start monitoring error:', error);
    alert(t('messages.monitoring.startFailed', { error: error.message }));
  }
}

/**
 * Stop Monitoring
 */
export async function stopMonitoring() {
  try {
    await window.electronAPI.stopEventSub();
    handleMonitoringStopped();
  } catch (error) {
    console.error('Stop monitoring error:', error);
    alert(t('messages.monitoring.stopFailed', { error: error.message }));
  }
}

/**
 * Handle Monitoring Stopped
 */
export function handleMonitoringStopped() {
  resetMonitoringState();

  document.getElementById('startMonitorBtn').style.display = 'inline-flex';
  document.getElementById('stopMonitorBtn').style.display = 'none';
  document.getElementById('monitorStatus').textContent = t('dashboard.status.inactive');
  document.getElementById('monitorStatus').className = 'status-badge status-inactive';
  document.getElementById('uptime').textContent = '-';

  stopTokenExpiryTimer();
}

/**
 * Check Monitoring Status
 */
export async function checkMonitoringStatus() {
  try {
    const result = await window.electronAPI.getEventSubStatus();
    if (result.running) {
      state.monitoringActive = true;
      state.startTime = Date.now();

      document.getElementById('startMonitorBtn').style.display = 'none';
      document.getElementById('stopMonitorBtn').style.display = 'inline-flex';
      document.getElementById('monitorStatus').textContent = t('dashboard.status.active');
      document.getElementById('monitorStatus').className = 'status-badge status-active';

      updateUptime();
      state.uptimeInterval = setInterval(updateUptime, 1000);

      fetchAndStartTokenExpiryTimer();
    }
  } catch (error) {
    console.error('Status check error:', error);
  }
}

/**
 * Update Uptime display
 */
function updateUptime() {
  if (!state.startTime) {
    document.getElementById('uptime').textContent = '-';
    return;
  }

  const elapsed = Date.now() - state.startTime;
  const hours = Math.floor(elapsed / HOUR_MS);
  const minutes = Math.floor((elapsed % HOUR_MS) / MINUTE_MS);
  const seconds = Math.floor((elapsed % MINUTE_MS) / SECOND_MS);

  const parts = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  parts.push(`${seconds}s`);

  document.getElementById('uptime').textContent = parts.join(' ');
}

/**
 * Fetch and start token expiry timer
 */
export async function fetchAndStartTokenExpiryTimer() {
  try {
    const result = await window.electronAPI.getTokenExpiry();
    if (result.success) {
      state.tokenExpiresAt = result.expiresAt;
      updateTokenExpiry();
      scheduleTokenExpiryUpdate();
    } else {
      console.error('Failed to get token expiry:', result.error);
      document.getElementById('tokenExpiry').textContent = t('dashboard.tokenExpiryUnknown');
    }
  } catch (error) {
    console.error('Error fetching token expiry:', error);
    document.getElementById('tokenExpiry').textContent = t('dashboard.tokenExpiryUnknown');
  }
}

/**
 * Clear any pending token expiry timeout
 */
function clearTokenExpiryTimeout() {
  if (state.tokenExpiryInterval) {
    clearTimeout(state.tokenExpiryInterval);
    state.tokenExpiryInterval = null;
  }
}

/**
 * Schedule token expiry updates with dynamic interval
 */
function scheduleTokenExpiryUpdate() {
  clearTokenExpiryTimeout();

  if (!state.tokenExpiresAt) {
    return;
  }

  const remaining = state.tokenExpiresAt - Date.now();

  let interval;
  if (remaining <= 0) {
    return;
  } else if (remaining < MINUTE_MS) {
    interval = SECOND_MS;
  } else {
    interval = MINUTE_MS;
  }

  state.tokenExpiryInterval = setTimeout(() => {
    updateTokenExpiry();
    scheduleTokenExpiryUpdate();
  }, interval);
}

/**
 * Stop token expiry timer
 */
export function stopTokenExpiryTimer() {
  clearTokenExpiryTimeout();
  state.tokenExpiresAt = null;
  document.getElementById('tokenExpiry').textContent = '-';
}

/**
 * Update Token Expiry display
 */
function updateTokenExpiry() {
  const tokenExpiryElement = document.getElementById('tokenExpiry');

  if (!state.tokenExpiresAt) {
    tokenExpiryElement.textContent = '-';
    tokenExpiryElement.className = 'status-value token-expiry';
    return;
  }

  const remaining = state.tokenExpiresAt - Date.now();

  if (remaining <= 0) {
    tokenExpiryElement.textContent = t('dashboard.tokenExpired');
    tokenExpiryElement.className = 'status-value token-expiry token-expired';
    return;
  }

  const hours = Math.floor(remaining / HOUR_MS);
  const minutes = Math.floor((remaining % HOUR_MS) / MINUTE_MS);
  const seconds = Math.floor((remaining % MINUTE_MS) / SECOND_MS);

  const parts = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0 || hours > 0) parts.push(`${minutes}m`);
  if (hours === 0) parts.push(`${seconds}s`);

  tokenExpiryElement.textContent = parts.join(' ');

  if (remaining < TOKEN_WARNING_THRESHOLD_MS) {
    tokenExpiryElement.className = 'status-value token-expiry token-expiring-soon';
  } else {
    tokenExpiryElement.className = 'status-value token-expiry';
  }
}

/**
 * Handle EventSub Stopped
 * @param {number} code - Exit code
 * @param {Function} showTokenErrorModal - Function to show token error modal
 */
export function handleEventSubStopped(code, showTokenErrorModal) {
  console.log('EventSub stopped with code:', code);
  handleMonitoringStopped();

  if (code !== 0) {
    const lastEvents = state.allEvents.slice(-5);
    const hasTokenError = lastEvents.some(event =>
      event.type === 'error' &&
      (event.message.includes('Token validation failed') ||
       event.message.includes('Invalid or expired access token'))
    );

    if (hasTokenError) {
      showTokenErrorModal(t('modal.tokenError.message'));
    } else {
      alert(t('messages.monitoring.stoppedUnexpectedly'));
    }
  }
}
