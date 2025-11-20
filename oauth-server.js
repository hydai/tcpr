import express from 'express';
import axios from 'axios';
import { loadConfig } from './config/loader.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { TWITCH_URLS, DEFAULT_OAUTH_SCOPES } from './config/constants.js';
import { Config } from './config/env.js';
import { Logger } from './lib/logger.js';
import { StateTokenManager } from './lib/StateTokenManager.js';

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
const CLIENT_ID = config.clientId;
const CLIENT_SECRET = config.clientSecret;
const REDIRECT_URI = config.redirectUri;
const SCOPES = DEFAULT_OAUTH_SCOPES;

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
  if (!CLIENT_ID || !CLIENT_SECRET) {
    Logger.error('Missing CLIENT_ID or CLIENT_SECRET');
    return res.status(500).send(
      'Server configuration error: Missing TWITCH_CLIENT_ID or TWITCH_CLIENT_SECRET in config.json'
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
    Logger.log(`Token Type: ${token_type}`);
    Logger.log(`Expires In: ${expires_in} seconds`);
    Logger.log(`Scopes: ${scope}`);

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
    Logger.log(`Client ID: ${client_id}`);

    // Display token information in console
    Logger.header('TWITCH OAUTH SUCCESSFUL', '=', 80);
    Logger.log('\n⚠️  WARNING: Access token will be displayed. Do not share or commit this token!\n');
    Logger.log('Add these values to your config.json file:\n');
    Logger.log(`TWITCH_ACCESS_TOKEN=${access_token}`);
    Logger.log(`TWITCH_BROADCASTER_ID=${user_id}`);
    if (refresh_token) {
      Logger.log(`TWITCH_REFRESH_TOKEN=${refresh_token}`);
    }
    Logger.log('\nUser Information:');
    Logger.log(`Username: ${login}`);
    Logger.log(`User ID: ${user_id}`);
    Logger.log(`Scopes: ${scopes.join(', ')}`);
    Logger.divider('=', 80);
    Logger.log('');

    // Redirect back to home page with success message and token
    res.redirect(`/?access_token=${encodeURIComponent(access_token)}`);

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
app.listen(PORT, () => {
  Logger.header('TWITCH OAUTH SERVER STARTED', '=', 80);
  Logger.log(`\nServer running at: http://localhost:${PORT}`);

  Logger.configStatus({
    'Client ID': CLIENT_ID,
    'Client Secret': CLIENT_SECRET,
    'Redirect URI': REDIRECT_URI
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
  if (!CLIENT_ID || !CLIENT_SECRET) {
    Logger.warn('WARNING: Missing required environment variables!');
    Logger.log('Please add the following to your config.json file:');
    if (!CLIENT_ID) Logger.log('- TWITCH_CLIENT_ID');
    if (!CLIENT_SECRET) Logger.log('- TWITCH_CLIENT_SECRET');
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
