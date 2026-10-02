"""Exercises GET /visits/repeat-check through FastAPI with an in-memory Supabase stand-in
that really applies the query's filters, so a wrong filter makes these tests fail."""
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

import routers.visits as visits_module


class FakeQuery:
    def __init__(self, rows, calls):
        self.rows = rows
        self.calls = calls

    def select(self, _cols):
        return self

    def eq(self, col, val):
        self.calls.append(("eq", col, val))
        return FakeQuery([r for r in self.rows if r.get(col) == val], self.calls)

    def gte(self, col, val):
        self.calls.append(("gte", col, val))
        return FakeQuery([r for r in self.rows if r.get(col) and r[col] >= val], self.calls)

    def lte(self, col, val):
        self.calls.append(("lte", col, val))
        return FakeQuery([r for r in self.rows if r.get(col) and r[col] <= val], self.calls)

    def execute(self):
        return type("Result", (), {"data": self.rows})()


class FakeSupabase:
    def __init__(self, rows):
        self.rows = rows
        self.calls = []

    def table(self, name):
        assert name == "vendor_visits"
        return FakeQuery(self.rows, self.calls)


def row(user, visit_date, program="RTL-ATT-EDM", status="Complete", reps_present="Pass", store_number="242"):
    return {"user_id": user, "retailer_name": "Kroger - Fred Meyer", "store_number": store_number,
            "program": program, "visit_date": visit_date, "status": status, "reps_present": reps_present}


@pytest.fixture
def client_with(monkeypatch):
    def make(rows):
        fake = FakeSupabase(rows)
        monkeypatch.setattr(visits_module, "supabase_admin", fake)
        monkeypatch.setattr(visits_module, "get_user_id", lambda auth: auth.removeprefix("Bearer "))
        app = FastAPI()
        app.include_router(visits_module.router)
        return TestClient(app), fake
    return make


def get(client, week_of, user="kelsey"):
    return client.get("/visits/repeat-check", params={"week_of": week_of},
                      headers={"Authorization": f"Bearer {user}"})


def test_returns_only_qualifying_last_week_repeats(client_with):
    client, _ = client_with([
        row("kelsey", "2026-09-30"),                                   # repeat
        row("kelsey", "2026-10-01", program="RTL-GDI-LeafGuard", reps_present="Fail"),  # reps absent → allowed
        row("kelsey", "2026-10-02", program="RS-CKE", status="Draft"),  # unsubmitted → ignored
        row("kelsey", "2026-09-24", program="RTL-IME"),                 # two weeks ago → ignored
        row("kelsey", "2026-10-06", program="RTL-LEAF FILTER"),         # this week → ignored
    ])
    res = get(client, "2026-10-07")
    assert res.status_code == 200
    body = res.json()
    assert body["success"] is True
    assert body["data"]["week_start"] == "2026-09-28"
    assert body["data"]["week_end"] == "2026-10-04"
    assert body["data"]["repeats"] == [{
        "retailer_name": "Kroger - Fred Meyer", "store_number": "242",
        "program": "RTL-ATT-EDM", "visit_date": "2026-09-30",
    }]


def test_only_checks_the_signed_in_users_history(client_with):
    client, fake = client_with([row("stacy", "2026-09-30")])
    assert get(client, "2026-10-07", user="kelsey").json()["data"]["repeats"] == []
    assert ("eq", "user_id", "kelsey") in fake.calls


def test_query_is_scoped_to_submitted_visits_in_last_week(client_with):
    client, fake = client_with([])
    get(client, "2026-10-07")
    assert ("eq", "status", "Complete") in fake.calls
    assert ("gte", "visit_date", "2026-09-28") in fake.calls
    assert ("lte", "visit_date", "2026-10-04") in fake.calls


def test_route_is_not_swallowed_by_visit_id_route(client_with):
    client, _ = client_with([])
    assert "repeats" in get(client, "2026-10-07").json()["data"]


def test_bad_date_is_a_400(client_with):
    client, _ = client_with([])
    assert get(client, "10/07/2026").status_code == 400


def test_requires_auth_header(client_with):
    client, _ = client_with([])
    assert client.get("/visits/repeat-check", params={"week_of": "2026-10-07"}).status_code == 422
