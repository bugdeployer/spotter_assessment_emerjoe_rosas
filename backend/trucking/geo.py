"""Small geodesy helpers: distances along a polyline, sampling, offsets."""

from __future__ import annotations

import math
from bisect import bisect_left

EARTH_RADIUS_MI = 3958.7613
METERS_PER_MILE = 1609.344

LonLat = tuple[float, float]
GridCell = tuple[float, float]  # a snapped (lat, lon): the centre of a forecast grid cell

# Checkpoint weather is looked up on a grid this fine (about 7 miles), finer than the forecast models' own resolution.
CHECKPOINT_GRID = 0.1  # degrees


def haversine_mi(a: LonLat, b: LonLat) -> float:
    """Great-circle distance in miles between two (lon, lat) points."""
    lon1, lat1, lon2, lat2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    h = math.sin((lat2 - lat1) / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin((lon2 - lon1) / 2) ** 2
    return 2 * EARTH_RADIUS_MI * math.asin(math.sqrt(h))


class Polyline:
    """A [lon, lat] polyline with cumulative distance, scaled to a known total length.

    Routing APIs report an authoritative total distance; haversine sums of the geometry
    differ slightly, so positions are expressed as a fraction of the geometry and scaled to
    ``total_mi``.
    """

    def __init__(self, coords: list[LonLat], total_mi: float | None = None):
        if len(coords) < 2:
            raise ValueError("polyline needs at least two points")
        self.coords = coords
        cum = [0.0]
        for a, b in zip(coords, coords[1:], strict=False):
            cum.append(cum[-1] + haversine_mi(a, b))
        self._raw_cum = cum
        raw_total = cum[-1]
        self.total_mi = total_mi if total_mi else raw_total
        self._scale = self.total_mi / raw_total if raw_total else 1.0

    def point_at(self, miles: float) -> LonLat:
        """Interpolated [lon, lat] at ``miles`` along the route (clamped to the ends)."""
        target = max(0.0, min(miles, self.total_mi)) / self._scale if self._scale else 0.0
        i = bisect_left(self._raw_cum, target)
        if i <= 0:
            return self.coords[0]
        if i >= len(self.coords):
            return self.coords[-1]
        seg = self._raw_cum[i] - self._raw_cum[i - 1]
        t = (target - self._raw_cum[i - 1]) / seg if seg else 0.0
        (x1, y1), (x2, y2) = self.coords[i - 1], self.coords[i]
        return (x1 + (x2 - x1) * t, y1 + (y2 - y1) * t)

    def bearing_at(self, miles: float) -> float:
        """Approximate heading in radians (0 = north, clockwise) near ``miles``."""
        a = self.point_at(max(0.0, miles - 2))
        b = self.point_at(min(self.total_mi, miles + 2))
        dx = (b[0] - a[0]) * math.cos(math.radians((a[1] + b[1]) / 2))
        dy = b[1] - a[1]
        return math.atan2(dx, dy)


def offset_point(p: LonLat, bearing: float, miles: float) -> LonLat:
    """Move ``miles`` from ``p`` along ``bearing`` (radians clockwise from north)."""
    lat_deg = miles * math.cos(bearing) / 69.0
    lon_deg = miles * math.sin(bearing) / (69.0 * max(0.1, math.cos(math.radians(p[1]))))
    return (p[0] + lon_deg, p[1] + lat_deg)


def decimate(coords: list[LonLat], min_gap_mi: float = 0.25) -> list[LonLat]:
    """Drop vertices closer than ``min_gap_mi`` to the last kept one (always keeps both ends).

    Display-only: the routing API returns metre-level detail the screen can't show, which
    bloats the response and slows map rendering. Analysis still uses the full geometry.
    """
    kept = [coords[0]]
    for p in coords[1:-1]:
        if haversine_mi(kept[-1], p) >= min_gap_mi:
            kept.append(p)
    kept.append(coords[-1])
    return kept


# A regular marker this close to the destination is the destination: no near-duplicate checkpoint.
_SAME_POINT_MI = 1e-6


def checkpoint_distances(total_mi: float, interval_mi: float) -> list[float]:
    """Mile markers 0, I, 2I, ... and the destination, exactly once (e.g. 60 mi every 25 -> 0, 25, 50, 60)."""
    marks = []
    i = 0
    while i * interval_mi < total_mi - _SAME_POINT_MI:
        marks.append(i * interval_mi)
        i += 1
    marks.append(total_mi)
    return marks


def overlap_fraction(sample: list[LonLat], other: Polyline, tolerance_mi: float = 2.0) -> float:
    """Fraction of ``sample`` points that lie within ``tolerance_mi`` of ``other``'s vertices.

    ``other`` is densified by sampling every mile so vertex distance approximates line distance.
    """
    n = max(2, int(other.total_mi))
    dense = [other.point_at(other.total_mi * i / n) for i in range(n + 1)]
    close = 0
    for p in sample:
        if any(haversine_mi(p, q) <= tolerance_mi for q in dense):
            close += 1
    return close / len(sample) if sample else 0.0


def snap(lat: float, lon: float, step: float = CHECKPOINT_GRID) -> GridCell:
    """Snap to the centre of a ``step``-degree grid cell, so nearby lookups share one forecast."""
    return (round(round(lat / step) * step, 3), round(round(lon / step) * step, 3))
