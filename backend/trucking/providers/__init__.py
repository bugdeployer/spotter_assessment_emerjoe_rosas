"""Clients for the outside services the app relies on.

* geocoding (type-ahead place search): Geoapify Address Autocomplete, with a server-side key
* routing: OSRM (keyless)
* weather: Open-Meteo (keyless)

Base URLs come from settings, so a self-hosted or commercial equivalent can be swapped in.
"""

from .geocoding import GeocoderNotConfigured, geocode
from .http import ProviderError
from .routing import fetch_route_via, fetch_routes
from .weather import fetch_weather

__all__ = ["GeocoderNotConfigured", "ProviderError", "fetch_route_via", "fetch_routes", "fetch_weather", "geocode"]
