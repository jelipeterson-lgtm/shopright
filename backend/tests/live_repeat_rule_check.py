"""Live end-to-end check of the "same vendor at the same store two weeks in a row" rule
against the real ShopRight API and database, using a real login.

It creates a handful of throwaway assessments at a fake store named "ShopRight E2E Test",
checks GET /visits/repeat-check, then deletes them (also sweeping up leftovers from any
earlier run that was interrupted).

Use a dedicated test account, not a shopper's real account: if a run is killed partway
through, leftover test assessments would show up in that account's weekly Shop File until
the next run cleans them up.

    cd backend
    E2E_EMAIL=you+e2e@example.com E2E_PASSWORD='...' python tests/live_repeat_rule_check.py --create-account

Options:
    --create-account   sign the account up first if it doesn't exist (email confirmation is off)
    --api URL          API to test (default https://shopright-api.onrender.com)
    --token JWT        skip sign-in and use this access token
    --cleanup-only     just delete leftover E2E test assessments and exit
"""
import argparse
import os
import sys
import uuid
from datetime import date, timedelta
from pathlib import Path

import httpx

TEST_RETAILER = "ShopRight E2E Test"
ATT, LEAFGUARD, CKE, IME, WATER = "RTL-ATT-EDM", "RTL-GDI-LeafGuard", "RS-CKE", "RTL-IME", "RS-DS WATER-Primo and RSW"


def read_frontend_env():
    env = {}
    path = Path(__file__).resolve().parents[2] / "frontend" / ".env.production"
    for line in path.read_text().splitlines():
        if "=" in line and not line.startswith("#"):
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip()
    return env


def sign_in(email, password, create):
    env = read_frontend_env()
    base, anon = env["VITE_SUPABASE_URL"], env["VITE_SUPABASE_ANON_KEY"]
    headers = {"apikey": anon, "Content-Type": "application/json"}
    creds = {"email": email, "password": password}
    r = httpx.post(f"{base}/auth/v1/token?grant_type=password", json=creds, headers=headers, timeout=30)
    if r.status_code == 400 and create:
        print(f"Account not found — creating {email}")
        s = httpx.post(f"{base}/auth/v1/signup", json=creds, headers=headers, timeout=30)
        s.raise_for_status()
        r = httpx.post(f"{base}/auth/v1/token?grant_type=password", json=creds, headers=headers, timeout=30)
    if r.status_code != 200:
        sys.exit(f"Sign-in failed ({r.status_code}): {r.text[:200]}")
    return r.json()["access_token"]


class Api:
    def __init__(self, base, token):
        # Render's free tier can take ~30s to wake up.
        self.client = httpx.Client(base_url=base, headers={"Authorization": f"Bearer {token}"}, timeout=90)

    def call(self, method, path, **kw):
        r = self.client.request(method, path, **kw)
        r.raise_for_status()
        return r.json()

    def create(self, store_number, program, visit_date):
        body = {"retailer_name": TEST_RETAILER, "store_number": store_number, "program": program,
                "address": "1 Test St", "city": "Testville", "state": "OR",
                "visit_date": visit_date, "visit_time": "10:00", "session_date": visit_date}
        return self.call("POST", "/visits", json=body)["data"]["id"]

    def submit(self, visit_id, **fields):
        if fields:
            self.call("PUT", f"/visits/{visit_id}", json=fields)
        self.call("POST", f"/visits/{visit_id}/complete")

    def cleanup(self):
        leftovers = [v for v in self.call("GET", "/visits")["data"] if v["retailer_name"] == TEST_RETAILER]
        for v in leftovers:
            self.call("DELETE", f"/visits/{v['id']}")
        return len(leftovers)


def run(api):
    today = date.today()
    this_monday = today - timedelta(days=today.weekday())
    last_mon, last_sun = this_monday - timedelta(days=7), this_monday - timedelta(days=1)
    two_weeks_ago = this_monday - timedelta(days=10)
    store, other_store = f"E2E-{uuid.uuid4().hex[:6]}", f"E2E-{uuid.uuid4().hex[:6]}"

    # (store, program, date, how to leave it, should it be held back this week?)
    cases = [
        (store, ATT, last_mon, {"reps_present": "Pass"}, True, "submitted last Monday"),
        (store, LEAFGUARD, last_sun, {"reps_present": "Pass", "eval_pushy": "Fail"}, True, "other Fail still counts (last Sunday)"),
        (store, CKE, last_mon + timedelta(days=2), {"reps_present": "Fail"}, False, "reps not present → may return"),
        (store, IME, last_mon + timedelta(days=3), None, False, "never submitted"),
        (store, WATER, two_weeks_ago, {"reps_present": "Pass"}, False, "two weeks ago"),
        (other_store, CKE, this_monday, {"reps_present": "Pass"}, False, "earlier this week"),
    ]

    swept = api.cleanup()
    if swept:
        print(f"Removed {swept} leftover test assessment(s) from an earlier run")

    try:
        for s, program, d, submit_fields, _, label in cases:
            vid = api.create(s, program, d.isoformat())
            if submit_fields is not None:
                api.submit(vid, **submit_fields)
            print(f"  seeded {program:28} {d}  ({label})")

        data = api.call("GET", "/visits/repeat-check", params={"week_of": today.isoformat()})["data"]
        assert data["week_start"] == last_mon.isoformat(), data
        assert data["week_end"] == last_sun.isoformat(), data
        got = {(r["store_number"], r["program"]) for r in data["repeats"] if r["retailer_name"] == TEST_RETAILER}

        failures = 0
        for s, program, _, _, expected, label in cases:
            held = (s, program) in got
            ok = held == expected
            failures += not ok
            print(f"{'PASS' if ok else 'FAIL'}  {label:40} held back={held} expected={expected}")
        return failures
    finally:
        print(f"Cleaned up {api.cleanup()} test assessment(s)")


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--api", default=os.environ.get("SHOPRIGHT_API_URL", "https://shopright-api.onrender.com"))
    p.add_argument("--token")
    p.add_argument("--create-account", action="store_true")
    p.add_argument("--cleanup-only", action="store_true")
    args = p.parse_args()

    token = args.token
    if not token:
        email, password = os.environ.get("E2E_EMAIL"), os.environ.get("E2E_PASSWORD")
        if not email or not password:
            sys.exit("Set E2E_EMAIL and E2E_PASSWORD (or pass --token).")
        token = sign_in(email, password, args.create_account)

    api = Api(args.api, token)
    if args.cleanup_only:
        print(f"Removed {api.cleanup()} leftover test assessment(s)")
        return
    print(f"Testing {args.api} — week of {date.today()}")
    failures = run(api)
    print("\nALL CHECKS PASSED" if not failures else f"\n{failures} CHECK(S) FAILED")
    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    main()
