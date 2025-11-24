import express from 'express';
import { loadConfig } from './config/loader.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { DEFAULT_OAUTH_SCOPES } from './config/constants.js';
import { Config } from './config/env.js';
import { Logger } from './lib/logger.js';
import { StateTokenManager } from './lib/StateTokenManager.js';
import {
  buildAuthUrl,
  exchangeCodeForToken,
  validateAndGetUserInfo,
  buildErrorRedirect,
  logTokenInfo,
  getHealthCheckResponse
} from './lib/oauth-handler.js';

// Load configuration from config.json
loadConfig();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

// Load configuration
let config;
try {
  config = Config.loadForOAuth();
} catch (error) {
  Logger.error('Configuration error:', error);
  Logger.warn('Server will start but OAuth flow will not work until configuration is fixed');
  config = Config.load(); // Load what we can
}

const PORT = config.port;
const SCOPES = DEFAULT_OAUTH_SCOPES;

// OAuth configuration object for shared handler
const oauthConfig = {
  clientId: config.clientId,
  clientSecret: config.clientSecret,
  redirectUri: config.redirectUri,
  scopes: SCOPES
};

// Initialize state token manager
const stateTokenManager = new StateTokenManager();

// Serve static files from public directory
app.use(express.static(join(__dirname, 'public')));

/**
 * Route: GET /auth
 * Initiates the OAuth flow by redirecting to Twitch authorization page
 */
app.get('/auth', (req, res) => {
  // Validate environment variables
  if (!oauthConfig.clientId || !oauthConfig.clientSecret) {
    Logger.error('Missing CLIENT_ID or CLIENT_SECRET');
    return res.status(500).send(
      'Server configuration error: Missing TWITCH_CLIENT_ID or TWITCH_CLIENT_SECRET in config.json'
    );
  }

  // Generate a state token for CSRF protection
  const state = stateTokenManager.create();

  // Build authorization URL using shared handler
  const authUrl = buildAuthUrl(oauthConfig, state);

  Logger.info('Redirecting to Twitch OAuth...');
  Logger.debug('Authorization URL:', authUrl);

  // Redirect user to Twitch authorization page
  res.redirect(authUrl);
});

/**
 * Route: GET /callback
 * Handles the OAuth callback from Twitch
 */
app.get('/callback', async (req, res) => {
  const { code, state, error, error_description } = req.query;

  // Validate parameter types to prevent injection attacks
  if (code && typeof code !== 'string') {
    Logger.error('Invalid code parameter type');
    return res.redirect('/?error=invalid_request&error_description=Invalid+parameter+type');
  }
  if (state && typeof state !== 'string') {
    Logger.error('Invalid state parameter type');
    return res.redirect('/?error=invalid_request&error_description=Invalid+parameter+type');
  }

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

    // Display token information in console using shared handler
    logTokenInfo(tokens, userInfo);

    // Redirect back to home page with success message and token
    res.redirect(`/?access_token=${encodeURIComponent(tokens.accessToken)}`);

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
app.listen(PORT, () => {
  Logger.header('TWITCH OAUTH SERVER STARTED', '=', 80);
  Logger.log(`\nServer running at: http://localhost:${PORT}`);

  Logger.configStatus({
    'Client ID': oauthConfig.clientId,
    'Client Secret': oauthConfig.clientSecret,
    'Redirect URI': oauthConfig.redirectUri
  });

  Logger.log(`\nRequired Scopes: ${SCOPES.join(', ')}`);

  Logger.divider('=', 80);
  Logger.log('\nTo start the OAuth flow:');
  Logger.log(`1. Open your browser and navigate to: http://localhost:${PORT}`);
  Logger.log(`2. Click "Connect with Twitch"`);
  Logger.log(`3. Authorize the application`);
  Logger.log(`4. Copy the access token and add it to your config.json file`);
  Logger.divider('=', 80);
  Logger.log('');

  // Validate configuration
  if (!oauthConfig.clientId || !oauthConfig.clientSecret) {
    Logger.warn('WARNING: Missing required config.json fields!');
    Logger.log('Please add the following to your config.json file:');
    if (!oauthConfig.clientId) Logger.log('- TWITCH_CLIENT_ID');
    if (!oauthConfig.clientSecret) Logger.log('- TWITCH_CLIENT_SECRET');
    Logger.log('');
  }
});

// Handle graceful shutdown
function shutdown() {
  Logger.log('\n\nShutting down OAuth server...');
  stateTokenManager.destroy();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
