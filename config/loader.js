/**
 * Configuration loader that supports multiple config sources
 * Priority: config.json > .env
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { Logger } from '../lib/logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');
const CONFIG_JSON_PATH = join(PROJECT_ROOT, 'config.json');
const ENV_PATH = join(PROJECT_ROOT, '.env');

// Configuration mapping for setting environment variables
const CONFIG_MAPPING = [
  { key: 'TWITCH_CLIENT_ID', env: 'TWITCH_CLIENT_ID' },
  { key: 'TWITCH_CLIENT_SECRET', env: 'TWITCH_CLIENT_SECRET' },
  { key: 'TWITCH_ACCESS_TOKEN', env: 'TWITCH_ACCESS_TOKEN' },
  { key: 'TWITCH_BROADCASTER_ID', env: 'TWITCH_BROADCASTER_ID' },
  { key: 'REDIRECT_URI', env: 'REDIRECT_URI' },
  { key: 'PORT', env: 'PORT' }
];

// Store which config source was actually loaded
let loadedSource = null;

/**
 * Load configuration from available sources
 * @returns {Object} Configuration object with environment variables set
 */
export function loadConfig() {
  // Try loading from config.json first (visible file)
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
      Logger.error('Falling back to .env file...\n');
      // Fall through to dotenv loading
    }
  }

  // Fall back to .env file (hidden file, backward compatibility)
  if (existsSync(ENV_PATH)) {
    dotenv.config();
    loadedSource = '.env';
    return {
      source: '.env',
      loaded: true
    };
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
    return 'config.json (visible config file)';
  }

  if (loadedSource === '.env') {
    return '.env (hidden config file)';
  }

  return 'No config file found';
}
