import L from 'leaflet'
import { memo } from 'react'
import { Marker, Tooltip } from 'react-leaflet'
import type { Place } from '../../types'

const pin = (color: string) =>
  L.divIcon({
    className: '',
    html: `<div class="pin" style="background:${color}"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  })

export const EndPins = memo(function EndPins({ origin, destination }: { origin: Place | null; destination: Place | null }) {
  return (
    <>
      {origin && <Marker position={[origin.lat, origin.lon]} icon={pin('#111827')} />}
      {destination && <Marker position={[destination.lat, destination.lon]} icon={pin('#dc2626')} />}
    </>
  )
})

/** The truck, cab to the right; mirrored for westbound travel so it always drives forwards. */
const truck = (facingLeft: boolean) =>
  L.divIcon({
    className: '',
    html: `<div class="truck" aria-hidden="true">
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#111827" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"${facingLeft ? ' style="transform:scaleX(-1)"' : ''}>
      <path d="M2 6h11v9H2z"/><path d="M13 9h4l3 3v3h-7z"/><circle cx="6.5" cy="17" r="1.8" fill="#fff"/><circle cx="16.5" cy="17" r="1.8" fill="#fff"/>
    </svg></div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  })
// Built once each, so playback (a new position every frame) never rebuilds the icon.
const TRUCK_RIGHT = truck(false)
const TRUCK_LEFT = truck(true)

/** The truck marker: a pure view of where the truck is and which way it heads (Layers works that out once per frame). */
export function TruckMarker({ position, label, facingLeft }: { position: [number, number]; label: string; facingLeft: boolean }) {
  return (
    <Marker position={position} icon={facingLeft ? TRUCK_LEFT : TRUCK_RIGHT} interactive={false} zIndexOffset={1000}>
      <Tooltip permanent direction="top" offset={[0, -16]} className="truck-label">
        {label}
      </Tooltip>
    </Marker>
  )
}
