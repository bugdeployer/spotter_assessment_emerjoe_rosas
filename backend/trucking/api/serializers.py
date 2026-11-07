"""Request validation for the API."""

from datetime import UTC, datetime, timedelta

from rest_framework import serializers


class PlaceSerializer(serializers.Serializer):
    """A point on the map, as chosen from the place search."""

    lat = serializers.FloatField(min_value=-90, max_value=90)
    lon = serializers.FloatField(min_value=-180, max_value=180)
    label = serializers.CharField(required=False, allow_blank=True)


class PlanSerializer(serializers.Serializer):
    """Body of ``POST /api/plan``."""

    origin = PlaceSerializer()
    destination = PlaceSerializer()
    departure = serializers.DateTimeField()
    load_lb = serializers.IntegerField(min_value=0, max_value=200_000)
    interval_miles = serializers.ChoiceField(choices=[10, 25, 50], default=25)

    def validate_departure(self, value):
        """Departure must fall inside the window the forecast can cover: today (UTC) to four days ahead."""
        now = datetime.now(UTC)
        # Forecast data starts at 00:00 GMT today and the heatmap slider needs at least 48h beyond departure.
        if value < now.replace(hour=0, minute=0, second=0, microsecond=0):
            raise serializers.ValidationError("Departure cannot be before today (UTC).")
        if value > now + timedelta(days=4):
            raise serializers.ValidationError("Departure must be within the next 4 days (forecast range).")
        return value
