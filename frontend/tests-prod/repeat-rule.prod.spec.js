// LIVE production check of the repeat-vendor rule: real site, real API, real database.
// Uses a throwaway account (E2E_EMAIL / E2E_PASSWORD) that the workflow creates per run.
// It seeds last-week assessments only for that account and deletes its assessments at the end.
import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'

const API = process.env.PROD_API_URL || 'https://shopright-api.onrender.com'
const EMAIL = process.env.E2E_EMAIL
const PASSWORD = process.env.E2E_PASSWORD

const env = Object.fromEntries(
  readFileSync(new URL('../.env.production', import.meta.url), 'utf8')
    .split('\n').filter(l => l.includes('=')).map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
)

const FM = { retailer_name: 'Kroger - Fred Meyer', store_number: '242', city: 'Oregon City', state: 'OR' }
const COSTCO = { retailer_name: 'Costco', store_number: '2', city: 'Portland', state: 'OR' }
const ATT = 'RTL-ATT-EDM'
const LEAFGUARD = 'RTL-GDI-LeafGuard'
const CKE = 'RS-CKE'

const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const today = new Date()
const thisMonday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - ((today.getDay() + 6) % 7))
const lastTuesday = ymd(new Date(thisMonday.getFullYear(), thisMonday.getMonth(), thisMonday.getDate() - 6))

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

async function seedSubmitted(store, program, repsPresent) {
  const { data } = await api('POST', '/visits', {
    ...store, program, address: '', visit_date: lastTuesday, visit_time: '10:00', session_date: lastTuesday,
  })
  await api('PUT', `/visits/${data.id}`, { reps_present: repsPresent })
  await api('POST', `/visits/${data.id}/complete`)
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

  // A brand-new account has no address, and the Route Planner won't optimize without a start.
  await api('PUT', '/auth/profile', { home_address: '1120 SW 5th Ave, Portland, OR 97204' })
  await deleteAllMyVisits()
  await seedSubmitted(FM, ATT, 'Pass')   // last week, reps present → must be held back
  await seedSubmitted(FM, CKE, 'Fail')   // last week, reps NOT present → may return
})

test.afterAll(async () => {
  if (token) await deleteAllMyVisits()
})

test('live: repeat is held back, others route normally, "Add anyway" and manual entry confirm', async ({ page }) => {
  await page.goto('/login')
  await page.locator('input[type="email"]').fill(EMAIL)
  await page.locator('input[type="password"]').fill(PASSWORD)
  await page.getByRole('button', { name: 'Sign In' }).click()
  await page.waitForURL(url => !url.pathname.startsWith('/login'))

  await page.goto('/route')
  await page.getByRole('button', { name: 'Paste SMS Check-in' }).click()
  const checkin = [
    [FM.retailer_name, FM.store_number, ATT, FM.city, FM.state],
    [FM.retailer_name, FM.store_number, LEAFGUARD, FM.city, FM.state],
    [FM.retailer_name, FM.store_number, CKE, FM.city, FM.state],
    [COSTCO.retailer_name, COSTCO.store_number, ATT, COSTCO.city, COSTCO.state],
  ].map(cols => cols.join('\t')).join('\n')
  await page.getByPlaceholder('Paste check-in text here...').fill(checkin)
  await page.getByRole('button', { name: 'Add Check-ins & Re-optimize' }).click()

  // Exactly one held back: AT&T at Fred Meyer. CKE there had reps absent, so it is NOT held back.
  await expect(page.getByText('Found 4 check-ins')).toBeVisible()
  await expect(page.getByTestId('held-back-count')).toHaveText('1 held back — shopped last week')

  await page.getByRole('button', { name: 'Continue to Filters' }).click()
  await page.getByRole('button', { name: 'Optimize Route' }).click()

  const fmCard = page.locator('[data-upcoming-index]').filter({ hasText: 'Kroger - Fred Meyer #242' })
  const costcoCard = page.locator('[data-upcoming-index]').filter({ hasText: 'Costco #2' })
  // Fail fast with the app's own message if it shows an error instead of a route.
  const appError = page.locator('p.text-red-500').first()
  const outcome = await Promise.race([
    fmCard.waitFor({ timeout: 120_000 }).then(() => 'route').catch(() => 'timeout'),
    appError.waitFor({ timeout: 120_000 }).then(() => 'error').catch(() => 'timeout'),
  ])
  if (outcome === 'error') throw new Error(`Route Planner showed an error: ${await appError.innerText()}`)
  await expect(fmCard).toBeVisible()
  await expect(fmCard).toContainText(LEAFGUARD)
  await expect(fmCard).toContainText(CKE)
  await expect(fmCard).not.toContainText(ATT)
  await expect(costcoCard).toContainText(ATT)      // same vendor, different store → fine

  const held = page.getByTestId('held-back-section')
  await expect(held).toContainText('Held back — shopped last week (1)')
  await held.locator('summary').click()
  await expect(held).toContainText(ATT)
  await page.screenshot({ path: test.info().outputPath('1-held-back.png'), fullPage: true })

  await held.getByRole('button', { name: 'Add anyway' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toContainText(`${ATT} at Kroger - Fred Meyer #242 last week`)
  await page.screenshot({ path: test.info().outputPath('2-confirm.png') })
  await dialog.getByRole('button', { name: 'Add anyway' }).click()

  // Re-optimizes on its own and now includes AT&T at Fred Meyer, marked with the icon.
  await expect(fmCard).toContainText(ATT)
  await expect(fmCard.getByTestId('repeat-icon')).toBeVisible()
  await expect(page.getByTestId('held-back-section')).toBeHidden()
  await page.screenshot({ path: test.info().outputPath('3-added-anyway.png'), fullPage: true })

  // Manual entry asks too; cancel creates nothing.
  await page.goto('/manual-visit')
  await page.getByPlaceholder('Store number or retailer name').fill('242')
  await page.getByRole('button', { name: 'Search' }).click()
  await page.locator('button', { hasText: 'Kroger - Fred Meyer #242' }).click()
  await page.locator('select').selectOption(ATT)
  await page.getByRole('button', { name: 'Create Visit' }).click()
  await expect(page.getByRole('dialog')).toContainText(`${ATT} at Kroger - Fred Meyer #242`)
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click()

  const { data } = await api('GET', '/visits')
  expect(data.filter(v => v.visit_date !== lastTuesday)).toHaveLength(0)
})
