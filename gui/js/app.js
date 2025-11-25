/**
 * Main Application Entry Point
 *
 * This file initializes the application and wires together all modules.
 */

// Import modules
import { state } from './state.js';
import { t, getCurrentLanguage, changeLanguage } from './i18n-helper.js';
import { handleEventSubLog, clearEvents, getShowKeepaliveLogs, setShowKeepaliveLogs } from './events.js';
import {
  wizardNext, wizardPrev, toggleSecretVisibility, saveAndContinue,
  completeSetup, showWizard
} from './wizard.js';
import { startOAuthFlow, copyToken, refreshOAuth, pollForOAuthRefreshCompletion } from './oauth.js';
import {
  startMonitoring, stopMonitoring, handleMonitoringStopped, checkMonitoringStatus,
  handleEventSubStopped, fetchAndStartTokenExpiryTimer
} from './monitoring.js';
import { exportEvents, openExternal, openFolder, confirmDeleteLogs } from './export.js';
import {
  showDeleteLogsModal, closeDeleteLogsModal, showNotification, closeNotificationModal,
  showTokenErrorModal, closeTokenErrorModal
} from './modals.js';

// Initialize app on load
document.addEventListener('DOMContentLoaded', async () => {
  await initializeApp();
});

/**
 * Initialize Application
 */
async function initializeApp() {
  // Initialize i18n first
  await initI18n();

  // Check if first run
  const firstRunResult = await window.electronAPI.isFirstRun();
  state.isFirstRun = firstRunResult;

  // Load existing configuration
  const configResult = await window.electronAPI.loadConfig();
  if (configResult.success && configResult.config) {
    state.config = { ...state.config, ...configResult.config };
  }

  // Get app version
  const version = await window.electronAPI.getVersion();
  const versionElement = document.getElementById('appVersion');
  if (versionElement) {
    versionElement.textContent = version;
  }

  // Get session ID
  const sessionResult = await window.electronAPI.getSessionId();
  if (sessionResult.success && sessionResult.sessionId) {
    state.sessionId = sessionResult.sessionId;
    const sessionIdElement = document.getElementById('sessionId');
    if (sessionIdElement) {
      sessionIdElement.textContent = sessionResult.sessionId;
    }
  }

  // Get config path
  const configPath = await window.electronAPI.getConfigPath();
  const configPathElement = document.getElementById('configPath');
  if (configPathElement) {
    configPathElement.textContent = configPath;
  }

  // Setup event listeners
  setupEventListeners();

  // Show appropriate view
  if (state.isFirstRun || !state.config.TWITCH_ACCESS_TOKEN) {
    showWizard();
  } else {
    showDashboard();
  }
}

/**
 * Setup Event Listeners
 */
function setupEventListeners() {
  // Settings button
  const settingsBtn = document.getElementById('settingsBtn');
  if (settingsBtn) {
    settingsBtn.addEventListener('click', openSettings);
  }

  // EventSub listeners
  window.electronAPI.onEventSubLog((data) => {
    handleEventSubLog(data);
  });

  window.electronAPI.onEventSubStopped((code) => {
    handleEventSubStopped(code, showTokenErrorModal);
  });

  // OAuth listeners
  window.electronAPI.onOAuthStopped((code) => {
    console.log('OAuth server stopped with code:', code);
  });

  // Token refresh listener
  window.electronAPI.onTokenRefreshed(() => {
    console.log('Token refreshed, updating expiry timer...');
    if (state.monitoringActive) {
      fetchAndStartTokenExpiryTimer();
    }
  });
}

/**
 * Show Dashboard
 */
function showDashboard() {
  document.getElementById('setupWizard').style.display = 'none';
  document.getElementById('mainDashboard').style.display = 'block';
  document.getElementById('settingsPanel').style.display = 'none';

  checkMonitoringStatus();
}

/**
 * Open Settings
 */
function openSettings() {
  document.getElementById('setupWizard').style.display = 'none';
  document.getElementById('mainDashboard').style.display = 'none';
  document.getElementById('settingsPanel').style.display = 'block';

  document.getElementById('settingsClientId').value = state.config.TWITCH_CLIENT_ID || '';
  document.getElementById('settingsClientSecret').value = state.config.TWITCH_CLIENT_SECRET || '';
  document.getElementById('settingsAccessToken').value = state.config.TWITCH_ACCESS_TOKEN || '';
  document.getElementById('settingsBroadcasterId').value = state.config.TWITCH_BROADCASTER_ID || '';
  document.getElementById('settingsRedirectUri').value = state.config.REDIRECT_URI || 'http://localhost:3000/callback';
  document.getElementById('settingsPort').value = state.config.PORT || '3000';

  const currentLang = getCurrentLanguage();
  document.getElementById('settingsLanguage').value = currentLang;

  // Load keepalive logs preference (default: hidden)
  document.getElementById('settingsShowKeepalive').checked = getShowKeepaliveLogs();
}

/**
 * Close Settings
 */
function closeSettings() {
  showDashboard();
}

/**
 * Save Settings
 */
async function saveSettings() {
  state.config.TWITCH_CLIENT_ID = document.getElementById('settingsClientId').value.trim();
  state.config.TWITCH_CLIENT_SECRET = document.getElementById('settingsClientSecret').value.trim();
  state.config.TWITCH_ACCESS_TOKEN = document.getElementById('settingsAccessToken').value.trim();
  state.config.TWITCH_BROADCASTER_ID = document.getElementById('settingsBroadcasterId').value.trim();
  state.config.REDIRECT_URI = document.getElementById('settingsRedirectUri').value.trim();
  state.config.PORT = document.getElementById('settingsPort').value.trim();

  // Save keepalive logs preference
  setShowKeepaliveLogs(document.getElementById('settingsShowKeepalive').checked);

  try {
    const result = await window.electronAPI.saveConfig(state.config);

    if (result.success) {
      alert(t('messages.settings.saveSuccess'));
      closeSettings();
    } else {
      alert(t('messages.settings.saveFailed', { error: result.error }));
    }
  } catch (error) {
    console.error('Save error:', error);
    alert(t('messages.settings.saveFailed', { error: error.message }));
  }
}

/**
 * Toggle Language
 */
function toggleLanguage() {
  const currentLang = getCurrentLanguage();
  const newLang = currentLang === 'en' ? 'ja' : 'en';
  changeLanguage(newLang);

  const settingsPanel = document.getElementById('settingsPanel');
  if (settingsPanel && settingsPanel.style.display === 'block') {
    document.getElementById('settingsLanguage').value = newLang;
  }
}

/**
 * Delete all logs wrapper
 */
function deleteAllLogs() {
  showDeleteLogsModal();
}

/**
 * Confirm delete logs wrapper
 */
async function handleConfirmDeleteLogs() {
  await confirmDeleteLogs(closeDeleteLogsModal, showNotification);
}

/**
 * Complete setup wrapper
 */
function handleCompleteSetup() {
  completeSetup(showDashboard);
}

/**
 * Refresh OAuth from Modal
 */
async function refreshOAuthFromModal() {
  closeTokenErrorModal();

  try {
    await window.electronAPI.saveConfig(state.config);

    const oldAccessToken = state.config.TWITCH_ACCESS_TOKEN;
    const port = parseInt(state.config.PORT) || 3000;
    const result = await window.electronAPI.startOAuth(port);

    if (result.success) {
      const oauthUrl = `http://localhost:${port}`;
      await window.electronAPI.openExternal(oauthUrl);

      alert(t('messages.oauth.modalSuccess'));
      openSettings();
      pollForOAuthRefreshCompletion(oldAccessToken);
    } else {
      throw new Error(result.error);
    }
  } catch (error) {
    console.error('OAuth error:', error);
    alert(t('messages.settings.oauthFailed', { error: error.message }));
  }
}

// Export functions to global scope for HTML onclick handlers
window.wizardNext = wizardNext;
window.wizardPrev = wizardPrev;
window.toggleSecretVisibility = toggleSecretVisibility;
window.startOAuthFlow = startOAuthFlow;
window.copyToken = copyToken;
window.saveAndContinue = saveAndContinue;
window.completeSetup = handleCompleteSetup;
window.openSettings = openSettings;
window.closeSettings = closeSettings;
window.saveSettings = saveSettings;
window.refreshOAuth = refreshOAuth;
window.startMonitoring = startMonitoring;
window.stopMonitoring = stopMonitoring;
window.clearEvents = clearEvents;
window.exportEvents = exportEvents;
window.openExternal = openExternal;
window.openFolder = openFolder;
window.toggleLanguage = toggleLanguage;
window.showTokenErrorModal = showTokenErrorModal;
window.closeTokenErrorModal = closeTokenErrorModal;
window.refreshOAuthFromModal = refreshOAuthFromModal;
window.deleteAllLogs = deleteAllLogs;
window.showDeleteLogsModal = showDeleteLogsModal;
window.closeDeleteLogsModal = closeDeleteLogsModal;
window.confirmDeleteLogs = handleConfirmDeleteLogs;
window.showNotification = showNotification;
window.closeNotificationModal = closeNotificationModal;
