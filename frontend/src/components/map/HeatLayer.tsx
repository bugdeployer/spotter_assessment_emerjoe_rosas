import L from 'leaflet'
import { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'
import { HEAT_COLOR, RISK_ORDER, UNKNOWN_COLOR } from '../../lib/risk'
import type { Hazard, HeatPoint } from '../../types'

// Colour per risk level (0-4). Each point is a soft disc in its own level's colour, and discs are
// painted from lowest to highest risk, so overlap never changes a colour (unlike additive heatmaps,
// where many "low" points would add up to look like "high"). Low is deliberately faint: on a calm
// day the corridor should whisper, so real weather is the loudest thing on the map.
const rgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16)
  return `${n >> 16},${(n >> 8) & 255},${n & 255}`
}
const RGB = RISK_ORDER.map((k) => rgb(HEAT_COLOR[k]))
const ALPHA = [0.14, 0.5, 0.58, 0.68, 0.78]
// Samples without a forecast are grey, never green: "no data" must not read as "safe".
const MISSING = -1
const MISSING_RGB = rgb(UNKNOWN_COLOR)
const MISSING_ALPHA = 0.32

// Discs reach this far past their neighbours, so adjacent points fuse into one continuous strip
// instead of a string of separate blobs.
const DISC_OVERLAP = 0.9
// Half-width of the visible corridor, in miles (never narrower than the data it must show).
const MIN_CORRIDOR_HALF_MILES = 22
// The corridor edge is drawn as nested strokes of falling width, giving a soft edge without
// relying on canvas filters (not available in every browser). Many thin steps keep it smooth.
const SOFT_EDGE: [width: number, alpha: number][] = [1, 0.88, 0.76, 0.64, 0.52, 0.4, 0.3, 0.2].map((w) => [w, 0.2])

interface Props {
  points: HeatPoint[]
  hour: number
  /** Which hazard colours the heat: the worst of the three, or one on its own. */
  hazard: Hazard
  /** Route lines as [lat, lon] polylines; the heat is clipped to a band around them. */
  routes: [number, number][][]
  /** Typical miles between neighbouring heat points. */
  cellMiles: number
  /** 0-1; lets the parent fade the heat in with zoom without redrawing it. */
  opacity?: number
}

/** Risk level (0-4) of a point at an hour for the chosen hazard, or MISSING where the forecast has no value. */
function levelAt(p: HeatPoint, hazard: Hazard, hour: number): number {
  const digit = (s: string) => {
    const d = s.charCodeAt(hour) - 48 // '-' (no data) and past-the-end both fall outside 0-4
    return d >= 0 && d <= 4 ? d : MISSING
  }
  if (hazard !== 'all') return digit(p[hazard])
  const levels = [digit(p.wind), digit(p.rain), digit(p.snow)]
  // The worst of three hazards is only known when all three are.
  return levels.includes(MISSING) ? MISSING : Math.max(...levels)
}

export function HeatLayer({ points, hour, hazard, routes, cellMiles, opacity = 1 }: Props) {
  const map = useMap()
  const redraw = useRef<() => void>(() => {})
  const canvasEl = useRef<HTMLCanvasElement | null>(null)
  const frame = useRef(0)
  const maskDirty = useRef(true)
  // Latest props, so map-move redraws always use the current slider position.
  const state = useRef({ points, hour, hazard, routes, cellMiles })
  useEffect(() => {
    state.current = { points, hour, hazard, routes, cellMiles }
  })

  useEffect(() => {
    const el = L.DomUtil.create('canvas', 'heat-canvas') as HTMLCanvasElement
    el.style.cssText = 'position:absolute;pointer-events:none;transition:opacity .25s'
    canvasEl.current = el
    // Own pane between the tiles (z 200) and the route lines (z 400), so routes stay crisp on top.
    const pane = map.getPane('heat') ?? map.createPane('heat')
    pane.style.zIndex = '250'
    pane.appendChild(el)

    // The corridor mask is the expensive part (thousands of route vertices, several strokes). It is built
    // once, on a canvas bigger than the viewport and at half resolution (its edge is soft anyway), in
    // map-pane coordinates, which do not change when the map is panned. Panning, including the follow
    // camera's every-frame pan, just reuses it; zooming, resizing or leaving its area rebuilds it.
    const mask = document.createElement('canvas')
    let maskArea = { x: 0, y: 0, w: 0, h: 0 } // the map-pane rectangle the mask covers
    const MASK_SCALE = 0.5

    const pxPerMile = () => {
      const c = map.getCenter()
      return Math.abs(map.latLngToContainerPoint([c.lat + 1 / 69, c.lng]).y - map.latLngToContainerPoint(c).y)
    }

    const rebuildMask = (size: L.Point) => {
      const pad = Math.round(Math.max(size.x, size.y) * 0.35)
      const origin = map.containerPointToLayerPoint([-pad, -pad])
      maskArea = { x: origin.x, y: origin.y, w: size.x + 2 * pad, h: size.y + 2 * pad }
      mask.width = Math.round(maskArea.w * MASK_SCALE)
      mask.height = Math.round(maskArea.h * MASK_SCALE)
      const m = mask.getContext('2d')!
      m.setTransform(MASK_SCALE, 0, 0, MASK_SCALE, 0, 0)
      m.clearRect(0, 0, maskArea.w, maskArea.h)
      m.lineCap = 'round'
      m.lineJoin = 'round'
      m.strokeStyle = '#000'
      const halfMiles = Math.max(MIN_CORRIDOR_HALF_MILES, state.current.cellMiles * 0.6)
      const full = Math.max(18, 2 * halfMiles * pxPerMile())
      for (const [scale, alpha] of SOFT_EDGE) {
        m.globalAlpha = alpha
        m.lineWidth = full * scale
        for (const route of state.current.routes) {
          m.beginPath()
          let lx = NaN
          let ly = NaN
          route.forEach(([lat, lon], i) => {
            const p = map.latLngToLayerPoint([lat, lon])
            const x = p.x - maskArea.x
            const y = p.y - maskArea.y
            // Skip vertices under 1.5px from the last one: invisible, and thousands per route.
            if (i > 0 && Math.hypot(x - lx, y - ly) < 1.5 && i < route.length - 1) return
            if (i === 0) m.moveTo(x, y)
            else m.lineTo(x, y)
            lx = x
            ly = y
          })
          m.stroke()
        }
      }
      m.globalAlpha = 1
    }

    const draw = () => {
      const size = map.getSize()
      const dpr = window.devicePixelRatio || 1
      if (el.width !== size.x * dpr || el.height !== size.y * dpr) {
        el.width = size.x * dpr
        el.height = size.y * dpr
        el.style.width = `${size.x}px`
        el.style.height = `${size.y}px`
        maskDirty.current = true
      }
      // Panes pan with the map; keep the canvas pinned to the viewport's top-left in pane coordinates.
      const topLeft = map.containerPointToLayerPoint([0, 0])
      L.DomUtil.setPosition(el, topLeft)
      const ctx = el.getContext('2d')!
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.globalCompositeOperation = 'source-over'
      ctx.clearRect(0, 0, size.x, size.y)

      const { points: pts, hour: h, hazard: hz, cellMiles: cell } = state.current
      const bounds = map.getBounds().pad(0.3)
      const order = pts
        .filter((p) => bounds.contains([p.lat, p.lon]))
        .map((p) => ({ p, level: levelAt(p, hz, h) }))
        .sort((a, b) => a.level - b.level)
      if (!order.length) return

      // Disc radius in pixels, wide enough to blend with neighbouring points.
      const r = Math.max(14, cell * DISC_OVERLAP * pxPerMile())
      for (const { p, level } of order) {
        const pt = map.latLngToContainerPoint([p.lat, p.lon])
        const g = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, r)
        const [color, alpha] = level === MISSING ? [MISSING_RGB, MISSING_ALPHA] : [RGB[level], ALPHA[level]]
        g.addColorStop(0, `rgba(${color},${alpha})`)
        g.addColorStop(0.55, `rgba(${color},${alpha * 0.75})`)
        g.addColorStop(1, `rgba(${color},0)`)
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2)
        ctx.fill()
      }

      // Clip everything to the corridor around the routes, rebuilding the mask only when it no longer covers the view.
      const covers =
        topLeft.x >= maskArea.x &&
        topLeft.y >= maskArea.y &&
        topLeft.x + size.x <= maskArea.x + maskArea.w &&
        topLeft.y + size.y <= maskArea.y + maskArea.h
      if (maskDirty.current || !covers) {
        rebuildMask(size)
        maskDirty.current = false
      }
      ctx.globalCompositeOperation = 'destination-in'
      ctx.drawImage(mask, maskArea.x - topLeft.x, maskArea.y - topLeft.y, maskArea.w, maskArea.h)
      ctx.globalCompositeOperation = 'source-over'
    }

    const schedule = () => {
      cancelAnimationFrame(frame.current)
      frame.current = requestAnimationFrame(draw)
    }
    // Slider and pan changes only redraw; zooming, resizing or a view reset also invalidates the mask.
    const invalidate = () => {
      maskDirty.current = true
      schedule()
    }
    redraw.current = schedule

    map.on('move', schedule)
    map.on('zoom resize viewreset', invalidate)
    schedule()
    return () => {
      map.off('move', schedule)
      map.off('zoom resize viewreset', invalidate)
      cancelAnimationFrame(frame.current)
      el.remove()
    }
  }, [map])

  useEffect(() => {
    redraw.current()
  }, [points, hour, hazard])

  useEffect(() => {
    maskDirty.current = true
    redraw.current()
  }, [routes, cellMiles])

  useEffect(() => {
    if (canvasEl.current) canvasEl.current.style.opacity = String(opacity)
  }, [opacity])

  return null
}
