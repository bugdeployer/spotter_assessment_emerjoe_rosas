/** Small geometry helpers for [lat, lon] polylines (the route lines we draw). */

type LatLon = [number, number]

const toRad = (d: number) => (d * Math.PI) / 180

export function haversineMiles(a: LatLon, b: LatLon): number {
  const h =
    Math.sin(toRad(b[0] - a[0]) / 2) ** 2 +
    Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(toRad(b[1] - a[1]) / 2) ** 2
  return 2 * 3958.76 * Math.asin(Math.sqrt(h))
}

/** Running distance along the line, so a mile marker or fraction can be turned into a point ON it. */
export function cumulativeMiles(geometry: LatLon[]): number[] {
  const cum = [0]
  for (let i = 1; i < geometry.length; i++) cum.push(cum[i - 1] + haversineMiles(geometry[i - 1], geometry[i]))
  return cum
}

/** Point on the polyline at `fraction` (0-1) of its length. */
export function pointOnLine(geometry: LatLon[], cum: number[], fraction: number): LatLon {
  const target = Math.min(1, Math.max(0, fraction)) * cum[cum.length - 1]
  let lo = 0
  let hi = cum.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (cum[mid] < target) lo = mid
    else hi = mid
  }
  const span = cum[hi] - cum[lo]
  const f = span ? (target - cum[lo]) / span : 0
  return [
    geometry[lo][0] + (geometry[hi][0] - geometry[lo][0]) * f,
    geometry[lo][1] + (geometry[hi][1] - geometry[lo][1]) * f,
  ]
}
