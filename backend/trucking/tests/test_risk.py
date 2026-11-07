import pytest

from trucking.risk import Risk, classify, load_adjusted_wind_risk, rain_risk, snow_risk, wind_risk


@pytest.mark.parametrize(
    "mph,expected",
    [
        (0, Risk.LOW),
        (24.9, Risk.LOW),
        (25, Risk.MODERATE),
        (34.9, Risk.MODERATE),
        (35, Risk.HIGH),
        (44.9, Risk.HIGH),
        (45, Risk.SEVERE),
        (54.9, Risk.SEVERE),
        (55, Risk.NO_TRAVEL),
        (80, Risk.NO_TRAVEL),
    ],
)
def test_wind_bands(mph, expected):
    assert wind_risk(mph) == expected


@pytest.mark.parametrize(
    "rate,expected",
    [
        (0.09, Risk.LOW),
        (0.10, Risk.MODERATE),
        (0.25, Risk.HIGH),
        (0.50, Risk.SEVERE),
        (1.00, Risk.SEVERE),
        (1.01, Risk.NO_TRAVEL),
    ],
)
def test_rain_bands(rate, expected):
    assert rain_risk(rate) == expected


@pytest.mark.parametrize(
    "rate,expected",
    [
        (0.4, Risk.LOW),
        (0.5, Risk.MODERATE),
        (1.0, Risk.HIGH),
        (2.0, Risk.SEVERE),
        (3.0, Risk.SEVERE),
        (3.1, Risk.NO_TRAVEL),
    ],
)
def test_snow_bands(rate, expected):
    assert snow_risk(rate) == expected


def test_55_mph_no_travel_for_any_load():
    assert load_adjusted_wind_risk(55, 0) == Risk.NO_TRAVEL


def test_45_to_54_heavy_load_no_travel():
    assert load_adjusted_wind_risk(50, 30_001) == Risk.NO_TRAVEL
    assert load_adjusted_wind_risk(50, 30_000) == Risk.SEVERE  # rule is strictly > 30,000


def test_35_to_44_very_heavy_load_severe():
    assert load_adjusted_wind_risk(40, 40_001) == Risk.SEVERE
    assert load_adjusted_wind_risk(40, 40_000) == Risk.HIGH  # rule is strictly > 40,000


def test_load_rules_do_not_affect_light_wind():
    assert load_adjusted_wind_risk(30, 80_000) == Risk.MODERATE


def test_overall_is_worst_hazard():
    level, parts = classify(wind_mph=10, rain_in_hr=0.6, snow_in_hr=0.0, load_lb=10_000)
    assert level == Risk.SEVERE
    assert parts["rain"] == Risk.SEVERE and parts["wind"] == Risk.LOW
