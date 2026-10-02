// Native ES Modules: run via `node --experimental-vm-modules` (see npm test), no transform.
export default {
  testEnvironment: 'node',
  transform: {},
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.js'],
  testTimeout: 15000,
};
