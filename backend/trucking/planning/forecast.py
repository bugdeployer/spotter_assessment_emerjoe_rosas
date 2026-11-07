"""Reading a forecast series at an arbitrary moment."""

from __future__ import annotations

import math
from datetime import datetime

from ..types import ForecastSeries

# An ETA this close to a whole hour counts as that hour, so float noise can't turn an exact lookup into an
# interpolation that also needs the next hour's sample.
_EXACT_HOUR = 1e-6


def value_at(series: ForecastSeries, key: str, when: datetime) -> float | None:
    """The hourly value at ``when``, or None when it is unknown.

    Unknown means ``when`` falls outside the series, or the samples it needs are missing. An exact hour
    needs only that hour's sample; anything between two hours is interpolated linearly and needs both.
    """
    values = series[key]
    hours = (when - series["start"]).total_seconds() / 3600
    nearest = round(hours)
    if abs(hours - nearest) < _EXACT_HOUR:
        return values[nearest] if 0 <= nearest < len(values) else None
    if hours < 0 or hours > len(values) - 1:
        return None
    i = math.floor(hours)
    a, b = values[i], values[i + 1]
    if a is None or b is None:
        return None
    frac = hours - i
    return a * (1 - frac) + b * frac


def weather_at(series: ForecastSeries, when: datetime) -> dict[str, float | None]:
    """Wind (mph), rain and snow (in/hr) at ``when``. A value is None where the forecast can't say."""
    return {
        "wind_mph": value_at(series, "wind", when),
        "rain_in_hr": value_at(series, "rain", when),
        "snow_in_hr": value_at(series, "snow", when),
    }


def is_known(wx: dict[str, float | None]) -> bool:
    """True when all three hazards have a value, so an overall risk can be rated."""
    return all(v is not None for v in wx.values())
