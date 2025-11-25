const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Configuration
  loadConfig: () => ipcRenderer.invoke('config:load'),
  saveConfig: (config) => ipcRenderer.invoke('config:save', config),
  getConfigPath: () => ipcRenderer.invoke('config:getPath'),

  // App info
  isFirstRun: () => ipcRenderer.invoke('app:isFirstRun'),
  getVersion: () => ipcRenderer.invoke('app:getVersion'),
  getAppPath: (name) => ipcRenderer.invoke('app:getPath', name),

  // Token validation
  validateToken: (accessToken) => ipcRenderer.invoke('token:validate', accessToken),
  getTokenExpiry: () => ipcRenderer.invoke('token:getExpiry'),
  onTokenRefreshed: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('token:refreshed', handler);
    return () => ipcRenderer.removeListener('token:refreshed', handler);
  },

  // OAuth
  startOAuth: (port) => ipcRenderer.invoke('oauth:start', port),
  stopOAuth: () => ipcRenderer.invoke('oauth:stop'),
  onOAuthStopped: (callback) => {
    const handler = (event, code) => callback(code);
    ipcRenderer.on('oauth:stopped', handler);
    return () => ipcRenderer.removeListener('oauth:stopped', handler);
  },

  // EventSub
  startEventSub: () => ipcRenderer.invoke('eventsub:start'),
  stopEventSub: () => ipcRenderer.invoke('eventsub:stop'),
  getEventSubStatus: () => ipcRenderer.invoke('eventsub:status'),
  onEventSubLog: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('eventsub:log', handler);
    return () => ipcRenderer.removeListener('eventsub:log', handler);
  },
  onEventSubStopped: (callback) => {
    const handler = (event, code) => callback(code);
    ipcRenderer.on('eventsub:stopped', handler);
    return () => ipcRenderer.removeListener('eventsub:stopped', handler);
  },

  // Shell
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
  openPath: (folderPath) => ipcRenderer.invoke('shell:openPath', folderPath),

  // Dialogs
  showSaveDialog: (options) => ipcRenderer.invoke('dialog:showSave', options),

  // Event log export
  saveEventLog: (filePath, content) => ipcRenderer.invoke('eventlog:save', filePath, content),

  // Session management
  getSessionId: () => ipcRenderer.invoke('session:getId'),
  validateSessionLogs: (inMemoryLogs) => ipcRenderer.invoke('session:validateLogs', inMemoryLogs),

  // Logs management
  deleteAllLogs: () => ipcRenderer.invoke('logs:deleteAll')
});
