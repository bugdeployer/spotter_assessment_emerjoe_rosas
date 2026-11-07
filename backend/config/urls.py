"""Root URLs: the JSON API under /api/, the React app everywhere else."""

from django.urls import include, path

from .views import spa_index

urlpatterns = [
    path("api/", include("trucking.api.urls")),
    path("", spa_index),
]
