import { defineConfig } from '@playwright/test'

// Runs against the LIVE site and API with a throwaway account (see tests-prod/).
// Started from the "Production end-to-end" GitHub workflow; needs E2E_EMAIL / E2E_PASSWORD.
export default defineConfig({
  testDir: 'tests-prod',
  timeout: 300_000,
  expect: { timeout: 120_000 },
  use: {
    baseURL: process.env.PROD_APP_URL || 'https://shopright-jet.vercel.app',
    viewport: { width: 390, height: 844 },
    timezoneId: 'America/Los_Angeles',
    serviceWorkers: 'block',
    screenshot: 'on',
  },
})
