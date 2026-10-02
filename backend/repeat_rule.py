"""Smart Circle rule: a shopper may not assess the same vendor (exact program code)
at the same store in two consecutive Monday–Sunday weeks.

A last-week visit counts only if it was submitted (status Complete) and reps were
not marked absent (reps_present == "Fail" means the vendor wasn't there, so a
return the next week is allowed). Any other Fail on the assessment still counts.
"""
from datetime import date, timedelta


def previous_week_range(week_of: date) -> tuple[date, date]:
    this_monday = week_of - timedelta(days=week_of.weekday())
    return this_monday - timedelta(days=7), this_monday - timedelta(days=1)


def last_week_repeats(visits, week_of: date) -> dict:
    """Map (retailer_name, store_number, program) -> latest qualifying visit_date (YYYY-MM-DD)."""
    start, end = previous_week_range(week_of)
    repeats = {}
    for v in visits:
        if v.get("status") != "Complete" or v.get("reps_present") == "Fail":
            continue
        visit_date = v.get("visit_date")
        try:
            d = date.fromisoformat(visit_date)
        except (TypeError, ValueError):
            continue
        if not start <= d <= end:
            continue
        key = (v["retailer_name"], v["store_number"], v["program"])
        if visit_date > repeats.get(key, ""):
            repeats[key] = visit_date
    return repeats
