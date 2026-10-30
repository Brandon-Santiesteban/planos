import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  workers: 1, // the tests share the server's projects folder
  // Its own server (port 5175, mode e2e): projects saved during the tests go to test-results/, not to biblioteca/.
  use: { baseURL: 'http://localhost:5175', viewport: { width: 1400, height: 800 } },
  webServer: { command: 'npm run dev -- --port 5175 --strictPort --host --mode e2e', url: 'http://localhost:5175', reuseExistingServer: false },
});
