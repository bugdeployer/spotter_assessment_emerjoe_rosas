"""Choosing the route to recommend, and saying why.

Routes are compared on the brief's criteria, in its order: fewest Severe miles, fewest High miles, lowest
distance-weighted average risk, shortest travel time. Only routes whose every checkpoint has a forecast are
compared; a route with unknown stretches can't be ranked fairly against one without.

No Travel is not one of the brief's four criteria, so it doesn't change who wins the comparison. It does
decide whether the winner may be offered as a driving recommendation: a winner with any No Travel miles is
reported as the comparison winner only, and no route is recommended.
"""

from __future__ import annotations

from dataclasses import dataclass

# Recommendation states (the API's ``recommendation_status``).
RECOMMENDED = "recommended"
WINNER_HAS_NO_TRAVEL = "winner_has_no_travel"
ALL_ROUTES_NO_TRAVEL = "all_routes_no_travel"
NO_COMPLETE_FORECAST = "no_complete_forecast"

# A travel-time difference worth mentioning when it isn't what decided the comparison.
MEANINGFUL_DELAY_S = 5 * 60


@dataclass(frozen=True)
class RouteScore:
    """Unrounded totals for one route. Ranking uses these; the API shows rounded copies."""

    complete: bool  # every checkpoint has a forecast
    no_travel_mi: float
    severe_mi: float
    high_mi: float
    avg_risk: float | None  # None while part of the route has no forecast
    duration_s: float


@dataclass(frozen=True)
class Recommendation:
    status: str
    winner: int | None  # index of the comparison winner (best on the brief's criteria)
    recommended: int | None  # index of the route to drive, or None when none can be recommended
    explanation: str


def rank_key(s: RouteScore) -> tuple[float, float, float, float]:
    """Lower is better: Severe miles, High miles, average risk, travel time (all unrounded)."""
    assert s.avg_risk is not None, "only complete routes are ranked"
    return (s.severe_mi, s.high_mi, s.avg_risk, s.duration_s)


def recommend(scores: list[RouteScore], names: list[str]) -> Recommendation:
    """Compare the complete routes and decide what, if anything, to recommend."""
    comparable = [i for i, s in enumerate(scores) if s.complete]
    if not comparable:
        return Recommendation(NO_COMPLETE_FORECAST, None, None, _explain_incomplete(len(scores)))
    # Index breaks exact ties, so the routing service's own order decides and the result is deterministic.
    ranked = sorted(comparable, key=lambda i: (rank_key(scores[i]), i))
    winner = ranked[0]
    text = explain(scores, names, ranked)
    if all(s.no_travel_mi > 0 for s in scores):
        return Recommendation(ALL_ROUTES_NO_TRAVEL, winner, None, text)
    if scores[winner].no_travel_mi > 0:
        return Recommendation(WINNER_HAS_NO_TRAVEL, winner, None, text)
    return Recommendation(RECOMMENDED, winner, winner, text)


def _explain_incomplete(count: int) -> str:
    if count == 1:
        return "The forecast doesn't cover this route's whole trip, so it can't be rated."
    return "None of the routes has a forecast for its whole trip, so they can't be compared."


def _miles(x: float) -> str:
    """Miles for a sentence: one decimal at most (47.5, 25), two for tiny amounts (0.04)."""
    text = f"{x:.1f}" if x >= 0.1 or x == 0 else f"{x:.2f}"
    return text.removesuffix(".0")


def _duration(seconds: float) -> str:
    if seconds < 60:
        return f"{seconds:.0f} s"
    minutes = round(seconds / 60)
    return f"{minutes} min" if minutes < 60 else f"{minutes // 60} h {minutes % 60:02d} min"


def explain(scores: list[RouteScore], names: list[str], ranked: list[int]) -> str:
    """Why the winner won: the first criterion that separates it from the runner-up, plus any time cost.

    ``ranked`` holds the complete routes' indexes, best first.
    """
    w = ranked[0]
    if len(ranked) == 1:
        if len(scores) == 1:
            return "Only one route was available."
        return f"Only {names[w]} has a forecast for its whole trip; the other routes can't be compared."

    r = ranked[1]
    ws, rs = scores[w], scores[r]
    other = names[r]
    if ws.severe_mi != rs.severe_mi:
        reason = f"{_miles(rs.severe_mi - ws.severe_mi)} fewer Severe miles than {other}"
        reason += f" ({_miles(ws.severe_mi)} vs {_miles(rs.severe_mi)})"
    elif ws.high_mi != rs.high_mi:
        reason = f"Same Severe miles as {other}, and {_miles(rs.high_mi - ws.high_mi)} fewer High miles"
        reason += f" ({_miles(ws.high_mi)} vs {_miles(rs.high_mi)})"
    elif ws.avg_risk != rs.avg_risk:
        reason = (
            f"Same Severe and High miles as {other}, and a lower average risk"
            f" ({ws.avg_risk:.3f} vs {rs.avg_risk:.3f} of 4)"
        )
    elif ws.duration_s != rs.duration_s:
        return f"Same weather risk as {other}, and {_duration(rs.duration_s - ws.duration_s)} faster."
    else:
        return (
            f"Tied with {other} on Severe miles, High miles, average risk and travel time;"
            " listed first because the routing service returned it first."
        )

    fastest = min(ranked, key=lambda i: scores[i].duration_s)
    delay = ws.duration_s - scores[fastest].duration_s
    if delay >= MEANINGFUL_DELAY_S:
        reason += f"; {_duration(delay)} slower than {names[fastest]}"
    return reason + "."
