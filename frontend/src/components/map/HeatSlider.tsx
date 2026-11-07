import { Box, Checkbox, FormControlLabel, Paper, Slider, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material'
import { formatTime } from '../../lib/format'
import { colors } from '../../theme'
import { HEAT_COLOR, RISK_NAME, RISK_ORDER, UNKNOWN_COLOR } from '../../lib/risk'
import type { Hazard, HazardLegend } from '../../types'

const HAZARDS: { id: Hazard; label: string }[] = [
  { id: 'all', label: 'Overall' },
  { id: 'wind', label: 'Wind' },
  { id: 'rain', label: 'Rain' },
  { id: 'snow', label: 'Snow' },
]

interface Props {
  start: string
  /** Last forecast hour the slider reaches: `maxHours` (48), or less when the forecast ends sooner. */
  hours: number
  maxHours: number
  /** False when the forecast covers no hour at all: there is nothing to scrub. */
  available: boolean
  hour: number
  onChange: (h: number) => void
  show: boolean
  onToggle: (v: boolean) => void
  /** Hours after `start` at which the selected route's truck arrives (may be past the slider's end). */
  arrivalHour: number | null
  /** Some heat samples have no forecast: show the grey "No data" key. */
  hasMissing: boolean
  hazard: Hazard
  onHazard: (h: Hazard) => void
  legend: Record<Exclude<Hazard, 'all'>, HazardLegend>
  loadLb: number
}

/** Hours for a label: whole hours as-is, otherwise one decimal (so +48.3 h never reads as +48 h). */
const hoursLabel = (h: number) => (Math.round(h * 10) / 10).toString()

/** One plain sentence saying what the colours on the map mean right now. */
function describe(hazard: Hazard, loadLb: number): string {
  const load = `${loadLb.toLocaleString()} lb load`
  switch (hazard) {
    case 'all':
      return `Worst of wind, rain and snow at this time, rated for your ${load}.`
    case 'wind':
      return `Wind speed, rated for your ${load}.${loadLb > 30_000 ? ' Heavy loads count wind as riskier.' : ''}`
    case 'rain':
      return 'Rain rate, in inches per hour.'
    case 'snow':
      return 'Snow rate, in inches per hour.'
  }
}

export function HeatSlider({
  start,
  hours,
  maxHours,
  available,
  hour,
  onChange,
  show,
  onToggle,
  arrivalHour,
  hasMissing,
  hazard,
  onHazard,
  legend,
  loadLb,
}: Props) {
  const timeAt = (h: number) => formatTime(new Date(new Date(start).getTime() + h * 3600_000).toISOString())
  const ranges = hazard === 'all' ? null : legend[hazard]
  const arrivalShown = arrivalHour !== null && arrivalHour <= hours
  const caption = { fontSize: '0.7rem', color: colors.muted, fontVariantNumeric: 'tabular-nums' } as const
  return (
    <Paper
      sx={{
        position: 'absolute',
        zIndex: 1000,
        left: '50%',
        bottom: { xs: 40, md: 20 }, // on phones the map credit wraps to two lines; stay clear of it
        transform: 'translateX(-50%)',
        width: 'min(560px, calc(100% - 32px))',
        display: 'flex',
        flexDirection: 'column',
        gap: { xs: 1, md: '6px' },
        px: 3,
        py: { xs: 2, md: 3 },
        boxShadow: '0 4px 16px rgba(0,0,0,.15)',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontVariantNumeric: 'tabular-nums' }}>
        <FormControlLabel
          sx={{ m: 0, gap: 1 }}
          control={<Checkbox checked={show} onChange={(e) => onToggle(e.target.checked)} />}
          label="Weather risk"
          slotProps={{ typography: { variant: 'body2', sx: { fontWeight: 600 } } }}
        />
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          +{Math.floor(hour)}h · {timeAt(hour)}
        </Typography>
      </Box>
      <ToggleButtonGroup
        exclusive
        fullWidth
        size="small"
        value={hazard}
        disabled={!show}
        aria-label="Show weather risk for"
        onChange={(_, next: Hazard | null) => next && onHazard(next)}
        sx={{ opacity: show ? 1 : 0.5 }}
      >
        {HAZARDS.map((h) => (
          <ToggleButton key={h.id} value={h.id}>
            {h.label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
      <Typography variant="caption" sx={{ color: colors.muted, lineHeight: 1.35 }}>
        {!available
          ? 'No forecast covers this departure, so there is no weather heat to show and nothing to play.'
          : show
            ? describe(hazard, loadLb)
            : 'The map heat is hidden. The slider still moves the truck.'}
      </Typography>
      {available && (
        <>
          {/* Not disabled when the heatmap is hidden: the slider also moves the truck. */}
          <Slider
            value={hour}
            min={0}
            max={hours}
            step={1}
            onChange={(_, v) => onChange(v as number)}
            marks={arrivalShown ? [{ value: arrivalHour, label: `Arrives +${Math.round(arrivalHour)} h` }] : false}
            aria-label="Forecast hour after departure"
            getAriaValueText={(v) =>
              `${Math.floor(v)} hours after departure, ${timeAt(v)}` +
              (arrivalHour !== null && v >= arrivalHour ? ', truck at destination' : '')
            }
            sx={{ mx: '8px', width: 'auto', mb: arrivalShown ? 5 : 0 }}
          />
          <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, px: '8px', ...caption }}>
            <span>Departs {timeAt(0)}</span>
            <Box component="span" sx={{ textAlign: 'right', fontWeight: hours < maxHours ? 600 : 400 }}>
              {hours < maxHours ? `Forecast available through +${hours} h` : `+${hours} h`}
            </Box>
          </Box>
          {arrivalHour !== null && !arrivalShown && (
            // The trip outlasts the slider: playback ends at the slider's end with the truck still en route.
            <Box component="span" role="status" sx={{ px: '8px', ...caption, color: colors.ink, fontWeight: 600 }}>
              Playback {hour >= hours ? 'stopped' : 'stops'} at +{hours} h · Route arrives at +{hoursLabel(arrivalHour)} h (
              {timeAt(arrivalHour)}).{' '}
              <Box component="span" sx={{ fontWeight: 400, color: colors.muted }}>
                {hours < maxHours ? 'The forecast ends there.' : `The forecast slider covers ${maxHours} hours.`}
              </Box>
            </Box>
          )}
        </>
      )}
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '4px 10px',
          fontSize: { xs: '0.65rem', md: '0.7rem' },
          color: colors.muted,
        }}
      >
        {RISK_ORDER.map((k, i) => (
          <Box key={k} component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <Box
              component="i"
              aria-hidden="true"
              sx={{ display: 'inline-block', flex: 'none', width: { xs: 10, md: 12 }, height: { xs: 10, md: 12 }, borderRadius: '3px', bgcolor: HEAT_COLOR[k] }}
            />
            {RISK_NAME[k]}
            {ranges && (
              <Box component="b" sx={{ fontWeight: 600, color: colors.ink, fontVariantNumeric: 'tabular-nums' }}>
                {ranges.bands[i]}
              </Box>
            )}
          </Box>
        ))}
        {hasMissing && (
          <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <Box
              component="i"
              aria-hidden="true"
              sx={{ display: 'inline-block', flex: 'none', width: { xs: 10, md: 12 }, height: { xs: 10, md: 12 }, borderRadius: '3px', bgcolor: UNKNOWN_COLOR }}
            />
            No data
          </Box>
        )}
        {ranges && (
          <Box component="span" sx={{ ml: 'auto', fontWeight: 600, color: colors.muted }}>
            {ranges.unit}
          </Box>
        )}
      </Box>
    </Paper>
  )
}
