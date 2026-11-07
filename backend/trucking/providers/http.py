"""Shared HTTP plumbing for the third-party clients."""

from __future__ import annotations

import logging
import time

import requests
from django.conf import settings

log = logging.getLogger(__name__)


class ProviderError(Exception):
    """An upstream API failed or returned something unusable."""


def get_json(url: str, params: dict, retries: int = 3, timeout: float | None = None) -> dict | list:
    """GET JSON, retrying with backoff on 429/5xx (public APIs rate-limit bursts)."""
    last: Exception | None = None
    host = url.split("/")[2]
    for attempt in range(retries + 1):
        try:
            resp = requests.get(
                url,
                params=params,
                headers={"User-Agent": settings.HTTP_USER_AGENT},
                timeout=timeout or settings.HTTP_TIMEOUT,
            )
            if resp.status_code == 429 or resp.status_code >= 500:
                last = requests.HTTPError(f"{resp.status_code}")
                # Honour Retry-After if given; otherwise back off long enough for a rate-limit window to ease.
                wait = float(resp.headers.get("Retry-After") or 0) or 4.0 * (attempt + 1)
                log.warning("retrying %s after HTTP %s in %.0fs", host, resp.status_code, wait)
                time.sleep(min(wait, 20))
                continue
            resp.raise_for_status()
            return resp.json()
        except (requests.RequestException, ValueError) as exc:
            last = exc
            break
    # Log the exception type only: requests' messages quote the full URL, query string included.
    log.warning("upstream call failed: %s %s", host, type(last).__name__)
    raise ProviderError(f"Upstream service unavailable ({host})") from None
