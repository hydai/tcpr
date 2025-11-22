/**
 * Configuration loader for config.json
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { Logger } from '../lib/logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');
const CONFIG_JSON_PATH = join(PROJECT_ROOT, 'config.json');

// Configuration mapping for setting environment variables
const CONFIG_MAPPING = [
  { key: 'TWITCH_CLIENT_ID', env: 'TWITCH_CLIENT_ID' },
  { key: 'TWITCH_CLIENT_SECRET', env: 'TWITCH_CLIENT_SECRET' },
  { key: 'TWITCH_ACCESS_TOKEN', env: 'TWITCH_ACCESS_TOKEN' },
  { key: 'TWITCH_BROADCASTER_ID', env: 'TWITCH_BROADCASTER_ID' },
  { key: 'TWITCH_REFRESH_TOKEN', env: 'TWITCH_REFRESH_TOKEN' },
  { key: 'REDIRECT_URI', env: 'REDIRECT_URI' },
  { key: 'PORT', env: 'PORT' }
];

// Store which config source was actually loaded
let loadedSource = null;

/**
 * Load configuration from config.json
 * @returns {Object} Configuration object with environment variables set
 */
export function loadConfig() {
  // Load from config.json
  if (existsSync(CONFIG_JSON_PATH)) {
    try {
      const configData = readFileSync(CONFIG_JSON_PATH, 'utf8');
      const config = JSON.parse(configData);

      // Set environment variables from config.json
      // All values must be explicitly converted to strings since process.env only stores strings
      for (const { key, env } of CONFIG_MAPPING) {
        if (config[key] !== undefined) {
          process.env[env] = String(config[key]);
        }
      }

      loadedSource = 'config.json';
      return {
        source: 'config.json',
        loaded: true
      };
    } catch (error) {
      Logger.error('Error loading config.json:', error.message);
      loadedSource = null;
      return {
        source: 'none',
        loaded: false
      };
    }
  }

  // No config file found
  loadedSource = null;
  return {
    source: 'none',
    loaded: false
  };
}

/**
 * Get the configuration file being used
 * @returns {string} Path to config file or description
 */
export function getConfigSource() {
  // Return the source that was actually loaded
  if (loadedSource === 'config.json') {
    return 'config.json';
  }

  return 'No config file found';
}
