import { memo } from 'react'
import { Polyline, Tooltip } from 'react-leaflet'
import { ALTERNATIVE_DASH, routeColor } from '../../lib/routeStyle'
import type { PlanResponse, Route } from '../../types'

interface LinesProps {
  plan: PlanResponse
  selectedId: number
  hoveredId: number | null
  onSelect: (id: number) => void
}

/** Route lines only, so hovering a card in the list re-renders three polylines, not every checkpoint. */
export const RouteLines = memo(function RouteLines({ plan, selectedId, hoveredId, onSelect }: LinesProps) {
  const rank = (r: Route) => (r.id === selectedId ? 2 : r.id === hoveredId ? 1 : 0)
  return (
    <>
      {plan.routes
        // Draw the selected route last, and a hovered one just before it, so they sit on top.
        .slice()
        .sort((a, b) => rank(a) - rank(b))
        .map((r) => {
          const selected = r.id === selectedId
          const hovered = r.id === hoveredId
          return (
            <Polyline
              key={r.id}
              positions={r.geometry}
              pathOptions={{
                color: routeColor(r.id),
                weight: selected ? 6 : hovered ? 6 : 4,
                opacity: selected || hovered ? 0.95 : 0.55,
                dashArray: r.recommended ? undefined : ALTERNATIVE_DASH,
              }}
              eventHandlers={{ click: () => onSelect(r.id) }}
            >
              <Tooltip sticky>
                {r.name}
                {r.recommended ? ' (recommended)' : ''} · {r.distance_mi.toFixed(0)} mi
              </Tooltip>
            </Polyline>
          )
        })}
    </>
  )
})
