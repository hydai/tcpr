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

    // Timeouts
    testTimeout: 10000,

    // Global setup
    globals: true
  }
});
