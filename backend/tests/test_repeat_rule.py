from datetime import date

from repeat_rule import last_week_repeats, previous_week_range

KEY = ("Kroger - Fred Meyer", "242", "RTL-ATT-EDM")


def visit(visit_date, status="Complete", reps_present="Pass", program="RTL-ATT-EDM",
          store_number="242", retailer_name="Kroger - Fred Meyer", **extra):
    return {"retailer_name": retailer_name, "store_number": store_number, "program": program,
            "visit_date": visit_date, "status": status, "reps_present": reps_present, **extra}


# --- week boundaries (Monday–Sunday) ---

def test_previous_week_from_a_monday():
    assert previous_week_range(date(2026, 10, 5)) == (date(2026, 9, 28), date(2026, 10, 4))


def test_previous_week_from_a_sunday_is_the_week_before_its_own_week():
    assert previous_week_range(date(2026, 10, 4)) == (date(2026, 9, 21), date(2026, 9, 27))


def test_previous_week_across_year_boundary():
    assert previous_week_range(date(2027, 1, 1)) == (date(2026, 12, 21), date(2026, 12, 27))


def test_last_monday_and_last_sunday_both_count():
    week_of = date(2026, 10, 7)  # Wednesday
    assert last_week_repeats([visit("2026-09-28")], week_of) == {KEY: "2026-09-28"}
    assert last_week_repeats([visit("2026-10-04")], week_of) == {KEY: "2026-10-04"}


def test_two_weeks_ago_does_not_count():
    assert last_week_repeats([visit("2026-09-27")], date(2026, 10, 7)) == {}


def test_earlier_this_week_does_not_count():
    assert last_week_repeats([visit("2026-10-05")], date(2026, 10, 7)) == {}


# --- what counts as a last-week visit ---

def test_unsubmitted_visit_does_not_count():
    assert last_week_repeats([visit("2026-09-30", status="Draft")], date(2026, 10, 7)) == {}


def test_reps_present_fail_allows_return():
    assert last_week_repeats([visit("2026-09-30", reps_present="Fail")], date(2026, 10, 7)) == {}


def test_other_fails_still_count_as_a_repeat():
    v = visit("2026-09-30", reps_present="Pass", eval_pushy="Fail", eval_dress_code="Fail")
    assert last_week_repeats([v], date(2026, 10, 7)) == {KEY: "2026-09-30"}


def test_submitted_with_blank_reps_present_counts():
    assert last_week_repeats([visit("2026-09-30", reps_present=None)], date(2026, 10, 7)) == {KEY: "2026-09-30"}


# --- what counts as "the same" ---

def test_different_program_at_same_store_is_separate():
    result = last_week_repeats([visit("2026-09-30", program="RTL-GDI-LeafGuard")], date(2026, 10, 7))
    assert KEY not in result
    assert ("Kroger - Fred Meyer", "242", "RTL-GDI-LeafGuard") in result


def test_leafguard_location_codes_are_separate_vendors():
    result = last_week_repeats([visit("2026-09-30", program="RTL-GDI-LG Exit Fence")], date(2026, 10, 7))
    assert ("Kroger - Fred Meyer", "242", "RTL-GDI-LeafGuard") not in result


def test_same_program_at_different_store_is_separate():
    result = last_week_repeats([visit("2026-09-30", store_number="999")], date(2026, 10, 7))
    assert KEY not in result


def test_keeps_latest_date_when_shopped_twice_last_week():
    visits = [visit("2026-09-29"), visit("2026-10-02"), visit("2026-09-30")]
    assert last_week_repeats(visits, date(2026, 10, 7)) == {KEY: "2026-10-02"}


def test_malformed_dates_are_ignored():
    assert last_week_repeats([visit(None), visit("not-a-date")], date(2026, 10, 7)) == {}
