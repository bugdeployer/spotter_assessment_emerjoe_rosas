"""Serving the built React app."""

from django.conf import settings
from django.http import FileResponse, HttpResponse


def spa_index(request):
    """Serve the built React app, or a hint if it has not been built."""
    index = settings.FRONTEND_DIST / "index.html"
    if index.exists():
        return FileResponse(open(index, "rb"), content_type="text/html")
    return HttpResponse("API running. Build the frontend (npm run build) to serve the UI here.", status=200)
