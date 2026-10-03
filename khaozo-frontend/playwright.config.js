// Key flows against a running backend (API on :3000 with its database + Redis).
// The dev server is started here (or reused); see tests/e2e/README.md.
import { defineConfig, devices } from '@playwright/test';

const PORT = 5173;

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 45_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  globalSetup: './tests/e2e/global-setup.js',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    // Bhubaneswar (Patia) — the seeded places are around here
    geolocation: { latitude: 20.3589, longitude: 85.8231 },
    permissions: ['geolocation'],
    ignoreHTTPSErrors: true,
  },
  projects: [
    { name: 'phone', use: { ...devices['Pixel 7'] } },
    { name: 'laptop', use: { viewport: { width: 1280, height: 820 } }, testMatch: /discover|group/ },
  ],
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    port: PORT,
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
