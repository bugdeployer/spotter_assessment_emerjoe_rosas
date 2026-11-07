"""Choosing up to three distinct routes between two places."""

from __future__ import annotations

import math

from .. import providers
from ..geo import LonLat, Polyline, offset_point, overlap_fraction
from ..types import RouteCandidate

MAX_ROUTES = 3
DUPLICATE_OVERLAP = 0.9  # a candidate sharing more of its length than this with a kept route is dropped
DETOUR_FACTORS = (0.18, 0.3)  # how far (as a fraction of the route's length) via-point detours swing out


def build_candidates(origin: LonLat, destination: LonLat) -> list[RouteCandidate]:
    """Up to three distinct routes: OSRM alternatives, topped up with via-point detours."""
    found: list[RouteCandidate] = []

    def add(route: RouteCandidate | None) -> None:
        """Keep ``route`` unless we have enough routes or it mostly retraces one we already kept."""
        if not route or len(found) >= MAX_ROUTES:
            return
        line = Polyline(route["coords"], route["distance_mi"])
        route["line"] = line
        sample = [line.point_at(line.total_mi * i / 20) for i in range(21)]
        if any(overlap_fraction(sample, other["line"]) > DUPLICATE_OVERLAP for other in found):
            return
        found.append(route)

    for r in providers.fetch_routes(origin, destination):
        add(r)
    if not found:
        raise providers.ProviderError("No route found between these places")

    if len(found) < MAX_ROUTES:
        base = found[0]["line"]
        mid = base.total_mi / 2
        centre = base.point_at(mid)
        bearing = base.bearing_at(mid)
        for factor in DETOUR_FACTORS:
            for side in (math.pi / 2, -math.pi / 2):
                if len(found) >= MAX_ROUTES:
                    break
                via = offset_point(centre, bearing + side, base.total_mi * factor)
                add(providers.fetch_route_via(origin, via, destination))
    return found
