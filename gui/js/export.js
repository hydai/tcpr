/**
 * Event Export Functionality
 */

import { state } from './state.js';
import { convertToCSV, filterRedemptionEvents } from './utils.js';
import { t } from './i18n-helper.js';

const DAILY_OMIKUJI_TITLE = 'Dailyおみくじ';

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
 * Export filtered events as Excel (Dailyおみくじ only)
 * @param {Array} events - Events array to export
 */
export async function exportAsExcel(events) {
  const redemptions = filterRedemptionEvents(events, DAILY_OMIKUJI_TITLE);

  if (redemptions.length === 0) {
    alert(t('messages.export.noRedemptions'));
    return;
  }

  try {
    // Save via Electron - Excel generation happens in main process
    const now = new Date();
    const dateStr = now.getFullYear().toString() +
      String(now.getMonth() + 1).padStart(2, '0') +
      String(now.getDate()).padStart(2, '0');

    const result = await window.electronAPI.showSaveDialog({
      title: t('export.saveTitle'),
      defaultPath: `daily-omikuji-${dateStr}.xlsx`,
      filters: [{ name: 'Excel Files', extensions: ['xlsx'] }]
    });

    if (result.canceled || !result.filePath) {
      return;
    }

    let filePath = result.filePath;
    if (!filePath.toLowerCase().endsWith('.xlsx')) {
      filePath += '.xlsx';
    }

    // Send redemptions to main process for Excel generation
    const saveResult = await window.electronAPI.exportToExcel(filePath, redemptions);

    if (saveResult.success) {
      alert(t('messages.export.success', { count: redemptions.length, path: filePath }));
    } else {
      alert(t('messages.export.failed', { error: saveResult.error }));
    }
  } catch (error) {
    console.error('Excel export error:', error);
    alert(t('messages.export.failed', { error: error.message }));
  }
}

/**
 * Export current session events as Excel
 */
export async function exportSessionAsExcel() {
  if (state.allEvents.length === 0) {
    alert(t('messages.validation.noEvents'));
    return;
  }
  await exportAsExcel(state.allEvents);
}

/**
 * Load JSON file and convert to Excel
 */
export async function convertJsonToExcel() {
  try {
    // Open file dialog to select JSON
    const result = await window.electronAPI.showOpenDialog({
      title: t('export.selectJson'),
      filters: [{ name: 'JSON Files', extensions: ['json'] }],
      properties: ['openFile']
    });

    if (result.canceled || !result.filePaths?.length) {
      return;
    }

    // Read and parse JSON file
    const content = await window.electronAPI.readFile(result.filePaths[0]);
    const events = JSON.parse(content);

    if (!Array.isArray(events)) {
      alert(t('messages.export.invalidJson'));
      return;
    }

    // Export as Excel
    await exportAsExcel(events);
  } catch (error) {
    console.error('JSON to Excel conversion error:', error);
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
