/**
 * Configuration loader for config.json
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { Logger } from '../lib/logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');

// Use CONFIG_PATH env variable if set (for Electron), otherwise use project root
// This allows the Electron main process to specify where config.json is stored
const CONFIG_JSON_PATH = process.env.CONFIG_PATH || join(PROJECT_ROOT, 'config.json');

// Export the config path for other modules (e.g., TokenRefresher)
export { CONFIG_JSON_PATH };

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

      return {
        source: 'config.json',
        loaded: true
      };
    } catch (error) {
      Logger.error('Error loading config.json:', error.message);
      return {
        source: 'none',
        loaded: false
      };
    }
  }

  // No config file found
  return {
    source: 'none',
    loaded: false
  };
}
