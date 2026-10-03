import { test, expect } from '@playwright/test'
import { formatRepeatDate } from '../src/utils/repeatRule.js'

const FM = { retailer_name: 'Kroger - Fred Meyer', store_number: '242', city: 'Oregon City', state: 'OR', address: '1839 Molalla Ave' }
const COSTCO = { retailer_name: 'Costco', store_number: '1287', city: 'Portland', state: 'OR', address: '4849 NE 138th Ave' }
const ATT = 'RTL-ATT-EDM'
const LEAFGUARD = 'RTL-GDI-LeafGuard'
const PROGRAMS = [ATT, LEAFGUARD, 'RS-CKE']
const LAST_WEEK = '2026-09-23'

const checkinEntries = [
  { ...FM, program: ATT, store_id: 5, latitude: 45.33, longitude: -122.6 },
  { ...FM, program: LEAFGUARD, store_id: 5, latitude: 45.33, longitude: -122.6 },
  { ...COSTCO, program: ATT, store_id: 9, latitude: 45.55, longitude: -122.52 },
]

const json = (data, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(data) })
const ok = (data) => json({ success: true, data, error: null })

// Fake API. Records every call so tests can assert what was (and wasn't) sent.
async function mockApp(page, { repeatCheckFails = false, repeatDelayMs = 0 } = {}) {
  const calls = []
  await page.addInitScript(() => {
    const session = {
      access_token: 'test-token', token_type: 'bearer', expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 86400, refresh_token: 'test-refresh',
      user: { id: 'user-1', aud: 'authenticated', role: 'authenticated', email: 'e2e@example.com' },
    }
    localStorage.setItem('sb-supabase-auth-token', JSON.stringify(session))
  })

  await page.route('**/*', async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    if (url.hostname !== 'localhost') return route.abort()
    if (!url.pathname.startsWith('/__api/')) return route.continue()

    const path = url.pathname.slice('/__api'.length)
    const method = req.method()
    let body = null
    try { body = req.postDataJSON() } catch { body = null }
    calls.push({ method, path, query: Object.fromEntries(url.searchParams), body })

    if (path === '/visits/repeat-check') {
      if (repeatDelayMs) await new Promise(r => setTimeout(r, repeatDelayMs))
      if (repeatCheckFails) return route.fulfill(json({ detail: 'boom' }, 500))
      return route.fulfill(ok({ repeats: [{ ...FM, program: ATT, visit_date: LAST_WEEK }] }))
    }
    if (path === '/auth/profile') return route.fulfill(ok({ full_name: 'E2E Test', home_address: '1 Test St, Portland, OR 97201', is_free_account: true }))
    if (path.startsWith('/route/plan') && method === 'GET') return route.fulfill(ok(null))
    if (path === '/route/geocode') return route.fulfill(ok({ latitude: 45.52, longitude: -122.68 }))
    if (path === '/route/parse-checkin') return route.fulfill(ok(checkinEntries.map(e => ({ ...e }))))
    if (path === '/route/optimize') {
      const stops = {}
      for (const s of body.stores) {
        const key = `${s.retailer_name}|${s.store_number}`
        stops[key] ??= { ...s, vendors: [], vendor_flags: {}, status: 'upcoming', earnings: 0, est_minutes: 20, drive_time_min: 12, drive_distance_mi: 5 }
        stops[key].vendors.push(s.program)
        stops[key].earnings = 50 + 15 * (stops[key].vendors.length - 1)
      }
      const route_ = Object.values(stops)
      return route.fulfill(ok({ route: route_, overflow: [], summary: { total_stops: route_.length, total_vendors: body.stores.length, total_earnings: 100, total_time_min: 90 } }))
    }
    if (path === '/stores/search') return route.fulfill(ok([{ id: 5, ...FM }, { id: 9, ...COSTCO }]))
    if (path === '/stores/programs') return route.fulfill(ok(PROGRAMS))
    if (path === '/visits' && method === 'POST') return route.fulfill(ok({ id: 'new-visit-1', ...body, status: 'Draft' }))
    if (path === '/visits' && method === 'GET') return route.fulfill(ok([]))
    return route.fulfill(ok(null))
  })

  const optimizeBodies = () => calls.filter(c => c.path === '/route/optimize').map(c => c.body.stores.map(s => `${s.store_number}:${s.program}`).sort())
  const visitPosts = () => calls.filter(c => c.path === '/visits' && c.method === 'POST')
  return { calls, optimizeBodies, visitPosts }
}

async function planRouteFromCheckin(page) {
  await page.goto('/route')
  await page.getByRole('button', { name: 'Paste SMS Check-in' }).click()
  await page.getByPlaceholder('Paste check-in text here...').fill('check-in text')
  await page.getByRole('button', { name: 'Add Check-ins & Re-optimize' }).click()
}

test('a repeat vendor is held back from the route, but the store and its other vendors stay', async ({ page }) => {
  const api = await mockApp(page)
  await planRouteFromCheckin(page)

  await expect(page.getByTestId('held-back-count')).toHaveText('1 held back — shopped last week')
  await expect(page.getByText(`Held back — shopped last week (${formatRepeatDate(LAST_WEEK)})`)).toBeVisible()

  await page.getByRole('button', { name: 'Continue to Filters' }).click()
  await expect(page.getByText('1 held back — shopped last week', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Optimize Route' }).click()

  await expect.poll(() => api.optimizeBodies().length).toBe(1)
  expect(api.optimizeBodies()[0]).toEqual([`1287:${ATT}`, `242:${LEAFGUARD}`])

  // Fred Meyer stays in the route with LeafGuard; AT&T is listed below as held back.
  await expect(page.getByText('Kroger - Fred Meyer #242').first()).toBeVisible()
  const held = page.getByTestId('held-back-section')
  await expect(held).toContainText('Held back — shopped last week (1)')
  await held.locator('summary').click()
  await expect(held).toContainText(ATT)
  await page.screenshot({ path: test.info().outputPath('held-back.png'), fullPage: true })

  // Check the week sent to the server is the browser's local today.
  const today = await page.evaluate(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` })
  expect(api.calls.find(c => c.path === '/visits/repeat-check').query.week_of).toBe(today)
})

test('"Add anyway" asks once with specifics, cancel changes nothing, confirm re-optimizes with the vendor', async ({ page }) => {
  const api = await mockApp(page)
  await planRouteFromCheckin(page)
  await page.getByRole('button', { name: 'Continue to Filters' }).click()
  await page.getByRole('button', { name: 'Optimize Route' }).click()
  await expect.poll(() => api.optimizeBodies().length).toBe(1)

  const held = page.getByTestId('held-back-section')
  await held.locator('summary').click()

  // Cancel: nothing changes.
  await held.getByRole('button', { name: 'Add anyway' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toContainText(`You completed an assessment for ${ATT} at Kroger - Fred Meyer #242 last week (${formatRepeatDate(LAST_WEEK)})`)
  await expect(dialog).toContainText("doesn't allow the same vendor at the same store two weeks in a row")
  await page.screenshot({ path: test.info().outputPath('confirm-dialog.png') })
  await dialog.getByRole('button', { name: 'Cancel' }).click()
  await expect(dialog).toBeHidden()
  await expect(held).toBeVisible()
  expect(api.optimizeBodies().length).toBe(1)

  // Confirm: re-optimizes automatically and includes AT&T at Fred Meyer.
  await held.getByRole('button', { name: 'Add anyway' }).click()
  await dialog.getByRole('button', { name: 'Add anyway' }).click()
  await expect.poll(() => api.optimizeBodies().length).toBe(2)
  expect(api.optimizeBodies()[1]).toContain(`242:${ATT}`)
  await expect(page.getByTestId('held-back-section')).toBeHidden()

  // The overridden vendor carries the small icon; tapping it explains why.
  const icon = page.getByTestId('repeat-icon').first()
  await expect(icon).toBeVisible()
  await icon.click()
  await expect(page.getByText(`Also shopped last week (${formatRepeatDate(LAST_WEEK)})`)).toBeVisible()
  await page.screenshot({ path: test.info().outputPath('route-with-icon.png'), fullPage: true })

  // Re-optimizing again never asks a second time and keeps the vendor.
  await page.getByRole('button', { name: 'Re-optimize Route' }).click()
  await expect.poll(() => api.optimizeBodies().length).toBe(3)
  expect(api.optimizeBodies()[2]).toContain(`242:${ATT}`)
  await expect(page.getByRole('dialog')).toBeHidden()
})

test('adding a repeat vendor by hand on the route asks first; cancel creates nothing', async ({ page }) => {
  const api = await mockApp(page)
  await planRouteFromCheckin(page)
  await page.getByRole('button', { name: 'Continue to Filters' }).click()
  await page.getByRole('button', { name: 'Optimize Route' }).click()
  await expect.poll(() => api.optimizeBodies().length).toBe(1)

  const fmCard = page.locator('[data-upcoming-index]').filter({ hasText: 'Kroger - Fred Meyer #242' })
  await fmCard.getByRole('button', { name: '+ Vendor' }).click()
  await fmCard.locator('select').selectOption(ATT)
  await fmCard.getByRole('button', { name: 'Add Vendor' }).click()

  const dialog = page.getByRole('dialog')
  await expect(dialog).toContainText(ATT)
  await dialog.getByRole('button', { name: 'Cancel' }).click()
  expect(api.visitPosts().length).toBe(0)

  await fmCard.getByRole('button', { name: 'Add Vendor' }).click()
  await dialog.getByRole('button', { name: 'Add anyway' }).click()
  await expect.poll(() => api.visitPosts().length).toBe(1)
  expect(api.visitPosts()[0].body.program).toBe(ATT)
})

test('a non-repeat vendor added by hand goes straight through with no question', async ({ page }) => {
  const api = await mockApp(page)
  await planRouteFromCheckin(page)
  await page.getByRole('button', { name: 'Continue to Filters' }).click()
  await page.getByRole('button', { name: 'Optimize Route' }).click()
  await expect.poll(() => api.optimizeBodies().length).toBe(1)

  const costcoCard = page.locator('[data-upcoming-index]').filter({ hasText: 'Costco #1287' })
  await costcoCard.getByRole('button', { name: '+ Vendor' }).click()
  await costcoCard.locator('select').selectOption('RS-CKE')
  await costcoCard.getByRole('button', { name: 'Add Vendor' }).click()
  await expect.poll(() => api.visitPosts().length).toBe(1)
  await expect(page.getByRole('dialog')).toBeHidden()
})

for (const { name, path, select, submit } of [
  { name: 'Manual entry page', path: '/manual-visit', select: (p) => p.locator('button', { hasText: 'Kroger - Fred Meyer #242' }), submit: 'Create Visit' },
  { name: 'Add Store page', path: '/new-store', select: (p) => p.locator('button', { hasText: 'Kroger - Fred Meyer #242' }), submit: 'Confirm Store & Add Vendor' },
]) {
  test(`${name}: a repeat asks first, a non-repeat does not`, async ({ page }) => {
    const api = await mockApp(page)
    await page.goto(path)
    await page.getByPlaceholder('Store number or retailer name').fill('242')
    await page.getByRole('button', { name: 'Search' }).click()
    await select(page).click()

    await page.locator('select').selectOption(ATT)
    await page.getByRole('button', { name: submit }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toContainText(`${ATT} at Kroger - Fred Meyer #242`)
    await dialog.getByRole('button', { name: 'Cancel' }).click()
    expect(api.visitPosts().length).toBe(0)

    await page.locator('select').selectOption(LEAFGUARD)
    await page.getByRole('button', { name: submit }).click()
    await expect.poll(() => api.visitPosts().length).toBe(1)
    expect(api.visitPosts()[0].body.program).toBe(LEAFGUARD)
  })
}

test('if the repeat check fails, planning still works with nothing held back', async ({ page }) => {
  const api = await mockApp(page, { repeatCheckFails: true })
  await planRouteFromCheckin(page)
  await expect(page.getByText(/held back/)).toHaveCount(0)
  await page.getByRole('button', { name: 'Continue to Filters' }).click()
  await page.getByRole('button', { name: 'Optimize Route' }).click()
  await expect.poll(() => api.optimizeBodies().length).toBe(1)
  expect(api.optimizeBodies()[0]).toEqual([`1287:${ATT}`, `242:${ATT}`, `242:${LEAFGUARD}`])
})

test('a check-in pasted before last week\'s data arrives still holds the repeat back', async ({ page }) => {
  // Real phones and a sleeping server can take seconds; the live run caught this race.
  const api = await mockApp(page, { repeatDelayMs: 3000 })
  await planRouteFromCheckin(page)
  await page.getByRole('button', { name: 'Continue to Filters' }).click()
  await expect(page.getByRole('button', { name: 'Checking last week…' })).toBeDisabled()
  await expect(page.getByTestId('held-back-count')).toBeHidden()

  await page.getByRole('button', { name: 'Optimize Route' }).click()
  await expect.poll(() => api.optimizeBodies().length).toBe(1)
  expect(api.optimizeBodies()[0]).toEqual([`1287:${ATT}`, `242:${LEAFGUARD}`])
  await expect(page.getByTestId('held-back-section')).toContainText('Held back — shopped last week (1)')
})
