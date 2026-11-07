"""Getting up to three distinct routes, and failing cleanly when there are none."""

import pytest

from trucking import providers
from trucking.planning import candidates
from trucking.providers import ProviderError, routing

ORIGIN, DESTINATION = (-100.0, 40.0), (-100.0, 41.0)


def osrm_route(lon: float, miles: float = 69.0, seconds: float = 4000.0) -> dict:
    return {
        "geometry": {"coordinates": [[lon, 40.0], [lon, 41.0]]},
        "distance": miles * 1609.344,
        "duration": seconds,
        "legs": [{"steps": [{"ref": "US 83", "distance": miles * 1609.344}]}],
    }


def parsed(lon: float) -> dict:
    return routing._parse_route(osrm_route(lon))


def test_alternatives_are_topped_up_with_detours(monkeypatch):
    monkeypatch.setattr(providers, "fetch_routes", lambda o, d: [parsed(-100.0)])
    detours = iter([parsed(-101.0), parsed(-99.0)])
    monkeypatch.setattr(providers, "fetch_route_via", lambda o, v, d: next(detours))
    found = candidates.build_candidates(ORIGIN, DESTINATION)
    assert [r["coords"][0][0] for r in found] == [-100.0, -101.0, -99.0]


def test_duplicate_detours_leave_fewer_than_three_routes(monkeypatch):
    monkeypatch.setattr(providers, "fetch_routes", lambda o, d: [parsed(-100.0)])
    monkeypatch.setattr(providers, "fetch_route_via", lambda o, v, d: parsed(-100.0))  # same road every time
    assert len(candidates.build_candidates(ORIGIN, DESTINATION)) == 1


def test_no_routes_from_the_provider_is_a_provider_error(monkeypatch):
    monkeypatch.setattr(providers, "fetch_routes", lambda o, d: [])
    with pytest.raises(ProviderError, match="No route found"):
        candidates.build_candidates(ORIGIN, DESTINATION)


def test_empty_osrm_response_parses_to_no_routes(monkeypatch):
    monkeypatch.setattr(routing, "get_json", lambda url, params: {"code": "Ok", "routes": []})
    assert routing.fetch_routes(ORIGIN, DESTINATION) == []
    assert routing.fetch_route_via(ORIGIN, (-99.5, 40.5), DESTINATION) is None


@pytest.mark.parametrize(
    "payload",
    [
        [],
        {"code": "Ok"},
        {"code": "Ok", "routes": [{"distance": 1}]},
        {"code": "Ok", "routes": [{**osrm_route(-100.0), "duration": "slow"}]},
    ],
)
def test_malformed_routing_payloads_are_provider_errors(monkeypatch, payload):
    monkeypatch.setattr(routing, "get_json", lambda url, params: payload)
    with pytest.raises(ProviderError):
        routing.fetch_routes(ORIGIN, DESTINATION)
