import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildRepeatMap, getRepeatDate, isHeldBack, splitHeldBack, formatRepeatDate } from './repeatRule.js'

const repeats = [
  { retailer_name: 'Kroger - Fred Meyer', store_number: '242', program: 'RTL-ATT-EDM', visit_date: '2026-09-23' },
]
const map = buildRepeatMap(repeats)
const entry = (program, store_number = '242', extra = {}) =>
  ({ retailer_name: 'Kroger - Fred Meyer', store_number, program, ...extra })

test('same store + same vendor as last week is held back', () => {
  assert.equal(isHeldBack(entry('RTL-ATT-EDM'), map), true)
})

test('same store, different vendor is not held back', () => {
  assert.equal(isHeldBack(entry('RTL-GDI-LeafGuard'), map), false)
})

test('same vendor, different store is not held back', () => {
  assert.equal(isHeldBack(entry('RTL-ATT-EDM', '999'), map), false)
})

test('a confirmed override is no longer held back', () => {
  assert.equal(isHeldBack(entry('RTL-ATT-EDM', '242', { repeat_override: true }), map), false)
})

test('nothing is held back when last week had no repeats', () => {
  assert.equal(isHeldBack(entry('RTL-ATT-EDM'), buildRepeatMap([])), false)
  assert.equal(isHeldBack(entry('RTL-ATT-EDM'), undefined), false)
})

test('splitHeldBack holds back only the repeat vendor, keeping the store', () => {
  const { eligible, heldBack } = splitHeldBack([entry('RTL-ATT-EDM'), entry('RTL-GDI-LeafGuard')], map)
  assert.deepEqual(heldBack.map(e => e.program), ['RTL-ATT-EDM'])
  assert.deepEqual(eligible.map(e => e.program), ['RTL-GDI-LeafGuard'])
  assert.equal(eligible[0].store_number, '242')
})

test('getRepeatDate returns last week\'s date', () => {
  assert.equal(getRepeatDate(map, 'Kroger - Fred Meyer', '242', 'RTL-ATT-EDM'), '2026-09-23')
  assert.equal(getRepeatDate(map, 'Kroger - Fred Meyer', '242', 'RS-CKE'), null)
})

test('dates display as weekday + MM/DD/YY', () => {
  assert.equal(formatRepeatDate('2026-09-23'), 'Wed 09/23/26')
  assert.equal(formatRepeatDate(''), '')
})
