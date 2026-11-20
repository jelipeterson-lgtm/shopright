from pricing import stop_earnings, vendor_price


def test_first_vendor_is_65_from_the_change_date():
    assert vendor_price("2026-11-01", 0) == 65
    assert vendor_price("2026-11-20", 0) == 65


def test_additional_vendors_are_15():
    assert vendor_price("2026-11-20", 1) == 15
    assert vendor_price("2026-11-20", 4) == 15
    assert vendor_price("2026-10-15", 1) == 15


def test_shops_before_the_change_keep_50():
    assert vendor_price("2026-10-31", 0) == 50


def test_route_stop_earnings():
    assert stop_earnings(1) == 65
    assert stop_earnings(3) == 95
    assert stop_earnings(0) == 0
