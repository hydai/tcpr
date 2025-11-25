/**
 * OAuth Flow and Token Management
 */

import { state } from './state.js';
import { OAUTH_TIMEOUT_MS, createAlertElement } from './utils.js';
import { t } from './i18n-helper.js';

/**
 * Generic OAuth polling utility
 * @param {Object} options - Polling configuration
 */
async function pollOAuth(options) {
  const {
    isComplete,
    onSuccess,
    onTimeout,
    interval = 2000,
    useBackoff = false,
    maxInterval = 10000,
    stateKey = null
  } = options;

  const startTime = Date.now();
  let currentInterval = interval;
  let timerId = null;

  const cleanup = () => {
    if (timerId) {
      clearTimeout(timerId);
      timerId = null;
    }
    if (stateKey && state[stateKey]) {
      state[stateKey] = null;
    }
  };

  const poll = async () => {
    if (Date.now() - startTime >= OAUTH_TIMEOUT_MS) {
      cleanup();
      if (onTimeout) await onTimeout();
      return;
    }

    try {
      const configResult = await window.electronAPI.loadConfig();

      if (Date.now() - startTime >= OAUTH_TIMEOUT_MS) {
        cleanup();
        if (onTimeout) await onTimeout();
        return;
      }
      if (isComplete(configResult)) {
        cleanup();
        await onSuccess(configResult);
        return;
      }
    } catch (e) {
      console.error('OAuth poll error:', e);
    }

    if (useBackoff) {
      currentInterval = Math.min(currentInterval * 2, maxInterval);
    }
    timerId = setTimeout(poll, currentInterval);
    if (stateKey) {
      state[stateKey] = timerId;
    }
  };

  poll();
}

/**
 * Start OAuth Flow
 */
export async function startOAuthFlow() {
  const btn = document.getElementById('startOAuthBtn');
  const statusDiv = document.getElementById('oauthStatus');

  btn.disabled = true;
  btn.textContent = t('messages.oauth.startingServer');

  try {
    await window.electronAPI.saveConfig(state.config);

    const port = parseInt(state.config.PORT) || 3000;
    const result = await window.electronAPI.startOAuth(port);

    if (result.success) {
      // Create status message using DOM methods
      statusDiv.textContent = '';
      const statusMessage = document.createElement('div');
      statusMessage.className = 'status-message';

      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', 'status-icon');
      svg.setAttribute('width', '24');
      svg.setAttribute('height', '24');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('fill', 'none');
      svg.setAttribute('stroke', 'currentColor');

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', 'M22 11.08V12a10 10 0 1 1-5.93-9.14');
      svg.appendChild(path);

      const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
      polyline.setAttribute('points', '22 4 12 14.01 9 11.01');
      svg.appendChild(polyline);

      const textDiv = document.createElement('div');
      const p1 = document.createElement('p');
      const strong = document.createElement('strong');
      strong.className = 'server-status';
      strong.textContent = t('messages.oauth.serverRunning');
      p1.appendChild(strong);

      const p2 = document.createElement('p');
      p2.className = 'browser-status';
      p2.textContent = t('messages.oauth.openingBrowser');

      textDiv.appendChild(p1);
      textDiv.appendChild(p2);

      statusMessage.appendChild(svg);
      statusMessage.appendChild(textDiv);
      statusDiv.appendChild(statusMessage);

      const oauthUrl = `http://localhost:${port}`;
      await window.electronAPI.openExternal(oauthUrl);

      btn.textContent = t('messages.oauth.waitingAuth');

      pollForOAuthCompletion();
    } else {
      throw new Error(result.error);
    }
  } catch (error) {
    console.error('OAuth error:', error);
    statusDiv.textContent = '';
    statusDiv.appendChild(createAlertElement('error', t('messages.oauth.error') + ' ' + error.message));
    btn.disabled = false;
    btn.textContent = t('messages.oauth.retryAuthentication');
  }
}

/**
 * Poll for OAuth completion (initial auth)
 */
function pollForOAuthCompletion() {
  pollOAuth({
    interval: 2000,
    isComplete: (result) => result.success && result.config.TWITCH_ACCESS_TOKEN,
    onSuccess: async (configResult) => {
      state.config = { ...state.config, ...configResult.config };

      const statusDiv = document.getElementById('oauthStatus');
      statusDiv.textContent = '';
      statusDiv.appendChild(createAlertElement('success', t('messages.oauth.authSuccess')));

      document.getElementById('accessToken').value = state.config.TWITCH_ACCESS_TOKEN;
      document.getElementById('broadcasterId').value = state.config.TWITCH_BROADCASTER_ID;
      document.getElementById('tokenInputGroup').style.display = 'block';
      document.getElementById('broadcasterIdGroup').style.display = 'block';
      document.getElementById('continueFromOAuth').disabled = false;

      const btn = document.getElementById('startOAuthBtn');
      btn.textContent = t('messages.oauth.authComplete');
      btn.disabled = true;
      btn.classList.remove('btn-primary');
      btn.classList.add('btn-success');

      await window.electronAPI.stopOAuth();
    }
  });
}

/**
 * Helper function to check if OAuth token has been updated
 */
function isTokenUpdated(oldAccessToken, newToken) {
  if (typeof newToken !== 'string' || newToken.trim() === '') {
    return false;
  }
  return (
    typeof oldAccessToken !== 'string' ||
    oldAccessToken.trim() === '' ||
    newToken !== oldAccessToken
  );
}

/**
 * Poll for OAuth refresh completion with exponential backoff
 * @param {string} oldAccessToken - Previous token to compare against
 */
export function pollForOAuthRefreshCompletion(oldAccessToken) {
  if (state.oauthRefreshInterval) {
    clearTimeout(state.oauthRefreshInterval);
    state.oauthRefreshInterval = null;
  }

  pollOAuth({
    interval: 1000,
    useBackoff: true,
    maxInterval: 10000,
    stateKey: 'oauthRefreshInterval',
    isComplete: (result) => {
      if (!result.success || !result.config.TWITCH_ACCESS_TOKEN) return false;
      return isTokenUpdated(oldAccessToken, result.config.TWITCH_ACCESS_TOKEN);
    },
    onSuccess: async (configResult) => {
      const newToken = configResult.config.TWITCH_ACCESS_TOKEN;
      state.config = { ...state.config, ...configResult.config };

      const settingsPanel = document.getElementById('settingsPanel');
      if (settingsPanel.style.display === 'block') {
        document.getElementById('settingsAccessToken').value = state.config.TWITCH_ACCESS_TOKEN;
        document.getElementById('settingsBroadcasterId').value = state.config.TWITCH_BROADCASTER_ID || '';
      }

      try {
        await navigator.clipboard.writeText(newToken);
        alert(t('messages.oauth.refreshSuccessWithCopy'));
      } catch (err) {
        console.error('Failed to auto-copy token:', err);
        alert(t('messages.oauth.refreshSuccess'));
      }

      await window.electronAPI.stopOAuth();
    },
    onTimeout: async () => {
      alert(t('messages.oauth.refreshTimeout'));
      try {
        await window.electronAPI.stopOAuth();
      } catch (e) {
        console.error('Failed to stop OAuth server after timeout:', e);
      }
    }
  });
}

/**
 * Refresh OAuth
 */
export async function refreshOAuth() {
  if (confirm(t('messages.oauth.confirmRefresh'))) {
    try {
      const oldAccessToken = state.config.TWITCH_ACCESS_TOKEN;
      const port = parseInt(state.config.PORT) || 3000;
      await window.electronAPI.startOAuth(port);
      const oauthUrl = `http://localhost:${port}`;
      await window.electronAPI.openExternal(oauthUrl);
      alert(t('messages.oauth.serverStarted'));

      pollForOAuthRefreshCompletion(oldAccessToken);
    } catch (error) {
      alert(t('messages.settings.oauthFailed', { error: error.message }));
    }
  }
}

/**
 * Copy Token to clipboard
 * @param {Event} event - Click event
 */
export async function copyToken(event) {
  const tokenInput = document.getElementById('accessToken');
  try {
    await navigator.clipboard.writeText(tokenInput.value);
    const btn = event.target;
    const originalText = btn.textContent;
    btn.textContent = t('wizard.step2.accessToken.copied');
    setTimeout(() => {
      btn.textContent = originalText;
    }, 2000);
  } catch (err) {
    console.error('Failed to copy token:', err);
    alert(t('messages.token.copyFailed', { error: err.message }));
  }
}
