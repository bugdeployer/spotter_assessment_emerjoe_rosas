import { Box, Button, Divider, IconButton, SvgIcon, Tooltip } from '@mui/material'
import { colors } from '../../theme'
import { SPEEDS, type SimControls } from '../../hooks/useSimulation'
import { CONTROL_SIZE as SIZE, controlStripSx, stopMapEvents } from './mapControlStyle'

// Material Design icon paths (the same family as the rest of the UI's icons).
const PATH_PLAY = 'M8 5v14l11-7z'
const PATH_PAUSE = 'M6 19h4V5H6v14zm8-14v14h4V5h-4z'
const PATH_FOLLOW =
  'M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3A8.994 8.994 0 0 0 13 3.06V1h-2v2.06A8.994 8.994 0 0 0 3.06 11H1v2h2.06A8.994 8.994 0 0 0 11 20.94V23h2v-2.06A8.994 8.994 0 0 0 20.94 13H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z'
const PATH_FIT =
  'M15 3l2.3 2.3-2.89 2.87 1.42 1.42L18.7 6.7 21 9V3zM3 9l2.3-2.3 2.87 2.89 1.42-1.42L6.7 5.3 9 3H3zm6 12l-2.3-2.3 2.89-2.87-1.42-1.42L5.3 17.3 3 15v6zm12-6l-2.3 2.3-2.87-2.89-1.42 1.42 2.89 2.87L15 21h6z'

interface Props extends SimControls {
  onFit: () => void
}

/**
 * Trip simulation controls, top left, a twin of the zoom strip on the right:
 * play/pause, speed, follow the truck, and show the whole trip.
 */
export function MapControls({ playing, onPlayPause, speedIndex, onCycleSpeed, follow, onFollowChange, onFit }: Props) {
  const speed = SPEEDS[speedIndex]
  const hourWord = speed.hoursPerSecond === 1 ? 'hour' : 'hours'
  return (
    <Box
      role="group"
      aria-label="Trip simulation"
      ref={stopMapEvents}
      sx={{ ...controlStripSx, left: 10, top: 10 }}
    >
      <Tooltip title={playing ? 'Pause the trip' : 'Play the trip'} placement="right">
        <IconButton
          onClick={onPlayPause}
          aria-label={playing ? 'Pause the trip simulation' : 'Play the trip simulation'}
          sx={{
            width: SIZE,
            height: SIZE,
            borderRadius: 0,
            color: playing ? '#fff' : colors.accent,
            bgcolor: playing ? colors.accent : 'transparent',
            '&:hover': { bgcolor: playing ? '#1d4ed8' : colors.accentSoft },
          }}
        >
          <SvgIcon>
            <path d={playing ? PATH_PAUSE : PATH_PLAY} />
          </SvgIcon>
        </IconButton>
      </Tooltip>
      <Divider />
      <Tooltip title={`Speed ${speed.label}: ${speed.hoursPerSecond} ${hourWord} of travel per second. Click to change.`} placement="right">
        <Button
          onClick={onCycleSpeed}
          aria-label={`Playback speed ${speed.label}. Press to change.`}
          sx={{ minWidth: 0, width: SIZE, height: { xs: 40, md: 34 }, borderRadius: 0, color: colors.ink, fontSize: '0.8rem', fontVariantNumeric: 'tabular-nums' }}
        >
          {speed.label}
        </Button>
      </Tooltip>
      <Divider />
      <Tooltip title={follow ? 'Stop following the truck' : 'Follow the truck'} placement="right">
        <IconButton
          onClick={() => onFollowChange(!follow)}
          aria-label="Follow the truck"
          aria-pressed={follow}
          sx={{
            width: SIZE,
            height: SIZE,
            borderRadius: 0,
            color: follow ? colors.accent : colors.muted,
            bgcolor: follow ? colors.accentSoft : 'transparent',
            boxShadow: follow ? `inset 0 0 0 2px ${colors.accent}` : 'none',
          }}
        >
          <SvgIcon>
            <path d={PATH_FOLLOW} />
          </SvgIcon>
        </IconButton>
      </Tooltip>
      <Divider />
      <Tooltip title="Show the whole trip" placement="right">
        <IconButton onClick={onFit} aria-label="Show the whole trip" sx={{ width: SIZE, height: SIZE, borderRadius: 0, color: colors.muted }}>
          <SvgIcon>
            <path d={PATH_FIT} />
          </SvgIcon>
        </IconButton>
      </Tooltip>
    </Box>
  )
}
