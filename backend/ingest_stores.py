"""
Download Book1.xlsx from Dropbox, geocode addresses, and load into stores table.
Also loads program list into a programs table.
Run manually: python3 ingest_stores.py
"""
import os
import time
import httpx
from openpyxl import load_workbook
from dotenv import load_dotenv
from db import supabase_admin

load_dotenv()

DROPBOX_URL = os.getenv("DROPBOX_STORES_URL", "").replace("dl=0", "dl=1")


def download_book1():
    print("Downloading Book1.xlsx from Dropbox...")
    r = httpx.get(DROPBOX_URL, follow_redirects=True, timeout=30)
    r.raise_for_status()
    path = "/tmp/Book1.xlsx"
    with open(path, "wb") as f:
        f.write(r.content)
    print(f"Downloaded {len(r.content)} bytes")
    return path


def geocode_address(address, city, state, zip_code):
    full_address = f"{address}, {city}, {state} {zip_code}"
    try:
        r = httpx.get(
            "https://nominatim.openstreetmap.org/search",
            params={"q": full_address, "format": "json", "limit": 1},
            headers={"User-Agent": "ShopRight/1.0"},
            timeout=10,
        )
        data = r.json()
        if data:
            return float(data[0]["lat"]), float(data[0]["lon"])
    except Exception as e:
        print(f"  Geocode failed for {full_address}: {e}")
    return None, None


def parse_and_load(path):
    wb = load_workbook(path)

    # --- Load Programs ---
    if "Program" in wb.sheetnames:
        ws_prog = wb["Program"]
        programs = []
        for row in range(2, ws_prog.max_row + 1):
            code = ws_prog.cell(row, 1).value
            if code and code.strip():
                programs.append(code.strip())
        print(f"Found {len(programs)} programs")

        # Store programs in database
        for prog in programs:
            supabase_admin.table("programs").upsert(
                {"code": prog}, on_conflict="code"
            ).execute()
        print(f"Programs loaded: {programs}")
    else:
        print("No Program worksheet found")

    # --- Load Stores from Retail worksheet ---
    ws_name = "Retail" if "Retail" in wb.sheetnames else wb.sheetnames[0]
    ws = wb[ws_name]

    seen = set()
    stores = []

    for row in range(2, ws.max_row + 1):
        retailer = ws.cell(row, 1).value
        store_num = str(ws.cell(row, 2).value or "").strip()

        if not retailer or not store_num:
            continue

        key = (retailer.strip(), store_num)
        if key in seen:
            continue
        seen.add(key)

        stores.append({
            "retailer_name": retailer.strip(),
            "store_number": store_num,
            "address": (ws.cell(row, 3).value or "").strip(),
            "city": (ws.cell(row, 4).value or "").strip(),
            "state": (ws.cell(row, 5).value or "").strip(),
            "zip_code": str(ws.cell(row, 6).value or "").strip(),
        })

    print(f"Parsed {len(stores)} unique stores (from {ws.max_row - 1} rows)")

    # Geocode each unique address
    geocoded = {}
    for store in stores:
        addr_key = (store["address"], store["city"], store["state"], store["zip_code"])
        if addr_key not in geocoded:
            lat, lon = geocode_address(*addr_key)
            geocoded[addr_key] = (lat, lon)
            if lat:
                print(f"  Geocoded: {store['retailer_name']} #{store['store_number']} -> {lat}, {lon}")
            else:
                print(f"  FAILED: {store['retailer_name']} #{store['store_number']}")
            time.sleep(1.1)  # Nominatim rate limit

        store["latitude"], store["longitude"] = geocoded[addr_key]

    # Upsert into database
    print("Loading into database...")
    for store in stores:
        supabase_admin.table("stores").upsert(
            store, on_conflict="retailer_name,store_number"
        ).execute()

    print(f"Done. {len(stores)} stores loaded.")


if __name__ == "__main__":
    path = download_book1()
    parse_and_load(path)
