/**
 * Configuration loader that supports multiple config sources
 * Priority: config.json > .env
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');
const CONFIG_JSON_PATH = join(PROJECT_ROOT, 'config.json');

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
      if (config.TWITCH_CLIENT_ID) process.env.TWITCH_CLIENT_ID = config.TWITCH_CLIENT_ID;
      if (config.TWITCH_CLIENT_SECRET) process.env.TWITCH_CLIENT_SECRET = config.TWITCH_CLIENT_SECRET;
      if (config.TWITCH_ACCESS_TOKEN) process.env.TWITCH_ACCESS_TOKEN = config.TWITCH_ACCESS_TOKEN;
      if (config.TWITCH_BROADCASTER_ID) process.env.TWITCH_BROADCASTER_ID = config.TWITCH_BROADCASTER_ID;
      if (config.REDIRECT_URI) process.env.REDIRECT_URI = config.REDIRECT_URI;
      if (config.PORT) process.env.PORT = String(config.PORT);

      return {
        source: 'config.json',
        loaded: true
      };
    } catch (error) {
      console.error('Error loading config.json:', error.message);
      console.error('Falling back to .env file...\n');
      // Fall through to dotenv loading
    }
  }

  // Fall back to .env file (hidden file, backward compatibility)
  dotenv.config();

  return {
    source: '.env',
    loaded: true
  };
}

/**
 * Get the configuration file being used
 * @returns {string} Path to config file or description
 */
export function getConfigSource() {
  if (existsSync(CONFIG_JSON_PATH)) {
    return 'config.json (visible config file)';
  }

  const envPath = join(PROJECT_ROOT, '.env');
  if (existsSync(envPath)) {
    return '.env (hidden config file)';
  }

  return 'No config file found';
}
