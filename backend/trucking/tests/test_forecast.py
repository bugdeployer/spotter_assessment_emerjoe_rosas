from datetime import UTC, datetime, timedelta

import pytest

from trucking.planning.forecast import value_at, weather_at
from trucking.providers import ProviderError
from trucking.providers.weather import parse_series

START = datetime(2026, 11, 7, 0, 0, tzinfo=UTC)


def series(wind):
    return {"start": START, "wind": wind, "rain": [0.0] * len(wind), "snow": [0.0] * len(wind)}


def at(h: float) -> datetime:
    return START + timedelta(hours=h)


def test_between_hours_is_interpolated():
    assert value_at(series([10.0, 20.0, 40.0]), "wind", at(1.25)) == pytest.approx(25.0)


def test_exact_hour_needs_only_that_hours_sample():
    s = series([10.0, 20.0, None])
    assert value_at(s, "wind", at(1)) == 20.0  # next hour missing doesn't matter
    assert value_at(s, "wind", at(2)) is None


def test_interpolating_across_a_missing_sample_is_unknown():
    assert value_at(series([10.0, None, 30.0]), "wind", at(0.5)) is None


def test_missing_observation_is_not_zero():
    wx = weather_at(series([None, None]), at(0))
    assert wx["wind_mph"] is None and wx["rain_in_hr"] == 0.0


def test_eta_outside_the_forecast_is_unknown():
    s = series([10.0, 20.0, 30.0])
    assert value_at(s, "wind", at(-0.5)) is None
    assert value_at(s, "wind", at(2.5)) is None  # expired: past the last sample
    assert value_at(s, "wind", at(5)) is None


def payload(**hourly_over):
    hourly = {
        "time": ["2026-11-07T00:00", "2026-11-07T01:00"],
        "wind_speed_10m": [5.0, None],
        "rain": [0.0, 0.1],
        "snowfall": [0, 0],
    }
    return {"hourly": {**hourly, **hourly_over}}


def test_parse_keeps_nulls_as_missing():
    s = parse_series(payload())
    assert s["start"] == START and s["wind"] == [5.0, None] and s["snow"] == [0.0, 0.0]


@pytest.mark.parametrize(
    "bad",
    [
        None,
        {"hourly": None},
        payload(rain=[0.0]),  # wrong length
        payload(wind_speed_10m=["fast", 1.0]),  # not a number
        payload(time=[]),
        payload(time=["2026-11-07T00:00", "2026-11-07T03:00"]),  # not hourly
        payload(snowfall=None),
    ],
)
def test_malformed_weather_payloads_are_provider_errors(bad):
    with pytest.raises(ProviderError):
        parse_series(bad)
