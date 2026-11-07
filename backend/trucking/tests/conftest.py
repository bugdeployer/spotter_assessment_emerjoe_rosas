import pytest
from django.core.cache import cache


@pytest.fixture(autouse=True)
def fresh_cache():
    """Forecasts and throttle counters live in the cache; never let one test see another's."""
    cache.clear()
    yield
    cache.clear()
