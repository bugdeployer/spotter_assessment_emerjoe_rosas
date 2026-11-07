import type { Route } from '../types'

/** How far along the route (miles) the truck is at time `t` (ms): linear between the checkpoints either side. */
export function truckMile(route: Route, t: number): { mile: number; arrived: boolean } {
  const cps = route.checkpoints
  const at = (i: number) => new Date(cps[i].eta).getTime()
  const last = cps.length - 1
  if (t <= at(0)) return { mile: 0, arrived: false }
  if (t >= at(last)) return { mile: cps[last].mile, arrived: true }
  let i = 1
  while (at(i) < t) i++
  const f = (t - at(i - 1)) / (at(i) - at(i - 1))
  return { mile: cps[i - 1].mile + (cps[i].mile - cps[i - 1].mile) * f, arrived: false }
}
