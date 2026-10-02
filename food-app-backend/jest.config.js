// Native ES Modules: run via `node --experimental-vm-modules` (see npm test), no transform.
export default {
  testEnvironment: 'node',
  transform: {},
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.js'],
  // Rebuild food_app_test from migrations + empty test Redis before every run
  globalSetup: '<rootDir>/tests/setup/globalSetup.js',
  testTimeout: 15000,
};
