"""Driving routes (OSRM)."""

from __future__ import annotations

from collections import defaultdict

from django.conf import settings

from ..geo import METERS_PER_MILE, LonLat
from ..types import RouteCandidate
from .http import ProviderError, get_json


def _parse_route(r: dict) -> RouteCandidate:
    """One OSRM route. Malformed payloads raise ProviderError instead of a KeyError deep in the planner."""
    try:
        coords = [(float(c[0]), float(c[1])) for c in r["geometry"]["coordinates"]]
        distance_mi = float(r["distance"]) / METERS_PER_MILE
        duration_s = float(r["duration"])
        # Summarise by road: total distance per ref/name, keep the longest few.
        by_road: dict[str, float] = defaultdict(float)
        for leg in r.get("legs", []):
            for step in leg.get("steps", []):
                road = step.get("ref") or step.get("name")
                if road:
                    by_road[road.split(";")[0]] += float(step["distance"])
    except (KeyError, TypeError, ValueError, IndexError):
        raise ProviderError("Routing service returned an unexpected response") from None
    if len(coords) < 2 or distance_mi <= 0 or duration_s <= 0:
        raise ProviderError("Routing service returned an unexpected response")
    top = sorted(by_road.items(), key=lambda kv: kv[1], reverse=True)[:3]
    return {"coords": coords, "distance_mi": distance_mi, "duration_s": duration_s, "roads": [name for name, _ in top]}


def _routes(points: list[LonLat], alternatives: int = 0) -> list[RouteCandidate]:
    coords = ";".join(f"{lon:.6f},{lat:.6f}" for lon, lat in points)
    data = get_json(
        f"{settings.OSRM_URL}/route/v1/driving/{coords}",
        {
            "alternatives": alternatives if alternatives else "false",
            "overview": "full",
            "geometries": "geojson",
            "steps": "true",
        },
    )
    if not isinstance(data, dict):
        raise ProviderError("Routing service returned an unexpected response")
    if data.get("code") != "Ok":
        raise ProviderError(f"No route found ({data.get('code', 'unknown')})")
    routes = data.get("routes")
    if not isinstance(routes, list):
        raise ProviderError("Routing service returned an unexpected response")
    return [_parse_route(r) for r in routes]


def fetch_routes(origin: LonLat, destination: LonLat) -> list[RouteCandidate]:
    """Primary route plus OSRM's alternatives (may be fewer than requested)."""
    return _routes([origin, destination], alternatives=3)


def fetch_route_via(origin: LonLat, via: LonLat, destination: LonLat) -> RouteCandidate | None:
    """A route forced through ``via``, or None if the service can't make one."""
    try:
        routes = _routes([origin, via, destination])
    except ProviderError:
        return None
    return routes[0] if routes else None
