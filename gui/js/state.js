/**
 * Application State Management
 */

// Application State
export const state = {
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
  oauthRefreshInterval: null,
  allEvents: [],
  sessionId: null,
  tokenExpiresAt: null,
  tokenExpiryInterval: null,
  userInitiatedStop: false
};

/**
 * Reset monitoring-related state
 */
export function resetMonitoringState() {
  state.monitoringActive = false;
  state.startTime = null;
  if (state.uptimeInterval) {
    clearInterval(state.uptimeInterval);
    state.uptimeInterval = null;
  }
}

/**
 * Reset token expiry state
 */
export function resetTokenExpiryState() {
  if (state.tokenExpiryInterval) {
    clearTimeout(state.tokenExpiryInterval);
    state.tokenExpiryInterval = null;
  }
  state.tokenExpiresAt = null;
}
