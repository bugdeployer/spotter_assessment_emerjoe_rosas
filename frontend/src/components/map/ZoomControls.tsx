import { Box, Divider, IconButton, SvgIcon, Tooltip } from '@mui/material'
import { useState } from 'react'
import { useMap, useMapEvents } from 'react-leaflet'
import { colors } from '../../theme'
import { CONTROL_SIZE, controlStripSx, stopMapEvents } from './mapControlStyle'

const PATH_ADD = 'M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z'
const PATH_REMOVE = 'M19 13H5v-2h14v2z'

/**
 * Zoom in / zoom out, top right, styled as a twin of the simulation strip on the left.
 * It replaces Leaflet's own zoom control and lives outside the trip layers because it is
 * needed before any trip has been planned.
 */
export function ZoomControls() {
  const map = useMap()
  const [zoom, setZoom] = useState(map.getZoom())
  useMapEvents({ zoomend: () => setZoom(map.getZoom()) })

  const button = (label: string, path: string, disabled: boolean, onClick: () => void) => (
    <Tooltip title={label} placement="left">
      {/* The span lets the tooltip work on a disabled button too. */}
      <span>
        <IconButton
          onClick={onClick}
          disabled={disabled}
          aria-label={label}
          sx={{ width: CONTROL_SIZE, height: CONTROL_SIZE, borderRadius: 0, color: colors.ink, '&.Mui-disabled': { color: '#9ca3af' } }}
        >
          <SvgIcon>
            <path d={path} />
          </SvgIcon>
        </IconButton>
      </span>
    </Tooltip>
  )

  return (
    <Box role="group" aria-label="Zoom" ref={stopMapEvents} sx={{ ...controlStripSx, right: 10, top: 10 }}>
      {button('Zoom in', PATH_ADD, zoom >= map.getMaxZoom(), () => map.zoomIn())}
      <Divider />
      {button('Zoom out', PATH_REMOVE, zoom <= map.getMinZoom(), () => map.zoomOut())}
    </Box>
  )
}
