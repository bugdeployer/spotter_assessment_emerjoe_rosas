import { Box } from '@mui/material'
import { memo } from 'react'
import { CircleMarker, Popup } from 'react-leaflet'
import { formatTime } from '../../lib/format'
import { RISK_COLOR, RISK_NAME, UNKNOWN_COLOR } from '../../lib/risk'
import type { PlanResponse } from '../../types'

/** A forecast value for the popup; a dash where the forecast has none. */
const reading = (v: number | null, digits: number) => (v === null ? '–' : v.toFixed(digits))

interface CheckpointsProps {
  plan: PlanResponse
  selectedId: number
  onSelect: (id: number) => void
  stride: number
  dotRadius: number
}

export const Checkpoints = memo(function Checkpoints({ plan, selectedId, onSelect, stride, dotRadius }: CheckpointsProps) {
  return (
    <>
      {plan.routes.flatMap((r) => {
        // Alternatives show half as many dots as the selected route, so they stay secondary.
        const step = r.id === selectedId ? stride : stride * 2
        const shown = r.checkpoints.filter((_, i) => i % step === 0 || i === r.checkpoints.length - 1)
        return shown.map((c) => {
          const selected = r.id === selectedId
          return (
            <CircleMarker
              key={`${r.id}-${c.mile}`}
              center={[c.lat, c.lon]}
              radius={selected ? dotRadius : Math.max(3, dotRadius - 2)}
              pathOptions={{
                color: '#fff',
                weight: selected ? 2 : 1,
                fillColor: c.risk ? RISK_COLOR[c.risk] : UNKNOWN_COLOR,
                fillOpacity: selected ? 1 : 0.6,
              }}
              eventHandlers={{ click: () => onSelect(r.id) }}
            >
              <Popup>
                <strong>
                  {r.name} · mile {c.mile.toFixed(0)}
                </strong>
                <br />
                ETA {formatTime(c.eta)}
                <br />
                <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}>
                  <Box
                    component="i"
                    aria-hidden="true"
                    sx={{ display: 'inline-block', width: 9, height: 9, borderRadius: '50%', bgcolor: c.risk ? RISK_COLOR[c.risk] : UNKNOWN_COLOR }}
                  />
                  {c.risk ? RISK_NAME[c.risk] : 'No forecast for this ETA'}
                </Box>
                {c.drivers.length > 0 && ` (${c.drivers.join(', ')})`}
                <br />
                Wind {reading(c.weather.wind_mph, 0)} mph · Rain {reading(c.weather.rain_in_hr, 2)} in/hr · Snow{' '}
                {reading(c.weather.snow_in_hr, 2)} in/hr
                {c.load_rule && (
                  <>
                    <br />
                    Heavy-load wind rule raised the wind rating here.
                  </>
                )}
              </Popup>
            </CircleMarker>
          )
        })
      })}
    </>
  )
})
