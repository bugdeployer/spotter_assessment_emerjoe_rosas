import { cumulativeMiles, pointOnLine } from './geo'
import type { Place, Route } from '../types'

// Google Maps URLs accept up to 9 waypoints; fewer keeps the stop list short for the driver.
const MAX_WAYPOINTS = 6
const MILES_PER_WAYPOINT = 60

/**
 * Evenly spaced points along the route's own line. Passing them as waypoints makes Google Maps
 * follow this route instead of picking its own fastest one.
 */
function waypointsFor(route: Route): string[] {
  const count = Math.min(MAX_WAYPOINTS, Math.floor(route.distance_mi / MILES_PER_WAYPOINT))
  const cum = cumulativeMiles(route.geometry)
  return Array.from({ length: count }, (_, i) => {
    const [lat, lon] = pointOnLine(route.geometry, cum, (i + 1) / (count + 1))
    return `${lat.toFixed(5)},${lon.toFixed(5)}`
  })
}

/**
 * Link that opens Google Maps directions for `route` (a new tab, or the app on a phone).
 *
 * Route 0 is the routing service's own primary route, which Google Maps would choose anyway, so it
 * gets no waypoints. The alternatives do, otherwise Google would quietly replace them with its
 * fastest route. Google Maps cannot take a departure time, so it always routes from "now".
 */
export function googleMapsUrl(route: Route, origin: Place, destination: Place): string {
  const params = new URLSearchParams({
    api: '1',
    origin: origin.label,
    destination: destination.label,
    travelmode: 'driving',
  })
  const waypoints = route.id === 0 ? [] : waypointsFor(route)
  if (waypoints.length) params.set('waypoints', waypoints.join('|'))
  return `https://www.google.com/maps/dir/?${params}`
}
