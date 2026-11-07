import { Box, Button, Chip, Link, List, ListItem, ListItemButton, Paper, SvgIcon, Typography } from '@mui/material'
import { memo, useState } from 'react'
import { formatDuration, formatTime } from '../../lib/format'
import { googleMapsUrl } from '../../lib/googleMaps'
import { ALTERNATIVE_DASH, routeColor } from '../../lib/routeStyle'
import { colors } from '../../theme'
import { RISK_COLOR, RISK_NAME, RISK_ORDER, UNKNOWN_COLOR } from '../../lib/risk'
import type { PlanRequest, PlanResponse, Route } from '../../types'

interface Props {
  plan: PlanResponse
  request: PlanRequest
  selectedId: number
  onSelect: (id: number) => void
  onHover: (id: number | null) => void
}

const tabular = { fontVariantNumeric: 'tabular-nums' } as const
const miles = (n: number) => `${n.toFixed(0)} mi`

/** A small coloured dot standing for a risk level (the label next to it carries the meaning). */
function Dot({ color, size = 9 }: { color: string; size?: number }) {
  return <Box component="i" aria-hidden="true" sx={{ display: 'inline-block', flex: 'none', width: size, height: size, borderRadius: '50%', bgcolor: color }} />
}

/** A short sample of the route's map line: same colour, solid if recommended, dashed otherwise. */
function LineSwatch({ route }: { route: Route }) {
  return (
    <Box component="svg" sx={{ flex: 'none' }} width="40" height="10" viewBox="0 0 40 10" aria-hidden="true">
      <line
        x1="3"
        x2="37"
        y1="5"
        y2="5"
        stroke={routeColor(route.id)}
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={route.recommended ? undefined : ALTERNATIVE_DASH}
      />
    </Box>
  )
}

/** The worst level that still matters on a route, as a plain sentence (or null if calm). */
function residualRisk(route: Route): string | null {
  const m = route.miles_by_risk
  const levels = [
    ['no_travel', 'No travel'],
    ['severe', 'Severe'],
    ['high', 'High-risk'],
  ] as const
  for (const [key, label] of levels) {
    if (m[key] > 0) return `${label} weather on about ${miles(m[key])} of this route.`
  }
  return null
}

/** Headline and the sentence under it, for each recommendation state. */
function verdict(plan: PlanResponse, winner: Route | undefined): { title: string; detail: string | null } {
  switch (plan.recommendation_status) {
    case 'recommended': {
      const risky = winner!.max_risk === 'severe'
      return { title: risky ? `Safest option: ${winner!.name}` : `Take ${winner!.name}`, detail: null }
    }
    case 'winner_has_no_travel':
      return {
        title: 'No route recommended',
        detail: `${winner!.name} compares best on Severe miles, High miles, average risk and travel time, but it crosses No Travel weather on about ${miles(winner!.miles_by_risk.no_travel)}.`,
      }
    case 'all_routes_no_travel':
      return {
        title: 'Every route crosses No Travel weather',
        detail: `None can be recommended for this departure. ${winner!.name} compares best on the other criteria.`,
      }
    case 'no_complete_forecast':
      return {
        title: 'No recommendation',
        detail: 'The forecast doesn’t reach every checkpoint on any route, so routes can’t be compared fairly. An earlier departure keeps more of the trip inside the forecast.',
      }
  }
}

function RecommendedSummary({ plan, request, selectedId, onSelect }: Omit<Props, 'onHover'>) {
  const [openedAt] = useState(() => Date.now())
  const winner = plan.routes.find((r) => r.id === plan.comparison_winner_id)
  const recommended = plan.recommendation_status === 'recommended'
  const { title, detail } = verdict(plan, winner)
  const residual = winner && recommended ? residualRisk(winner) : null
  const hits = winner?.load_rule_checkpoints ?? 0
  // The button follows the route currently selected on the map.
  const chosen = plan.routes.find((r) => r.id === selectedId) ?? plan.routes[0]
  // Google Maps routes from "now"; say so when the planned departure is meaningfully different.
  const departsLater = Math.abs(Date.parse(request.departure) - openedAt) > 3600_000
  return (
    <Paper
      component="section"
      aria-labelledby="recommend-title"
      sx={{ order: { xs: 1, md: 0 }, p: 4, display: 'flex', flexDirection: 'column', gap: 2, border: `2px solid ${recommended ? colors.ink : colors.danger}` }}
    >
      <Typography id="recommend-title" variant="h2" component="h2" sx={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: '1.15rem' }}>
        {recommended && winner && <LineSwatch route={winner} />}
        {title}
      </Typography>
      {detail && <Typography sx={{ fontWeight: 600, color: recommended ? colors.ink : colors.danger }}>{detail}</Typography>}
      {winner && (
        <Typography sx={tabular}>
          {!recommended && `${winner.name}: `}
          {winner.distance_mi.toFixed(0)} mi · {formatDuration(winner.duration_s)} · arrives {formatTime(winner.arrival)}
          <br />
          via {winner.roads.join(', ') || 'local roads'}
        </Typography>
      )}
      {winner && <Typography sx={{ fontWeight: recommended ? 600 : 400 }}>{plan.explanation}</Typography>}
      {residual && (
        <Typography variant="body2" sx={{ fontWeight: 600, color: colors.danger }}>
          {residual}
        </Typography>
      )}
      <Typography variant="caption" component="p" sx={{ fontSize: '0.8rem', lineHeight: 1.45, color: colors.muted }}>
        Rated for a {request.load_lb.toLocaleString()} lb load, using the forecast for the time you reach each checkpoint
        (every {request.interval_miles} mi).
        {hits > 0 && ` The heavy-load wind rule raised the wind rating at ${hits} checkpoint${hits === 1 ? '' : 's'}.`}
      </Typography>
      <Button
        component="a"
        href={googleMapsUrl(chosen, request.origin, request.destination)}
        target="_blank"
        rel="noopener noreferrer"
        variant={recommended ? 'contained' : 'outlined'}
        fullWidth
        aria-label={`Open ${chosen.name} in Google Maps (opens in a new tab)`}
        endIcon={
          <SvgIcon fontSize="small" aria-hidden="true">
            <path d="M6 6v2h8.59L5 17.59 6.41 19 16 9.41V18h2V6z" />
          </SvgIcon>
        }
        sx={{ mt: 1, py: '11px', fontSize: '0.9rem' }}
      >
        {recommended && chosen.id === winner?.id ? 'Continue in Google Maps' : `Open ${chosen.name} in Google Maps`}
      </Button>
      {departsLater && (
        <Typography variant="caption" component="p" sx={{ fontSize: '0.8rem', lineHeight: 1.45, color: colors.muted }}>
          Google Maps starts from now. It can’t take your planned departure time.
        </Typography>
      )}
      {winner && selectedId !== winner.id && (
        <Link component="button" type="button" onClick={() => onSelect(winner.id)} sx={{ alignSelf: 'flex-start' }}>
          {recommended ? 'Show the recommended route on the map' : `Show ${winner.name} on the map`}
        </Link>
      )}
    </Paper>
  )
}

function RouteRow({
  route,
  reference,
  selected,
  onSelect,
  onHover,
}: {
  route: Route
  /** The route others are compared against for travel time (the winner), if any. */
  reference: Route | undefined
  selected: boolean
  onSelect: (id: number) => void
  onHover: (id: number | null) => void
}) {
  const nonLow = RISK_ORDER.filter((k) => route.miles_by_risk[k] > 0 && k !== 'low')
  const diff = reference ? route.duration_s - reference.duration_s : 0
  const barLabel = [
    ...RISK_ORDER.filter((k) => route.miles_by_risk[k] > 0).map((k) => `${RISK_NAME[k]} ${miles(route.miles_by_risk[k])}`),
    ...(route.unknown_miles > 0 ? [`No forecast ${miles(route.unknown_miles)}`] : []),
  ].join(', ')

  return (
    <ListItem disablePadding>
      <ListItemButton
        selected={selected}
        onClick={() => onSelect(route.id)}
        onMouseEnter={() => onHover(route.id)}
        onMouseLeave={() => onHover(null)}
        onFocus={() => onHover(route.id)}
        onBlur={() => onHover(null)}
        aria-pressed={selected}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <LineSwatch route={route} />
          <Typography component="strong" sx={{ fontWeight: 700 }}>
            {route.name}
          </Typography>
          {route.recommended && <Chip label="Recommended" size="small" />}
          {route.comparison_winner && !route.recommended && <Chip label="Best compared" size="small" variant="outlined" />}
          {!route.forecast_complete && <Chip label="Not compared" size="small" variant="outlined" />}
          <Typography
            variant="caption"
            component="span"
            title="The highest risk level at any checkpoint with a forecast"
            sx={{ ml: 'auto', display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 600, color: colors.ink }}
          >
            <Dot color={route.max_risk ? RISK_COLOR[route.max_risk] : UNKNOWN_COLOR} />
            Highest risk: {route.max_risk ? RISK_NAME[route.max_risk] : 'unknown'}
          </Typography>
        </Box>
        <Typography variant="body2" sx={tabular}>
          {route.distance_mi.toFixed(0)} mi · {formatDuration(route.duration_s)} · arrives {formatTime(route.arrival)}
        </Typography>
        {reference && route.id !== reference.id && diff !== 0 && (
          <Typography variant="body2" sx={{ ...tabular, fontSize: '0.8rem', color: colors.muted }}>
            {formatDuration(Math.abs(diff))} {diff > 0 ? 'longer' : 'shorter'} than {reference.name}
          </Typography>
        )}
        <Typography variant="caption" sx={{ color: colors.muted }}>
          via {route.roads.join(', ') || 'local roads'}
        </Typography>
        <Box
          role="img"
          aria-label={`Route miles by risk: ${barLabel}`}
          sx={{ display: 'flex', height: 8, borderRadius: '4px', overflow: 'hidden', mt: '6px', mb: '2px', bgcolor: colors.line }}
        >
          {RISK_ORDER.map((k) => (
            <Box key={k} component="span" sx={{ width: `${(route.miles_by_risk[k] / route.distance_mi) * 100}%`, bgcolor: RISK_COLOR[k] }} />
          ))}
          <Box component="span" sx={{ width: `${(route.unknown_miles / route.distance_mi) * 100}%`, bgcolor: UNKNOWN_COLOR }} />
        </Box>
        <Typography variant="caption" component="div" sx={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', color: colors.label }}>
          {nonLow.length === 0 && route.unknown_miles === 0 ? (
            <span>Low risk the whole way</span>
          ) : (
            <>
              {nonLow.map((k) => (
                <Box key={k} component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                  <Dot color={RISK_COLOR[k]} />
                  {RISK_NAME[k]} {miles(route.miles_by_risk[k])}
                </Box>
              ))}
              {route.unknown_miles > 0 && (
                <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                  <Dot color={UNKNOWN_COLOR} />
                  No forecast {miles(route.unknown_miles)}
                </Box>
              )}
              {route.avg_risk !== null && (
                <span title="Distance-weighted average of the risk levels, from 0 (Low) to 4 (No travel)">
                  Average risk {route.avg_risk.toFixed(2)} of 4
                </span>
              )}
            </>
          )}
        </Typography>
        {!route.forecast_complete && (
          <Typography variant="caption" sx={{ mt: 1, color: '#92400e' }}>
            No forecast for about {miles(route.unknown_miles)} of this trip (past the forecast’s end, or missing data), so
            it isn’t compared with the others.
          </Typography>
        )}
      </ListItemButton>
    </ListItem>
  )
}

export const RouteList = memo(function RouteList({ plan, request, selectedId, onSelect, onHover }: Props) {
  const reference = plan.routes.find((r) => r.id === plan.comparison_winner_id)
  const found = plan.routes.length
  return (
    <>
      <RecommendedSummary plan={plan} request={request} selectedId={selectedId} onSelect={onSelect} />
      <Paper component="section" aria-labelledby="compare-title" sx={{ order: { xs: 4, md: 0 }, p: 4 }}>
        <Typography id="compare-title" variant="h2" component="h2">
          Compare routes
        </Typography>
        <Typography variant="caption" component="p" sx={{ mt: '2px', mb: 2, color: colors.muted }}>
          On the map, the recommended route is a solid line and the others are dashed.
          {found < plan.routes_requested &&
            ` Only ${found} distinct route${found === 1 ? ' was' : 's were'} found for this trip (${plan.routes_requested} requested).`}
        </Typography>
        <List disablePadding sx={{ mx: -1, '& li + li': { borderTop: `1px solid ${colors.line}` } }}>
          {plan.routes.map((r) => (
            <RouteRow key={r.id} route={r} reference={reference} selected={r.id === selectedId} onSelect={onSelect} onHover={onHover} />
          ))}
        </List>
      </Paper>
    </>
  )
})
