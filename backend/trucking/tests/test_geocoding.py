"""Place search through Geoapify, with the provider faked at the HTTP layer.

Every failure case also checks that neither the key nor the upstream URL reaches the client or the logs.
"""

import logging

import pytest
import requests
from rest_framework.test import APIClient

from trucking.providers import geocoding

KEY = "test-geoapify-key-not-real-123"
UPSTREAM = "api.geoapify.com"


class FakeResponse:
    def __init__(self, status=200, body=None, raises=None):
        self.status_code = status
        self._body = body
        self._raises = raises

    def json(self):
        if self._raises:
            raise self._raises
        return self._body


@pytest.fixture(autouse=True)
def configured(settings):
    settings.GEOAPIFY_API_KEY = KEY
    settings.GEOAPIFY_AUTOCOMPLETE_URL = f"https://{UPSTREAM}/v1/geocode/autocomplete"


@pytest.fixture
def upstream(monkeypatch):
    """Replace the HTTP call; record what was asked. Set ``.reply`` to a FakeResponse or an exception."""

    class Upstream:
        reply = FakeResponse(body={"results": []})
        calls: list = []

    def fake_get(url, params=None, headers=None, timeout=None):
        Upstream.calls.append({"url": url, "params": params, "timeout": timeout})
        if isinstance(Upstream.reply, Exception):
            raise Upstream.reply
        return Upstream.reply

    Upstream.calls = []
    monkeypatch.setattr(geocoding.requests, "get", fake_get)
    return Upstream


def search(q="denver"):
    return APIClient().get("/api/geocode", {"q": q})


def assert_nothing_leaks(res, caplog):
    text = res.content.decode() + caplog.text
    assert KEY not in text
    assert UPSTREAM not in text and "apiKey" not in text


def test_results_are_mapped_to_label_lat_lon(upstream):
    upstream.reply = FakeResponse(
        body={
            "results": [
                {"formatted": "Denver, CO, United States of America", "lat": 39.7392, "lon": -104.9849, "rank": {}},
                {"formatted": "Denver, PA, United States of America", "lat": 40.2334, "lon": -76.1374},
            ],
            "query": {"text": "denver"},
        }
    )
    res = search("denver")
    assert res.status_code == 200
    assert res.json() == [
        {"label": "Denver, CO, United States of America", "lat": 39.7392, "lon": -104.9849},
        {"label": "Denver, PA, United States of America", "lat": 40.2334, "lon": -76.1374},
    ]
    params = upstream.calls[0]["params"]
    assert params["text"] == "denver" and params["apiKey"] == KEY
    assert params["filter"] == "countrycode:us,ca,mx" and params["limit"] == 5 and params["format"] == "json"
    assert upstream.calls[0]["timeout"] == 5


def test_never_more_than_five_results(upstream):
    upstream.reply = FakeResponse(
        body={"results": [{"formatted": f"Place {i}", "lat": 40, "lon": -100} for i in range(8)]}
    )
    assert len(search("place").json()) == 5


def test_repeat_queries_are_served_from_the_cache(upstream):
    upstream.reply = FakeResponse(body={"results": [{"formatted": "Salt Lake City, UT", "lat": 40.76, "lon": -111.89}]})
    search("Salt Lake")
    search("  salt   LAKE ")
    assert len(upstream.calls) == 1


def test_empty_results(upstream):
    upstream.reply = FakeResponse(body={"results": []})
    res = search("zzzzqqq")
    assert res.status_code == 200 and res.json() == []


def test_missing_key_is_a_clear_503(settings, upstream, caplog):
    settings.GEOAPIFY_API_KEY = ""
    res = search()
    assert res.status_code == 503
    assert res.json() == {"detail": "Place search is not configured on this server"}
    assert upstream.calls == []  # no request goes out without a key
    assert_nothing_leaks(res, caplog)


@pytest.mark.parametrize(
    "reply, detail",
    [
        (FakeResponse(status=429, body={"message": "Quota exceeded"}), "Place search is busy right now"),
        (FakeResponse(status=401, body={"message": f"Invalid apiKey {KEY}"}), "Place search is unavailable"),
        (FakeResponse(status=500, body={}), "Place search is unavailable"),
        (
            requests.Timeout(f"Read timed out: https://{UPSTREAM}/v1/geocode/autocomplete?apiKey={KEY}"),
            "Place search timed out",
        ),
        (
            requests.ConnectionError(f"Max retries exceeded with url: /v1/geocode/autocomplete?apiKey={KEY}"),
            "Place search is unavailable",
        ),
        (FakeResponse(body={"features": []}), "Place search returned an unexpected response"),
        (
            FakeResponse(body={"results": [{"formatted": "X", "lat": "north", "lon": 1}]}),
            "Place search returned an unexpected response",
        ),
        (FakeResponse(raises=ValueError("not json")), "Place search returned an unexpected response"),
    ],
)
def test_upstream_failures_are_bounded_and_leak_nothing(upstream, caplog, reply, detail):
    caplog.set_level(logging.DEBUG)
    upstream.reply = reply
    res = search()
    assert res.status_code == 502
    assert res.json() == {"detail": detail}
    assert len(upstream.calls) == 1  # one attempt, no retry loop
    assert_nothing_leaks(res, caplog)


def test_type_ahead_has_its_own_rate_limit(upstream, monkeypatch):
    from rest_framework.throttling import SimpleRateThrottle

    monkeypatch.setitem(SimpleRateThrottle.THROTTLE_RATES, "geocode", "3/minute")
    codes = [search(f"denver{i}").status_code for i in range(5)]
    assert codes == [200, 200, 200, 429, 429]
