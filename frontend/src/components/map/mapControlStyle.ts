import type { SxProps, Theme } from '@mui/material/styles'
import L from 'leaflet'

/** Button edge length: touch-friendly on phones, compact on desktop. */
export const CONTROL_SIZE = { xs: 44, md: 38 }

/** The look shared by every group of map buttons (zoom, simulation), so they read as one family. */
export const controlStripSx: SxProps<Theme> = {
  position: 'absolute',
  zIndex: 1000,
  display: 'flex',
  flexDirection: 'column',
  bgcolor: '#fff',
  border: '2px solid rgba(0,0,0,.2)',
  borderRadius: '10px',
  backgroundClip: 'padding-box',
  boxShadow: '0 2px 8px rgba(0,0,0,.15)',
  overflow: 'hidden',
}

/** Ref callback: keep clicks, double-clicks and scrolling on a control from reaching the map underneath. */
export function stopMapEvents(el: HTMLElement | null) {
  if (el) {
    L.DomEvent.disableClickPropagation(el)
    L.DomEvent.disableScrollPropagation(el)
  }
}
