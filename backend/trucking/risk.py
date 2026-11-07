"""Weather risk classification. Pure functions, no I/O.

Thresholds come from the assessment brief. Band boundaries are lower-inclusive,
e.g. wind 25.0 mph is Moderate, 35.0 is High, 45.0 is Severe, 55.0 is No Travel.
"""

from __future__ import annotations

from enum import IntEnum


class Risk(IntEnum):
    """Risk levels in increasing severity; the integer value is what gets averaged and ranked."""

    LOW = 0
    MODERATE = 1
    HIGH = 2
    SEVERE = 3
    NO_TRAVEL = 4

    @property
    def label(self) -> str:
        """Lower-case name used in the API, e.g. ``no_travel``."""
        return self.name.lower()


# Lower bound of each band above Low: (Moderate, High, Severe, No Travel).
WIND_MPH = (25.0, 35.0, 45.0, 55.0)
RAIN_IN_HR = (0.10, 0.25, 0.50, 1.00)
SNOW_IN_HR = (0.5, 1.0, 2.0, 3.0)

HEAVY_LOAD_LB = 30_000
VERY_HEAVY_LOAD_LB = 40_000


def _band(value: float, bounds: tuple[float, float, float, float], *, upper_exclusive_top: bool = False) -> Risk:
    """Map a value onto a Risk using ascending lower bounds.

    Rain and snow are specified as ``>1.00`` / ``>3.0`` for No Travel (strictly greater),
    while wind is ``>= 55``. ``upper_exclusive_top`` makes the top bound strict.
    """
    level = Risk.LOW
    for i, bound in enumerate(bounds, start=1):
        is_top = i == len(bounds)
        passed = value > bound if (is_top and upper_exclusive_top) else value >= bound
        if passed:
            level = Risk(i)
    return level


def wind_risk(mph: float) -> Risk:
    """Risk from wind speed alone (mph), ignoring the load."""
    return _band(mph, WIND_MPH)


def rain_risk(in_per_hr: float) -> Risk:
    """Risk from rainfall rate (inches per hour). No Travel is strictly above 1.00."""
    return _band(in_per_hr, RAIN_IN_HR, upper_exclusive_top=True)


def snow_risk(in_per_hr: float) -> Risk:
    """Risk from snowfall rate (inches per hour). No Travel is strictly above 3.0."""
    return _band(in_per_hr, SNOW_IN_HR, upper_exclusive_top=True)


def load_adjusted_wind_risk(mph: float, load_lb: float) -> Risk:
    """Wind band after applying the load rules.

    * >= 55 mph: No Travel for any load (already the base band).
    * 45-54 mph and load > 30,000 lb: No Travel.
    * 35-44 mph and load > 40,000 lb: Severe.
    """
    base = wind_risk(mph)
    if base == Risk.SEVERE and load_lb > HEAVY_LOAD_LB:
        return Risk.NO_TRAVEL
    if base == Risk.HIGH and load_lb > VERY_HEAVY_LOAD_LB:
        return Risk.SEVERE
    return base


def classify(wind_mph: float, rain_in_hr: float, snow_in_hr: float, load_lb: float) -> tuple[Risk, dict[str, Risk]]:
    """Overall risk is the worst of the three hazards. Also returns the per-hazard levels."""
    parts = {
        "wind": load_adjusted_wind_risk(wind_mph, load_lb),
        "rain": rain_risk(rain_in_hr),
        "snow": snow_risk(snow_in_hr),
    }
    return max(parts.values()), parts


def legend_ranges() -> dict[str, dict]:
    """Human-readable band ranges per hazard, generated from the same thresholds the rules use.

    The map legend shows these when a single hazard is selected, so the numbers a driver reads can
    never drift from the numbers that decide the colours. Order is Low, Moderate, High, Severe, No travel.
    """
    w = [int(x) for x in WIND_MPH]
    wind = [f"<{w[0]}", f"{w[0]}–{w[1] - 1}", f"{w[1]}–{w[2] - 1}", f"{w[2]}–{w[3] - 1}", f"{w[3]}+"]
    r = [f"{x:.2f}" for x in RAIN_IN_HR]
    rain = [f"<{r[0]}", f"{r[0]}–{r[1]}", f"{r[1]}–{r[2]}", f"{r[2]}–{r[3]}", f">{r[3]}"]
    s = [f"{x:.1f}" for x in SNOW_IN_HR]
    snow = [f"<{s[0]}", f"{s[0]}–{s[1]}", f"{s[1]}–{s[2]}", f"{s[2]}–{s[3]}", f">{s[3]}"]
    return {
        "wind": {"unit": "mph", "bands": wind},
        "rain": {"unit": "in/hr", "bands": rain},
        "snow": {"unit": "in/hr", "bands": snow},
    }
