import { test } from 'node:test'
import assert from 'node:assert/strict'
import { vendorPrice, invoiceTotal } from './pricing.js'

test('$65 first vendor, $15 each additional, from the change date', () => {
  assert.equal(vendorPrice('2026-11-20', 0), 65)
  assert.equal(vendorPrice('2026-11-20', 1), 15)
  assert.equal(vendorPrice('2026-11-01', 0), 65)
})

test('shops before the change keep $50 for the first vendor', () => {
  assert.equal(vendorPrice('2026-10-31', 0), 50)
  assert.equal(vendorPrice('2026-10-31', 2), 15)
})

test('invoice total groups by store and day', () => {
  const v = (date, store, retailer = 'Costco') => ({ visit_date: date, store_number: store, retailer_name: retailer })
  const visits = [
    v('2026-11-19', '9'), v('2026-11-19', '9'), v('2026-11-19', '9'),
    v('2026-11-19', '111'),
    v('2026-11-20', '9'),
    v('2026-11-19', '9', 'Kroger - Fred Meyer'),
  ]
  assert.equal(invoiceTotal(visits), 65 + 15 + 15 + 65 + 65 + 65)
})

test('route stop earnings use current pricing', async () => {
  const { stopEarnings } = await import('./pricing.js')
  assert.equal(stopEarnings(1), 65)
  assert.equal(stopEarnings(3), 95)
  assert.equal(stopEarnings(0), 0)
})
