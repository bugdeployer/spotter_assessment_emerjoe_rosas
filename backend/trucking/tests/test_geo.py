from trucking.geo import Polyline, checkpoint_distances, snap


def test_checkpoints_include_start_and_end():
    assert checkpoint_distances(60, 25) == [0, 25, 50, 60]
    assert checkpoint_distances(50, 25) == [0, 25, 50]


def test_polyline_point_at_is_scaled_to_reported_distance():
    line = Polyline([(0.0, 0.0), (0.0, 1.0)], total_mi=100)  # ~69 mi geometry, reported as 100
    lon, lat = line.point_at(50)
    assert abs(lat - 0.5) < 0.01
    assert line.point_at(500) == (0.0, 1.0)


def test_snap_groups_nearby_points_into_one_forecast_cell():
    assert snap(39.7392, -104.9903) == snap(39.7201, -104.9512)
    assert snap(39.7392, -104.9903) == (39.7, -105.0)
    assert snap(39.7392, -104.9903, 1.0) == (40.0, -105.0)
