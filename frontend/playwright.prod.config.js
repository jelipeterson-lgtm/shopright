import { defineConfig, devices } from '@playwright/test'

// Runs against the LIVE site and API with a throwaway account (see tests-prod/).
// Started from the "Production end-to-end" GitHub workflow; needs E2E_EMAIL / E2E_PASSWORD.
// One account is shared, so phones run one after another, never in parallel.
const shared = {
  baseURL: process.env.PROD_APP_URL || 'https://shopright-jet.vercel.app',
  timezoneId: 'America/Los_Angeles',
  serviceWorkers: 'block',
  screenshot: 'on',
}

export default defineConfig({
  testDir: 'tests-prod',
  timeout: 300_000,
  expect: { timeout: 120_000 },
  workers: 1,
  fullyParallel: false,
  projects: [
    { name: 'android-chrome', use: { ...devices['Pixel 7'], ...shared } },
    { name: 'iphone-safari', use: { ...devices['iPhone 15'], ...shared } },
  ],
})
