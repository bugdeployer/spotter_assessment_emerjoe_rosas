"""Checkpoints, ETAs and forecast coverage for a single route."""

from trucking.planning.route_analysis import analyze_route

from .fixtures import DEPARTURE, EveryCell, forecast, hours, straight_route


def analyse(wind, miles=60, truck_seconds=3 * 3600, interval=25, load_lb=20_000):
    return analyze_route(straight_route(miles, truck_seconds), DEPARTURE, load_lb, interval, EveryCell(forecast(wind)))


def test_null_weather_is_unknown_not_low():
    wind = [10.0, None, 10.0, 10.0, 10.0]  # no observation at 1 h, which mile 25 (1.25 h) needs
    public, s = analyse(wind)
    cp = public["checkpoints"][1]
    assert cp["mile"] == 25 and cp["risk"] is None and cp["forecast_available"] is False
    assert cp["weather"]["wind_mph"] is None
    assert public["unknown_miles"] == 25.0
    assert public["miles_by_risk"]["low"] == 35.0  # the other three stretches only
    assert public["forecast_complete"] is False and public["avg_risk"] is None
    assert s.complete is False and s.avg_risk is None


def test_expired_forecast_makes_the_end_of_the_trip_unknown():
    # Forecast stops after 2 h; the truck reaches mile 50 at 2.5 h and the destination at 3 h.
    public, s = analyse([10.0, 10.0, 10.0])
    assert [cp["risk"] for cp in public["checkpoints"]] == ["low", "low", None, None]
    assert public["unknown_miles"] == 22.5  # 37.5 -> 60
    assert public["max_risk"] == "low" and s.complete is False


def test_complete_forecast_counts_every_mile():
    public, s = analyse([10.0] * 6)
    assert public["forecast_complete"] is True and public["unknown_miles"] == 0
    assert sum(public["miles_by_risk"].values()) == 60
    assert s.avg_risk == 0.0


def test_one_destination_checkpoint_when_the_route_ends_on_a_marker():
    public, _ = analyse([10.0] * 6, miles=50)
    assert [cp["mile"] for cp in public["checkpoints"]] == [0, 25, 50]


def test_checkpoint_spacing_follows_the_interval():
    for interval, marks in [(10, [0, 10, 20, 30, 40, 50, 60]), (50, [0, 50, 60])]:
        public, _ = analyse([10.0] * 6, interval=interval)
        assert [cp["mile"] for cp in public["checkpoints"]] == marks


def test_etas_follow_the_trucks_progress():
    public, _ = analyse([10.0] * 6)
    expected = [DEPARTURE + hours(h) for h in (0, 1.25, 2.5, 3)]
    assert [cp["eta"] for cp in public["checkpoints"]] == [t.isoformat() for t in expected]


# --- trips longer than the 48-hour slider: scoring follows each checkpoint's own ETA


def long_trip(wind):
    # 1,200 mi in 60 h with a checkpoint every 50 mi: mile 1,100 is reached at exactly +55 h.
    public, _ = analyse(wind, miles=1200, truck_seconds=60 * 3600, interval=50)
    return {cp["mile"]: cp for cp in public["checkpoints"]}, public


def test_checkpoint_past_48_hours_is_scored_from_its_eta():
    wind = [10.0] * 168
    wind[55] = 50.0  # Severe for a 20,000 lb load, only at +55 h
    cps, public = long_trip(wind)
    assert cps[1100]["eta"] == (DEPARTURE + hours(55)).isoformat()
    assert cps[1100]["risk"] == "severe" and cps[1100]["weather"]["wind_mph"] == 50.0
    assert public["forecast_complete"] is True


def test_checkpoint_past_the_forecast_is_unknown_not_low():
    cps, public = long_trip([10.0] * 49)  # forecast ends at +48 h
    assert cps[1100]["risk"] is None and cps[1100]["forecast_available"] is False
    assert cps[950]["risk"] == "low"  # +47.5 h, still covered
    # Stretches from mile 975 on (checkpoints at +48.75 h and later) are unknown, not Low.
    assert public["unknown_miles"] == 225.0
    assert public["miles_by_risk"]["low"] == 975.0
    assert public["forecast_complete"] is False
