"""URL routes for the JSON API (mounted under /api/)."""

from django.urls import path

from . import views

urlpatterns = [
    path("geocode", views.geocode),
    path("plan", views.plan),
]
