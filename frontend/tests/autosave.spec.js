import { test, expect } from '@playwright/test'

const visit = {
  id: 'v1',
  status: 'Draft',
  retailer_name: 'Costco',
  store_number: '1287',
  address: '4849 NE 138th Ave',
  city: 'Portland',
  state: 'OR',
  program: 'RTL-ATT-EDM',
  visit_date: '2026-10-15',
  visit_time: '13:05:00',
  reps_present: 'Pass',
  rep_count: 2,
  visit_recap: '',
}

const ok = (data) => ({
  status: 200,
  contentType: 'application/json',
  body: JSON.stringify({ success: true, data, error: null }),
})

async function mockVisit(page) {
  const puts = []
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
    if (path === '/visits/v1' && method === 'PUT') {
      puts.push(body)
      return route.fulfill(ok({ ...visit, ...body }))
    }
    if (path === '/visits/v1' && method === 'GET') return route.fulfill(ok(visit))
    if (path === '/auth/profile') return route.fulfill(ok({ full_name: 'E2E Test', is_free_account: true }))
    return route.fulfill(ok(null))
  })
  return puts
}

test('assessment autosave waits out a pause, then flushes on blur and when the page hides', async ({ page }) => {
  const puts = await mockVisit(page)
  await page.goto('/visit/v1')
  const recap = page.getByPlaceholder('Describe the overall visit...')
  await expect(recap).toBeVisible()

  const recapPuts = () => puts.filter((body) => body && Object.prototype.hasOwnProperty.call(body, 'visit_recap'))

  await recap.fill('Hello')
  await recap.fill('Hello there')
  await page.waitForTimeout(1000)
  expect(recapPuts()).toEqual([])

  await expect.poll(() => recapPuts().at(-1)?.visit_recap, { timeout: 4000 }).toBe('Hello there')
  const afterPause = recapPuts().length

  await recap.fill('Hello there friend')
  await recap.blur()
  await expect.poll(() => recapPuts().at(-1)?.visit_recap, { timeout: 2000 }).toBe('Hello there friend')
  expect(recapPuts().length).toBeGreaterThan(afterPause)

  await recap.fill('Saved on hide')
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await expect.poll(() => recapPuts().at(-1)?.visit_recap, { timeout: 2000 }).toBe('Saved on hide')
})
