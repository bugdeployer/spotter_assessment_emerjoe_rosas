"""Names for the plain dicts that flow between the providers and the planning code."""

from __future__ import annotations

from datetime import datetime
from typing import TypedDict

from .geo import LonLat, Polyline


class ForecastSeries(TypedDict):
    """Hourly forecast for one grid cell. Index 0 is ``start``; units are mph and inches per hour.

    ``None`` marks an hour the provider returned no value for. It is kept distinct from 0.0 (calm / dry):
    a missing observation makes that hour's weather unknown, never Low.
    """

    start: datetime
    wind: list[float | None]
    rain: list[float | None]
    snow: list[float | None]


class RouteCandidate(TypedDict, total=False):
    """A route from the routing service. ``line`` is added once the geometry has been measured."""

    coords: list[LonLat]
    distance_mi: float
    duration_s: float
    roads: list[str]
    line: Polyline
