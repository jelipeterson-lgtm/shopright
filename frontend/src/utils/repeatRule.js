// Same vendor at the same store two weeks in a row is not allowed (Smart Circle rule).
// The backend decides which last-week visits count; this module only matches against them.

export const repeatKey = (retailerName, storeNumber, program) =>
  `${retailerName}|${storeNumber}|${program}`

export function buildRepeatMap(repeats = []) {
  const map = {}
  for (const r of repeats) map[repeatKey(r.retailer_name, r.store_number, r.program)] = r.visit_date
  return map
}

export function getRepeatDate(repeatMap, retailerName, storeNumber, program) {
  return repeatMap?.[repeatKey(retailerName, storeNumber, program)] || null
}

export function isHeldBack(entry, repeatMap) {
  return !entry.repeat_override &&
    !!getRepeatDate(repeatMap, entry.retailer_name, entry.store_number, entry.program)
}

export function splitHeldBack(entries, repeatMap) {
  const eligible = []
  const heldBack = []
  for (const e of entries) (isHeldBack(e, repeatMap) ? heldBack : eligible).push(e)
  return { eligible, heldBack }
}

// "2026-09-23" -> "Tue 09/23/26"
export function formatRepeatDate(isoDate) {
  if (!isoDate) return ''
  const [y, m, d] = isoDate.split('-')
  const weekday = new Date(Number(y), Number(m) - 1, Number(d))
    .toLocaleDateString('en-US', { weekday: 'short' })
  return `${weekday} ${m}/${d}/${y.slice(2)}`
}
