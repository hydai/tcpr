import express from 'express';
import axios from 'axios';
import dotenv from 'dotenv';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Twitch OAuth endpoints
const TWITCH_AUTH_URL = 'https://id.twitch.tv/oauth2/authorize';
const TWITCH_TOKEN_URL = 'https://id.twitch.tv/oauth2/token';
const TWITCH_VALIDATE_URL = 'https://id.twitch.tv/oauth2/validate';

// OAuth configuration from environment
const CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI || `http://localhost:${PORT}/callback`;

// Required scopes for channel points
const SCOPES = [
  'channel:read:redemptions',
  'channel:manage:redemptions'
];

// Store state tokens temporarily (in production, use Redis or a database)
const stateTokens = new Map();

// Serve static files from public directory
app.use(express.static(join(__dirname, 'public')));

/**
 * Route: GET /auth
 * Initiates the OAuth flow by redirecting to Twitch authorization page
 */
app.get('/auth', (req, res) => {
  // Validate environment variables
  if (!CLIENT_ID || !CLIENT_SECRET) {
    return res.status(500).send(
      'Server configuration error: Missing TWITCH_CLIENT_ID or TWITCH_CLIENT_SECRET in .env file'
    );
  }

  // Generate a random state token for CSRF protection
  const state = crypto.randomBytes(16).toString('hex');

  // Store state token with expiration (5 minutes)
  stateTokens.set(state, {
    timestamp: Date.now(),
    expiresAt: Date.now() + (5 * 60 * 1000) // 5 minutes
  });

  // Clean up expired state tokens
  cleanupExpiredStates();

  // Build authorization URL
  const authParams = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: SCOPES.join(' '),
    state: state
  });

  const authUrl = `${TWITCH_AUTH_URL}?${authParams.toString()}`;

  console.log('Redirecting to Twitch OAuth...');
  console.log('Authorization URL:', authUrl);

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
    console.error('OAuth Error:', error, error_description);
    return res.redirect(`/?error=${encodeURIComponent(error)}&error_description=${encodeURIComponent(error_description || '')}`);
  }

  // Validate required parameters
  if (!code || !state) {
    console.error('Missing code or state parameter');
    return res.redirect('/?error=invalid_request&error_description=Missing+code+or+state+parameter');
  }

  // Verify state token (CSRF protection)
  if (!stateTokens.has(state)) {
    console.error('Invalid state token');
    return res.redirect('/?error=invalid_state&error_description=State+token+is+invalid+or+expired');
  }

  // Remove used state token
  stateTokens.delete(state);

  try {
    console.log('Exchanging authorization code for access token...');

    // Exchange authorization code for access token
    const tokenResponse = await axios.post(TWITCH_TOKEN_URL, null, {
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

    console.log('Successfully obtained access token!');
    console.log('Token Type:', token_type);
    console.log('Expires In:', expires_in, 'seconds');
    console.log('Scopes:', scope);

    // Validate the token and get user information
    const validateResponse = await axios.get(TWITCH_VALIDATE_URL, {
      headers: {
        'Authorization': `OAuth ${access_token}`
      }
    });

    const { client_id, login, user_id, scopes } = validateResponse.data;

    console.log('Token validated successfully!');
    console.log('User Login:', login);
    console.log('User ID:', user_id);
    console.log('Client ID:', client_id);

    // Display token information in console
    console.log('\n' + '='.repeat(80));
    console.log('TWITCH OAUTH SUCCESSFUL');
    console.log('='.repeat(80));
    console.log('\nAdd these values to your .env file:\n');
    console.log(`TWITCH_ACCESS_TOKEN=${access_token}`);
    console.log(`TWITCH_BROADCASTER_ID=${user_id}`);
    if (refresh_token) {
      console.log(`TWITCH_REFRESH_TOKEN=${refresh_token}`);
    }
    console.log('\nUser Information:');
    console.log(`Username: ${login}`);
    console.log(`User ID: ${user_id}`);
    console.log(`Scopes: ${scopes.join(', ')}`);
    console.log('\n' + '='.repeat(80) + '\n');

    // Redirect back to home page with success message and token
    res.redirect(`/?access_token=${encodeURIComponent(access_token)}`);

  } catch (error) {
    console.error('Error exchanging code for token:', error.response?.data || error.message);

    const errorMsg = error.response?.data?.message || error.message;
    return res.redirect(`/?error=token_exchange_failed&error_description=${encodeURIComponent(errorMsg)}`);
  }
});

/**
 * Route: GET /health
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    config: {
      clientId: CLIENT_ID ? '✓ Set' : '✗ Missing',
      clientSecret: CLIENT_SECRET ? '✓ Set' : '✗ Missing',
      redirectUri: REDIRECT_URI
    }
  });
});

/**
 * Cleanup expired state tokens
 */
function cleanupExpiredStates() {
  const now = Date.now();
  for (const [state, data] of stateTokens.entries()) {
    if (data.expiresAt < now) {
      stateTokens.delete(state);
    }
  }
}

// Start the server
app.listen(PORT, () => {
  console.log('\n' + '='.repeat(80));
  console.log('TWITCH OAUTH SERVER STARTED');
  console.log('='.repeat(80));
  console.log(`\nServer running at: http://localhost:${PORT}`);
  console.log(`\nConfiguration:`);
  console.log(`- Client ID: ${CLIENT_ID ? '✓ Set' : '✗ Missing'}`);
  console.log(`- Client Secret: ${CLIENT_SECRET ? '✓ Set' : '✗ Missing'}`);
  console.log(`- Redirect URI: ${REDIRECT_URI}`);
  console.log(`\nRequired Scopes: ${SCOPES.join(', ')}`);
  console.log('\n' + '='.repeat(80));
  console.log('\nTo start the OAuth flow:');
  console.log(`1. Open your browser and navigate to: http://localhost:${PORT}`);
  console.log(`2. Click "Connect with Twitch"`);
  console.log(`3. Authorize the application`);
  console.log(`4. Copy the access token and add it to your .env file`);
  console.log('\n' + '='.repeat(80) + '\n');

  // Validate configuration
  if (!CLIENT_ID || !CLIENT_SECRET) {
    console.warn('⚠️  WARNING: Missing required environment variables!');
    console.warn('Please add the following to your .env file:');
    if (!CLIENT_ID) console.warn('- TWITCH_CLIENT_ID');
    if (!CLIENT_SECRET) console.warn('- TWITCH_CLIENT_SECRET');
    console.warn('');
  }
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\nShutting down OAuth server...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\nShutting down OAuth server...');
  process.exit(0);
});
