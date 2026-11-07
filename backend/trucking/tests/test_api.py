from datetime import UTC, datetime, timedelta

import pytest
from rest_framework.test import APIClient

from trucking import providers
from trucking.api import views

PLACE = {"lat": 39.74, "lon": -104.99}


def body(**over):
    data = {
        "origin": PLACE,
        "destination": {"lat": 40.71, "lon": -74.0},
        "departure": datetime.now(UTC).isoformat(),
        "load_lb": 20_000,
        "interval_miles": 25,
    }
    return {**data, **over}


@pytest.fixture
def client():
    return APIClient()


def test_short_search_text_returns_no_matches_without_calling_the_provider(client, monkeypatch):
    monkeypatch.setattr(providers, "geocode", lambda q: pytest.fail("should not be called"))
    assert client.get("/api/geocode", {"q": "de"}).json() == []


def test_plan_passes_validated_input_to_the_planner(client, monkeypatch):
    seen = {}
    monkeypatch.setattr(views, "plan_trip", lambda *args: seen.setdefault("args", args) and {"ok": True})
    res = client.post("/api/plan", body(), format="json")
    assert res.status_code == 200 and res.json() == {"ok": True}
    origin, destination, _, load, interval = seen["args"]
    assert origin == (-104.99, 39.74) and destination == (-74.0, 40.71)
    assert (load, interval) == (20_000, 25)


def test_plan_passes_the_submitted_departure_to_the_planner(client, monkeypatch):
    seen = {}
    monkeypatch.setattr(views, "plan_trip", lambda *args: seen.setdefault("args", args) and {"ok": True})
    submitted = (datetime.now(UTC) + timedelta(days=1, hours=3)).replace(second=0, microsecond=0)
    client.post("/api/plan", body(departure=submitted.isoformat()), format="json")
    departure = seen["args"][2]
    assert departure == submitted and departure.tzinfo is not None


@pytest.mark.parametrize(
    "override",
    [
        {"load_lb": -1},
        {"load_lb": 300_000},
        {"interval_miles": 30},
        {"origin": {"lat": 95, "lon": 0}},
        {"departure": (datetime.now(UTC) - timedelta(days=2)).isoformat()},
        {"departure": (datetime.now(UTC) + timedelta(days=6)).isoformat()},
    ],
)
def test_plan_rejects_invalid_input(client, override):
    assert client.post("/api/plan", body(**override), format="json").status_code == 400


def test_planner_is_throttled_per_client(client, monkeypatch):
    from rest_framework.throttling import AnonRateThrottle

    monkeypatch.setitem(AnonRateThrottle.THROTTLE_RATES, "anon", "2/hour")
    codes = [client.post("/api/plan", {}, format="json").status_code for _ in range(4)]
    assert codes == [400, 400, 429, 429]  # invalid bodies still count
