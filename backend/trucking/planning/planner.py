"""Planning a trip end to end: routes, forecasts, risk, recommendation and heatmap."""

from __future__ import annotations

from datetime import UTC, datetime

from .. import providers
from ..geo import LonLat
from .candidates import MAX_ROUTES, build_candidates
from .heatmap import build_heatmap, cell_miles, choose_cells, heatmap_start, usable_hours
from .recommendation import recommend
from .route_analysis import analyze_route, checkpoint_cells


def plan_trip(origin: LonLat, destination: LonLat, departure: datetime, load_lb: float, interval_mi: float) -> dict:
    """Everything the UI needs for one search. ``origin`` and ``destination`` are (lon, lat)."""
    departure = departure.astimezone(UTC)
    candidates = build_candidates(origin, destination)

    # One batch of forecasts serves both the checkpoints and the heatmap.
    heat_cells, grid = choose_cells(candidates)
    checkpoint_needs = {cell for c in candidates for cell in checkpoint_cells(c["line"], interval_mi)}
    weather = providers.fetch_weather(checkpoint_needs | set(heat_cells))

    analysed = [analyze_route(c, departure, load_lb, interval_mi, weather) for c in candidates]
    routes = [public for public, _ in analysed]
    names = [f"Route {chr(65 + i)}" for i in range(len(routes))]
    choice = recommend([score for _, score in analysed], names)
    for i, r in enumerate(routes):
        r["id"] = i
        r["name"] = names[i]
        r["recommended"] = i == choice.recommended
        r["comparison_winner"] = i == choice.winner

    start = heatmap_start(departure)
    hours = usable_hours(start, [weather[c] for c in heat_cells])
    return {
        "routes": routes,
        "routes_requested": MAX_ROUTES,
        "recommendation_status": choice.status,
        "recommended_id": choice.recommended,
        "comparison_winner_id": choice.winner,
        "explanation": choice.explanation,
        "heatmap": build_heatmap(heat_cells, weather, start, hours, load_lb, cell_miles(grid)),
    }
