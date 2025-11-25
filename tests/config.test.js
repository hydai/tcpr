import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Config } from '../config/env.js';

describe('Config', () => {
  // Store original env values
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Clear relevant env vars before each test
    delete process.env.TWITCH_CLIENT_ID;
    delete process.env.TWITCH_CLIENT_SECRET;
    delete process.env.TWITCH_ACCESS_TOKEN;
    delete process.env.TWITCH_BROADCASTER_ID;
    delete process.env.TWITCH_REFRESH_TOKEN;
    delete process.env.REDIRECT_URI;
    delete process.env.PORT;
  });

  afterEach(() => {
    // Restore original env
    process.env = { ...originalEnv };
  });

  describe('load', () => {
    it('should load config with all values set', () => {
      process.env.TWITCH_CLIENT_ID = 'test-client-id';
      process.env.TWITCH_CLIENT_SECRET = 'test-secret';
      process.env.TWITCH_ACCESS_TOKEN = 'test-token';
      process.env.TWITCH_BROADCASTER_ID = '12345';

      const config = Config.load({ required: 'minimal' });

      expect(config.clientId).toBe('test-client-id');
      expect(config.clientSecret).toBe('test-secret');
      expect(config.accessToken).toBe('test-token');
      expect(config.broadcasterId).toBe('12345');
    });

    it('should use default values for port and redirectUri', () => {
      process.env.TWITCH_CLIENT_ID = 'test-client-id';

      const config = Config.load({ required: 'minimal' });

      expect(config.port).toBe(3000);
      expect(config.redirectUri).toBe('http://localhost:3000/callback');
    });

    it('should parse PORT as integer', () => {
      process.env.TWITCH_CLIENT_ID = 'test-client-id';
      process.env.PORT = '8080';

      const config = Config.load({ required: 'minimal' });

      expect(config.port).toBe(8080);
    });

    it('should throw when required clientId is missing', () => {
      expect(() => Config.load({ required: 'minimal' }))
        .toThrow(/Missing required configuration/);
    });

    it('should throw when oauth required fields are missing', () => {
      process.env.TWITCH_CLIENT_ID = 'test-client-id';

      expect(() => Config.load({ required: 'oauth' }))
        .toThrow(/Missing required configuration/);
    });

    it('should throw when client required fields are missing', () => {
      process.env.TWITCH_CLIENT_ID = 'test-client-id';

      expect(() => Config.load({ required: 'client' }))
        .toThrow(/Missing required configuration/);
    });

    it('should validate port range', () => {
      process.env.TWITCH_CLIENT_ID = 'test-client-id';
      process.env.PORT = '-1';

      expect(() => Config.load({ required: 'minimal' }))
        .toThrow(/PORT must be a valid number between 1 and 65535/);
    });

    it('should accept valid ports', () => {
      process.env.TWITCH_CLIENT_ID = 'test-client-id';

      process.env.PORT = '3000';
      expect(() => Config.load({ required: 'minimal' })).not.toThrow();

      process.env.PORT = '1';
      expect(() => Config.load({ required: 'minimal' })).not.toThrow();

      process.env.PORT = '65535';
      expect(() => Config.load({ required: 'minimal' })).not.toThrow();
    });
  });

  describe('getEnvName', () => {
    it('should map config keys to environment variable names', () => {
      expect(Config.getEnvName('clientId')).toBe('TWITCH_CLIENT_ID');
      expect(Config.getEnvName('clientSecret')).toBe('TWITCH_CLIENT_SECRET');
      expect(Config.getEnvName('accessToken')).toBe('TWITCH_ACCESS_TOKEN');
      expect(Config.getEnvName('broadcasterId')).toBe('TWITCH_BROADCASTER_ID');
      expect(Config.getEnvName('refreshToken')).toBe('TWITCH_REFRESH_TOKEN');
      expect(Config.getEnvName('redirectUri')).toBe('REDIRECT_URI');
      expect(Config.getEnvName('port')).toBe('PORT');
    });

    it('should uppercase unknown keys', () => {
      expect(Config.getEnvName('unknownKey')).toBe('UNKNOWNKEY');
    });
  });

  describe('load with returnValidationResult', () => {
    it('should return valid:true when all required fields are set', () => {
      process.env.TWITCH_CLIENT_ID = 'test-client-id';
      process.env.TWITCH_ACCESS_TOKEN = 'test-token';
      process.env.TWITCH_BROADCASTER_ID = '12345';

      const result = Config.load({ required: 'client', returnValidationResult: true });

      expect(result.valid).toBe(true);
      expect(result.config).toBeDefined();
    });

    it('should return valid:false when required fields are missing', () => {
      process.env.TWITCH_CLIENT_ID = 'test-client-id';
      // Missing access token and broadcaster ID

      const result = Config.load({ required: 'client', returnValidationResult: true });

      expect(result.valid).toBe(false);
      expect(result.missing).toContain('accessToken');
      expect(result.missing).toContain('broadcasterId');
    });

    it('should return valid:false for invalid port', () => {
      process.env.TWITCH_CLIENT_ID = 'test-client-id';
      process.env.PORT = '-1';

      const result = Config.load({ required: 'minimal', returnValidationResult: true });

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid PORT');
    });
  });

  describe('required field presets', () => {
    it('should validate client preset fields', () => {
      process.env.TWITCH_CLIENT_ID = 'test-client-id';
      process.env.TWITCH_ACCESS_TOKEN = 'test-token';
      process.env.TWITCH_BROADCASTER_ID = '12345';

      const config = Config.load({ required: 'client' });

      expect(config.clientId).toBe('test-client-id');
      expect(config.accessToken).toBe('test-token');
      expect(config.broadcasterId).toBe('12345');
    });

    it('should validate oauth preset fields', () => {
      process.env.TWITCH_CLIENT_ID = 'test-client-id';
      process.env.TWITCH_CLIENT_SECRET = 'test-secret';

      const config = Config.load({ required: 'oauth' });

      expect(config.clientId).toBe('test-client-id');
      expect(config.clientSecret).toBe('test-secret');
    });

    it('should accept custom required fields array', () => {
      process.env.TWITCH_CLIENT_ID = 'test-client-id';
      process.env.TWITCH_REFRESH_TOKEN = 'test-refresh';

      const config = Config.load({ required: ['clientId', 'refreshToken'] });

      expect(config.clientId).toBe('test-client-id');
      expect(config.refreshToken).toBe('test-refresh');
    });
  });
});
