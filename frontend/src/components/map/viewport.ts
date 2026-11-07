import L from 'leaflet'
import type { PlanResponse } from '../../types'

// Progressive detail. Checkpoint dots are thinned so neighbours stay at least this far apart on screen;
// the heatmap fades in between these two zoom levels instead of switching on at one.
export const MIN_DOT_GAP_PX = 40
export const HEAT_FADE_START_ZOOM = 3.5
export const HEAT_FULL_ZOOM = 6.5
// Following the truck is pointless at continent scale: zoom in at least this far when it switches on.
export const FOLLOW_ZOOM = 8

/**
 * Show every 1st, 2nd, 4th, 8th... checkpoint. Strides are powers of two, so each zoom-in
 * level exactly doubles the dots and never moves existing ones: detail appears gradually.
 */
export function checkpointStride(zoom: number, plan: PlanResponse): number {
  const r = plan.routes[0]
  const interval = r.checkpoints[1] ? r.checkpoints[1].mile - r.checkpoints[0].mile : 25
  const lat = r.geometry[Math.floor(r.geometry.length / 2)][0]
  const milesPerPx = (156543.03 * Math.cos((lat * Math.PI) / 180)) / 2 ** zoom / 1609.344
  const gapPx = interval / milesPerPx
  return 2 ** Math.max(0, Math.ceil(Math.log2(MIN_DOT_GAP_PX / gapPx)))
}

/**
 * Frame every route inside the map, keeping the ends of the trip clear of the slider card that
 * floats over the bottom of the map (measured, since it is taller on phones).
 */
export function fitTrip(map: L.Map, plan: PlanResponse) {
  const slider = map.getContainer().parentElement?.querySelector<HTMLElement>('.slider')
  const covered = slider ? Math.max(0, map.getContainer().getBoundingClientRect().bottom - slider.getBoundingClientRect().top) : 0
  map.fitBounds(L.latLngBounds(plan.routes.flatMap((r) => r.geometry)), {
    paddingTopLeft: [40, 40],
    paddingBottomRight: [40, covered + 32],
  })
}

/** Heat opacity at a zoom level: 0 when zoomed out, 1 once zoomed in. */
export const heatOpacityAt = (zoom: number) =>
  Math.min(1, Math.max(0, (zoom - HEAT_FADE_START_ZOOM) / (HEAT_FULL_ZOOM - HEAT_FADE_START_ZOOM)))
