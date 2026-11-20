import io

from openpyxl import Workbook, load_workbook

import excel


def blank_template(*_args, **_kwargs):
    buf = io.BytesIO()
    Workbook().save(buf)
    buf.seek(0)
    return buf


def visit(date, store, program, retailer="Costco", city="Aloha"):
    return {"visit_date": date, "store_number": store, "program": program,
            "retailer_name": retailer, "city": city}


def test_invoice_lines_use_65_and_15_and_no_mileage(monkeypatch):
    monkeypatch.setattr(excel, "_download_template", blank_template)
    visits = [
        visit("2026-11-19", "9", "RTL-ATT-EDM"),
        visit("2026-11-19", "9", "RS-CKE"),
        visit("2026-11-19", "111", "RS-CKE", city="Tigard"),
        visit("2026-10-30", "2", "RTL-ATT-EDM", city="Portland"),
    ]
    out, invoice_id = excel.generate_invoice(visits, {"full_name": "Test Shopper", "mileage_rate": 0.725}, 2026, 11)
    ws = load_workbook(out).active
    rows = [(ws.cell(r, 2).value, ws.cell(r, 5).value, ws.cell(r, 10).value) for r in range(14, 20) if ws.cell(r, 10).value is not None]
    assert invoice_id == "2611"
    assert rows == [
        ("2", "RTL-ATT-EDM", 50),
        ("111", "RS-CKE", 65),
        ("9", "RTL-ATT-EDM", 65),
        ("9", "RS-CKE", 15),
    ]
    assert all(ws.cell(r, 5).value != "Mileage" for r in range(14, 77))
