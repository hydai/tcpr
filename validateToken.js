import { loadConfig } from './config/loader.js';
import { Config } from './config/env.js';
import { TokenValidator } from './lib/tokenValidator.js';
import { Logger } from './lib/logger.js';
import { TokenValidationError } from './lib/errors.js';

// Load configuration from config.json
loadConfig();

/**
 * Validates the Twitch access token and checks for required scopes
 */
async function validateToken() {
  // Load configuration
  const result = Config.loadForValidation();

  if (!result.valid) {
    Logger.error('Missing required config.json fields');
    Logger.log('Please ensure the following are set in your config.json file:');
    result.missing.forEach(field => {
      Logger.log(`  - ${Config.getEnvName(field)}`);
    });
    return false;
  }

  const { config } = result;

  Logger.log('🔍 Validating Twitch access token...\n');

  try {
    // Validate the token using shared validator
    const tokenData = await TokenValidator.validate(
      config.accessToken,
      config.broadcasterId
    );

    Logger.success('Token is valid!');
    Logger.log(`   User ID: ${tokenData.user_id}`);
    Logger.log(`   Login: ${tokenData.login}`);
    Logger.log(`   Client ID: ${tokenData.client_id}`);
    Logger.log(`   Scopes: ${tokenData.scopes.join(', ')}`);
    Logger.log(`   Expires in: ${tokenData.expires_in} seconds\n`);

    Logger.success('Token has required scope!');
    Logger.success('Token belongs to the broadcaster account!');
    Logger.log('\n✨ All validations passed! You can now run "npm start"\n');

    return true;

  } catch (error) {
    if (error instanceof TokenValidationError) {
      Logger.error('ERROR: Token validation failed\n');

      // Format and display the error with solutions
      const formatted = TokenValidator.formatError(error);

      Logger.log(formatted.message);
      Logger.log('\n💡 Solution:');
      formatted.solution.forEach(line => {
        Logger.log(`   ${line}`);
      });
      Logger.log('');

      return false;
    }

    // Handle unexpected errors
    Logger.error('Error validating token:', error.message);
    if (error.response) {
      Logger.log('   Status: ' + error.response.status);
      Logger.log('   Data: ' + JSON.stringify(error.response.data, null, 2));
    }
    return false;
  }
}

// Run validation
validateToken().then(success => {
  process.exit(success ? 0 : 1);
});
