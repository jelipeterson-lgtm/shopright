import { test, expect } from '@playwright/test'

const VISIT = {
  id: 'visit-1', retailer_name: 'Costco', store_number: '9', program: 'RTL-GDI-LeafGuard',
  status: 'Draft', visit_date: '2026-10-15', visit_time: '10:00', reps_present: null, visit_recap: '',
}
const json = (data, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(data) })
const ok = (data) => json({ success: true, data, error: null })

// Fake API whose server can be "down" (every request gets a 503, like a Render restart).
async function mockApp(page) {
  const state = { down: false, saved: { ...VISIT }, puts: [], completed: false }
  await page.addInitScript(() => {
    localStorage.setItem('sb-supabase-auth-token', JSON.stringify({
      access_token: 'test-token', token_type: 'bearer', expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 86400, refresh_token: 'test-refresh',
      user: { id: 'user-1', aud: 'authenticated', role: 'authenticated', email: 'e2e@example.com' },
    }))
  })
  await page.route('**/*', async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    if (url.hostname !== 'localhost') return route.abort()
    if (!url.pathname.startsWith('/__api/')) return route.continue()
    const path = url.pathname.slice('/__api'.length)
    const method = req.method()
    if (path === '/auth/profile') return route.fulfill(ok({ full_name: 'E2E', is_free_account: true }))
    if (path === '/payments/status') return route.fulfill(ok({ active: true }))
    if (state.down) return route.fulfill(json({ detail: 'Service unavailable' }, 503))
    if (path === '/visits/visit-1' && method === 'GET') return route.fulfill(ok({ ...state.saved }))
    if (path === '/visits/visit-1' && method === 'PUT') {
      const body = req.postDataJSON()
      state.puts.push(body)
      Object.assign(state.saved, body)
      return route.fulfill(ok({ ...state.saved }))
    }
    if (path === '/review') return route.fulfill(ok({ skipped: true, reason: 'no_key' }))
    if (path === '/visits/visit-1/complete') { state.completed = true; return route.fulfill(ok({ ...state.saved, status: 'Complete' })) }
    return route.fulfill(ok(null))
  })
  return state
}

const recap = (page) => page.getByPlaceholder('Describe the overall visit...')

test('quick edits to two fields are both saved', async ({ page }) => {
  const api = await mockApp(page)
  await page.goto('/visit/visit-1')
  await page.getByRole('button', { name: 'Fail', exact: true }).first().click()
  await recap(page).fill('No reps at the kiosk')
  await expect.poll(() => [api.saved.reps_present, api.saved.visit_recap]).toEqual(['Fail', 'No reps at the kiosk'])
})

test('edits made while the server is down are kept and saved once it is back', async ({ page }) => {
  const api = await mockApp(page)
  await page.goto('/visit/visit-1')
  await expect(page.getByText('Reps Present?')).toBeVisible()
  api.down = true
  await page.getByRole('button', { name: 'Fail', exact: true }).first().click()
  await recap(page).fill('Typed during a restart')
  await expect(page.getByRole('status')).toContainText('Not saved yet')
  api.down = false
  await expect.poll(() => api.saved.visit_recap, { timeout: 15_000 }).toBe('Typed during a restart')
  expect(api.saved.reps_present).toBe('Fail')
  await expect(page.getByRole('status')).toBeHidden()
})

test('closing the app while offline keeps the edits on the phone', async ({ page }) => {
  const api = await mockApp(page)
  await page.goto('/visit/visit-1')
  await expect(page.getByText('Reps Present?')).toBeVisible()
  api.down = true
  await page.getByRole('button', { name: 'Fail', exact: true }).first().click()
  await recap(page).fill('Kept on the phone')
  await expect(page.getByRole('status')).toContainText('Not saved yet')
  api.down = false
  await page.reload()
  await expect(recap(page)).toHaveValue('Kept on the phone')
  await expect.poll(() => api.saved.visit_recap).toBe('Kept on the phone')
})

test('an assessment is never submitted while its answers could not be saved', async ({ page }) => {
  const api = await mockApp(page)
  await page.goto('/visit/visit-1')
  await page.getByRole('button', { name: 'Fail', exact: true }).first().click()
  await recap(page).fill('Ready to submit')
  await expect.poll(() => api.saved.visit_recap).toBe('Ready to submit')
  api.down = true
  await page.getByRole('button', { name: 'Review & Submit' }).click()
  await expect(page.getByText("Couldn't save your answers")).toBeVisible()
  expect(api.completed).toBe(false)
  api.down = false
  await page.getByRole('button', { name: 'Review & Submit' }).click()
  await expect.poll(() => api.completed).toBe(true)
})
