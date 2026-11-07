"""Place search for the type-ahead: Geoapify Address Autocomplete, called only from the server.

The API key is read from the server environment and travels in the request's query string (the documented way
to pass it). So nothing from the request (its URL, or exception messages that quote it) is ever logged or returned
to the client: errors are reported by type and status code only, and exception chains are cut.
"""

from __future__ import annotations

import hashlib
import logging
import math

import requests
from django.conf import settings
from django.core.cache import cache

from .http import ProviderError

log = logging.getLogger(__name__)

COUNTRIES = "us,ca,mx"
RESULT_LIMIT = 5
CACHE_SECONDS = 24 * 3600  # place names don't move; repeat prefixes cost no credits


class GeocoderNotConfigured(ProviderError):
    """The server has no Geoapify key, so place search is switched off."""


def _place(r: object) -> dict:
    if not isinstance(r, dict):
        raise ValueError
    label, lat, lon = r["formatted"], float(r["lat"]), float(r["lon"])
    if not isinstance(label, str) or not label or not (math.isfinite(lat) and math.isfinite(lon)):
        raise ValueError
    return {"label": label, "lat": lat, "lon": lon}


def geocode(query: str, limit: int = RESULT_LIMIT) -> list[dict]:
    """Up to ``limit`` places in the US, Canada or Mexico matching ``query``, as ``{"label", "lat", "lon"}``.

    One attempt with a short timeout: a type-ahead answer that arrives late is useless, so there is no retry loop.
    Raises GeocoderNotConfigured without a key, and ProviderError for any upstream problem.
    """
    key = settings.GEOAPIFY_API_KEY
    if not key:
        raise GeocoderNotConfigured("Place search is not configured on this server")

    normalised = " ".join(query.lower().split())
    cache_key = "geo:" + hashlib.sha256(f"{limit}:{normalised}".encode()).hexdigest()
    hit = cache.get(cache_key)
    if hit is not None:
        return hit

    try:
        resp = requests.get(
            settings.GEOAPIFY_AUTOCOMPLETE_URL,
            params={
                "text": query,
                "filter": f"countrycode:{COUNTRIES}",
                "limit": limit,
                "lang": "en",
                "format": "json",
                "apiKey": key,
            },
            headers={"User-Agent": settings.HTTP_USER_AGENT},
            timeout=settings.GEOCODE_TIMEOUT,
        )
    except requests.Timeout:
        log.warning("place search timed out")
        raise ProviderError("Place search timed out") from None
    except requests.RequestException as exc:
        log.warning("place search failed: %s", type(exc).__name__)
        raise ProviderError("Place search is unavailable") from None

    if resp.status_code == 429:
        log.warning("place search rate-limited upstream (HTTP 429)")
        raise ProviderError("Place search is busy right now")
    if resp.status_code in (401, 403):
        log.error("place search rejected the server's API key (HTTP %s)", resp.status_code)
        raise ProviderError("Place search is unavailable")
    if resp.status_code != 200:
        log.warning("place search failed upstream (HTTP %s)", resp.status_code)
        raise ProviderError("Place search is unavailable")

    try:
        data = resp.json()
        results = data["results"]
        if not isinstance(results, list):
            raise ValueError
        places = [_place(r) for r in results][:limit]
    except (ValueError, KeyError, TypeError):
        log.warning("place search returned an unexpected response")
        raise ProviderError("Place search returned an unexpected response") from None

    cache.set(cache_key, places, CACHE_SECONDS)
    return places
