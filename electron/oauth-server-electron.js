import express from 'express';
import axios from 'axios';
import { loadConfig } from '../config/loader.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import { TWITCH_URLS, DEFAULT_OAUTH_SCOPES } from '../config/constants.js';
import { Logger } from '../lib/logger.js';
import { StateTokenManager } from '../lib/StateTokenManager.js';

// Load configuration from config.json or .env
loadConfig();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration file path (passed from Electron main process)
const CONFIG_PATH = process.env.ELECTRON_CONFIG_PATH || join(dirname(__dirname), '.env');

// Server instance
let server = null;

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

    const PORT = config.port || 3000;
    const CLIENT_ID = config.clientId;
    const CLIENT_SECRET = config.clientSecret;
    const REDIRECT_URI = config.redirectUri || `http://localhost:${PORT}/callback`;
    const SCOPES = DEFAULT_OAUTH_SCOPES;

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
      if (!CLIENT_ID || !CLIENT_SECRET) {
        Logger.error('Missing CLIENT_ID or CLIENT_SECRET');
        return res.status(500).send(
          'Server configuration error: Missing CLIENT_ID or CLIENT_SECRET'
        );
      }

      // Generate a state token for CSRF protection
      const state = stateTokenManager.create();

      // Build authorization URL
      const authParams = new URLSearchParams({
        client_id: CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        response_type: 'code',
        scope: SCOPES.join(' '),
        state: state
      });

      const authUrl = `${TWITCH_URLS.OAUTH_AUTHORIZE}?${authParams.toString()}`;

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
        return res.redirect(`/?error=${encodeURIComponent(error)}&error_description=${encodeURIComponent(error_description || '')}`);
      }

      // Validate required parameters
      if (!code || !state) {
        Logger.error('Missing code or state parameter');
        return res.redirect('/?error=invalid_request&error_description=Missing+code+or+state+parameter');
      }

      // Verify and consume state token (CSRF protection)
      if (!stateTokenManager.consume(state)) {
        Logger.error('Invalid state token');
        return res.redirect('/?error=invalid_state&error_description=State+token+is+invalid+or+expired');
      }

      try {
        Logger.info('Exchanging authorization code for access token...');

        // Exchange authorization code for access token
        const tokenResponse = await axios.post(TWITCH_URLS.OAUTH_TOKEN, null, {
          params: {
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            code: code,
            grant_type: 'authorization_code',
            redirect_uri: REDIRECT_URI
          },
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        });

        const { access_token, refresh_token, expires_in, scope, token_type } = tokenResponse.data;

        Logger.success('Successfully obtained access token!');

        // Validate the token and get user information
        const validateResponse = await axios.get(TWITCH_URLS.OAUTH_VALIDATE, {
          headers: {
            'Authorization': `OAuth ${access_token}`
          }
        });

        const { client_id, login, user_id, scopes } = validateResponse.data;

        Logger.success('Token validated successfully!');
        Logger.log(`User Login: ${login}`);
        Logger.log(`User ID: ${user_id}`);

        // Save to config file (Electron mode)
        try {
          const configPath = config.configPath || CONFIG_PATH;

          // Read existing config or create new
          let existingConfig = {};
          if (fs.existsSync(configPath)) {
            const content = fs.readFileSync(configPath, 'utf-8');
            content.split('\n').forEach(line => {
              line = line.trim();
              if (line && !line.startsWith('#')) {
                const [key, ...valueParts] = line.split('=');
                const value = valueParts.join('=').trim();
                existingConfig[key.trim()] = value;
              }
            });
          }

          // Update with new values
          existingConfig['TWITCH_ACCESS_TOKEN'] = access_token;
          existingConfig['TWITCH_BROADCASTER_ID'] = user_id;
          if (refresh_token) {
            existingConfig['TWITCH_REFRESH_TOKEN'] = refresh_token;
          }

          // Ensure we have the client credentials
          if (CLIENT_ID && !existingConfig['TWITCH_CLIENT_ID']) {
            existingConfig['TWITCH_CLIENT_ID'] = CLIENT_ID;
          }
          if (CLIENT_SECRET && !existingConfig['TWITCH_CLIENT_SECRET']) {
            existingConfig['TWITCH_CLIENT_SECRET'] = CLIENT_SECRET;
          }

          // Write back to file
          const lines = [
            '# Twitch Channel Points Monitor Configuration',
            '# Generated by the OAuth flow',
            '',
            `TWITCH_CLIENT_ID=${existingConfig['TWITCH_CLIENT_ID'] || ''}`,
            `TWITCH_CLIENT_SECRET=${existingConfig['TWITCH_CLIENT_SECRET'] || ''}`,
            `TWITCH_ACCESS_TOKEN=${existingConfig['TWITCH_ACCESS_TOKEN'] || ''}`,
            `TWITCH_BROADCASTER_ID=${existingConfig['TWITCH_BROADCASTER_ID'] || ''}`,
            `REDIRECT_URI=${existingConfig['REDIRECT_URI'] || REDIRECT_URI}`,
            `PORT=${existingConfig['PORT'] || PORT}`
          ];

          if (existingConfig['TWITCH_REFRESH_TOKEN']) {
            lines.push(`TWITCH_REFRESH_TOKEN=${existingConfig['TWITCH_REFRESH_TOKEN']}`);
          }

          fs.writeFileSync(configPath, lines.join('\n'), 'utf-8');
          Logger.success(`Configuration saved to: ${configPath}`);
        } catch (saveError) {
          Logger.error('Error saving configuration:', saveError);
        }

        // Redirect with success and token info
        const redirectParams = new URLSearchParams({
          access_token: access_token,
          user_id: user_id,
          username: login,
          success: 'true'
        });

        res.redirect(`/?${redirectParams.toString()}`);

      } catch (error) {
        Logger.error('Error exchanging code for token:', error.response?.data || error.message);

        const errorMsg = error.response?.data?.message || error.message;
        return res.redirect(`/?error=token_exchange_failed&error_description=${encodeURIComponent(errorMsg)}`);
      }
    });

    /**
     * Route: GET /health
     * Health check endpoint
     */
    app.get('/health', (req, res) => {
      const stats = stateTokenManager.getStats();

      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        config: {
          clientId: CLIENT_ID ? '✓ Set' : '✗ Missing',
          clientSecret: CLIENT_SECRET ? '✓ Set' : '✗ Missing',
          redirectUri: REDIRECT_URI
        },
        stateTokens: {
          total: stats.total,
          active: stats.active,
          expired: stats.expired
        }
      });
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
