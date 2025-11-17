// Constants
const OAUTH_TIMEOUT_MS = 300000; // 5 minutes

// Application State
const state = {
  currentStep: 0,
  config: {
    TWITCH_CLIENT_ID: '',
    TWITCH_CLIENT_SECRET: '',
    TWITCH_ACCESS_TOKEN: '',
    TWITCH_BROADCASTER_ID: '',
    REDIRECT_URI: 'http://localhost:3000/callback',
    PORT: '3000'
  },
  isFirstRun: true,
  monitoringActive: false,
  eventCount: 0,
  startTime: null,
  uptimeInterval: null,
  allEvents: [] // Store all events for export
};

// Initialize app on load
document.addEventListener('DOMContentLoaded', async () => {
  await initializeApp();
});

// Initialize Application
async function initializeApp() {
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

// Setup Event Listeners
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
    handleEventSubStopped(code);
  });

  // OAuth listeners
  window.electronAPI.onOAuthMessage((data) => {
    handleOAuthMessage(data);
  });

  window.electronAPI.onOAuthStopped((code) => {
    console.log('OAuth server stopped with code:', code);
  });
}

// Wizard Navigation
function wizardNext() {
  const currentStepElement = document.querySelector(`.wizard-step[data-step="${state.currentStep}"]`);

  // Validate current step
  if (!validateStep(state.currentStep)) {
    return;
  }

  // Collect data from current step
  collectStepData(state.currentStep);

  // Move to next step
  state.currentStep++;

  // Hide current step
  currentStepElement.classList.remove('active');

  // Show next step
  const nextStepElement = document.querySelector(`.wizard-step[data-step="${state.currentStep}"]`);
  if (nextStepElement) {
    nextStepElement.classList.add('active');

    // Initialize next step
    initializeStep(state.currentStep);
  }
}

function wizardPrev() {
  const currentStepElement = document.querySelector(`.wizard-step[data-step="${state.currentStep}"]`);

  // Move to previous step
  state.currentStep--;

  // Hide current step
  currentStepElement.classList.remove('active');

  // Show previous step
  const prevStepElement = document.querySelector(`.wizard-step[data-step="${state.currentStep}"]`);
  if (prevStepElement) {
    prevStepElement.classList.add('active');
  }
}

// Validate Step
function validateStep(step) {
  switch (step) {
    case 1: // Twitch App Setup
      const clientId = document.getElementById('clientId').value.trim();
      const clientSecret = document.getElementById('clientSecret').value.trim();

      if (!clientId || !clientSecret) {
        alert('Please enter both Client ID and Client Secret.');
        return false;
      }
      return true;

    case 2: // OAuth
      if (!state.config.TWITCH_ACCESS_TOKEN) {
        alert('Please complete the OAuth flow to continue.');
        return false;
      }
      return true;

    default:
      return true;
  }
}

// Collect Step Data
function collectStepData(step) {
  switch (step) {
    case 1: // Twitch App Setup
      state.config.TWITCH_CLIENT_ID = document.getElementById('clientId').value.trim();
      state.config.TWITCH_CLIENT_SECRET = document.getElementById('clientSecret').value.trim();
      break;
  }
}

// Initialize Step
function initializeStep(step) {
  switch (step) {
    case 2: // OAuth
      // Pre-fill client credentials if available
      break;

    case 3: // Review
      // Populate review data
      document.getElementById('reviewClientId').textContent = state.config.TWITCH_CLIENT_ID || '-';
      document.getElementById('reviewToken').textContent = state.config.TWITCH_ACCESS_TOKEN
        ? state.config.TWITCH_ACCESS_TOKEN.substring(0, 20) + '...'
        : '-';
      document.getElementById('reviewBroadcasterId').textContent = state.config.TWITCH_BROADCASTER_ID || '-';
      break;

    case 4: // Validation
      validateConfiguration();
      break;
  }
}

// Toggle Secret Visibility
function toggleSecretVisibility() {
  const secretInput = document.getElementById('clientSecret');
  const checkbox = document.getElementById('showSecret');

  if (checkbox.checked) {
    secretInput.type = 'text';
  } else {
    secretInput.type = 'password';
  }
}

// Start OAuth Flow
async function startOAuthFlow() {
  const btn = document.getElementById('startOAuthBtn');
  const statusDiv = document.getElementById('oauthStatus');

  // Disable button
  btn.disabled = true;
  btn.textContent = 'Starting OAuth Server...';

  try {
    // Save current config temporarily
    await window.electronAPI.saveConfig(state.config);

    // Start OAuth server
    const port = parseInt(state.config.PORT) || 3000;
    const result = await window.electronAPI.startOAuth(port);

    if (result.success) {
      // Update status
      statusDiv.innerHTML = `
        <div class="status-message">
          <svg class="status-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
            <polyline points="22 4 12 14.01 9 11.01"/>
          </svg>
          <div>
            <p><strong>OAuth server is running!</strong></p>
            <p>Opening your browser to authenticate with Twitch...</p>
          </div>
        </div>
      `;

      // Open OAuth URL in browser
      const oauthUrl = `http://localhost:${port}`;
      await window.electronAPI.openExternal(oauthUrl);

      btn.textContent = 'Waiting for authentication...';

      // Poll for token (we'll get it via OAuth callback)
      pollForOAuthCompletion();
    } else {
      throw new Error(result.error);
    }
  } catch (error) {
    console.error('OAuth error:', error);
    statusDiv.innerHTML = `
      <div class="alert alert-error">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <circle cx="12" cy="12" r="10"/>
          <line x1="15" y1="9" x2="9" y2="15"/>
          <line x1="9" y1="9" x2="15" y2="15"/>
        </svg>
        <span>Error: ${error.message}</span>
      </div>
    `;
    btn.disabled = false;
    btn.textContent = 'Retry Authentication';
  }
}

// Poll for OAuth completion
function pollForOAuthCompletion() {
  const interval = setInterval(async () => {
    const configResult = await window.electronAPI.loadConfig();
    if (configResult.success && configResult.config.TWITCH_ACCESS_TOKEN) {
      clearInterval(interval);

      // Update state
      state.config = { ...state.config, ...configResult.config };

      // Update UI
      const statusDiv = document.getElementById('oauthStatus');
      statusDiv.innerHTML = `
        <div class="alert alert-success">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
            <polyline points="22 4 12 14.01 9 11.01"/>
          </svg>
          <span>Authentication successful!</span>
        </div>
      `;

      // Show token
      document.getElementById('accessToken').value = state.config.TWITCH_ACCESS_TOKEN;
      document.getElementById('broadcasterId').value = state.config.TWITCH_BROADCASTER_ID;
      document.getElementById('tokenInputGroup').style.display = 'block';
      document.getElementById('broadcasterIdGroup').style.display = 'block';

      // Enable continue button
      document.getElementById('continueFromOAuth').disabled = false;

      // Update button
      const btn = document.getElementById('startOAuthBtn');
      btn.textContent = 'Authentication Complete';
      btn.disabled = true;
      btn.classList.remove('btn-primary');
      btn.classList.add('btn-success');

      // Stop OAuth server
      await window.electronAPI.stopOAuth();
    }
  }, 2000);

  // Timeout after configured time
  setTimeout(() => {
    clearInterval(interval);
  }, OAUTH_TIMEOUT_MS);
}

// Handle OAuth Message
function handleOAuthMessage(data) {
  console.log('OAuth message:', data);
  // Handle any messages from OAuth server
}

// Copy Token
async function copyToken(event) {
  const tokenInput = document.getElementById('accessToken');
  try {
    await navigator.clipboard.writeText(tokenInput.value);
    // Show feedback
    const btn = event.target;
    const originalText = btn.textContent;
    btn.textContent = 'Copied!';
    setTimeout(() => {
      btn.textContent = originalText;
    }, 2000);
  } catch (err) {
    console.error('Failed to copy token:', err);
    alert('Failed to copy token: ' + err.message);
  }
}

// Save and Continue (Step 3 -> 4)
async function saveAndContinue() {
  try {
    // Save configuration
    const result = await window.electronAPI.saveConfig(state.config);

    if (result.success) {
      wizardNext();
    } else {
      alert('Failed to save configuration: ' + result.error);
    }
  } catch (error) {
    console.error('Save error:', error);
    alert('Failed to save configuration: ' + error.message);
  }
}

// Validate Configuration
async function validateConfiguration() {
  const resultsDiv = document.getElementById('validationResults');
  const continueBtn = document.getElementById('continueFromValidation');

  resultsDiv.innerHTML = `
    <div class="validation-item pending">
      <div class="validation-icon">⏳</div>
      <div class="validation-text">
        <strong>Validating access token...</strong>
        <p>Checking token validity and permissions</p>
      </div>
    </div>
  `;

  try {
    const result = await window.electronAPI.validateToken(state.config.TWITCH_ACCESS_TOKEN);

    if (result.success) {
      resultsDiv.innerHTML = `
        <div class="validation-item success">
          <div class="validation-icon">✓</div>
          <div class="validation-text">
            <strong>Token is valid!</strong>
            <p>User: ${result.data.login} (ID: ${result.data.user_id})</p>
            <p>Scopes: ${result.data.scopes.join(', ')}</p>
          </div>
        </div>
      `;

      // Update broadcaster ID if needed
      if (!state.config.TWITCH_BROADCASTER_ID) {
        state.config.TWITCH_BROADCASTER_ID = result.data.user_id;
        await window.electronAPI.saveConfig(state.config);
      }

      continueBtn.disabled = false;
    } else {
      resultsDiv.innerHTML = `
        <div class="validation-item error">
          <div class="validation-icon">✗</div>
          <div class="validation-text">
            <strong>Validation failed!</strong>
            <p>${result.error}</p>
          </div>
        </div>
      `;
    }
  } catch (error) {
    console.error('Validation error:', error);
    resultsDiv.innerHTML = `
      <div class="validation-item error">
        <div class="validation-icon">✗</div>
        <div class="validation-text">
          <strong>Validation error!</strong>
          <p>${error.message}</p>
        </div>
      </div>
    `;
  }
}

// Complete Setup
function completeSetup() {
  showDashboard();
}

// Show Wizard
function showWizard() {
  document.getElementById('setupWizard').style.display = 'block';
  document.getElementById('mainDashboard').style.display = 'none';
  document.getElementById('settingsPanel').style.display = 'none';
}

// Show Dashboard
function showDashboard() {
  document.getElementById('setupWizard').style.display = 'none';
  document.getElementById('mainDashboard').style.display = 'block';
  document.getElementById('settingsPanel').style.display = 'none';

  // Check monitoring status
  checkMonitoringStatus();
}

// Open Settings
function openSettings() {
  document.getElementById('setupWizard').style.display = 'none';
  document.getElementById('mainDashboard').style.display = 'none';
  document.getElementById('settingsPanel').style.display = 'block';

  // Populate settings
  document.getElementById('settingsClientId').value = state.config.TWITCH_CLIENT_ID || '';
  document.getElementById('settingsClientSecret').value = state.config.TWITCH_CLIENT_SECRET || '';
  document.getElementById('settingsAccessToken').value = state.config.TWITCH_ACCESS_TOKEN || '';
  document.getElementById('settingsBroadcasterId').value = state.config.TWITCH_BROADCASTER_ID || '';
  document.getElementById('settingsRedirectUri').value = state.config.REDIRECT_URI || 'http://localhost:3000/callback';
  document.getElementById('settingsPort').value = state.config.PORT || '3000';
}

// Close Settings
function closeSettings() {
  showDashboard();
}

// Save Settings
async function saveSettings() {
  // Collect settings
  state.config.TWITCH_CLIENT_ID = document.getElementById('settingsClientId').value.trim();
  state.config.TWITCH_CLIENT_SECRET = document.getElementById('settingsClientSecret').value.trim();
  state.config.TWITCH_ACCESS_TOKEN = document.getElementById('settingsAccessToken').value.trim();
  state.config.TWITCH_BROADCASTER_ID = document.getElementById('settingsBroadcasterId').value.trim();
  state.config.REDIRECT_URI = document.getElementById('settingsRedirectUri').value.trim();
  state.config.PORT = document.getElementById('settingsPort').value.trim();

  try {
    const result = await window.electronAPI.saveConfig(state.config);

    if (result.success) {
      alert('Settings saved successfully!');
      closeSettings();
    } else {
      alert('Failed to save settings: ' + result.error);
    }
  } catch (error) {
    console.error('Save error:', error);
    alert('Failed to save settings: ' + error.message);
  }
}

// Refresh OAuth
async function refreshOAuth() {
  if (confirm('This will start a new OAuth flow. Continue?')) {
    try {
      const port = parseInt(state.config.PORT) || 3000;
      await window.electronAPI.startOAuth(port);
      const oauthUrl = `http://localhost:${port}`;
      await window.electronAPI.openExternal(oauthUrl);
      alert('OAuth server started. Complete the authentication in your browser.');
    } catch (error) {
      alert('Failed to start OAuth: ' + error.message);
    }
  }
}

// Start Monitoring
async function startMonitoring() {
  try {
    const result = await window.electronAPI.startEventSub();

    if (result.success) {
      state.monitoringActive = true;
      state.startTime = Date.now();

      // Update UI
      document.getElementById('startMonitorBtn').style.display = 'none';
      document.getElementById('stopMonitorBtn').style.display = 'inline-flex';
      document.getElementById('monitorStatus').textContent = 'Active';
      document.getElementById('monitorStatus').className = 'status-badge status-active';

      // Start uptime counter
      updateUptime();
      state.uptimeInterval = setInterval(updateUptime, 1000);
    } else {
      alert('Failed to start monitoring: ' + result.error);
    }
  } catch (error) {
    console.error('Start monitoring error:', error);
    alert('Failed to start monitoring: ' + error.message);
  }
}

// Stop Monitoring
async function stopMonitoring() {
  try {
    await window.electronAPI.stopEventSub();
    handleMonitoringStopped();
  } catch (error) {
    console.error('Stop monitoring error:', error);
    alert('Failed to stop monitoring: ' + error.message);
  }
}

// Handle Monitoring Stopped
function handleMonitoringStopped() {
  state.monitoringActive = false;
  state.startTime = null;

  // Update UI
  document.getElementById('startMonitorBtn').style.display = 'inline-flex';
  document.getElementById('stopMonitorBtn').style.display = 'none';
  document.getElementById('monitorStatus').textContent = 'Inactive';
  document.getElementById('monitorStatus').className = 'status-badge status-inactive';
  document.getElementById('uptime').textContent = '-';

  // Stop uptime counter
  if (state.uptimeInterval) {
    clearInterval(state.uptimeInterval);
    state.uptimeInterval = null;
  }
}

// Check Monitoring Status
async function checkMonitoringStatus() {
  try {
    const result = await window.electronAPI.getEventSubStatus();
    if (result.running) {
      state.monitoringActive = true;
      state.startTime = Date.now(); // Approximate

      document.getElementById('startMonitorBtn').style.display = 'none';
      document.getElementById('stopMonitorBtn').style.display = 'inline-flex';
      document.getElementById('monitorStatus').textContent = 'Active';
      document.getElementById('monitorStatus').className = 'status-badge status-active';

      updateUptime();
      state.uptimeInterval = setInterval(updateUptime, 1000);
    }
  } catch (error) {
    console.error('Status check error:', error);
  }
}

// Handle EventSub Log
function handleEventSubLog(data) {
  console.log('EventSub log:', data);

  const eventsList = document.getElementById('eventsList');

  // Remove empty state if present
  const emptyState = eventsList.querySelector('.empty-state');
  if (emptyState) {
    emptyState.remove();
  }

  // Create event item
  const eventItem = document.createElement('div');
  eventItem.className = 'event-item';

  const timestamp = new Date().toISOString();
  const displayTime = new Date().toLocaleTimeString();
  const isError = data.type === 'error';

  eventItem.innerHTML = `
    <div class="event-header">
      <span class="event-type" style="color: ${isError ? 'var(--error)' : 'var(--success)'}">
        ${isError ? '❌ Error' : '📢 Event'}
      </span>
      <span class="event-time">${displayTime}</span>
    </div>
    <div class="event-details">
      <pre>${escapeHtml(data.message)}</pre>
    </div>
  `;

  // Add to top of list
  eventsList.insertBefore(eventItem, eventsList.firstChild);

  // Store event in persistent array for export
  state.allEvents.push({
    timestamp: timestamp,
    type: data.type || 'info',
    message: data.message
  });

  // Increment event count
  state.eventCount++;
  document.getElementById('eventCount').textContent = state.eventCount;

  // Limit to 100 events in UI (but keep all in allEvents)
  while (eventsList.children.length > 100) {
    eventsList.removeChild(eventsList.lastChild);
  }
}

// Handle EventSub Stopped
function handleEventSubStopped(code) {
  console.log('EventSub stopped with code:', code);
  handleMonitoringStopped();

  if (code !== 0) {
    alert('Monitoring stopped unexpectedly. Check the event log for details.');
  }
}

// Update Uptime
function updateUptime() {
  if (!state.startTime) {
    document.getElementById('uptime').textContent = '-';
    return;
  }

  const elapsed = Date.now() - state.startTime;
  const hours = Math.floor(elapsed / 3600000);
  const minutes = Math.floor((elapsed % 3600000) / 60000);
  const seconds = Math.floor((elapsed % 60000) / 1000);

  const parts = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  parts.push(`${seconds}s`);

  document.getElementById('uptime').textContent = parts.join(' ');
}

// Clear Events
function clearEvents() {
  const eventsList = document.getElementById('eventsList');
  eventsList.innerHTML = `
    <div class="empty-state">
      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" opacity="0.3">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
      <p>No events yet. Start monitoring to see events appear here.</p>
    </div>
  `;

  state.eventCount = 0;
  state.allEvents = []; // Clear all stored events
  document.getElementById('eventCount').textContent = '0';
}

// Export Events
async function exportEvents() {
  if (state.allEvents.length === 0) {
    alert('No events to export. Start monitoring to capture events.');
    return;
  }

  try {
    // Show save dialog
    const dateStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    const result = await window.electronAPI.showSaveDialog({
      title: 'Export Events',
      defaultPath: `twitch-events-${dateStr}.json`,
      filters: [
        { name: 'JSON Files', extensions: ['json'] },
        { name: 'CSV Files', extensions: ['csv'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });

    if (result.canceled || !result.filePath) {
      return;
    }

    // Determine format based on file extension
    const filePath = result.filePath;
    const ext = window.electronAPI.path.extname(filePath).toLowerCase().replace('.', '');

    let content;
    if (ext === 'csv') {
      // Export as CSV
      content = convertToCSV(state.allEvents);
    } else {
      // Export as JSON (default)
      content = JSON.stringify(state.allEvents, null, 2);
    }

    // Save the file
    const saveResult = await window.electronAPI.saveEventLog(filePath, content);

    if (saveResult.success) {
      alert(`Successfully exported ${state.allEvents.length} events to ${filePath}`);
    } else {
      alert(`Failed to export events: ${saveResult.error}`);
    }
  } catch (error) {
    console.error('Export error:', error);
    alert(`Failed to export events: ${error.message}`);
  }
}

// Escape CSV field properly
function escapeCSVField(field) {
  // Convert to string, replace newlines with space, escape double quotes, wrap in double quotes
  const str = String(field).replace(/\r?\n/g, ' ').replace(/"/g, '""');
  return `"${str}"`;
}

// Convert events to CSV format
function convertToCSV(events) {
  const headers = ['Timestamp', 'Type', 'Message'];
  const rows = [headers.map(escapeCSVField).join(',')];

  events.forEach(event => {
    rows.push([event.timestamp, event.type, event.message].map(escapeCSVField).join(','));
  });

  return rows.join('\n');
}

// Open External URL
async function openExternal(url) {
  await window.electronAPI.openExternal(url);
}

// Utility: Escape HTML
function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Export functions to global scope
window.wizardNext = wizardNext;
window.wizardPrev = wizardPrev;
window.toggleSecretVisibility = toggleSecretVisibility;
window.startOAuthFlow = startOAuthFlow;
window.copyToken = copyToken;
window.saveAndContinue = saveAndContinue;
window.completeSetup = completeSetup;
window.openSettings = openSettings;
window.closeSettings = closeSettings;
window.saveSettings = saveSettings;
window.refreshOAuth = refreshOAuth;
window.startMonitoring = startMonitoring;
window.stopMonitoring = stopMonitoring;
window.clearEvents = clearEvents;
window.exportEvents = exportEvents;
window.openExternal = openExternal;
