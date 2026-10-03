import { defineConfig, devices } from '@playwright/test'

// Browser tests run the real app against a mocked API and a fake signed-in session,
// so they never touch the real database or any real account.
// Shoppers use phones, so every test runs as Android Chrome and as iPhone Safari (WebKit),
// including the smallest common iPhone screen.
const PORT = 5199

const shared = {
  timezoneId: 'America/Los_Angeles',
  // The PWA service worker would fetch around the test's mocked API.
  serviceWorkers: 'block',
}

export default defineConfig({
  testDir: 'tests',
  timeout: 30_000,
  use: { baseURL: `http://localhost:${PORT}` },
  projects: [
    { name: 'android-chrome', use: { ...devices['Pixel 7'], ...shared } },
    { name: 'iphone-safari', use: { ...devices['iPhone 15'], ...shared } },
    { name: 'small-iphone-safari', use: { ...devices['iPhone SE'], ...shared } },
  ],
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
