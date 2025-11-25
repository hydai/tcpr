import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Test environment
    environment: 'node',

    // Include test files
    include: ['tests/**/*.test.js'],

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['lib/**/*.js', 'client/**/*.js', 'config/**/*.js'],
      exclude: ['**/node_modules/**', '**/dist/**', '**/gui/**', '**/electron/**']
    },

    // Timeouts - 5s is sufficient for unit tests; use per-test timeouts for longer tests
    testTimeout: 5000,

    // Global setup
    globals: true
  }
});
