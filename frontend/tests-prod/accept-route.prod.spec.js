// LIVE production check of Accept Route: real site, real API, real database, throwaway account.
import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'

const API = process.env.PROD_API_URL || 'https://shopright-api.onrender.com'
const EMAIL = process.env.E2E_EMAIL
const PASSWORD = process.env.E2E_PASSWORD

const env = Object.fromEntries(
  readFileSync(new URL('../.env.production', import.meta.url), 'utf8')
    .split('\n').filter(l => l.includes('=')).map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
)

let token

async function api(method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(120_000),
  })
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${await res.text()}`)
  return res.json()
}

async function deleteAllMyVisits() {
  const { data } = await api('GET', '/visits')
  for (const v of data) await api('DELETE', `/visits/${v.id}`)
}

test.beforeAll(async () => {
  expect(EMAIL && PASSWORD, 'E2E_EMAIL and E2E_PASSWORD must be set').toBeTruthy()
  const r = await fetch(`${env.VITE_SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: env.VITE_SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  })
  expect(r.status, 'sign-in to Supabase').toBe(200)
  token = (await r.json()).access_token
  await api('PUT', '/auth/profile', { home_address: '1120 SW 5th Ave, Portland, OR 97204' })
  await deleteAllMyVisits()
})

test.afterAll(async () => {
  if (token) await deleteAllMyVisits()
})

test('live: Accept Route creates the route\'s vendor assessments', async ({ page }) => {
  const failures = []
  page.on('response', r => { if (r.url().includes('/visits/batch')) failures.push(`${r.status()} ${r.url()}`) })
  page.on('requestfailed', r => failures.push(`FAILED ${r.url()} ${r.failure()?.errorText}`))
  page.on('console', m => { if (m.type() === 'error') failures.push(`console: ${m.text()}`) })

  await page.goto('/login')
  await page.locator('input[type="email"]').fill(EMAIL)
  await page.locator('input[type="password"]').fill(PASSWORD)
  await page.getByRole('button', { name: 'Sign In' }).click()
  await page.waitForURL(url => !url.pathname.startsWith('/login'))

  await page.goto('/route')
  await page.waitForLoadState('networkidle')
  const clear = page.getByRole('button', { name: 'Clear', exact: true })
  if (await clear.isVisible()) await clear.click()
  await page.getByRole('button', { name: 'Paste SMS Check-in' }).click()
  const checkin = [
    ['Costco', '9', 'RTL-GDI-LeafGuard', 'Aloha', 'OR'],
    ['Costco', '111', 'RS-CKE', 'Tigard', 'OR'],
    ['Costco', '111', 'RTL-SCI-Multi Srv-Exit Fence', 'Tigard', 'OR'],
  ].map(cols => cols.join('\t')).join('\n')
  await page.getByPlaceholder('Paste check-in text here...').fill(checkin)
  await page.getByRole('button', { name: 'Add Check-ins & Re-optimize' }).click()
  await page.getByRole('button', { name: 'Continue to Filters' }).click()
  await page.getByRole('button', { name: 'Optimize Route' }).click()

  const accept = page.getByRole('button', { name: /Accept Route — Create 3 Vendor Assessments/ })
  await expect(accept).toBeVisible({ timeout: 120_000 })
  await accept.click()

  const ok = page.getByText(/Route accepted!/)
  const appError = page.locator('p.text-red-500').first()
  const outcome = await Promise.race([
    ok.waitFor({ timeout: 60_000 }).then(() => 'ok').catch(() => 'timeout'),
    appError.waitFor({ timeout: 60_000 }).then(() => 'error').catch(() => 'timeout'),
  ])
  await page.screenshot({ path: test.info().outputPath('accept-route.png'), fullPage: true })
  if (outcome !== 'ok') {
    const shown = outcome === 'error' ? await appError.innerText() : 'no message'
    throw new Error(`Accept Route failed: ${shown}\n${failures.join('\n')}`)
  }

  const { data } = await api('GET', '/visits')
  expect(data.map(v => v.program).sort()).toEqual(['RS-CKE', 'RTL-GDI-LeafGuard', 'RTL-SCI-Multi Srv-Exit Fence'])
})
