from datetime import UTC, datetime, timedelta

from trucking.planning.heatmap import build_heatmap, usable_hours
from trucking.risk import legend_ranges

START = datetime(2026, 11, 7, 0, 0, tzinfo=UTC)


def series(wind=0.0, rain=0.0, snow=0.0, hours=10):
    return {
        "start": START,
        "wind": [wind] * hours,
        "rain": [rain] * hours,
        "snow": [snow] * hours,
    }


def heat(weather, load_lb=10_000, hours=3):
    cell = (30.0, -90.0)
    return build_heatmap({cell: (30.0, -90.0)}, {cell: weather}, START, hours, load_lb, 25)


def test_hazards_are_kept_separate_one_digit_per_hour():
    point = heat(series(wind=30, rain=0.6, snow=0.0))["points"][0]
    assert point["wind"] == "1111"  # 30 mph = Moderate
    assert point["rain"] == "3333"  # 0.6 in/hr = Severe
    assert point["snow"] == "0000"
    assert all(len(point[h]) == 4 for h in ("wind", "rain", "snow"))  # hours + 1


def test_wind_digits_include_the_load_rules():
    light = heat(series(wind=40), load_lb=10_000)["points"][0]["wind"]
    heavy = heat(series(wind=40), load_lb=45_000)["points"][0]["wind"]
    assert light == "2222"  # 35-44 mph is High for a light load
    assert heavy == "3333"  # ...and Severe over 40,000 lb


def test_response_carries_the_slider_length_and_spacing():
    data = heat(series(), hours=5)
    assert data["hours"] == 5 and data["max_hours"] == 48 and data["available"] is True
    assert data["cell_miles"] == 25
    assert data["start"] == START.isoformat()


def test_legend_ranges_come_from_the_thresholds():
    legend = legend_ranges()
    assert legend["wind"]["bands"] == ["<25", "25–34", "35–44", "45–54", "55+"]
    assert legend["rain"]["bands"] == ["<0.10", "0.10–0.25", "0.25–0.50", "0.50–1.00", ">1.00"]
    assert legend["snow"]["bands"] == ["<0.5", "0.5–1.0", "1.0–2.0", "2.0–3.0", ">3.0"]
    assert legend["wind"]["unit"] == "mph" and legend["rain"]["unit"] == "in/hr"


# --- forecast slider range


def hourly(hours_of_data: int, offset_h: int = 0, gaps: tuple[int, ...] = ()) -> dict:
    """A calm series with ``hours_of_data`` hourly samples starting ``offset_h`` hours before START."""
    values = [None if h in gaps else 0.0 for h in range(hours_of_data)]
    return {
        "start": START - timedelta(hours=offset_h),
        "wind": list(values),
        "rain": list(values),
        "snow": list(values),
    }


def test_slider_reaches_48_hours_when_the_forecast_covers_them():
    assert usable_hours(START, [hourly(168, offset_h=10)]) == 48


def test_shorter_coverage_caps_the_slider_at_the_last_usable_hour():
    # Samples for hours 0..31 after START only.
    assert usable_hours(START, [hourly(32)]) == 31


def test_range_stops_at_the_first_hour_no_point_can_show():
    assert usable_hours(START, [hourly(168, gaps=(20,))]) == 19
    # ...unless another point has that hour.
    assert usable_hours(START, [hourly(168, gaps=(20,)), hourly(168)]) == 48


def test_no_usable_hour_is_reported_as_none():
    assert usable_hours(START, [hourly(5, offset_h=10)]) is None  # forecast ended before departure
    assert usable_hours(START, []) is None


def test_missing_samples_are_marked_missing_not_low():
    weather = series(wind=30)
    weather["wind"][1] = None
    point = heat(weather, hours=2)["points"][0]
    assert point["wind"] == "1-1"
    assert point["rain"] == "000"


def test_unavailable_heatmap_has_no_points_and_says_so():
    cell = (30.0, -90.0)
    data = build_heatmap({cell: (30.0, -90.0)}, {cell: series()}, START, None, 10_000, 25)
    assert data["available"] is False and data["points"] == [] and data["hours"] == 0
