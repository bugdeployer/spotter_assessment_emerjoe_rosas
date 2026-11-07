"""Scoring one route: checkpoints, ETAs, weather risk and miles at each risk level."""

from __future__ import annotations

from datetime import datetime, timedelta

from ..geo import GridCell, Polyline, checkpoint_distances, decimate, snap
from ..risk import Risk, classify, load_adjusted_wind_risk, wind_risk
from ..types import ForecastSeries, RouteCandidate
from .forecast import is_known, weather_at
from .recommendation import RouteScore

TRUCK_SPEED_FACTOR = 0.9  # OSRM uses car speeds; trucks are slower


def checkpoint_cells(line: Polyline, interval_mi: float) -> set[GridCell]:
    """The forecast grid cells a route's checkpoints fall in (what must be fetched to analyse it)."""
    cells = set()
    for mile in checkpoint_distances(line.total_mi, interval_mi):
        lon, lat = line.point_at(mile)
        cells.add(snap(lat, lon))
    return cells


def _checkpoint(lat: float, lon: float, mile: float, eta: datetime, wx: dict, load_lb: float, segment: float) -> dict:
    """One checkpoint as the API returns it. Unknown weather gives ``risk: None`` rather than a guess."""
    known = is_known(wx)
    if known:
        level, parts = classify(wx["wind_mph"], wx["rain_in_hr"], wx["snow_in_hr"], load_lb)
        # True when the heavy-load wind rule rated the wind worse than the plain wind table would.
        load_rule = load_adjusted_wind_risk(wx["wind_mph"], load_lb) > wind_risk(wx["wind_mph"])
        drivers = [k for k, v in parts.items() if v == level and level > Risk.LOW]
    return {
        "mile": round(mile, 1),
        "lat": lat,
        "lon": lon,
        "eta": eta.isoformat(),
        "weather": {k: None if v is None else round(v, 2) for k, v in wx.items()},
        "forecast_available": known,
        "risk": level.label if known else None,
        "risk_level": int(level) if known else None,
        "drivers": drivers if known else [],
        "load_rule": load_rule if known else False,
        "segment_miles": round(segment, 2),
    }


def analyze_route(
    route: RouteCandidate,
    departure: datetime,
    load_lb: float,
    interval_mi: float,
    weather: dict[GridCell, ForecastSeries],
) -> tuple[dict, RouteScore]:
    """One route as the API returns it, plus its unrounded score for ranking.

    A checkpoint every ``interval_mi`` miles (and one at the destination) gets the truck's ETA there, the
    forecast for that moment and its risk. Each checkpoint stands for the stretch halfway to its neighbours;
    stretches whose forecast is unknown are counted as unknown miles, never as Low. ``weather`` must hold
    every checkpoint's cell.
    """
    line: Polyline = route["line"]
    total = line.total_mi
    duration_s = route["duration_s"] / TRUCK_SPEED_FACTOR
    marks = checkpoint_distances(total, interval_mi)

    checkpoints = []
    miles = dict.fromkeys(Risk, 0.0)
    unknown_mi = 0.0
    weighted = 0.0
    for i, mile in enumerate(marks):
        lon, lat = line.point_at(mile)
        eta = departure + timedelta(seconds=duration_s * (mile / total if total else 0))
        wx = weather_at(weather[snap(lat, lon)], eta)
        lo = 0.0 if i == 0 else (marks[i - 1] + mile) / 2
        hi = total if i == len(marks) - 1 else (mile + marks[i + 1]) / 2
        segment = hi - lo
        cp = _checkpoint(lat, lon, mile, eta, wx, load_lb, segment)
        checkpoints.append(cp)
        if cp["risk_level"] is None:
            unknown_mi += segment
        else:
            level = Risk(cp["risk_level"])
            miles[level] += segment
            weighted += int(level) * segment

    complete = unknown_mi == 0
    known_levels = [cp["risk_level"] for cp in checkpoints if cp["risk_level"] is not None]
    score = RouteScore(
        complete=complete,
        no_travel_mi=miles[Risk.NO_TRAVEL],
        severe_mi=miles[Risk.SEVERE],
        high_mi=miles[Risk.HIGH],
        # Distance-weighted over the whole route; undefined while part of the route has no forecast.
        avg_risk=weighted / total if complete and total else (0.0 if complete else None),
        duration_s=duration_s,
    )
    public = {
        "distance_mi": round(total, 1),
        "duration_s": round(duration_s),
        "arrival": (departure + timedelta(seconds=duration_s)).isoformat(),
        "roads": route["roads"],
        "geometry": [[round(lat, 5), round(lon, 5)] for lon, lat in decimate(line.coords)],
        "checkpoints": checkpoints,
        # Rounded for display only; ranking uses the raw values in RouteScore.
        "miles_by_risk": {r.label: round(m, 1) for r, m in miles.items()},
        "unknown_miles": round(unknown_mi, 1),
        "avg_risk": None if score.avg_risk is None else round(score.avg_risk, 3),
        "max_risk": Risk(max(known_levels)).label if known_levels else None,
        "load_rule_checkpoints": sum(cp["load_rule"] for cp in checkpoints),
        "forecast_complete": complete,
    }
    return public, score
