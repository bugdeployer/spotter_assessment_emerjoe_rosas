"""The whole planner through the API, with only the outside services (OSRM, Open-Meteo) faked."""

from datetime import UTC, datetime, timedelta

import pytest
from rest_framework.test import APIClient

from trucking.providers import routing, weather

MILES = 60
FAST_TRUCK_S = 3 * 3600  # 20 mph: ETAs of 0, 1.25, 2.5 and 3 h at miles 0, 25, 50, 60
SLOW_TRUCK_S = 6 * 3600
# Wind by hour after departure: calm, then rising. Checkpoints only see this if their ETAs advance.
WIND_BY_HOUR = [10.0, 30.0, 40.0, 50.0] + [50.0] * 164


def departure() -> datetime:
    """Next whole hour (inside the API's accepted window), so lookups land on exact forecast hours."""
    return datetime.now(UTC).replace(minute=0, second=0, microsecond=0) + timedelta(hours=1)


def osrm_route(lon: float, truck_seconds: float) -> dict:
    meters = MILES * 1609.344
    return {
        "geometry": {"coordinates": [[lon, 40.0], [lon, 40.0 + MILES / 69.0]]},
        "distance": meters,
        "duration": truck_seconds * 0.9,  # OSRM reports car time; the planner divides by 0.9
        "legs": [{"steps": [{"ref": "US 83", "distance": meters}]}],
    }


def fake_services(monkeypatch, start: datetime, wind: list, hours_of_data: int = 168, routes: list | None = None):
    """Answer routing and weather requests like the real APIs would, from fixed data."""

    def osrm(url, params, **kw):
        points = url.rsplit("/", 1)[1].split(";")
        if len(points) == 3:  # detour through a via point: none possible here
            return {"code": "NoRoute"}
        # The slower route comes first, so the ranking (not the provider's order) must pick the winner.
        return {"code": "Ok", "routes": routes or [osrm_route(-99.0, SLOW_TRUCK_S), osrm_route(-100.0, FAST_TRUCK_S)]}

    def open_meteo(url, params, **kw):
        times = [(start + timedelta(hours=h)).strftime("%Y-%m-%dT%H:%M") for h in range(hours_of_data)]
        hourly = {
            "time": times,
            "wind_speed_10m": wind[:hours_of_data],
            "rain": [0.0] * hours_of_data,
            "snowfall": [0.0] * hours_of_data,
        }
        return [{"hourly": hourly} for _ in params["latitude"].split(",")]

    monkeypatch.setattr(routing, "get_json", osrm)
    monkeypatch.setattr(weather, "get_json", open_meteo)


def plan(dep: datetime, load_lb: int = 20_000, interval: int = 25) -> dict:
    body = {
        "origin": {"lat": 40.0, "lon": -100.0},
        "destination": {"lat": 40.87, "lon": -100.0},
        "departure": dep.isoformat(),
        "load_lb": load_lb,
        "interval_miles": interval,
    }
    res = APIClient().post("/api/plan", body, format="json")
    assert res.status_code == 200, res.content
    return res.json()


@pytest.fixture
def dep():
    return departure()


def test_plan_end_to_end(monkeypatch, dep):
    # Forecast starts 2 h before departure, so departure is hour index 2.
    fake_services(monkeypatch, dep - timedelta(hours=2), [10.0, 10.0] + WIND_BY_HOUR)
    data = plan(dep)

    slow, fast = data["routes"]
    assert [cp["mile"] for cp in fast["checkpoints"]] == [0, 25, 50, 60]
    assert [cp["eta"] for cp in fast["checkpoints"]] == [
        dep.isoformat(),
        (dep + timedelta(hours=1, minutes=15)).isoformat(),
        (dep + timedelta(hours=2, minutes=30)).isoformat(),
        (dep + timedelta(hours=3)).isoformat(),
    ]
    # 10 mph, 32.5 mph (1.25 h), 45 mph (2.5 h), 50 mph (3 h).
    assert [cp["risk"] for cp in fast["checkpoints"]] == ["low", "moderate", "severe", "severe"]
    assert fast["miles_by_risk"] == {"low": 12.5, "moderate": 25.0, "high": 0.0, "severe": 22.5, "no_travel": 0.0}
    # The slow truck meets the wind earlier in its trip: 45 mph at mile 25 (2.5 h).
    assert slow["miles_by_risk"] == {"low": 12.5, "moderate": 0.0, "high": 0.0, "severe": 47.5, "no_travel": 0.0}

    assert data["recommendation_status"] == "recommended"
    assert data["recommended_id"] == 1 and data["comparison_winner_id"] == 1
    assert data["explanation"] == "25 fewer Severe miles than Route A (22.5 vs 47.5)."
    assert len(data["routes"]) == 2 and data["routes_requested"] == 3  # no detour was possible
    assert data["heatmap"]["hours"] == 48 and data["heatmap"]["available"] is True


def test_expired_forecast_leaves_no_route_to_recommend(monkeypatch, dep):
    # Data covers only up to 1 h after departure: every route's later checkpoints are unknown.
    fake_services(monkeypatch, dep - timedelta(hours=2), [10.0] * 168, hours_of_data=4)
    data = plan(dep)
    assert data["recommendation_status"] == "no_complete_forecast"
    assert data["recommended_id"] is None and data["comparison_winner_id"] is None
    assert all(not r["forecast_complete"] and r["unknown_miles"] > 0 for r in data["routes"])
    assert not any(r["recommended"] or r["comparison_winner"] for r in data["routes"])
    assert data["heatmap"]["hours"] == 1  # forecast available through +1 h


def test_null_weather_everywhere(monkeypatch, dep):
    fake_services(monkeypatch, dep - timedelta(hours=2), [None] * 168)
    data = plan(dep)
    assert data["recommendation_status"] == "no_complete_forecast"
    assert all(r["max_risk"] is None and r["avg_risk"] is None for r in data["routes"])
    assert data["heatmap"]["available"] is False and data["heatmap"]["points"] == []


def test_malformed_weather_is_a_502(monkeypatch, dep):
    fake_services(monkeypatch, dep - timedelta(hours=2), [10.0] * 168)
    monkeypatch.setattr(weather, "get_json", lambda url, params, **kw: {"hourly": {"time": []}})
    res = APIClient().post(
        "/api/plan",
        {
            "origin": {"lat": 40.0, "lon": -100.0},
            "destination": {"lat": 40.87, "lon": -100.0},
            "departure": dep.isoformat(),
            "load_lb": 20_000,
            "interval_miles": 25,
        },
        format="json",
    )
    assert res.status_code == 502
    assert res.json() == {"detail": "Weather service returned an unexpected response"}


def test_no_route_is_a_structured_error(monkeypatch, dep):
    fake_services(monkeypatch, dep - timedelta(hours=2), [10.0] * 168)
    monkeypatch.setattr(routing, "get_json", lambda url, params, **kw: {"code": "Ok", "routes": []})
    res = APIClient().post(
        "/api/plan",
        {
            "origin": {"lat": 40.0, "lon": -100.0},
            "destination": {"lat": 40.87, "lon": -100.0},
            "departure": dep.isoformat(),
            "load_lb": 20_000,
            "interval_miles": 25,
        },
        format="json",
    )
    assert res.status_code == 502 and res.json() == {"detail": "No route found between these places"}


def test_sixty_hour_trip_is_scored_past_the_48_hour_slider(monkeypatch, dep):
    # One 60-mile route driven in 60 h, checkpoints every 10 mi: the last one is at +60 h.
    wind = [10.0] * 168
    wind[2 + 60] = 50.0  # Severe at +60 h only (index 2 is departure)
    fake_services(monkeypatch, dep - timedelta(hours=2), wind, routes=[osrm_route(-100.0, 60 * 3600)])
    data = plan(dep, interval=10)
    route = data["routes"][0]
    last = route["checkpoints"][-1]
    assert last["eta"] == (dep + timedelta(hours=60)).isoformat()
    assert last["risk"] == "severe"
    assert route["forecast_complete"] is True
    assert data["heatmap"]["hours"] == 48  # the slider stays at 48 h; scoring doesn't
