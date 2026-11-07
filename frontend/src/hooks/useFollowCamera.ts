import { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'
import { FOLLOW_ZOOM } from '../components/map/viewport'

/**
 * Keeps the map centred on `position` while `follow` is on. Switching it on glides to the truck at a
 * zoom where following makes sense, then locks on; from then on each position update pans the map by
 * the small offset needed (panBy keeps the map's coordinate frame, so it is cheap enough to run every frame).
 * Must be called inside a react-leaflet map.
 */
export function useFollowCamera(follow: boolean, position: [number, number]) {
  const map = useMap()
  const [lat, lon] = position
  const latest = useRef(position)
  useEffect(() => {
    latest.current = position // declared first so the effects below see the newest position
  })
  const locked = useRef(false)

  useEffect(() => {
    locked.current = false
    if (!follow) return
    map.flyTo(latest.current, Math.max(map.getZoom(), FOLLOW_ZOOM), { duration: 0.9 })
    const lock = () => {
      locked.current = true
    }
    map.once('moveend', lock)
    return () => {
      map.off('moveend', lock)
    }
  }, [follow, map])

  useEffect(() => {
    if (!follow || !locked.current) return
    map.panBy(map.latLngToContainerPoint([lat, lon]).subtract(map.getSize().divideBy(2)), { animate: false })
  }, [follow, lat, lon, map])
}
