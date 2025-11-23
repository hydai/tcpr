import express from 'express';
import { loadConfig } from '../config/loader.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import { DEFAULT_OAUTH_SCOPES } from '../config/constants.js';
import { Logger } from '../lib/logger.js';
import { StateTokenManager } from '../lib/StateTokenManager.js';
import {
  buildAuthUrl,
  exchangeCodeForToken,
  validateAndGetUserInfo,
  buildErrorRedirect,
  buildSuccessRedirect,
  getHealthCheckResponse,
  parsePort
} from '../lib/oauth-handler.js';

// Load configuration from config.json
loadConfig();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration file path (passed from Electron main process)
const CONFIG_PATH = process.env.ELECTRON_CONFIG_PATH || join(dirname(__dirname), 'config.json');

// Server instance
let server = null;

/**
 * Save tokens to config file (Electron-specific)
 * @param {Object} params - Parameters
 * @param {string} params.configPath - Path to config file
 * @param {Object} params.tokens - Token data
 * @param {Object} params.userInfo - User information
 * @param {Object} params.oauthConfig - OAuth configuration
 */
function saveTokensToConfigFile({ configPath, tokens, userInfo, oauthConfig }) {
  // Read existing config or create new
  let existingConfig = {};
  if (fs.existsSync(configPath)) {
    const content = fs.readFileSync(configPath, 'utf-8');
    existingConfig = JSON.parse(content);
  }

  // Update with new values
  existingConfig.TWITCH_ACCESS_TOKEN = tokens.accessToken;
  existingConfig.TWITCH_BROADCASTER_ID = userInfo.userId;
  if (tokens.refreshToken) {
    existingConfig.TWITCH_REFRESH_TOKEN = tokens.refreshToken;
  }

  // Ensure we have the client credentials
  if (oauthConfig.clientId && !existingConfig.TWITCH_CLIENT_ID) {
    existingConfig.TWITCH_CLIENT_ID = oauthConfig.clientId;
  }
  if (oauthConfig.clientSecret && !existingConfig.TWITCH_CLIENT_SECRET) {
    existingConfig.TWITCH_CLIENT_SECRET = oauthConfig.clientSecret;
  }

  // Ensure we have redirect URI and port
  if (!existingConfig.REDIRECT_URI) {
    existingConfig.REDIRECT_URI = oauthConfig.redirectUri;
  }
  if (!existingConfig.PORT) {
    existingConfig.PORT = oauthConfig.port;
  }

  // Write back to file as JSON
  fs.writeFileSync(configPath, JSON.stringify(existingConfig, null, 2), 'utf-8');
  Logger.success(`Configuration saved to: ${configPath}`);
}

/**
 * Start OAuth server for Electron
 * @param {Object} config - Configuration object
 * @param {string} config.clientId - Twitch Client ID
 * @param {string} config.clientSecret - Twitch Client Secret
 * @param {string} config.redirectUri - OAuth redirect URI
 * @param {number} config.port - Server port
 * @param {string} config.configPath - Path to config file
 */
export function startOAuthServer(config) {
  return new Promise((resolve, reject) => {
    const app = express();

    const PORT = parsePort(config.port);
    const SCOPES = DEFAULT_OAUTH_SCOPES;

    // OAuth configuration object for shared handler
    const oauthConfig = {
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      redirectUri: config.redirectUri || `http://localhost:${PORT}/callback`,
      scopes: SCOPES,
      port: PORT
    };

    // Initialize state token manager
    const stateTokenManager = new StateTokenManager();

    // Serve static files from public directory
    app.use(express.static(join(dirname(__dirname), 'public')));

    /**
     * Route: GET /auth
     * Initiates the OAuth flow by redirecting to Twitch authorization page
     */
    app.get('/auth', (req, res) => {
      // Validate environment variables
      if (!oauthConfig.clientId || !oauthConfig.clientSecret) {
        Logger.error('Missing CLIENT_ID or CLIENT_SECRET');
        return res.status(500).send(
          'Server configuration error: Missing CLIENT_ID or CLIENT_SECRET'
        );
      }

      // Generate a state token for CSRF protection
      const state = stateTokenManager.create();

      // Build authorization URL using shared handler
      const authUrl = buildAuthUrl(oauthConfig, state);

      Logger.info('Redirecting to Twitch OAuth...');

      // Redirect user to Twitch authorization page
      res.redirect(authUrl);
    });

    /**
     * Route: GET /callback
     * Handles the OAuth callback from Twitch
     */
    app.get('/callback', async (req, res) => {
      const { code, state, error, error_description } = req.query;

      // Handle OAuth errors
      if (error) {
        Logger.error('OAuth Error:', { error, error_description });
        return res.redirect(buildErrorRedirect(error, error_description || ''));
      }

      // Validate required parameters
      if (!code || !state) {
        Logger.error('Missing code or state parameter');
        return res.redirect(buildErrorRedirect('invalid_request', 'Missing code or state parameter'));
      }

      // Verify and consume state token (CSRF protection)
      if (!stateTokenManager.consume(state)) {
        Logger.error('Invalid state token');
        return res.redirect(buildErrorRedirect('invalid_state', 'State token is invalid or expired'));
      }

      try {
        // Exchange authorization code for access token using shared handler
        const tokens = await exchangeCodeForToken(oauthConfig, code);

        // Validate the token and get user information using shared handler
        const userInfo = await validateAndGetUserInfo(tokens.accessToken);

        // Save to config file (Electron-specific behavior)
        try {
          const configPath = config.configPath || CONFIG_PATH;
          saveTokensToConfigFile({ configPath, tokens, userInfo, oauthConfig });
        } catch (saveError) {
          Logger.error('Error saving configuration:', saveError);
        }

        // Redirect with success and token info
        res.redirect(buildSuccessRedirect({
          accessToken: tokens.accessToken,
          userId: userInfo.userId,
          username: userInfo.login,
          success: true
        }));

      } catch (error) {
        Logger.error('Error exchanging code for token:', error.response?.data || error.message);

        const errorMsg = error.response?.data?.message || error.message;
        return res.redirect(buildErrorRedirect('token_exchange_failed', errorMsg));
      }
    });

    /**
     * Route: GET /health
     * Health check endpoint
     */
    app.get('/health', (req, res) => {
      const stats = stateTokenManager.getStats();
      res.json(getHealthCheckResponse(oauthConfig, stats));
    });

    // Start the server
    server = app.listen(PORT, () => {
      Logger.info(`OAuth server started on port ${PORT}`);
      resolve({ port: PORT });
    });

    server.on('error', (error) => {
      Logger.error('Server error:', error);
      reject(error);
    });
  });
}

/**
 * Stop OAuth server
 */
export function stopOAuthServer() {
  return new Promise((resolve) => {
    if (server) {
      server.close(() => {
        Logger.info('OAuth server stopped');
        resolve();
      });
    } else {
      resolve();
    }
  });
}
