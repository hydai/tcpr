import { app, BrowserWindow, ipcMain, dialog, Menu, shell } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { fork } from 'child_process';
import { randomUUID } from 'crypto';
import { BUILTIN_CONFIG } from '../config/builtin.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;
let eventSubProcess = null;
let oauthServerProcess = null;

// Path to config.json file
const configPath = path.join(app.getPath('userData'), 'config.json');

// Session management
let sessionId = null;
let sessionLogPath = null;
let sessionLogQueue = [];
let sessionLogQueueIndex = 0; // Track read position to avoid shift() overhead
let sessionLogWriting = false;
let sessionLogRetryCount = 0;
const MAX_RETRY_ATTEMPTS = 5;
const MAX_BACKOFF_DELAY_MS = 10000; // Maximum delay between retries (10 seconds)
const QUEUE_CLEANUP_THRESHOLD = 100; // Clean up processed entries after this many
const VALIDATION_SAMPLE_SIZE = 100; // Number of entries to sample for large datasets

// Create main window
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, '../build/icon.png'),
    backgroundColor: '#0e0e10',
    show: false
  });

  // Load the GUI
  mainWindow.loadFile(path.join(__dirname, '../gui/index.html'));

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
    stopEventSub();
    stopOAuthServer();
  });
}

// Create application menu
function createMenu() {
  const isMac = process.platform === 'darwin';

  const template = [
    // App menu (macOS only)
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    }] : []),
    // File menu
    {
      label: 'File',
      submenu: [
        isMac ? { role: 'close' } : { role: 'quit' }
      ]
    },
    // Edit menu
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        ...(isMac ? [
          { role: 'pasteAndMatchStyle' },
          { role: 'delete' },
          { role: 'selectAll' },
          { type: 'separator' },
          {
            label: 'Speech',
            submenu: [
              { role: 'startSpeaking' },
              { role: 'stopSpeaking' }
            ]
          }
        ] : [
          { role: 'delete' },
          { type: 'separator' },
          { role: 'selectAll' }
        ])
      ]
    },
    // View menu
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    // Window menu
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac ? [
          { type: 'separator' },
          { role: 'front' },
          { type: 'separator' },
          { role: 'window' }
        ] : [
          { role: 'close' }
        ])
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// Initialize session with unique ID and log file
function initializeSession() {
  // Generate unique session ID
  sessionId = randomUUID();

  // Create session log file path
  const userDataDir = app.getPath('userData');
  if (!fs.existsSync(userDataDir)) {
    fs.mkdirSync(userDataDir, { recursive: true });
  }

  sessionLogPath = path.join(userDataDir, `session-${sessionId}.jsonl`);

  // Initialize log file as empty (NDJSON format)
  try {
    fs.writeFileSync(sessionLogPath, '', 'utf-8');
    console.log(`Session initialized: ${sessionId}`);
    console.log(`Session log file: ${sessionLogPath}`);
  } catch (error) {
    console.error('Failed to initialize session log file:', error);
  }
}

// Append log entry to session file (queued to prevent race conditions)
function appendToSessionLog(logEntry) {
  if (!sessionLogPath) {
    console.error('Session log path not initialized');
    return;
  }

  sessionLogQueue.push(logEntry);

  // Start processing if not already running
  if (!sessionLogWriting) {
    processSessionLogQueue().catch(error => {
      console.error('Critical error in session log processing:', error);
    });
  }
}

// Process session log queue sequentially to prevent race conditions
async function processSessionLogQueue() {
  if (sessionLogWriting) return;
  sessionLogWriting = true;

  try {
    while (sessionLogQueueIndex < sessionLogQueue.length) {
      const logEntry = sessionLogQueue[sessionLogQueueIndex]; // Peek using index

      // Skip internal error logs to prevent infinite loops
      if (logEntry.internal) {
        sessionLogQueueIndex++;
        continue;
      }

      try {
        // Append as NDJSON (newline-delimited JSON) - much more efficient
        await fs.promises.appendFile(
          sessionLogPath,
          JSON.stringify(logEntry) + '\n',
          'utf-8'
        );

        // Successfully written - move to next entry and reset retry count
        sessionLogQueueIndex++;
        sessionLogRetryCount = 0;
      } catch (error) {
        sessionLogRetryCount++;

        console.error(`Failed to append to session log (attempt ${sessionLogRetryCount}/${MAX_RETRY_ATTEMPTS}):`, error);

        // Check if we've exceeded retry limit
        if (sessionLogRetryCount >= MAX_RETRY_ATTEMPTS) {
          console.error('Max retry attempts reached. Discarding log entry:', logEntry);

          // Notify user about permanent failure
          if (mainWindow) {
            mainWindow.webContents.send('eventsub:log', {
              type: 'error',
              message: `Critical: Session log write failed after ${MAX_RETRY_ATTEMPTS} attempts. Some logs may be lost.`,
              timestamp: new Date().toISOString(),
              internal: true
            });
          }

          // Skip this entry to prevent blocking the queue forever
          sessionLogQueueIndex++;
          sessionLogRetryCount = 0;
        } else {
          // Notify about retry
          if (mainWindow) {
            mainWindow.webContents.send('eventsub:log', {
              type: 'error',
              message: `Warning: Failed to save log to session file (will retry): ${error.message}`,
              timestamp: new Date().toISOString(),
              internal: true
            });
          }

          // Exit loop to retry later with exponential backoff
          // Keep sessionLogWriting = true to prevent concurrent retries
          const backoffDelay = Math.min(1000 * Math.pow(2, sessionLogRetryCount), MAX_BACKOFF_DELAY_MS);
          setTimeout(() => {
            sessionLogWriting = false; // Reset before retry
            processSessionLogQueue().catch(err => {
              console.error('Critical error in session log retry:', err);
            });
          }, backoffDelay);

          return; // Exit without setting sessionLogWriting = false
        }
      }
    }

    // Clean up processed entries periodically to prevent unbounded memory growth
    if (sessionLogQueueIndex > QUEUE_CLEANUP_THRESHOLD) {
      sessionLogQueue = sessionLogQueue.slice(sessionLogQueueIndex);
      sessionLogQueueIndex = 0;
    }
  } finally {
    // Only reset if we're not scheduling a retry
    // (return statement above will skip this)
    sessionLogWriting = false;
  }
}

// App ready
app.whenReady().then(() => {
  initializeSession();
  createMenu();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Handlers

// Helper function to load configuration
async function loadConfig() {
  try {
    const config = {};

    // First, load builtin credentials if available
    if (BUILTIN_CONFIG.hasBuiltinCredentials) {
      config.TWITCH_CLIENT_ID = BUILTIN_CONFIG.clientId;
      config.TWITCH_CLIENT_SECRET = BUILTIN_CONFIG.clientSecret;
    }

    // Then, load user configuration from config.json file (overrides builtin)
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, 'utf-8');
      const jsonConfig = JSON.parse(content);

      // Merge JSON config into config object
      // Only override if value is not empty (preserves built-in credentials when config has empty values)
      for (const [key, value] of Object.entries(jsonConfig)) {
        if (value !== null && value !== undefined && value !== '') {
          config[key] = value;
        }
      }
    }

    return { success: true, config };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Load configuration
ipcMain.handle('config:load', loadConfig);

// Save configuration
ipcMain.handle('config:save', async (event, config) => {
  try {
    // Ensure user data directory exists
    const userDataDir = app.getPath('userData');
    if (!fs.existsSync(userDataDir)) {
      fs.mkdirSync(userDataDir, { recursive: true });
    }

    // Helper function to determine if a credential should be saved
    const shouldSaveCredential = (value, builtinValue) =>
      !BUILTIN_CONFIG.hasBuiltinCredentials || (value && value !== builtinValue);

    // Only save Client ID and Secret if they differ from builtin or if no builtin exists
    const shouldSaveClientId = shouldSaveCredential(config.TWITCH_CLIENT_ID, BUILTIN_CONFIG.clientId);
    const shouldSaveClientSecret = shouldSaveCredential(config.TWITCH_CLIENT_SECRET, BUILTIN_CONFIG.clientSecret);

    // Build config object
    const configObject = {
      $comment: 'Twitch Channel Points Monitor Configuration - Generated by the GUI application'
    };

    // Only save Client ID and Secret if they differ from builtin
    if (shouldSaveClientId && config.TWITCH_CLIENT_ID) {
      configObject.TWITCH_CLIENT_ID = config.TWITCH_CLIENT_ID;
    }
    if (shouldSaveClientSecret && config.TWITCH_CLIENT_SECRET) {
      configObject.TWITCH_CLIENT_SECRET = config.TWITCH_CLIENT_SECRET;
    }

    configObject.TWITCH_ACCESS_TOKEN = config.TWITCH_ACCESS_TOKEN || '';
    configObject.TWITCH_BROADCASTER_ID = config.TWITCH_BROADCASTER_ID || '';
    configObject.REDIRECT_URI = config.REDIRECT_URI || 'http://localhost:3000/callback';
    configObject.PORT = parseInt(config.PORT, 10) || 3000;

    // Write as formatted JSON
    fs.writeFileSync(configPath, JSON.stringify(configObject, null, 2), 'utf-8');
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Get configuration path
ipcMain.handle('config:getPath', async () => {
  return configPath;
});

// Check if first run
ipcMain.handle('app:isFirstRun', async () => {
  return !fs.existsSync(configPath);
});

// Validate token
ipcMain.handle('token:validate', async (event, accessToken) => {
  try {
    const { TokenValidator } = await import('../lib/tokenValidator.js');
    const result = await TokenValidator.quickCheck(accessToken);
    if (result) {
      return { success: true, data: result };
    } else {
      return { success: false, error: 'Invalid or expired access token' };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Start OAuth server
ipcMain.handle('oauth:start', async (event, port = 3000) => {
  try {
    if (oauthServerProcess) {
      return { success: false, error: 'OAuth server is already running' };
    }

    // Load current configuration
    const configResult = await loadConfig();
    if (!configResult.success) {
      return { success: false, error: 'Failed to load configuration' };
    }

    // Import and start the OAuth server
    const { startOAuthServer } = await import('./oauth-server-electron.js');

    await startOAuthServer({
      clientId: configResult.config.TWITCH_CLIENT_ID,
      clientSecret: configResult.config.TWITCH_CLIENT_SECRET,
      redirectUri: configResult.config.REDIRECT_URI || `http://localhost:${port}/callback`,
      port: port,
      configPath: configPath
    });

    oauthServerProcess = { running: true }; // Mark as running

    return { success: true, port };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Stop OAuth server
ipcMain.handle('oauth:stop', async () => {
  await stopOAuthServer();
  return { success: true };
});

async function stopOAuthServer() {
  if (oauthServerProcess && oauthServerProcess.running) {
    try {
      const { stopOAuthServer: stopServer } = await import('./oauth-server-electron.js');
      await stopServer();
      oauthServerProcess = null;
    } catch (error) {
      console.error('Error stopping OAuth server:', error);
    }
  }
}

// Start EventSub monitoring
ipcMain.handle('eventsub:start', async () => {
  try {
    if (eventSubProcess) {
      return { success: false, error: 'EventSub is already running' };
    }

    // Load configuration
    const configResult = await loadConfig();
    if (!configResult.success || !configResult.config.TWITCH_ACCESS_TOKEN) {
      return { success: false, error: 'Configuration not found. Please complete setup first.' };
    }

    // Set environment variables from config
    const envVars = {
      ...process.env,
      TWITCH_CLIENT_ID: configResult.config.TWITCH_CLIENT_ID || '',
      TWITCH_CLIENT_SECRET: configResult.config.TWITCH_CLIENT_SECRET || '',
      TWITCH_ACCESS_TOKEN: configResult.config.TWITCH_ACCESS_TOKEN || '',
      TWITCH_BROADCASTER_ID: configResult.config.TWITCH_BROADCASTER_ID || '',
      REDIRECT_URI: configResult.config.REDIRECT_URI || '',
      PORT: configResult.config.PORT || ''
    };

    eventSubProcess = fork(
      path.join(__dirname, '../index.js'),
      [],
      {
        env: envVars,
        stdio: 'pipe'
      }
    );

    eventSubProcess.on('error', (error) => {
      const logEntry = {
        timestamp: new Date().toISOString(),
        type: 'error',
        message: `Failed to start EventSub process: ${error.message}`
      };

      if (mainWindow) {
        mainWindow.webContents.send('eventsub:log', logEntry);
        mainWindow.webContents.send('eventsub:stopped', null);
      }

      // Auto-save to session log
      appendToSessionLog(logEntry);

      eventSubProcess = null;
    });

    eventSubProcess.stdout.on('data', (data) => {
      const logEntry = {
        timestamp: new Date().toISOString(),
        type: 'info',
        message: data.toString()
      };

      if (mainWindow) {
        mainWindow.webContents.send('eventsub:log', logEntry);
      }

      // Auto-save to session log
      appendToSessionLog(logEntry);
    });

    eventSubProcess.stderr.on('data', (data) => {
      const logEntry = {
        timestamp: new Date().toISOString(),
        type: 'error',
        message: data.toString()
      };

      if (mainWindow) {
        mainWindow.webContents.send('eventsub:log', logEntry);
      }

      // Auto-save to session log
      appendToSessionLog(logEntry);
    });

    eventSubProcess.on('exit', (code) => {
      eventSubProcess = null;
      if (mainWindow) {
        mainWindow.webContents.send('eventsub:stopped', code);
      }
    });

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Stop EventSub monitoring
ipcMain.handle('eventsub:stop', async () => {
  stopEventSub();
  return { success: true };
});

function stopEventSub() {
  if (eventSubProcess) {
    eventSubProcess.kill();
    eventSubProcess = null;
  }
}

// Get EventSub status
ipcMain.handle('eventsub:status', async () => {
  return { running: eventSubProcess !== null };
});

// Open external URL
ipcMain.handle('shell:openExternal', async (event, url) => {
  await shell.openExternal(url);
  return { success: true };
});

// Open folder in system file explorer
ipcMain.handle('shell:openPath', async (event, folderPath) => {
  const result = await shell.openPath(folderPath);
  if (result) {
    return { success: false, error: result };
  }
  return { success: true };
});

// Show open dialog
ipcMain.handle('dialog:showOpen', async (event, options) => {
  const result = await dialog.showOpenDialog(mainWindow, options);
  return result;
});

// Show save dialog
ipcMain.handle('dialog:showSave', async (event, options) => {
  const result = await dialog.showSaveDialog(mainWindow, options);
  return result;
});

// Get app version
ipcMain.handle('app:getVersion', async () => {
  return app.getVersion();
});

// Get app path
ipcMain.handle('app:getPath', async (event, name) => {
  return app.getPath(name);
});

// Save event log
ipcMain.handle('eventlog:save', async (event, filePath, content) => {
  try {
    await fs.promises.writeFile(filePath, content, 'utf-8');
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Get session ID
ipcMain.handle('session:getId', async () => {
  return { success: true, sessionId };
});

// Get session log file path
ipcMain.handle('session:getLogPath', async () => {
  return { success: true, path: sessionLogPath };
});

// Read session log for validation
ipcMain.handle('session:readLog', async () => {
  try {
    if (!sessionLogPath || !fs.existsSync(sessionLogPath)) {
      return { success: false, error: 'Session log file not found' };
    }

    const content = await fs.promises.readFile(sessionLogPath, 'utf-8');

    // Parse NDJSON format (newline-delimited JSON)
    const logs = content
      .split('\n')
      .filter(line => line.trim().length > 0)
      .map(line => JSON.parse(line));

    return { success: true, logs };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Validate logs in main process to prevent UI blocking
ipcMain.handle('session:validateLogs', async (event, inMemoryLogs) => {
  try {
    if (!sessionLogPath || !fs.existsSync(sessionLogPath)) {
      return {
        success: true,
        valid: false,
        message: 'Session log file not found.',
        sessionLogCount: 0
      };
    }

    const content = await fs.promises.readFile(sessionLogPath, 'utf-8');

    // Parse NDJSON format
    const sessionLogs = content
      .split('\n')
      .filter(line => line.trim().length > 0)
      .map(line => JSON.parse(line));

    // Check if counts match
    if (sessionLogs.length !== inMemoryLogs.length) {
      return {
        success: true,
        valid: false,
        message: 'Event count mismatch between session file and in-memory logs.',
        sessionLogCount: sessionLogs.length
      };
    }

    // Optimize validation for large datasets using sampling
    const totalLogs = sessionLogs.length;
    let indicesToCheck = [];

    if (totalLogs <= VALIDATION_SAMPLE_SIZE * 2) {
      // Small dataset: validate all entries
      indicesToCheck = Array.from({ length: totalLogs }, (_, i) => i);
    } else {
      // Large dataset: use sampling strategy
      // - First VALIDATION_SAMPLE_SIZE/2 entries
      // - Last VALIDATION_SAMPLE_SIZE/2 entries
      // - Random sample from middle
      const halfSample = Math.floor(VALIDATION_SAMPLE_SIZE / 2);

      // First entries
      for (let i = 0; i < halfSample; i++) {
        indicesToCheck.push(i);
      }

      // Last entries
      for (let i = totalLogs - halfSample; i < totalLogs; i++) {
        indicesToCheck.push(i);
      }

      // Random middle samples using Set for O(n) complexity instead of O(n²)
      const middleStart = halfSample;
      const middleEnd = totalLogs - halfSample;
      const middleRange = middleEnd - middleStart;
      const numMiddleSamples = Math.min(VALIDATION_SAMPLE_SIZE, middleRange);

      const indicesSet = new Set(indicesToCheck);
      let added = 0;
      while (added < numMiddleSamples) {
        const randomIndex = middleStart + Math.floor(Math.random() * middleRange);
        if (!indicesSet.has(randomIndex)) {
          indicesToCheck.push(randomIndex);
          indicesSet.add(randomIndex);
          added++;
        }
      }

      // Sort indices for efficient access
      indicesToCheck.sort((a, b) => a - b);
    }

    // Validate sampled entries
    for (const i of indicesToCheck) {
      const sessionLog = sessionLogs[i];
      const memoryLog = inMemoryLogs[i];

      if (sessionLog.timestamp !== memoryLog.timestamp ||
          sessionLog.message !== memoryLog.message ||
          sessionLog.type !== memoryLog.type) {
        return {
          success: true,
          valid: false,
          message: `Event mismatch at index ${i}. Session log and in-memory logs differ.${totalLogs > VALIDATION_SAMPLE_SIZE * 2 ? ' (Sampled validation)' : ''}`,
          sessionLogCount: sessionLogs.length
        };
      }
    }

    // All checks passed
    return {
      success: true,
      valid: true,
      message: `Logs validated successfully.${totalLogs > VALIDATION_SAMPLE_SIZE * 2 ? ` (Sampled ${indicesToCheck.length} of ${totalLogs} entries)` : ''}`,
      sessionLogCount: sessionLogs.length
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
});
