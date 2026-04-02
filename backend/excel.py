"""
Excel generation — template-copy approach.
Downloads master templates from Dropbox, copies them, writes visit data.
"""
import os
import io
import httpx
from openpyxl import load_workbook
from datetime import datetime, date
from collections import defaultdict

DROPBOX_SHOPFILE_URL = os.getenv("DROPBOX_SHOPFILE_TEMPLATE_URL", "").replace("dl=0", "dl=1")
DROPBOX_INVOICE_URL = os.getenv("DROPBOX_INVOICE_TEMPLATE_URL", "").replace("dl=0", "dl=1")

# Cache templates in memory
_template_cache = {}


def _download_template(url, key):
    if key not in _template_cache:
        r = httpx.get(url, follow_redirects=True, timeout=30)
        r.raise_for_status()
        _template_cache[key] = r.content
    return io.BytesIO(_template_cache[key])


def generate_shop_file(visits, first_name):
    """Generate Shop File .xlsx from a list of Complete visits for one ISO week."""
    template = _download_template(DROPBOX_SHOPFILE_URL, "shopfile")
    wb = load_workbook(template)
    ws = wb.active

    # Clear existing sample data rows (keep row 1 headers)
    for row in range(2, ws.max_row + 1):
        for col in range(1, 41):
            ws.cell(row, col, None)

    # Write visit data starting at row 2
    for i, v in enumerate(visits):
        row = i + 2

        # Col 1: Fail Count — count of "Fail" across eval fields
        fail_count = 0
        eval_fields = [
            "eval_engaging", "eval_greeting", "eval_one_no", "eval_pushy",
            "eval_clogging", "eval_leaning", "eval_food_drink", "eval_dress_code",
            "eval_name_badge", "eval_badge_location_pass", "eval_other_area",
            "eval_other_store_areas", "eval_soft_selling",
        ]
        for f in eval_fields:
            if v.get(f) == "Fail":
                fail_count += 1
        ws.cell(row, 1, fail_count)

        ws.cell(row, 2, v.get("retailer_name", ""))
        ws.cell(row, 3, v.get("program", ""))
        ws.cell(row, 4, v.get("store_number", ""))
        ws.cell(row, 5, v.get("city", ""))
        ws.cell(row, 6, v.get("state", ""))
        ws.cell(row, 7, v.get("visit_date", ""))
        ws.cell(row, 8, v.get("visit_time", ""))

        reps = v.get("reps_present", "")
        ws.cell(row, 9, reps)

        # If Reps Present = Fail, cols 10-39 are blank
        if reps == "Fail":
            ws.cell(row, 40, v.get("visit_recap", ""))
            continue

        ws.cell(row, 10, v.get("rep_names", ""))
        ws.cell(row, 11, v.get("rep_description", ""))

        # Col 12: Less than 4 reps present? — Pass if <= 4, Fail if > 4
        rep_count = v.get("rep_count")
        if rep_count is not None:
            ws.cell(row, 12, "Pass" if rep_count <= 4 else "Fail")
        ws.cell(row, 13, v.get("rep_count_reason") or (str(rep_count) if rep_count is not None else ""))

        ws.cell(row, 14, v.get("eval_engaging", "Pass"))
        ws.cell(row, 15, v.get("eval_engaging_comment", ""))
        ws.cell(row, 16, v.get("eval_greeting", "Pass"))
        ws.cell(row, 17, v.get("eval_greeting_comment", ""))
        ws.cell(row, 18, v.get("eval_one_no", "Pass"))
        ws.cell(row, 19, v.get("eval_one_no_comment", ""))
        ws.cell(row, 20, v.get("eval_pushy", "Pass"))
        ws.cell(row, 21, v.get("eval_pushy_comment", ""))
        ws.cell(row, 22, v.get("eval_clogging", "Pass"))
        ws.cell(row, 23, v.get("eval_clogging_comment", ""))
        ws.cell(row, 24, v.get("eval_leaning", "Pass"))
        ws.cell(row, 25, v.get("eval_leaning_comment", ""))
        ws.cell(row, 26, v.get("eval_food_drink", "Pass"))
        ws.cell(row, 27, v.get("eval_food_drink_comment", ""))
        ws.cell(row, 28, v.get("eval_dress_code", "Pass"))
        ws.cell(row, 29, v.get("eval_dress_code_comment", ""))
        ws.cell(row, 30, v.get("eval_name_badge", "Pass"))
        ws.cell(row, 31, v.get("eval_name_badge_comment", ""))
        ws.cell(row, 32, v.get("eval_badge_location_pass", "Pass"))
        ws.cell(row, 33, v.get("eval_badge_where", ""))
        ws.cell(row, 34, v.get("eval_other_area", "Pass"))
        ws.cell(row, 35, v.get("eval_other_area_comment", ""))
        ws.cell(row, 36, v.get("eval_other_store_areas", "Pass"))
        ws.cell(row, 37, v.get("eval_other_store_areas_comment", ""))
        ws.cell(row, 38, v.get("eval_soft_selling", "N/A"))
        ws.cell(row, 39, v.get("eval_resource_guide", "N/A"))
        ws.cell(row, 40, v.get("visit_recap", ""))

    # Determine filename: last shopping day of the visits
    visit_dates = [v.get("visit_date", "") for v in visits if v.get("visit_date")]
    if visit_dates:
        last_day = max(visit_dates)
        try:
            dt = datetime.strptime(last_day, "%Y-%m-%d")
            date_str = dt.strftime("%m.%d.%y")
        except ValueError:
            date_str = last_day
    else:
        date_str = datetime.now().strftime("%m.%d.%y")

    filename = f"Shop File {first_name} {date_str}.xlsx"

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    return output, filename


def generate_invoice(visits, mileage_entries, profile):
    """
    Generate Invoice .xlsx.
    visits: list of Complete visits for the month
    mileage_entries: list of {date: str, miles: number}
    profile: user profile dict
    """
    template = _download_template(DROPBOX_INVOICE_URL, "invoice")
    wb = load_workbook(template)
    ws = wb.active

    # Row 1: Invoice number
    invoice_num = profile.get("next_invoice_number", 1)
    ws.cell(1, 2, f"INVOICE #{invoice_num}")

    # Rows 2-4: User info
    ws.cell(2, 2, profile.get("full_name", ""))
    ws.cell(3, 2, profile.get("home_address", ""))
    contact = f"{profile.get('phone', '')}  {profile.get('report_email', '')}".strip()
    ws.cell(4, 2, contact)

    # Row 6: Date
    ws.cell(6, 3, datetime.now().strftime("%Y-%m-%d"))

    # Clear existing mileage and vendor rows
    for row in range(14, 77):
        for col in range(2, 11):
            ws.cell(row, col, None)

    current_row = 14

    # Write mileage rows
    mileage_rate = profile.get("mileage_rate", 0.70)
    for entry in mileage_entries:
        if entry.get("miles", 0) > 0:
            ws.cell(current_row, 5, "Mileage")
            ws.cell(current_row, 6, entry["date"])
            ws.cell(current_row, 8, mileage_rate)
            ws.cell(current_row, 9, entry["miles"])
            ws.cell(current_row, 10, f"=I{current_row}*H{current_row}")
            current_row += 1

    # Blank separator row
    current_row += 2

    # Calculate vendor pricing: $50 first vendor per stop per day, $15 additional
    # Group visits by (date, store_number, retailer_name) to determine stop
    stops = defaultdict(list)
    for v in visits:
        key = (v.get("visit_date", ""), v.get("store_number", ""), v.get("retailer_name", ""))
        stops[key].append(v)

    # Sort by date then store
    sorted_stops = sorted(stops.items(), key=lambda x: (x[0][0], x[0][2], x[0][1]))

    for (visit_date, store_num, retailer), stop_visits in sorted_stops:
        for j, v in enumerate(stop_visits):
            price = 50 if j == 0 else 15
            ws.cell(current_row, 2, store_num)
            ws.cell(current_row, 3, v.get("city", ""))
            ws.cell(current_row, 4, v.get("retailer_name", ""))
            ws.cell(current_row, 5, v.get("program", ""))
            ws.cell(current_row, 6, visit_date)
            ws.cell(current_row, 10, price)
            current_row += 1

    # Update subtotal formula to cover all data rows
    ws.cell(77, 10, f"=SUM(J14:J{current_row - 1})")

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)

    return output, invoice_num
