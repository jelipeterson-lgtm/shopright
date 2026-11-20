// Mirrors backend/pricing.py: pay per vendor, per store, per day. Mileage is no longer paid.
export const PRICE_CHANGE_DATE = '2026-11-01'
export const FIRST_VENDOR = 65
export const FIRST_VENDOR_BEFORE_CHANGE = 50
export const ADDITIONAL_VENDOR = 15

export function vendorPrice(visitDate, indexAtStop) {
  if (indexAtStop > 0) return ADDITIONAL_VENDOR
  if (visitDate && visitDate < PRICE_CHANGE_DATE) return FIRST_VENDOR_BEFORE_CHANGE
  return FIRST_VENDOR
}

// Visits are priced in the order given; the first at each store on each date is the first vendor.
export function invoiceTotal(visits) {
  const seen = {}
  let total = 0
  for (const v of visits) {
    const key = `${v.visit_date}|${v.store_number}|${v.retailer_name}`
    const index = seen[key] || 0
    seen[key] = index + 1
    total += vendorPrice(v.visit_date, index)
  }
  return total
}

// Pay for one stop planned today (Route Planner).
export function stopEarnings(vendorCount) {
  return vendorCount > 0 ? FIRST_VENDOR + ADDITIONAL_VENDOR * (vendorCount - 1) : 0
}
