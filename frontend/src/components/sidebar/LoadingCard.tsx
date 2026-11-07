import { Box, Link, LinearProgress, Paper, Typography } from '@mui/material'
import { useEffect, useState } from 'react'
import { colors } from '../../theme'

/** Honest progress for a slow request: we can't know the stage, so show elapsed time and an indeterminate bar. */
export function LoadingCard({ onCancel }: { onCancel: () => void }) {
  const [seconds, setSeconds] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => clearInterval(t)
  }, [])

  return (
    <Paper role="status" aria-live="polite" sx={{ p: 4, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
        <Typography variant="body2" component="strong" sx={{ fontWeight: 700 }}>
          Finding routes and checking forecasts…
        </Typography>
        <Typography variant="body2" component="span" sx={{ color: colors.subtle, fontVariantNumeric: 'tabular-nums' }}>
          {seconds}s
        </Typography>
      </Box>
      <LinearProgress aria-hidden="true" />
      <Typography variant="caption" sx={{ color: colors.subtle }}>
        {seconds < 8
          ? 'Longer trips need more forecast lookups and can take up to 30 seconds.'
          : 'Still working. Weather data for long trips is fetched in batches; repeat searches are much faster.'}
      </Typography>
      <Link component="button" type="button" onClick={onCancel} sx={{ alignSelf: 'flex-start' }}>
        Cancel
      </Link>
    </Paper>
  )
}
