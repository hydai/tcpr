/**
 * Setup Wizard Logic
 */

import { state } from './state.js';
import { t } from './i18n-helper.js';

/**
 * Wizard Next Step
 */
export function wizardNext() {
  const currentStepElement = document.querySelector(`.wizard-step[data-step="${state.currentStep}"]`);

  if (!validateStep(state.currentStep)) {
    return;
  }

  collectStepData(state.currentStep);

  state.currentStep++;

  currentStepElement.classList.remove('active');

  const nextStepElement = document.querySelector(`.wizard-step[data-step="${state.currentStep}"]`);
  if (nextStepElement) {
    nextStepElement.classList.add('active');
    initializeStep(state.currentStep);
  }
}

/**
 * Wizard Previous Step
 */
export function wizardPrev() {
  const currentStepElement = document.querySelector(`.wizard-step[data-step="${state.currentStep}"]`);

  state.currentStep--;

  currentStepElement.classList.remove('active');

  const prevStepElement = document.querySelector(`.wizard-step[data-step="${state.currentStep}"]`);
  if (prevStepElement) {
    prevStepElement.classList.add('active');
  }
}

/**
 * Validate Step
 * @param {number} step - Step number
 * @returns {boolean} Whether step is valid
 */
function validateStep(step) {
  switch (step) {
    case 1:
      const clientId = document.getElementById('clientId').value.trim();
      const clientSecret = document.getElementById('clientSecret').value.trim();

      if (!clientId || !clientSecret) {
        alert(t('messages.validation.clientIdRequired'));
        return false;
      }
      return true;

    case 2:
      if (!state.config.TWITCH_ACCESS_TOKEN) {
        alert(t('messages.validation.oauthRequired'));
        return false;
      }
      return true;

    default:
      return true;
  }
}

/**
 * Collect Step Data
 * @param {number} step - Step number
 */
function collectStepData(step) {
  switch (step) {
    case 1:
      state.config.TWITCH_CLIENT_ID = document.getElementById('clientId').value.trim();
      state.config.TWITCH_CLIENT_SECRET = document.getElementById('clientSecret').value.trim();
      break;
  }
}

/**
 * Initialize Step
 * @param {number} step - Step number
 */
function initializeStep(step) {
  switch (step) {
    case 2:
      break;

    case 3:
      document.getElementById('reviewClientId').textContent = state.config.TWITCH_CLIENT_ID || '-';
      document.getElementById('reviewToken').textContent = state.config.TWITCH_ACCESS_TOKEN
        ? state.config.TWITCH_ACCESS_TOKEN.substring(0, 20) + '...'
        : '-';
      document.getElementById('reviewBroadcasterId').textContent = state.config.TWITCH_BROADCASTER_ID || '-';
      break;

    case 4:
      validateConfiguration();
      break;
  }
}

/**
 * Toggle Secret Visibility
 */
export function toggleSecretVisibility() {
  const secretInput = document.getElementById('clientSecret');
  const checkbox = document.getElementById('showSecret');

  if (checkbox.checked) {
    secretInput.type = 'text';
  } else {
    secretInput.type = 'password';
  }
}

/**
 * Save and Continue (Step 3 -> 4)
 */
export async function saveAndContinue() {
  try {
    const result = await window.electronAPI.saveConfig(state.config);

    if (result.success) {
      wizardNext();
    } else {
      alert(t('messages.config.saveFailed', { error: result.error }));
    }
  } catch (error) {
    console.error('Save error:', error);
    alert(t('messages.config.saveFailed', { error: error.message }));
  }
}

/**
 * Validate Configuration
 */
async function validateConfiguration() {
  const resultsDiv = document.getElementById('validationResults');
  const continueBtn = document.getElementById('continueFromValidation');

  // Create pending state
  resultsDiv.textContent = '';
  const pendingItem = createValidationItem('pending', '\u23F3', t('wizard.step4.validating'), t('wizard.step4.checkingToken'));
  resultsDiv.appendChild(pendingItem);

  try {
    const result = await window.electronAPI.validateToken(state.config.TWITCH_ACCESS_TOKEN);

    resultsDiv.textContent = '';

    if (result.success) {
      const successItem = createValidationItem('success', '\u2713', '', '');
      resultsDiv.appendChild(successItem);

      const title = successItem.querySelector('.validation-title');
      title.textContent = t('wizard.step4.tokenValid');

      const userInfo = document.createElement('p');
      userInfo.textContent = t('wizard.step4.userLabel') + ' ' + result.data.login +
        ' (' + t('wizard.step4.idLabel') + ' ' + result.data.user_id + ')';

      const scopesInfo = document.createElement('p');
      scopesInfo.textContent = t('wizard.step4.scopesLabel') + ' ' + result.data.scopes.join(', ');

      const textDiv = successItem.querySelector('.validation-text');
      textDiv.appendChild(userInfo);
      textDiv.appendChild(scopesInfo);

      if (!state.config.TWITCH_BROADCASTER_ID) {
        state.config.TWITCH_BROADCASTER_ID = result.data.user_id;
        await window.electronAPI.saveConfig(state.config);
      }

      continueBtn.disabled = false;
    } else {
      const errorItem = createValidationItem('error', '\u2717', '', '');
      resultsDiv.appendChild(errorItem);

      errorItem.querySelector('.validation-title').textContent = t('wizard.step4.tokenInvalid');
      const errorMsg = document.createElement('p');
      errorMsg.textContent = result.error;
      errorItem.querySelector('.validation-text').appendChild(errorMsg);
    }
  } catch (error) {
    console.error('Validation error:', error);
    resultsDiv.textContent = '';

    const errorItem = createValidationItem('error', '\u2717', '', '');
    resultsDiv.appendChild(errorItem);

    errorItem.querySelector('.validation-title').textContent = t('wizard.step4.validationError');
    const errorMsg = document.createElement('p');
    errorMsg.textContent = error.message;
    errorItem.querySelector('.validation-text').appendChild(errorMsg);
  }
}

/**
 * Create validation item element
 * @param {string} status - 'pending', 'success', or 'error'
 * @param {string} icon - Icon character
 * @param {string} title - Title text
 * @param {string} description - Description text
 * @returns {HTMLElement} Validation item element
 */
function createValidationItem(status, icon, title, description) {
  const item = document.createElement('div');
  item.className = `validation-item ${status}`;

  const iconDiv = document.createElement('div');
  iconDiv.className = 'validation-icon';
  iconDiv.textContent = icon;

  const textDiv = document.createElement('div');
  textDiv.className = 'validation-text';

  const titleStrong = document.createElement('strong');
  titleStrong.className = 'validation-title';
  titleStrong.textContent = title;

  textDiv.appendChild(titleStrong);

  if (description) {
    const descP = document.createElement('p');
    descP.textContent = description;
    textDiv.appendChild(descP);
  }

  item.appendChild(iconDiv);
  item.appendChild(textDiv);

  return item;
}

/**
 * Complete Setup
 * @param {Function} showDashboard - Function to show dashboard
 */
export function completeSetup(showDashboard) {
  showDashboard();
}

/**
 * Show Wizard
 */
export function showWizard() {
  document.getElementById('setupWizard').style.display = 'block';
  document.getElementById('mainDashboard').style.display = 'none';
  document.getElementById('settingsPanel').style.display = 'none';
}
