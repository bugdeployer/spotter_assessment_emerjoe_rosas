"""HTTP endpoints: place search and trip planning."""

from rest_framework import status
from rest_framework.decorators import api_view, throttle_classes
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle

from .. import providers
from ..planning import plan_trip
from .serializers import PlanSerializer


class GeocodeThrottle(AnonRateThrottle):
    """Per-client-IP limit for the type-ahead (``GEOCODE_THROTTLE_RATE``), separate from the planner's."""

    scope = "geocode"


MAX_QUERY_CHARS = 200


@api_view(["GET"])
@throttle_classes([GeocodeThrottle])
def geocode(request):
    """``GET /api/geocode?q=`` - up to five places matching ``q`` (empty list for fewer than 3 characters).

    503 when the server has no geocoding key, 502 for upstream failures; ``detail`` never includes the key or the
    upstream URL.
    """
    q = request.query_params.get("q", "").strip()[:MAX_QUERY_CHARS]
    if len(q) < 3:
        return Response([])
    try:
        return Response(providers.geocode(q))
    except providers.GeocoderNotConfigured as exc:
        return Response({"detail": str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
    except providers.ProviderError as exc:
        return Response({"detail": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)


@api_view(["POST"])
def plan(request):
    """``POST /api/plan`` - three routes with weather risk per checkpoint, the recommendation and the heatmap."""
    ser = PlanSerializer(data=request.data)
    ser.is_valid(raise_exception=True)
    d = ser.validated_data
    try:
        result = plan_trip(
            (d["origin"]["lon"], d["origin"]["lat"]),
            (d["destination"]["lon"], d["destination"]["lat"]),
            d["departure"],
            d["load_lb"],
            d["interval_miles"],
        )
    except providers.ProviderError as exc:
        return Response({"detail": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)
    return Response(result)
