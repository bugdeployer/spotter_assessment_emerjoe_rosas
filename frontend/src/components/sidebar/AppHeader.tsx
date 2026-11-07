import { Box, Typography } from '@mui/material'
import { colors } from '../../theme'

/** App title and one line on what it does. */
export function AppHeader() {
  return (
    <Box component="header">
      <Typography variant="h1" component="h1" sx={{ fontSize: '1.25rem', letterSpacing: '-0.01em', lineHeight: 1.2 }}>
        Weather-aware truck routing
      </Typography>
      <Typography variant="body2" sx={{ color: colors.muted, mt: '2px' }}>
        Compare routes by the weather you’ll meet on the way.
      </Typography>
    </Box>
  )
}
