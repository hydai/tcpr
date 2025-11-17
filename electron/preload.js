import { contextBridge, ipcRenderer } from 'electron';

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

  // OAuth
  startOAuth: (port) => ipcRenderer.invoke('oauth:start', port),
  stopOAuth: () => ipcRenderer.invoke('oauth:stop'),
  onOAuthMessage: (callback) => ipcRenderer.on('oauth:message', (event, data) => callback(data)),
  onOAuthStopped: (callback) => ipcRenderer.on('oauth:stopped', (event, code) => callback(code)),

  // EventSub
  startEventSub: () => ipcRenderer.invoke('eventsub:start'),
  stopEventSub: () => ipcRenderer.invoke('eventsub:stop'),
  getEventSubStatus: () => ipcRenderer.invoke('eventsub:status'),
  onEventSubLog: (callback) => ipcRenderer.on('eventsub:log', (event, data) => callback(data)),
  onEventSubStopped: (callback) => ipcRenderer.on('eventsub:stopped', (event, code) => callback(code)),

  // Shell
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),

  // Dialogs
  showOpenDialog: (options) => ipcRenderer.invoke('dialog:showOpen', options),
  showSaveDialog: (options) => ipcRenderer.invoke('dialog:showSave', options)
});
