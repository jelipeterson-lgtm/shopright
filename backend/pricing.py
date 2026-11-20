"""What Smart Circle pays per assessed vendor.

Per store per day: the first vendor pays FIRST_VENDOR, each additional vendor at the
same store that day pays ADDITIONAL_VENDOR. From PRICE_CHANGE_DATE the first vendor
pays $65 and mileage is no longer reimbursed; shops before it keep the old $50.
"""

PRICE_CHANGE_DATE = "2026-11-01"
FIRST_VENDOR = 65
FIRST_VENDOR_BEFORE_CHANGE = 50
ADDITIONAL_VENDOR = 15


def vendor_price(visit_date, index_at_stop):
    """visit_date: YYYY-MM-DD; index_at_stop: 0 for the first vendor at that store that day."""
    if index_at_stop > 0:
        return ADDITIONAL_VENDOR
    if visit_date and str(visit_date) < PRICE_CHANGE_DATE:
        return FIRST_VENDOR_BEFORE_CHANGE
    return FIRST_VENDOR


def stop_earnings(vendor_count):
    """Pay for one stop planned today (Route Planner)."""
    if vendor_count <= 0:
        return 0
    return FIRST_VENDOR + ADDITIONAL_VENDOR * (vendor_count - 1)
