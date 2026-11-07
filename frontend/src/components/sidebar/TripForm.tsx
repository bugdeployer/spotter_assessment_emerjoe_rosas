import { Box, Button, FormControl, FormHelperText, FormLabel, Link, OutlinedInput, Paper, Select, Typography } from '@mui/material'
import { memo, useState } from 'react'
import { toLocalInput } from '../../lib/format'
import { colors } from '../../theme'
import type { Place, PlanRequest } from '../../types'
import { PlaceInput } from './PlaceInput'

interface Props {
  loading: boolean
  /** After a search the form steps back into a one-line summary so the results lead. */
  collapsed: boolean
  onExpand: () => void
  onSubmit: (req: PlanRequest) => void
}

const cityName = (p: Place | null) => p?.label.split(',')[0] ?? ''

export const TripForm = memo(function TripForm({ loading, collapsed, onExpand, onSubmit }: Props) {
  const [origin, setOrigin] = useState<Place | null>(null)
  const [destination, setDestination] = useState<Place | null>(null)
  const [departure, setDeparture] = useState(() => toLocalInput(new Date(Date.now() + 3600_000)))
  const [load, setLoad] = useState(35000)
  const [interval, setIntervalMiles] = useState<10 | 25 | 50>(25)

  // Forecast window the server accepts: now .. 4 days ahead.
  const minDeparture = toLocalInput(new Date(Date.now() - 60_000))
  const maxDeparture = toLocalInput(new Date(Date.now() + 4 * 86_400_000 - 60_000))

  const ready = origin && destination && departure && load >= 0

  if (collapsed) {
    return (
      <Paper sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 3, px: 4, py: 3 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
          <Typography variant="h2" component="strong" noWrap>
            {cityName(origin)} → {cityName(destination)}
          </Typography>
          <Typography variant="body2" sx={{ fontSize: '0.8rem', color: colors.muted, fontVariantNumeric: 'tabular-nums' }}>
            {new Date(departure).toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' })} ·{' '}
            {load.toLocaleString()} lb · every {interval} mi
          </Typography>
        </Box>
        {/* Padding and negative margin enlarge the hit area without changing the layout. */}
        <Link component="button" type="button" onClick={onExpand} sx={{ flex: 'none', alignSelf: 'center', p: '12px 4px', m: '-12px -4px' }}>
          Change trip
        </Link>
      </Paper>
    )
  }

  return (
    <Paper
      component="form"
      sx={{ p: 4, display: 'flex', flexDirection: 'column', gap: 3 }}
      onSubmit={(e: React.FormEvent) => {
        e.preventDefault()
        if (!origin || !destination) return
        onSubmit({
          origin,
          destination,
          departure: new Date(departure).toISOString(),
          load_lb: load,
          interval_miles: interval,
        })
      }}
    >
      <PlaceInput label="Origin" value={origin} onChange={setOrigin} />
      <PlaceInput label="Destination" value={destination} onChange={setDestination} />
      {/* Required by the place-search provider's terms (free plan) and by the OpenStreetMap licence. */}
      <Typography variant="caption" component="p" sx={{ mt: -2, color: colors.muted }}>
        Place search powered by{' '}
        <Link href="https://www.geoapify.com/" target="_blank" rel="noopener noreferrer">
          Geoapify
        </Link>{' '}
        · ©{' '}
        <Link href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">
          OpenStreetMap
        </Link>{' '}
        contributors
      </Typography>
      <FormControl fullWidth>
        <FormLabel htmlFor="departure">Departure</FormLabel>
        <OutlinedInput
          id="departure"
          type="datetime-local"
          value={departure}
          onChange={(e) => setDeparture(e.target.value)}
          inputProps={{ min: minDeparture, max: maxDeparture }}
          required
        />
        <FormHelperText>Forecasts are available up to 4 days ahead.</FormHelperText>
      </FormControl>
      <Box sx={{ display: 'flex', gap: 3 }}>
        <FormControl sx={{ flex: 1 }}>
          <FormLabel htmlFor="load">Load (lb)</FormLabel>
          <OutlinedInput
            id="load"
            type="number"
            value={load}
            onChange={(e) => setLoad(Number(e.target.value))}
            inputProps={{ min: 0, max: 200000, step: 1 }}
            required
          />
        </FormControl>
        <FormControl sx={{ flex: 1 }}>
          <FormLabel htmlFor="interval">Checkpoint every</FormLabel>
          {/* Native select: the operating system's own picker, which is the best control on a phone. */}
          <Select
            native
            value={interval}
            onChange={(e) => setIntervalMiles(Number(e.target.value) as 10 | 25 | 50)}
            inputProps={{ id: 'interval' }}
          >
            <option value={10}>10 mi</option>
            <option value={25}>25 mi</option>
            <option value={50}>50 mi</option>
          </Select>
        </FormControl>
      </Box>
      {(!origin || !destination) && <FormHelperText sx={{ m: 0 }}>Pick origin and destination from the suggestions.</FormHelperText>}
      <Button type="submit" variant="contained" fullWidth disabled={!ready || loading} sx={{ py: '10px' }}>
        {loading ? 'Analysing routes…' : 'Find safest route'}
      </Button>
    </Paper>
  )
})
