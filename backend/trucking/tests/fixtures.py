"""Small, realistic builders shared by the tests: straight-line routes and hourly forecasts."""

from datetime import UTC, datetime, timedelta

from trucking.geo import Polyline

DEPARTURE = datetime(2026, 11, 7, 6, 0, tzinfo=UTC)
MILES_PER_DEGREE_LAT = 69.0


def straight_route(miles: float, truck_seconds: float, lon: float = -100.0) -> dict:
    """A route due north from (40N, ``lon``) that a truck drives in ``truck_seconds``.

    The routing service reports car times; the planner divides by 0.9, so the raw duration is scaled to match.
    """
    coords = [(lon, 40.0), (lon, 40.0 + miles / MILES_PER_DEGREE_LAT)]
    return {
        "coords": coords,
        "distance_mi": miles,
        "duration_s": truck_seconds * 0.9,
        "roads": ["US 83"],
        "line": Polyline(coords, miles),
    }


def forecast(wind: list, rain: list | None = None, snow: list | None = None, start: datetime = DEPARTURE) -> dict:
    """Hourly series from ``start`` (index 0). ``None`` marks a missing observation."""
    n = len(wind)
    return {"start": start, "wind": list(wind), "rain": list(rain or [0.0] * n), "snow": list(snow or [0.0] * n)}


class EveryCell(dict):
    """Weather lookup where every grid cell has the same forecast (fine for routes a few miles apart)."""

    def __init__(self, series: dict):
        super().__init__()
        self.series = series

    def __missing__(self, key):
        return self.series

    def __iter__(self):  # pragma: no cover - not needed by the planner
        return iter(())


def hours(h: float) -> timedelta:
    return timedelta(hours=h)
