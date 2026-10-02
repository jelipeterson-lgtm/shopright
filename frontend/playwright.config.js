import { defineConfig } from '@playwright/test'

// Browser tests run the real app against a mocked API and a fake signed-in session,
// so they never touch the real database or any real account.
const PORT = 5199

export default defineConfig({
  testDir: 'tests',
  timeout: 30_000,
  use: {
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 390, height: 844 },
    timezoneId: 'America/Los_Angeles',
    // The PWA service worker would fetch around the test's mocked API.
    serviceWorkers: 'block',
  },
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    env: {
      // Same origin as the app so requests need no CORS preflight; the test intercepts /__api.
      VITE_API_URL: `http://localhost:${PORT}/__api`,
      VITE_SUPABASE_URL: 'http://supabase.test',
      VITE_SUPABASE_ANON_KEY: 'test-anon-key',
    },
  },
})
