import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: '.',
  timeout: 120_000,
  use: { baseURL: 'http://localhost:5199', viewport: { width: 1600, height: 1000 } },
  // The test server runs without model keys: browser tests never call the models (pills, turns) or spend on them.
  webServer: { command: 'npx vite --port 5199 --strictPort', cwd: '../..', url: 'http://localhost:5199', reuseExistingServer: false, timeout: 60_000,
    env: { GLM_API_KEY: '', OPENROUTER_API_KEY: '' } },
})
