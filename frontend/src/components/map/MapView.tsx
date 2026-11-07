import 'leaflet/dist/leaflet.css'
import { MapContainer, TileLayer } from 'react-leaflet'
import type { PlanResponse } from '../../types'
import { TripLayers, type TripLayersProps } from './TripLayers'
import { ZoomControls } from './ZoomControls'

interface Props extends Omit<TripLayersProps, 'plan'> {
  plan: PlanResponse | null
}

export function MapView({ plan, ...layers }: Props) {
  return (
    <MapContainer center={[39.5, -98.35]} zoom={4} zoomControl={false} style={{ position: 'absolute', inset: 0 }} preferCanvas>
      <ZoomControls />
      <TileLayer
        attribution="Tiles &copy; Esri &mdash; Esri, HERE, Garmin, OpenStreetMap contributors"
        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}"
        maxZoom={19}
      />
      {plan && <TripLayers plan={plan} {...layers} />}
    </MapContainer>
  )
}
