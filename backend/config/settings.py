"""Django settings. The app is stateless (no database); everything is computed per request."""

import os
from pathlib import Path

from django.core.exceptions import ImproperlyConfigured

BASE_DIR = Path(__file__).resolve().parent.parent
FRONTEND_DIST = BASE_DIR.parent / "frontend" / "dist"


def env_bool(name: str, default: bool) -> bool:
    """Read a true/false environment variable (1, true or yes mean true)."""
    return os.environ.get(name, str(default)).lower() in {"1", "true", "yes"}


DEBUG = env_bool("DJANGO_DEBUG", True)  # set DJANGO_DEBUG=0 in production
SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "dev-only-insecure-key")
if not DEBUG and SECRET_KEY == "dev-only-insecure-key":
    raise ImproperlyConfigured("Set DJANGO_SECRET_KEY when DJANGO_DEBUG is off.")
# Comma-separated hostnames. Defaults to any host for local use; set it to your domain in production.
ALLOWED_HOSTS = os.environ.get("DJANGO_ALLOWED_HOSTS", "*").split(",")

INSTALLED_APPS = [
    "django.contrib.staticfiles",
    "corsheaders",
    "rest_framework",
    "trucking",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.common.CommonMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"
TEMPLATES = []
DATABASES = {}

CORS_ALLOWED_ORIGINS = os.environ.get("CORS_ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")

REST_FRAMEWORK = {
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
    "DEFAULT_PARSER_CLASSES": ["rest_framework.parsers.JSONParser"],
    "DEFAULT_AUTHENTICATION_CLASSES": [],
    "DEFAULT_PERMISSION_CLASSES": [],
    "UNAUTHENTICATED_USER": None,
    # Each search spends the free weather/routing quotas, so cap requests per client IP.
    "DEFAULT_THROTTLE_CLASSES": ["rest_framework.throttling.AnonRateThrottle"],
    "DEFAULT_THROTTLE_RATES": {
        "anon": os.environ.get("API_THROTTLE_RATE", "120/hour"),
        # Type-ahead fires every few keystrokes, so it gets its own, faster bucket (see trucking.api.views).
        "geocode": os.environ.get("GEOCODE_THROTTLE_RATE", "30/minute"),
    },
    # Number of trusted proxies in front of the app, so throttles key on the real client IP from X-Forwarded-For
    # (unset: DRF uses the whole header, which a client can vary to dodge the limit).
    "NUM_PROXIES": int(os.environ["API_NUM_PROXIES"]) if os.environ.get("API_NUM_PROXIES") else None,
}

USE_TZ = True
TIME_ZONE = "UTC"

STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
# WhiteNoise serves the built React app (index.html, /assets/*) straight from its dist folder.
WHITENOISE_ROOT = FRONTEND_DIST if FRONTEND_DIST.exists() else None
WHITENOISE_INDEX_FILE = True
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# Third-party services. All are keyless by default.
OSRM_URL = os.environ.get("OSRM_URL", "https://router.project-osrm.org")
# Place search (type-ahead): Geoapify Address Autocomplete. The key stays on the server: never commit it, never
# put it in the frontend. Without it, /api/geocode answers 503 and the rest of the app still works.
GEOAPIFY_API_KEY = os.environ.get("GEOAPIFY_API_KEY", "").strip()
GEOAPIFY_AUTOCOMPLETE_URL = os.environ.get(
    "GEOAPIFY_AUTOCOMPLETE_URL", "https://api.geoapify.com/v1/geocode/autocomplete"
)
GEOCODE_TIMEOUT = 5  # seconds; a late type-ahead answer is useless
OPEN_METEO_URL = os.environ.get("OPEN_METEO_URL", "https://api.open-meteo.com/v1/forecast")
HTTP_USER_AGENT = os.environ.get("HTTP_USER_AGENT", "weather-aware-truck-routing/1.0 (assessment)")
HTTP_TIMEOUT = 20

CACHES = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}
