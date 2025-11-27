import { app, BrowserWindow, ipcMain, dialog, Menu, shell } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { fork } from 'child_process';
import { randomUUID } from 'crypto';
// SECURITY NOTE: xlsx@0.18.5 - Prototype Pollution (GHSA-4r6h-8v6p-xvw6) is patched in this version.
// ReDoS vulnerability (GHSA-5pgg-2g8v-p4x9) affects parsing only; we use xlsx for writing only.
// All data comes from trusted internal EventSub events, significantly reducing attack surface.
// Monitor for updates if read functionality is added in the future.
import * as XLSX from 'xlsx';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;
let eventSubProcess = null;
let oauthServerProcess = null;

// Path to config.json file
const configPath = path.join(app.getPath('userData'), 'config.json');

// Error message for file save path validation (used in multiple IPC handlers)
const FILE_SAVE_PATH_ERROR = 'For security, files can only be saved to:\n• Downloads\n• Documents\n• Desktop\n• App Data';

/**
 * SessionLogger - Manages session log writing
 *
 * Responsibilities:
 * - Creates and manages unique session IDs for each app run
 * - Writes event logs to NDJSON files in the user data directory
 *
 * Note: Uses synchronous file writes for simplicity and reliability during shutdown.
 * This may block the event loop for large entries but ensures data integrity.
 */
class SessionLogger {
  constructor() {
    this.sessionId = null;
    this.logPath = null;
    this.mainWindow = null;
  }

  /**
   * Initialize session with unique ID and log file
   */
  initialize() {
    this.sessionId = randomUUID();

    const logsDir = path.join(app.getPath('userData'), 'logs');
    try {
      fs.mkdirSync(logsDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create logs directory:', error);
    }

    this.logPath = path.join(logsDir, `session-${this.sessionId}.jsonl`);

    try {
      fs.writeFileSync(this.logPath, '', 'utf-8');
      console.log(`Session initialized: ${this.sessionId}`);
      console.log(`Session log file: ${this.logPath}`);
    } catch (error) {
      console.error('Failed to initialize session log file:', error);
    }
  }

  /**
   * Set the main window reference
   */
  setMainWindow(window) {
    this.mainWindow = window;
  }

  /**
   * Append log entry to session file
   * Skips internal logs (e.g., system status messages) to keep session files clean
   */
  append(logEntry) {
    if (!this.logPath || logEntry.internal) {
      return;
    }

    try {
      fs.appendFileSync(this.logPath, JSON.stringify(logEntry) + '\n', 'utf-8');
    } catch (error) {
      console.error('Failed to append to session log:', error);
    }
  }

  // Getters for external access
  get id() { return this.sessionId; }
  get path() { return this.logPath; }
  get initialized() { return !!(this.sessionId && this.logPath); }
}

// Global session logger instance
const sessionLogger = new SessionLogger();

/**
 * Check if a message is a keepalive message
 * Filters out WebSocket keepalive messages from EventSub stream to reduce UI clutter
 * and prevent session log pollution.
 *
 * Uses word boundaries to avoid false positives on unrelated messages.
 *
 * @param {string} message - Message to check
 * @returns {boolean} True if keepalive message
 * @example
 * isKeepaliveMessage('Received session_keepalive') // true
 * isKeepaliveMessage('Keepalive received from WebSocket') // true
 * isKeepaliveMessage('Channel point redemption event') // false
 */
const KEEPALIVE_REGEX = /\b(session_keepalive|keepalive received)\b/i;

function isKeepaliveMessage(message) {
  if (!message) return false;
  return KEEPALIVE_REGEX.test(message);
}

/**
 * Handle process log output from EventSub child process
 * Filters keepalive messages and sends to UI and session log
 *
 * @param {string} type - Log type ('info' or 'error')
 * @param {Buffer|string} data - Raw data from process stream
 */
function handleProcessLog(type, data) {
  const message = data.toString();

  // Filter out keepalive messages
  if (isKeepaliveMessage(message)) {
    return;
  }

  const logEntry = {
    timestamp: new Date().toISOString(),
    type: type,
    message: message
  };

  if (mainWindow) {
    mainWindow.webContents.send('eventsub:log', logEntry);
  }

  // Auto-save to session log
  sessionLogger.append(logEntry);
}

/**
 * Check if a child path is within a parent directory
 * Handles case-insensitive filesystems (Windows/macOS) and prevents path traversal
 * @param {string} parent - Parent directory path
 * @param {string} child - Child path to validate
 * @returns {boolean} True if child is within parent
 */
function isPathWithin(parent, child) {
  const normalizedParent = path.normalize(parent);
  const normalizedChild = path.normalize(child);

  // On case-insensitive filesystems (Windows/macOS), normalize case for comparison
  // This ensures /Users/Foo and /users/foo are treated as the same path
  let parentForComparison = normalizedParent;
  let childForComparison = normalizedChild;
  if (process.platform === 'win32' || process.platform === 'darwin') {
    parentForComparison = normalizedParent.toLowerCase();
    childForComparison = normalizedChild.toLowerCase();
  }

  const relative = path.relative(parentForComparison, childForComparison);

  // Ensure the relative path doesn't escape the parent (no '..' at start)
  // and isn't an absolute path (which would indicate it's outside the parent)
  return relative && !relative.startsWith('..') && !path.isAbsolute(relative);
}

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
    sessionLogger.setMainWindow(mainWindow);
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

// App ready
app.whenReady().then(() => {
  sessionLogger.initialize();
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

    // Load user configuration from config.json file
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, 'utf-8');
      const jsonConfig = JSON.parse(content);

      // Merge JSON config into config object.
      // Skip empty values to prevent clearing required configuration.
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

    // Build config object
    const configObject = {};

    // Save all configuration values
    if (config.TWITCH_CLIENT_ID) {
      configObject.TWITCH_CLIENT_ID = config.TWITCH_CLIENT_ID;
    }
    if (config.TWITCH_CLIENT_SECRET) {
      configObject.TWITCH_CLIENT_SECRET = config.TWITCH_CLIENT_SECRET;
    }

    configObject.TWITCH_ACCESS_TOKEN = config.TWITCH_ACCESS_TOKEN || '';
    configObject.TWITCH_BROADCASTER_ID = config.TWITCH_BROADCASTER_ID || '';

    // Save refresh token for auto-refresh functionality
    configObject.TWITCH_REFRESH_TOKEN = config.TWITCH_REFRESH_TOKEN || '';

    configObject.REDIRECT_URI = config.REDIRECT_URI || 'http://localhost:3000/callback';

    // Ensure PORT is always a valid number
    const portValue = parseInt(config.PORT, 10);
    configObject.PORT = isNaN(portValue) ? 3000 : portValue;

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

// Get token expiration info
ipcMain.handle('token:getExpiry', async () => {
  try {
    // Load current configuration
    const configResult = await loadConfig();
    if (!configResult.success || !configResult.config.TWITCH_ACCESS_TOKEN) {
      return { success: false, error: 'No access token configured' };
    }

    const { TokenValidator } = await import('../lib/tokenValidator.js');
    const result = await TokenValidator.quickCheck(configResult.config.TWITCH_ACCESS_TOKEN);

    if (result && result.expires_in !== undefined) {
      return {
        success: true,
        expiresIn: result.expires_in, // seconds until expiration
        expiresAt: Date.now() + (result.expires_in * 1000) // absolute timestamp
      };
    } else {
      return { success: false, error: 'Unable to get token expiration info' };
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
      TWITCH_REFRESH_TOKEN: configResult.config.TWITCH_REFRESH_TOKEN || '',
      TWITCH_BROADCASTER_ID: configResult.config.TWITCH_BROADCASTER_ID || '',
      REDIRECT_URI: configResult.config.REDIRECT_URI || '',
      PORT: configResult.config.PORT || '',
      // Pass the config path to the child process so TokenRefresher can save tokens
      CONFIG_PATH: configPath
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
      sessionLogger.append(logEntry);

      eventSubProcess = null;
    });

    eventSubProcess.stdout.on('data', (data) => handleProcessLog('info', data));

    // Handle structured IPC messages from child process
    eventSubProcess.on('message', (message) => {
      if (message.type === 'token:refreshed' && mainWindow) {
        mainWindow.webContents.send('token:refreshed');
      }
    });

    eventSubProcess.stderr.on('data', (data) => handleProcessLog('error', data));

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
// Security: Only allow http and https URLs to prevent arbitrary protocol execution
ipcMain.handle('shell:openExternal', async (event, url) => {
  try {
    const parsedUrl = new URL(url);
    const allowedProtocols = ['http:', 'https:'];

    if (!allowedProtocols.includes(parsedUrl.protocol)) {
      return { success: false, error: `Invalid URL protocol: ${parsedUrl.protocol}. Only http and https are allowed.` };
    }

    await shell.openExternal(url);
    return { success: true };
  } catch (error) {
    return { success: false, error: `Invalid URL: ${error.message}` };
  }
});

// Open folder in system file explorer
ipcMain.handle('shell:openPath', async (event, folderPath) => {
  const result = await shell.openPath(folderPath);
  if (result) {
    return { success: false, error: result };
  }
  return { success: true };
});

// Show save dialog
ipcMain.handle('dialog:showSave', async (event, options) => {
  const result = await dialog.showSaveDialog(mainWindow, options);
  return result;
});

// Show open dialog
ipcMain.handle('dialog:showOpen', async (event, options) => {
  const result = await dialog.showOpenDialog(mainWindow, options);
  return result;
});

// Read file content
// Security: Validate that the file path is within allowed directories
ipcMain.handle('file:read', async (event, filePath) => {
  try {
    // Resolve to absolute path to prevent path traversal
    let resolvedPath = path.resolve(filePath);

    // Resolve symlinks if file exists
    if (fs.existsSync(resolvedPath)) {
      try {
        resolvedPath = fs.realpathSync(resolvedPath);
      } catch (error) {
        console.error('Symlink resolution failed:', error.message);
        return { success: false, error: 'Failed to resolve file path' };
      }
    }

    // Define allowed directories for reading files
    const allowedDirs = [
      app.getPath('downloads'),
      app.getPath('documents'),
      app.getPath('desktop'),
      app.getPath('userData'),
      app.getPath('temp')
    ].map(dir => {
      try {
        return fs.realpathSync(dir);
      } catch (e) {
        return dir;
      }
    });

    // Check if the resolved path is within any allowed directory
    const isAllowedPath = allowedDirs.some(dir => isPathWithin(dir, resolvedPath));

    if (!isAllowedPath) {
      return {
        success: false,
        error: 'File access denied: path not in allowed directories'
      };
    }

    // Check file size to prevent memory exhaustion (50MB limit)
    const MAX_FILE_SIZE = 50 * 1024 * 1024;
    const stats = await fs.promises.stat(resolvedPath);
    if (stats.size > MAX_FILE_SIZE) {
      return {
        success: false,
        error: `File too large: ${Math.round(stats.size / (1024 * 1024))}MB exceeds 50MB limit`
      };
    }

    const content = await fs.promises.readFile(resolvedPath, 'utf-8');
    return { success: true, content };
  } catch (error) {
    return { success: false, error: error.message };
  }
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
// Security: Validate that the file path is within allowed directories
ipcMain.handle('eventlog:save', async (event, filePath, content) => {
  try {
    // Resolve to absolute path to prevent path traversal
    let resolvedPath = path.resolve(filePath);

    // Resolve symlinks to prevent bypass attacks
    // If parent directory exists, resolve it; validation occurs later via isAllowedPath check
    try {
      const parentDir = path.dirname(resolvedPath);
      if (fs.existsSync(parentDir)) {
        // Resolve parent directory symlinks
        const realParent = fs.realpathSync(parentDir);
        resolvedPath = path.join(realParent, path.basename(resolvedPath));
      }
      // If file already exists, resolve its symlinks too
      if (fs.existsSync(resolvedPath)) {
        resolvedPath = fs.realpathSync(resolvedPath);
      }
    } catch (error) {
      // If realpath fails, continue with resolved path
      // This handles the case where the file doesn't exist yet
    }

    // Define allowed directories for saving files, resolving symlinks
    const allowedDirs = [
      app.getPath('downloads'),
      app.getPath('documents'),
      app.getPath('desktop'),
      app.getPath('userData')
    ].map(dir => {
      try {
        return fs.realpathSync(dir);
      } catch (e) {
        // If directory doesn't exist or can't be resolved, use original path
        return dir;
      }
    });

    // Check if the resolved path is within any allowed directory
    const isAllowedPath = allowedDirs.some(dir => isPathWithin(dir, resolvedPath));

    if (!isAllowedPath) {
      return { success: false, error: FILE_SAVE_PATH_ERROR };
    }

    await fs.promises.writeFile(resolvedPath, content, 'utf-8');
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Export to Excel - generates Excel file from redemption data
// Security: Validate that the file path is within allowed directories
ipcMain.handle('export:excel', async (event, filePath, redemptions) => {
  try {
    // Validate input: redemptions must be an array
    if (!Array.isArray(redemptions)) {
      return { success: false, error: 'Invalid data: redemptions must be an array' };
    }

    // Validate each redemption has required fields
    // Note: user_id, user_login, user_input, and status are optional (use ?? '' in utils.js)
    const requiredFields = ['redeemed_at', 'reward_title', 'user_name', 'redemption_id'];
    for (const r of redemptions) {
      if (!r || typeof r !== 'object') {
        return { success: false, error: 'Invalid redemption data: each item must be an object' };
      }
      const missingFields = requiredFields.filter(field => !(field in r));
      if (missingFields.length > 0) {
        return { success: false, error: `Invalid redemption data: missing fields: ${missingFields.join(', ')}` };
      }
    }

    // Resolve to absolute path to prevent path traversal
    let resolvedPath = path.resolve(filePath);

    // Resolve symlinks to prevent bypass attacks
    try {
      const parentDir = path.dirname(resolvedPath);
      if (fs.existsSync(parentDir)) {
        const realParent = fs.realpathSync(parentDir);
        resolvedPath = path.join(realParent, path.basename(resolvedPath));
      }
      if (fs.existsSync(resolvedPath)) {
        resolvedPath = fs.realpathSync(resolvedPath);
      }
    } catch (error) {
      // Log the error and reject the operation for security
      console.error('Symlink resolution failed:', error.message);
      return {
        success: false,
        error: 'Failed to resolve file path. Please ensure the destination directory exists and is accessible.'
      };
    }

    // Define allowed directories for saving files
    const allowedDirs = [
      app.getPath('downloads'),
      app.getPath('documents'),
      app.getPath('desktop'),
      app.getPath('userData')
    ].map(dir => {
      try {
        return fs.realpathSync(dir);
      } catch (e) {
        return dir;
      }
    });

    // Check if the resolved path is within any allowed directory
    const isAllowedPath = allowedDirs.some(dir => isPathWithin(dir, resolvedPath));

    if (!isAllowedPath) {
      return { success: false, error: FILE_SAVE_PATH_ERROR };
    }

    /**
     * Convert UTC timestamp to JST (Asia/Tokyo) using Intl.DateTimeFormat
     * NOTE: This function is duplicated in gui/js/utils.js due to Electron architecture.
     * The main process cannot import ES modules from the renderer process without a bundler.
     * Keep both implementations in sync when making changes.
     * @see gui/js/utils.js#formatToJST
     */
    const formatToJST = (isoString) => {
      const date = new Date(isoString);
      const formatter = new Intl.DateTimeFormat('ja-JP', {
        timeZone: 'Asia/Tokyo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
      const parts = formatter.formatToParts(date);
      // Use optional chaining with fallbacks for defensive programming
      const y = parts.find(p => p.type === 'year')?.value ?? '0000';
      const m = parts.find(p => p.type === 'month')?.value ?? '00';
      const d = parts.find(p => p.type === 'day')?.value ?? '00';
      const h = parts.find(p => p.type === 'hour')?.value ?? '00';
      const min = parts.find(p => p.type === 'minute')?.value ?? '00';
      const s = parts.find(p => p.type === 'second')?.value ?? '00';
      return `${y}-${m}-${d} ${h}:${min}:${s}`;
    };

    /**
     * Sanitize field for Excel to prevent formula injection
     * Prefixes with single quote if value starts with formula characters (=, +, -, @)
     * @see https://owasp.org/www-community/attacks/CSV_Injection
     */
    const sanitizeExcelField = (value) => {
      const str = String(value ?? '');
      if (/^[=+\-@]/.test(str)) {
        return "'" + str;
      }
      return str;
    };

    // Convert redemptions to Excel rows with Japanese headers
    // All fields are sanitized to prevent Excel formula injection (defense-in-depth)
    const rows = redemptions.map(r => ({
      '引き換え時間 (UTC+9)': formatToJST(r.redeemed_at),
      '報酬名': sanitizeExcelField(r.reward_title),
      'ユーザー名': sanitizeExcelField(r.user_name),
      'ユーザーID': sanitizeExcelField(r.user_id),
      'ログイン名': sanitizeExcelField(r.user_login),
      'ユーザー入力': sanitizeExcelField(r.user_input),
      'ステータス': sanitizeExcelField(r.status),
      '引き換えID': sanitizeExcelField(r.redemption_id)
    }));

    // Create workbook and worksheet
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Dailyおみくじ');

    // Write to file
    XLSX.writeFile(workbook, resolvedPath);
    return { success: true };
  } catch (error) {
    console.error('Excel export failed:', error);
    return {
      success: false,
      error: `Failed to create Excel file: ${error.message}`
    };
  }
});

// Get session ID
ipcMain.handle('session:getId', async () => {
  return { success: true, sessionId: sessionLogger.id };
});

// Get session log file path
ipcMain.handle('session:getLogPath', async () => {
  return { success: true, path: sessionLogger.path };
});

// Delete all logs in the logs folder
ipcMain.handle('logs:deleteAll', async () => {
  try {
    const userDataDir = app.getPath('userData');
    const logsDir = path.join(userDataDir, 'logs');

    if (!fs.existsSync(logsDir)) {
      return { success: true, deletedCount: 0, message: 'Logs folder does not exist' };
    }

    // Read all files in the logs directory
    const files = await fs.promises.readdir(logsDir);
    let deletedCount = 0;
    const errors = [];

    for (const file of files) {
      // Skip the current session log file to avoid breaking active logging
      if (sessionLogger.path && path.join(logsDir, file) === sessionLogger.path) {
        continue;
      }

      const filePath = path.join(logsDir, file);
      try {
        const stat = await fs.promises.stat(filePath);
        if (stat.isFile()) {
          await fs.promises.unlink(filePath);
          deletedCount++;
        }
      } catch (fileError) {
        errors.push(`Failed to delete ${file}: ${fileError.message}`);
      }
    }

    if (errors.length > 0) {
      return {
        success: true,
        deletedCount,
        message: `Deleted ${deletedCount} files with ${errors.length} errors`,
        errors
      };
    }

    return { success: true, deletedCount, message: `Deleted ${deletedCount} log files` };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

