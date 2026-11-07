import { Box } from '@mui/material'
import { useEffect, useMemo, useState } from 'react'
import { useMap, useMapEvents } from 'react-leaflet'
import { useFollowCamera } from '../../hooks/useFollowCamera'
import type { SimControls } from '../../hooks/useSimulation'
import { cumulativeMiles, pointOnLine } from '../../lib/geo'
import { truckMile } from '../../lib/truck'
import { mapPillSx } from '../../theme'
import type { Hazard, Place, PlanResponse } from '../../types'
import { Checkpoints } from './Checkpoints'
import { HeatLayer } from './HeatLayer'
import { MapControls } from './MapControls'
import { EndPins, TruckMarker } from './Markers'
import { RouteLines } from './RouteLines'
import { checkpointStride, fitTrip, heatOpacityAt } from './viewport'

/** Miles behind and ahead of the truck used to tell which way it is heading. */
const HEADING_SPAN_MI = 5

function FitBounds({ plan }: { plan: PlanResponse }) {
  const map = useMap()
  useEffect(() => {
    fitTrip(map, plan)
  }, [plan, map])
  return null
}

export interface TripLayersProps {
  plan: PlanResponse
  selectedId: number
  hoveredId: number | null
  onSelect: (id: number) => void
  hour: number
  hazard: Hazard
  showHeat: boolean
  origin: Place | null
  destination: Place | null
  sim: SimControls
}

/** Everything drawn for a planned trip. Lives inside the map so it can follow zoom and scale the detail shown. */
export function TripLayers({ plan, selectedId, hoveredId, onSelect, hour, hazard, showHeat, origin, destination, sim }: TripLayersProps) {
  const map = useMap()
  const [zoom, setZoom] = useState(map.getZoom())
  useMapEvents({
    zoom: () => setZoom(map.getZoom()),
    zoomend: () => setZoom(map.getZoom()),
    // Taking hold of the map means the user wants to look elsewhere: stop following the truck.
    dragstart: () => sim.onFollowChange(false),
  })

  // The heat is hourly data; the truck moves continuously (playback runs `hour` through fractions).
  const heatHour = Math.floor(hour)

  // A popup describes one checkpoint at one time; once the hour changes it would be stale.
  useEffect(() => {
    map.closePopup()
  }, [heatHour, map])

  // Where the truck is: time -> mile -> a point on the drawn route line.
  const route = plan.routes.find((r) => r.id === selectedId) ?? plan.routes[0]
  const cum = useMemo(() => cumulativeMiles(route.geometry), [route])
  const { mile, arrived } = truckMile(route, new Date(plan.heatmap.start).getTime() + hour * 3600_000)
  const truck = pointOnLine(route.geometry, cum, mile / route.distance_mi)
  // Face the way the road is heading: compare a point a little behind with one a little ahead, wide enough
  // that a single bend doesn't flip the icon back and forth.
  const behind = pointOnLine(route.geometry, cum, (mile - HEADING_SPAN_MI) / route.distance_mi)
  const ahead = pointOnLine(route.geometry, cum, (mile + HEADING_SPAN_MI) / route.distance_mi)
  const routeHeadsLeft = ahead[1] < behind[1]
  // The truck faces the way it is moving: along the route, or back along it while the user scrubs backwards.
  // Parked at either end it keeps the route's own heading.
  const moving = mile > 0 && !arrived
  const facingLeft = moving && sim.reversed ? !routeHeadsLeft : routeHeadsLeft
  useFollowCamera(sim.follow, truck)

  const routeLines = useMemo(() => plan.routes.map((r) => r.geometry), [plan])
  const level = Math.round(zoom)
  const stride = useMemo(() => checkpointStride(level, plan), [level, plan])
  const dotRadius = Math.min(7, Math.max(4, level - 1))
  const heatOpacity = heatOpacityAt(zoom)

  return (
    <>
      <FitBounds plan={plan} />
      {showHeat && heatOpacity > 0.02 && (
        <HeatLayer
          points={plan.heatmap.points}
          hour={heatHour}
          hazard={hazard}
          routes={routeLines}
          cellMiles={plan.heatmap.cell_miles}
          opacity={heatOpacity}
        />
      )}
      <RouteLines plan={plan} selectedId={selectedId} hoveredId={hoveredId} onSelect={onSelect} />
      <Checkpoints plan={plan} selectedId={selectedId} onSelect={onSelect} stride={stride} dotRadius={dotRadius} />
      <EndPins origin={origin} destination={destination} />
      <TruckMarker position={truck} facingLeft={facingLeft} label={arrived ? 'Arrived' : `Mile ${mile.toFixed(0)}`} />
      <MapControls
        {...sim}
        onFit={() => {
          sim.onFollowChange(false)
          fitTrip(map, plan)
        }}
      />
      {showHeat && heatOpacity < 0.4 && (
        <Box sx={{ ...mapPillSx, top: 12, py: '6px', fontSize: '0.8rem', bgcolor: 'rgba(17,24,39,.85)', color: '#fff' }}>
          Zoom in to reveal the weather heatmap and more checkpoints
        </Box>
      )}
    </>
  )
}
