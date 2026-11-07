import { createTheme, type Theme } from '@mui/material/styles'
import type { SxProps } from '@mui/material/styles'

/** The few colours the UI uses (the same values the plain stylesheet had). */
export const colors = {
  ink: '#111827',
  muted: '#4b5563',
  subtle: '#6b7280',
  line: '#e5e7eb',
  accent: '#2563eb',
  accentSoft: '#eff6ff',
  canvas: '#f9fafb',
  page: '#f3f4f6',
  inputBorder: '#d1d5db',
  label: '#374151',
  hint: '#b45309',
  danger: '#991b1b',
}

export const theme = createTheme({
  // 4-unit spacing scale: sx={{ p: 4 }} is 16px. Tight inside a group, generous between groups.
  spacing: 4,
  // The layout switches to the side-by-side desktop arrangement above 800px.
  breakpoints: { values: { xs: 0, sm: 600, md: 801, lg: 1200, xl: 1536 } },
  shape: { borderRadius: 8 },
  palette: {
    primary: { main: colors.accent, dark: '#1d4ed8', contrastText: '#fff' },
    text: { primary: colors.ink, secondary: colors.muted, disabled: colors.muted },
    divider: colors.line,
    background: { default: colors.page, paper: '#fff' },
    error: { main: colors.danger },
  },
  typography: {
    // The system font: nothing to download, and it matches the user's OS.
    fontFamily: 'system-ui, sans-serif',
    h1: { fontSize: '1.15rem', fontWeight: 700, lineHeight: 1.3 },
    h2: { fontSize: '0.95rem', fontWeight: 700, lineHeight: 1.3 },
    body1: { fontSize: '0.9rem', lineHeight: 1.45 },
    body2: { fontSize: '0.85rem', lineHeight: 1.4 },
    caption: { fontSize: '0.75rem', lineHeight: 1.35 },
    button: { textTransform: 'none', fontWeight: 700 },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        // Browser surfaces the page didn't draw: selection, form accents.
        '::selection': { background: '#bfdbfe', color: colors.ink },
        'input, select': { accentColor: colors.accent, caretColor: colors.accent },
        // Markup that Leaflet creates itself (map pins, the truck, popup text) can't be a MUI component,
        // so its styles live here, in the theme, with everything else.
        '.pin': {
          width: 18,
          height: 18,
          borderRadius: '50%',
          border: '3px solid #fff',
          boxShadow: '0 1px 4px rgba(0,0,0,.5)',
        },
        '.truck': {
          width: 34,
          height: 34,
          borderRadius: '50%',
          background: '#fff',
          border: `2px solid ${colors.ink}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 2px 6px rgba(0,0,0,.35)',
        },
        '.truck-label': { fontSize: '0.7rem', fontWeight: 700, padding: '1px 6px' },
        // Reduced motion: no endless sliding bar and no fade on the heat layer.
        '@media (prefers-reduced-motion: reduce)': {
          '.heat-canvas': { transition: 'none !important' },
          '.MuiLinearProgress-bar2': { display: 'none' },
          '.MuiLinearProgress-bar1': { animation: 'none !important', left: '0 !important', right: '0 !important', opacity: 0.4 },
          '.MuiCircularProgress-root': { animation: 'none !important' },
          '.MuiCircularProgress-circle': { animation: 'none !important' },
        },
      },
    },
    MuiPaper: {
      defaultProps: { variant: 'outlined' },
      styleOverrides: { root: { borderRadius: 10 } },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { borderRadius: 8, fontWeight: 700 },
        contained: {
          '&.Mui-disabled': { backgroundColor: colors.line, color: colors.muted },
        },
      },
    },
    MuiLink: {
      defaultProps: { underline: 'always' },
      styleOverrides: { root: { fontWeight: 600, textUnderlineOffset: '3px' } },
    },
    // Labels sit above their fields (not floating inside them), as small bold text.
    MuiFormLabel: {
      styleOverrides: {
        root: {
          display: 'block',
          marginBottom: 4,
          fontSize: '0.8rem',
          fontWeight: 600,
          color: colors.label,
          '&.Mui-focused': { color: colors.label },
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 6,
          fontSize: '0.8rem',
          '& .MuiOutlinedInput-notchedOutline': { borderColor: colors.inputBorder },
        },
        input: { padding: '8px', lineHeight: 1.3, height: 'auto' },
      },
    },
    MuiFormHelperText: {
      styleOverrides: { root: { margin: '4px 0 0', fontSize: '0.75rem', color: colors.subtle } },
    },
    MuiAutocomplete: {
      styleOverrides: {
        paper: { boxShadow: '0 6px 16px rgba(0,0,0,.12)', fontSize: '0.8rem' },
        option: { fontSize: '0.8rem', padding: '8px', '&.Mui-focused': { backgroundColor: colors.accentSoft } },
        noOptions: { fontSize: '0.8rem' },
        loading: { fontSize: '0.8rem' },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontSize: '0.7rem', fontWeight: 600, color: colors.ink, backgroundColor: colors.line, height: 20 },
        label: { padding: '0 8px' },
      },
    },
    MuiLinearProgress: {
      styleOverrides: { root: { height: 4, borderRadius: 2, backgroundColor: colors.line } },
    },
    MuiAlert: {
      styleOverrides: {
        // A function, so it outranks MUI's own severity colours for this one variant.
        root: ({ ownerState }) => ({
          padding: 16,
          borderRadius: 10,
          ...(ownerState.severity === 'error' && {
            backgroundColor: '#fef2f2',
            color: colors.danger,
            border: '1px solid #fca5a5',
          }),
        }),
        message: { padding: 0, fontSize: '0.85rem' },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          flexDirection: 'column',
          alignItems: 'stretch',
          gap: 3,
          padding: '10px 8px',
          borderRadius: 8,
          '&:hover': { backgroundColor: colors.page },
          '&.Mui-selected, &.Mui-selected:hover': {
            backgroundColor: colors.accentSoft,
            boxShadow: `inset 0 0 0 2px ${colors.accent}`,
          },
        },
      },
    },
    MuiCheckbox: { defaultProps: { size: 'small' }, styleOverrides: { root: { padding: 4 } } },
    MuiToggleButtonGroup: {
      styleOverrides: { root: { border: `1px solid ${colors.line}`, borderRadius: 8, overflow: 'hidden' } },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: {
          border: 0,
          borderRadius: 0,
          padding: '6px 4px',
          fontSize: '0.78rem',
          fontWeight: 600,
          color: colors.ink,
          '&:not(:first-of-type)': { borderLeft: `1px solid ${colors.line}`, marginLeft: 0 },
          '&.Mui-selected, &.Mui-selected:hover': { backgroundColor: colors.ink, color: '#fff' },
          '&.Mui-disabled': { color: colors.muted, border: 0 },
        },
      },
    },
    MuiSlider: {
      styleOverrides: {
        root: { padding: '8px 0', '&.Mui-disabled': { color: colors.line } },
        rail: { backgroundColor: colors.line, opacity: 1 },
        // The arrival mark: a thin tick on the track with a small label under it.
        mark: { width: 2, height: 14, borderRadius: 1, backgroundColor: colors.ink, opacity: 1, transform: 'translate(-1px, -50%)' },
        markActive: { backgroundColor: colors.ink, opacity: 1 },
        markLabel: { fontSize: '0.7rem', fontWeight: 600, color: colors.muted, fontVariantNumeric: 'tabular-nums', top: 28 },
      },
    },
  },
})

/** A small rounded note floating on the map, centred between the two button strips (left and right). */
export const mapPillSx: SxProps<Theme> = {
  position: 'absolute',
  zIndex: 1000,
  top: 14,
  left: 64,
  right: 64,
  width: 'max-content',
  maxWidth: 'calc(100% - 128px)',
  mx: 'auto',
  textAlign: 'center',
  px: 3,
  py: 2,
  borderRadius: '99px',
  fontSize: '0.85rem',
  pointerEvents: 'none',
}
