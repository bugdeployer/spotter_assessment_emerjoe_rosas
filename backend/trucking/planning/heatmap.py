"""The weather heatmap: risk at points along and across every route, hour by hour."""

from __future__ import annotations

import math
from datetime import datetime, timedelta

from ..geo import GridCell, Polyline, checkpoint_distances, offset_point, snap
from ..risk import legend_ranges, load_adjusted_wind_risk, rain_risk, snow_risk
from ..types import ForecastSeries, RouteCandidate
from .forecast import is_known, value_at, weather_at

FORECAST_SLIDER_HOURS = 48  # the brief's 0-48 hour forecast slider
MISSING = "-"  # heat digit for an hour with no forecast value
HEATMAP_STEP_MI = 25  # miles between sample positions along a route
CORRIDOR_OFFSET_MI = 20  # how far to each side of the route the samples reach
HEATMAP_GRIDS = (0.25, 0.4, 0.6, 0.8, 1.0)  # degrees, finest first
MAX_HEATMAP_CELLS = 220  # keeps one search inside the weather API's rate limit
MILES_PER_DEGREE = 69


def heatmap_cells(routes: list[RouteCandidate], grid: float) -> dict[GridCell, tuple[float, float]]:
    """Grid cells along and across the corridor of all routes: snapped cell -> real (lat, lon)."""
    cells: dict[GridCell, tuple[float, float]] = {}
    for route in routes:
        line: Polyline = route["line"]
        for mile in checkpoint_distances(line.total_mi, HEATMAP_STEP_MI):
            centre = line.point_at(mile)
            bearing = line.bearing_at(mile)
            for off in (-CORRIDOR_OFFSET_MI, 0, CORRIDOR_OFFSET_MI):
                lon, lat = offset_point(centre, bearing + math.pi / 2, off) if off else centre
                cells.setdefault(snap(lat, lon, grid), (lat, lon))
    return cells


def choose_cells(routes: list[RouteCandidate]) -> tuple[dict[GridCell, tuple[float, float]], float]:
    """The finest grid whose cell count stays within MAX_HEATMAP_CELLS, with its cells.

    Long trips need a coarser grid so that one search stays within the weather API's rate limit.
    """
    cells: dict[GridCell, tuple[float, float]] = {}
    grid = HEATMAP_GRIDS[0]
    for grid in HEATMAP_GRIDS:
        cells = heatmap_cells(routes, grid)
        if len(cells) <= MAX_HEATMAP_CELLS:
            break
    return cells, grid


def cell_miles(grid: float) -> int:
    """Typical distance between neighbouring heat points, so the map can size each point's
    footprint to blend with its neighbours instead of leaving gaps."""
    return round(max(HEATMAP_STEP_MI, grid * MILES_PER_DEGREE))


def heatmap_start(departure: datetime) -> datetime:
    """Slider hour 0: the departure hour, floored."""
    return departure.replace(minute=0, second=0, microsecond=0)


def usable_hours(start: datetime, series: list[ForecastSeries]) -> int | None:
    """The last slider hour (0-48) the forecast can show, or None when not even hour 0 can be shown.

    An hour is usable when at least one heat point has all three hazards for it. The range stops at the first
    hour that isn't, so the slider never runs into a blank map.
    """
    last = None
    for h in range(FORECAST_SLIDER_HOURS + 1):
        t = start + timedelta(hours=h)
        if not any(is_known(weather_at(s, t)) for s in series):
            break
        last = h
    return last


def _digit(level) -> str:
    return MISSING if level is None else str(int(level))


def build_heatmap(
    cells: dict[GridCell, tuple[float, float]],
    weather: dict[GridCell, ForecastSeries],
    start: datetime,
    hours: int | None,
    load_lb: float,
    cell_miles: int,
) -> dict:
    """Per-point risk for every slider hour, kept per hazard so the map can show wind, rain or snow alone.

    Each hazard is a string with one character per hour from ``start``: a digit 0-4 (Low..No travel), or
    ``-`` where the forecast has no value. The "all hazards" view is the per-hour maximum of the three, which
    the client computes (and treats as missing if any hazard is). ``hours`` is the last usable hour from
    ``usable_hours``; None means no hour is usable, so there are no points and ``available`` is False.
    """
    available = hours is not None
    times = [start + timedelta(hours=h) for h in range((hours or 0) + 1)] if available else []
    points = []
    for cell, (lat, lon) in cells.items():
        series = weather[cell]
        digits: dict[str, list[str]] = {"wind": [], "rain": [], "snow": []}
        for t in times:
            wind, rain, snow = (value_at(series, k, t) for k in ("wind", "rain", "snow"))
            digits["wind"].append(_digit(None if wind is None else load_adjusted_wind_risk(wind, load_lb)))
            digits["rain"].append(_digit(None if rain is None else rain_risk(rain)))
            digits["snow"].append(_digit(None if snow is None else snow_risk(snow)))
        if times:
            points.append({"lat": round(lat, 4), "lon": round(lon, 4), **{h: "".join(d) for h, d in digits.items()}})
    return {
        "start": start.isoformat(),
        "hours": hours or 0,
        "max_hours": FORECAST_SLIDER_HOURS,
        "available": available,
        "cell_miles": cell_miles,
        "legend": legend_ranges(),
        "points": points,
    }
