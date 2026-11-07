"""Ranking follows the brief literally: Severe miles, High miles, average risk, travel time (unrounded)."""

from trucking.planning.recommendation import (
    ALL_ROUTES_NO_TRAVEL,
    NO_COMPLETE_FORECAST,
    RECOMMENDED,
    WINNER_HAS_NO_TRAVEL,
    RouteScore,
    recommend,
)
from trucking.planning.route_analysis import analyze_route

from .fixtures import DEPARTURE, EveryCell, forecast, straight_route

NAMES = ["Route A", "Route B", "Route C"]


def score(severe=0.0, high=0.0, avg=0.0, seconds=36_000.0, no_travel=0.0, complete=True):
    return RouteScore(complete, no_travel, severe, high, avg if complete else None, seconds)


def analysed_score(miles, truck_seconds, wind, load_lb=20_000, interval=25):
    """Score a real route through the planner's own analysis."""
    _, s = analyze_route(straight_route(miles, truck_seconds), DEPARTURE, load_lb, interval, EveryCell(forecast(wind)))
    return s


def test_nine_seconds_decide_between_equal_risk_routes():
    # Same calm weather; 6010 s vs 6001 s. Rounding to minutes would call this a tie.
    calm = [5.0] * 24
    slow, fast = analysed_score(100, 6010, calm), analysed_score(100, 6001, calm)
    choice = recommend([slow, fast], NAMES)
    assert choice.winner == 1 and choice.recommended == 1 and choice.status == RECOMMENDED
    assert choice.explanation == "Same weather risk as Route A, and 9 s faster."


def test_lower_average_risk_beats_a_faster_route():
    # 0.304 vs 0.301: rounding to two decimals would tie them and hand the win to the faster route.
    faster_riskier = score(avg=0.304, seconds=20_000)
    slower_calmer = score(avg=0.301, seconds=21_000)
    choice = recommend([faster_riskier, slower_calmer], NAMES)
    assert choice.winner == 1
    assert choice.explanation == (
        "Same Severe and High miles as Route A, and a lower average risk (0.301 vs 0.304 of 4); "
        "17 min slower than Route A."
    )


def test_fewest_severe_miles_comes_first():
    choice = recommend(
        [score(severe=10, avg=0.1, seconds=3_600), score(severe=5, high=90, avg=1.5, seconds=9_000)], NAMES
    )
    assert choice.winner == 1
    assert choice.explanation.startswith("5 fewer Severe miles than Route A (5 vs 10)")
    assert "1 h 30 min slower than Route A" in choice.explanation


def test_high_miles_break_a_severe_tie():
    choice = recommend([score(high=20), score(high=10, seconds=36_120)], NAMES)
    assert choice.winner == 1
    # Two minutes slower is not worth mentioning.
    assert choice.explanation == "Same Severe miles as Route A, and 10 fewer High miles (10 vs 20)."


def test_analysis_feeds_real_severe_miles_into_the_ranking():
    # 50 mi at 50 mph wind: Severe for a 20,000 lb load. The calm route wins.
    stormy, calm = analysed_score(50, 3_600, [50.0] * 5), analysed_score(50, 3_600, [10.0] * 5)
    assert stormy.severe_mi == 50 and calm.severe_mi == 0
    assert recommend([stormy, calm], NAMES).winner == 1


# --- No Travel policy: not a ranking criterion, but it blocks the driving recommendation


def test_winner_with_no_travel_is_reported_but_not_recommended():
    # Literal order: B has fewer Severe miles, so it wins the comparison despite its No Travel miles.
    a = score(severe=30, avg=1.2)
    b = score(severe=0, no_travel=5, avg=0.4)
    choice = recommend([a, b], NAMES)
    assert choice.status == WINNER_HAS_NO_TRAVEL
    assert choice.winner == 1 and choice.recommended is None


def test_all_routes_with_no_travel_is_explicit():
    choice = recommend([score(no_travel=5, avg=0.5), score(no_travel=1, severe=4, avg=0.6)], NAMES)
    assert choice.status == ALL_ROUTES_NO_TRAVEL
    assert choice.winner == 0 and choice.recommended is None


def test_no_travel_from_the_heavy_load_wind_rule():
    # 48 mph: Severe for 30,000 lb, No Travel for 30,001 lb (strictly over).
    at_limit = analysed_score(50, 3_600, [48.0] * 5, load_lb=30_000)
    over = analysed_score(50, 3_600, [48.0] * 5, load_lb=30_001)
    assert at_limit.no_travel_mi == 0 and at_limit.severe_mi == 50
    assert over.no_travel_mi == 50 and over.severe_mi == 0


# --- coverage


def test_incomplete_routes_are_not_compared():
    incomplete = score(complete=False)  # would otherwise look perfect
    complete = score(severe=12, avg=0.9)
    choice = recommend([incomplete, complete], NAMES)
    assert choice.winner == 1 and choice.recommended == 1
    assert choice.explanation == "Only Route B has a forecast for its whole trip; the other routes can't be compared."


def test_all_routes_incomplete_means_no_recommendation():
    choice = recommend([score(complete=False), score(complete=False)], NAMES)
    assert choice.status == NO_COMPLETE_FORECAST
    assert choice.winner is None and choice.recommended is None
    assert "can't be compared" in choice.explanation


# --- explanations that invent nothing


def test_single_route():
    choice = recommend([score()], NAMES)
    assert choice.winner == 0 and choice.explanation == "Only one route was available."


def test_exact_tie_says_so():
    choice = recommend([score(severe=3, avg=0.2), score(severe=3, avg=0.2)], NAMES)
    assert choice.winner == 0
    assert choice.explanation.startswith("Tied with Route B on Severe miles, High miles, average risk and travel time")
