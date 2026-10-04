"""POST /visits/batch must insert visit_time as null.

Checked on the shopright database Oct 4, 2026: vendor_visits.visit_time was
`time without time zone`, NOT NULL, with no default. The batch insert omitted
the column (it set visit_date, session_date, status, and stop_open only), and
Postgres rejected that payload:

    null value in column "visit_time" of relation "vendor_visits"
    violates not-null constraint

The value on these rows is null, not a clock time. Render's clock is UTC
(that stamp was removed on April 24). Accept Route is hours before later
stops, and Visit.jsx only fills a time when the stored value is empty, so a
stamp would stick and land in the Shop File. The form writes the shopper's
local clock the first time a Draft is opened, and submit saves that time
before the row is marked Complete.

The column is nullable now. This stand-in still rejects an insert that omits
visit_time — the old payload — and accepts an explicit null.
"""
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

import routers.visits as visits_module

NOT_NULL = (
    'null value in column "visit_time" of relation "vendor_visits" '
    "violates not-null constraint"
)


class Result:
    def __init__(self, data):
        self.data = data


class FakeTable:
    def __init__(self, db):
        self.db = db
        self.filters = []
        self.op = None
        self.payload = None

    def select(self, _cols):
        self.op = "select"
        return self

    def eq(self, col, val):
        self.filters.append((col, val))
        return self

    def insert(self, rows):
        self.op = "insert"
        self.payload = rows
        return self

    def execute(self):
        if self.op == "insert":
            rows = self.payload if isinstance(self.payload, list) else [self.payload]
            for row in rows:
                # The old batch insert omitted the column. Postgres treats
                # that as null, and the NOT NULL constraint rejects it.
                if "visit_time" not in row:
                    self.db.error = NOT_NULL
                    raise RuntimeError(NOT_NULL)
            saved = []
            for row in rows:
                copy = dict(row)
                copy["id"] = f"new-{len(self.db.rows) + len(saved) + 1}"
                saved.append(copy)
            self.db.inserted.extend(saved)
            self.db.rows.extend(saved)
            return Result(saved)

        rows = self.db.rows
        for col, val in self.filters:
            rows = [r for r in rows if r.get(col) == val]
        return Result(rows)


class FakeDB:
    def __init__(self, rows):
        self.rows = list(rows)
        self.inserted = []
        self.error = None

    def table(self, name):
        assert name == "vendor_visits"
        return FakeTable(self)


def store(number, vendors, retailer="Costco"):
    return {
        "store_id": int(number),
        "retailer_name": retailer,
        "store_number": number,
        "address": "123 Main St",
        "city": "Portland",
        "state": "OR",
        "vendors": vendors,
    }


@pytest.fixture
def client(monkeypatch):
    db = FakeDB([])
    monkeypatch.setattr(visits_module, "supabase_admin", db)
    monkeypatch.setattr(visits_module, "get_user_id", lambda auth: auth.removeprefix("Bearer "))
    app = FastAPI()
    app.include_router(visits_module.router)
    # Surface the constraint error as the response instead of raising out of the test.
    return TestClient(app, raise_server_exceptions=False), db


def post_batch(client, stores, session_date="2026-10-06", user="kelsey"):
    return client.post(
        "/visits/batch",
        json={"stores": stores, "session_date": session_date},
        headers={"Authorization": f"Bearer {user}"},
    )


def test_batch_insert_sets_visit_time_null(client):
    http, db = client
    res = post_batch(http, [
        store("121", ["RTL-ATT-EDM", "RS-CKE"]),
        store("1287", ["RTL-GDI-LeafGuard"]),
    ])
    assert res.status_code == 200, db.error or res.text
    body = res.json()
    assert body["success"] is True
    assert body["data"]["created"] == 3
    assert body["data"]["skipped"] == 0
    assert len(db.inserted) == 3
    for row in db.inserted:
        assert row["visit_time"] is None
        assert row["status"] == "Draft"
        assert row["visit_date"] == "2026-10-06"
        assert row["session_date"] == "2026-10-06"
        assert row["user_id"] == "kelsey"
    assert [v["visit_time"] for v in body["data"]["visits"]] == [None, None, None]
    assert {row["program"] for row in db.inserted} == {
        "RTL-ATT-EDM", "RS-CKE", "RTL-GDI-LeafGuard",
    }


def test_batch_skips_existing_vendors_and_still_nulls_new_ones(client):
    http, db = client
    db.rows.append({
        "user_id": "kelsey",
        "retailer_name": "Costco",
        "store_number": "121",
        "program": "RTL-ATT-EDM",
        "session_date": "2026-10-06",
        "visit_time": "09:15:00",
    })
    res = post_batch(http, [store("121", ["RTL-ATT-EDM", "RS-CKE"])])
    assert res.status_code == 200, db.error or res.text
    body = res.json()
    assert body["data"]["created"] == 1
    assert body["data"]["skipped"] == 1
    assert len(db.inserted) == 1
    assert db.inserted[0]["program"] == "RS-CKE"
    assert db.inserted[0]["visit_time"] is None


def test_batch_with_nothing_new_does_not_insert(client):
    http, db = client
    res = post_batch(http, [store("121", [])])
    assert res.status_code == 200, db.error or res.text
    assert res.json()["data"]["created"] == 0
    assert db.inserted == []
