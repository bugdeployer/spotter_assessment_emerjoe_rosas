"""Hourly forecasts (Open-Meteo), fetched in parallel batches and cached."""

from __future__ import annotations

import math
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta

from django.conf import settings
from django.core.cache import cache

from ..geo import GridCell
from ..types import ForecastSeries
from .http import ProviderError, get_json

HOURLY_VARS = "wind_speed_10m,rain,snowfall"
FORECAST_DAYS = 7  # departure window (4 days) + a multi-day trip + slider range; keeps API cost low
CHUNK_SIZE = 25  # locations per request
CACHE_SECONDS = 30 * 60
# Open-Meteo field -> our series key.
FIELDS = {"wind_speed_10m": "wind", "rain": "rain", "snowfall": "snow"}


def _value(v: object) -> float | None:
    """A forecast value, or None when the provider has no observation for that hour.

    Missing values stay None (unknown), never 0.0, so a gap in the model output can't pass for calm weather.
    """
    if v is None:
        return None
    if isinstance(v, bool) or not isinstance(v, int | float) or not math.isfinite(v):
        raise ProviderError("Weather service returned an unexpected response")
    return float(v)


def parse_series(res: object) -> ForecastSeries:
    """Validate one location's payload and turn it into a series. Malformed payloads raise ProviderError."""
    bad = ProviderError("Weather service returned an unexpected response")
    if not isinstance(res, dict) or not isinstance(res.get("hourly"), dict):
        raise bad
    hourly = res["hourly"]
    times = hourly.get("time")
    if not isinstance(times, list) or not times:
        raise bad
    try:
        start = datetime.fromisoformat(times[0]).replace(tzinfo=UTC)
        last = datetime.fromisoformat(times[-1]).replace(tzinfo=UTC)
    except (TypeError, ValueError):
        raise bad from None
    # The series is indexed by hour from `start`, so the timestamps must be exactly hourly.
    if last - start != timedelta(hours=len(times) - 1):
        raise bad
    series: dict = {"start": start}
    for field, key in FIELDS.items():
        values = hourly.get(field)
        if not isinstance(values, list) or len(values) != len(times):
            raise bad
        series[key] = [_value(v) for v in values]
    return series  # type: ignore[return-value]


def _fetch_chunk(cells: list[GridCell]) -> dict[GridCell, ForecastSeries]:
    data = get_json(
        settings.OPEN_METEO_URL,
        {
            "latitude": ",".join(str(c[0]) for c in cells),
            "longitude": ",".join(str(c[1]) for c in cells),
            "hourly": HOURLY_VARS,
            "wind_speed_unit": "mph",
            "precipitation_unit": "inch",
            "timezone": "GMT",
            "forecast_days": FORECAST_DAYS,
        },
        timeout=60,
    )
    results = data if isinstance(data, list) else [data]
    if len(results) != len(cells):
        raise ProviderError("Weather service returned an unexpected response")
    return {cell: parse_series(res) for cell, res in zip(cells, results, strict=True)}


def fetch_weather(cells: set[GridCell]) -> dict[GridCell, ForecastSeries]:
    """Hourly forecast series for each snapped (lat, lon) cell, cached for 30 minutes."""
    result: dict[GridCell, ForecastSeries] = {}
    missing: list[GridCell] = []
    for cell in cells:
        hit = cache.get(f"wx:{cell[0]}:{cell[1]}")
        if hit is not None:
            result[cell] = hit
        else:
            missing.append(cell)
    chunks = [missing[i : i + CHUNK_SIZE] for i in range(0, len(missing), CHUNK_SIZE)]
    if chunks:
        with ThreadPoolExecutor(max_workers=4) as pool:
            for fetched in pool.map(_fetch_chunk, chunks):
                for cell, series in fetched.items():
                    cache.set(f"wx:{cell[0]}:{cell[1]}", series, CACHE_SECONDS)
                    result[cell] = series
    return result
