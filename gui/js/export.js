/**
 * Event Export Functionality
 */

import { state } from './state.js';
import { convertToCSV } from './utils.js';
import { t } from './i18n-helper.js';

/**
 * Validate logs against session file
 * @returns {Promise<Object>} Validation result
 */
async function validateLogsWithSessionFile() {
  try {
    const logsToValidate = state.allEvents;

    const result = await window.electronAPI.validateSessionLogs(logsToValidate);

    if (!result.success) {
      return {
        valid: false,
        message: `Validation error: ${result.error}`,
        sessionLogCount: 0
      };
    }

    return {
      valid: result.valid,
      message: result.message,
      sessionLogCount: result.sessionLogCount
    };
  } catch (error) {
    return {
      valid: false,
      message: `Validation error: ${error.message}`,
      sessionLogCount: 0
    };
  }
}

/**
 * Export Events
 */
export async function exportEvents() {
  if (state.allEvents.length === 0) {
    alert(t('messages.validation.noEvents'));
    return;
  }

  try {
    const validationResult = await validateLogsWithSessionFile();
    if (!validationResult.valid) {
      const proceed = confirm(
        t('messages.export.validationWarning', {
          message: validationResult.message,
          sessionCount: validationResult.sessionLogCount,
          memoryCount: state.allEvents.length
        })
      );
      if (!proceed) {
        return;
      }
    }

    const now = new Date();
    const dateStr = now.getFullYear().toString() +
      String(now.getMonth() + 1).padStart(2, '0') +
      String(now.getDate()).padStart(2, '0');
    const result = await window.electronAPI.showSaveDialog({
      title: 'Export Events',
      defaultPath: `twitch-events-${dateStr}`,
      filters: [
        { name: 'JSON Files', extensions: ['json'] },
        { name: 'CSV Files', extensions: ['csv'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });

    if (result.canceled || !result.filePath) {
      return;
    }

    let filePath = result.filePath;
    let format;
    if (result.filterIndex === 1) {
      format = 'csv';
    } else if (result.filterIndex === 0) {
      format = 'json';
    } else {
      if (filePath.toLowerCase().endsWith('.csv')) {
        format = 'csv';
      } else if (filePath.toLowerCase().endsWith('.json')) {
        format = 'json';
      } else {
        format = 'json';
      }
    }

    if (format === 'csv' && !filePath.toLowerCase().endsWith('.csv')) {
      filePath += '.csv';
    } else if (format === 'json' && !filePath.toLowerCase().endsWith('.json')) {
      filePath += '.json';
    }

    let content;
    if (format === 'csv') {
      content = convertToCSV(state.allEvents);
    } else {
      content = JSON.stringify(state.allEvents, null, 2);
    }

    const saveResult = await window.electronAPI.saveEventLog(filePath, content);

    if (saveResult.success) {
      alert(t('messages.export.success', { count: state.allEvents.length, path: filePath }));
    } else {
      alert(t('messages.export.failed', { error: saveResult.error }));
    }
  } catch (error) {
    console.error('Export error:', error);
    alert(t('messages.export.failed', { error: error.message }));
  }
}

/**
 * Open External URL
 * @param {string} url - URL to open
 */
export async function openExternal(url) {
  await window.electronAPI.openExternal(url);
}

/**
 * Open Folder
 * @param {string} folderType - Type of folder to open
 */
export async function openFolder(folderType) {
  try {
    const userDataPath = await window.electronAPI.getAppPath('userData');
    const result = await window.electronAPI.openPath(userDataPath);
    if (!result.success) {
      const errorMsg = result.error || 'Unknown error occurred';
      console.error(`Failed to open ${folderType} folder:`, errorMsg);
      alert(t('messages.folder.openFailed', { type: folderType, error: errorMsg }));
    }
  } catch (error) {
    console.error(`Error opening ${folderType} folder:`, error);
    alert(t('messages.folder.openError', { type: folderType, error: error.message || 'Unknown error occurred' }));
  }
}

/**
 * Delete all logs - shows confirmation modal
 * @param {Function} showDeleteLogsModal - Function to show delete logs modal
 */
export function deleteAllLogs(showDeleteLogsModal) {
  showDeleteLogsModal();
}

/**
 * Confirm Delete Logs
 * @param {Function} closeModal - Function to close modal
 * @param {Function} showNotification - Function to show notification
 */
export async function confirmDeleteLogs(closeModal, showNotification) {
  closeModal();

  try {
    const result = await window.electronAPI.deleteAllLogs();

    if (result.success) {
      if (result.deletedCount === 0) {
        showNotification('info', t('modal.notification.infoTitle'), t('messages.logs.noLogsToDelete'));
      } else if (result.errors && result.errors.length > 0) {
        showNotification('info', t('modal.notification.infoTitle'), t('messages.logs.deletePartialSuccess', {
          count: result.deletedCount,
          errorCount: result.errors.length
        }));
      } else {
        showNotification('success', t('modal.notification.successTitle'), t('messages.logs.deleteSuccess', { count: result.deletedCount }));
      }
    } else {
      showNotification('error', t('modal.notification.errorTitle'), t('messages.logs.deleteFailed', { error: result.error }));
    }
  } catch (error) {
    console.error('Error deleting logs:', error);
    showNotification('error', t('modal.notification.errorTitle'), t('messages.logs.deleteFailed', { error: error.message || t('messages.logs.unknownError') }));
  }
}
