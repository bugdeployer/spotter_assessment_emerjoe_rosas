import { Alert, Box, Link } from '@mui/material'
import { useEffect, useMemo, useRef, useState } from 'react'
import { HeatSlider } from './components/map/HeatSlider'
import { MapView } from './components/map/MapView'
import { AppHeader } from './components/sidebar/AppHeader'
import { LoadingCard } from './components/sidebar/LoadingCard'
import { RouteList } from './components/sidebar/RouteList'
import { TripForm } from './components/sidebar/TripForm'
import { usePlanner } from './hooks/usePlanner'
import { useSimulation } from './hooks/useSimulation'
import { colors, mapPillSx } from './theme'
import type { Hazard } from './types'

export default function App() {
  const { plan, req, planReq, loading, error, selectedId, setSelectedId, editing, submit, cancel, expandForm } = usePlanner()
  const [hoveredId, setHoveredId] = useState<number | null>(null)
  const [showHeat, setShowHeat] = useState(true)
  const [hazard, setHazard] = useState<Hazard>('all')
  const mapRef = useRef<HTMLElement | null>(null)

  // Two separate bounds. The slider covers the forecast (0-48 h, or less if the forecast ends sooner) and
  // never changes with the selected route. Playback covers the selected route's trip: it stops when that
  // truck arrives (or at the slider's end, for a trip longer than the forecast range). Scrubbing past the
  // arrival keeps the truck parked at the destination.
  const forecastHours = plan?.heatmap.available ? plan.heatmap.hours : 0
  const selected = plan?.routes.find((r) => r.id === selectedId)
  const arrivalHour = plan && selected ? (new Date(selected.arrival).getTime() - new Date(plan.heatmap.start).getTime()) / 3600_000 : null
  const playbackEnd = arrivalHour === null ? forecastHours : Math.min(arrivalHour, forecastHours)
  const { hour: clock, sim, scrub, rewind } = useSimulation(playbackEnd)
  const hour = Math.min(clock, forecastHours)
  const hasMissing = useMemo(
    () => plan?.heatmap.points.some((p) => p.wind.includes('-') || p.rain.includes('-') || p.snow.includes('-')) ?? false,
    [plan],
  )

  // A new plan starts the trip over; on phones the map sits below the form, so bring it into view.
  useEffect(() => {
    if (!plan) return
    rewind()
    if (window.matchMedia('(max-width: 800px)').matches) {
      mapRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [plan, rewind])

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: { xs: 'column', md: 'row' },
        height: { md: '100vh' },
        minHeight: { xs: '100vh', md: 0 },
        p: { xs: 4, md: 0 },
        gap: { xs: 4, md: 0 },
        bgcolor: { xs: colors.canvas, md: 'transparent' },
      }}
    >
      {/* On phones the sidebar dissolves (display: contents) so its cards can interleave with the map. */}
      <Box
        component="aside"
        sx={{
          display: { xs: 'contents', md: 'flex' },
          flexDirection: 'column',
          gap: 4,
          width: { md: 400 },
          flexShrink: 0,
          overflowY: 'auto',
          px: 4,
          py: 6,
          bgcolor: colors.canvas,
          borderRight: `1px solid ${colors.line}`,
          scrollbarWidth: 'thin',
          scrollbarColor: '#cbd5e1 transparent',
        }}
      >
        <AppHeader />
        <TripForm
          loading={loading}
          collapsed={planReq !== null && !editing}
          onExpand={expandForm}
          onSubmit={submit}
        />
        {loading && <LoadingCard onCancel={cancel} />}
        {error && (
          <Alert severity="error" icon={false}>
            <Box sx={{ mb: req ? '6px' : 0 }}>{error}</Box>
            {req && (
              <Link component="button" type="button" onClick={() => submit(req)}>
                Try again
              </Link>
            )}
          </Alert>
        )}
        {plan && planReq && (
          <RouteList plan={plan} request={planReq} selectedId={selectedId} onSelect={setSelectedId} onHover={setHoveredId} />
        )}
      </Box>
      <Box
        component="main"
        ref={mapRef}
        sx={{
          position: 'relative',
          flex: { xs: 'none', md: 1 },
          minWidth: 0,
          order: { xs: 3, md: 0 },
          height: { xs: '78vh', md: 'auto' },
          minHeight: { xs: 440, md: 0 },
          borderRadius: { xs: '10px', md: 0 },
          overflow: { xs: 'hidden', md: 'visible' },
          border: { xs: `1px solid ${colors.line}`, md: 0 },
        }}
      >
        <MapView
          plan={plan}
          selectedId={selectedId}
          hoveredId={hoveredId}
          onSelect={setSelectedId}
          hour={hour}
          hazard={hazard}
          showHeat={showHeat}
          origin={planReq?.origin ?? null}
          destination={planReq?.destination ?? null}
          sim={sim}
        />
        {!plan && !loading && (
          <Box
            sx={{
              ...mapPillSx,
              bgcolor: 'rgba(255,255,255,.92)',
              border: `1px solid ${colors.line}`,
              color: colors.label,
              boxShadow: '0 2px 8px rgba(0,0,0,.1)',
            }}
          >
            Enter a trip to compare routes by weather risk.
          </Box>
        )}
        {plan && (
          <HeatSlider
            start={plan.heatmap.start}
            hours={forecastHours}
            maxHours={plan.heatmap.max_hours}
            available={plan.heatmap.available}
            hour={hour}
            onChange={scrub}
            show={showHeat}
            onToggle={setShowHeat}
            arrivalHour={arrivalHour}
            hasMissing={hasMissing}
            hazard={hazard}
            onHazard={setHazard}
            legend={plan.heatmap.legend}
            loadLb={planReq?.load_lb ?? 0}
          />
        )}
      </Box>
    </Box>
  )
}
