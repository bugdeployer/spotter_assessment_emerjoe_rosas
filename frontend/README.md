# Frontend

React + TypeScript (Vite) single-page app with a Leaflet map, styled with Material UI (MUI). See the [project README](../README.md) for what the app does and how to run everything.

```bash
npm install
npm run dev     # http://localhost:5173, proxies /api to the Django server on :8000
npm run build   # production bundle into dist/ (served by Django via WhiteNoise)
```

Source layout: `src/App.tsx` (page layout only), `src/hooks/` (`usePlanner` runs searches, `useSimulation` is the trip clock and playback controls, `useFollowCamera` keeps the map on the truck), `src/components/sidebar/` (trip form, place search, route cards, loading card), `src/components/map/` (map, `TripLayers`, route lines, checkpoints, markers, heat layer, hour slider, `MapControls` top left, `ZoomControls` top right, `mapControlStyle.ts` for the look they share, `viewport.ts` for zoom thresholds and framing), `src/lib/` (API client, formatting, geometry, truck position, risk colours and names, route line colours, Google Maps link) and `src/types.ts` (the API's response shapes).

## Styling

All styling is MUI: there are no CSS files (apart from Leaflet's own). `src/theme.ts` holds the one theme: colours, the 4-unit spacing scale (`sx={{ p: 4 }}` is 16px), the 800px layout breakpoint (`md` and up is the side-by-side layout), the system font, and per-component overrides. Components use MUI parts (`Autocomplete` for the place fields, `Slider` for the hour slider with the arrival tick as a mark, `ToggleButtonGroup` for the hazard switch) and `sx` for layout. Markup that Leaflet creates itself (map pins, the truck, popup text) cannot be a MUI component, so its few styles live in the theme's `MuiCssBaseline` overrides.
