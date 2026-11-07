# Weather-Aware Truck Routing

A React + Django app that helps a truck driver pick the safest of three routes. For each route, I sample the weather
at checkpoints along the way, at the time the truck is expected to reach each one, and rate it with the brief's
wind, rain, snow and load-weight rules. The app then recommends a route, or explains why it can't. The map shows
every route, its checkpoints, ETAs and risk, plus a weather heatmap along the corridor with a 0–48 hour forecast
slider and a trip playback.

This README is my working log: what I built, the decisions I made along the way and why, and what I would build
next if this went past the assessment.

---

## What it does

1. **Input**: origin and destination (type-ahead place search), departure time, load weight, and checkpoint spacing
   (every 10, 25 or 50 miles).
2. **Routes**: up to three distinct driving routes.
3. **Checkpoints**: one every N miles plus the destination, each with the truck's ETA, the forecast for that moment,
   and a risk level (Low, Moderate, High, Severe, No Travel).
4. **Recommendation**: the brief's ranking (fewest Severe miles, then fewest High miles, then lowest average risk,
   then shortest time), with a one-sentence reason.
5. **Map**: routes, checkpoints with popups, a weather heatmap for any hour from 0 to 48, a truck you can scrub or
   play along the selected route, and a camera that can follow it.

Stack: Django + Django REST Framework (stateless JSON API, no database), React + TypeScript + Material UI, and
Leaflet with a custom canvas heat layer. Data comes from OSRM (routing), Open-Meteo (hourly weather) and Geoapify
(place search).

---

## Decision log

### 1. No database
There is nothing to persist: every search is computed from live forecasts and thrown away. A database would add
migrations, hosting cost and failure modes for no benefit. The API is stateless; the only state is a short-lived
cache for forecasts and place searches.

### 2. Three routes, even when the routing engine offers fewer
OSRM often returns only one or two alternatives. When it does, I force extra routes through via-points offset to
either side of the main route's midpoint, then drop any candidate that overlaps a kept route by more than 90%. A
"choice" between three versions of the same highway isn't a choice. If three distinct routes still don't exist,
the UI says how many were found instead of padding the list.

### 3. Truck speed, not car speed
OSRM's timings are for cars. I divide every duration by 0.9 so ETAs reflect a slower truck. This matters for
correctness, not just display: a later ETA can mean meeting a storm that a car would beat. It's a flat factor;
see the recommendations for how I'd do it properly.

### 4. Checkpoints and ETAs
Checkpoints sit at 0, N, 2N, … miles and at the destination exactly once (60 miles every 25 gives 0, 25, 50, 60).
Each ETA is departure plus the route's travel time scaled by the share of distance covered. Each checkpoint stands
for the stretch halfway to its neighbours, so the miles at each risk level add up to the route length. That makes
"miles of Severe weather" an honest number rather than a count of dots.

### 5. Weather at the exact ETA, and missing data stays missing
Forecasts are hourly; ETAs are not. I interpolate linearly between the two hours around an ETA, and an ETA exactly
on the hour uses only that hour's value. Coordinates are snapped to a 0.1° grid (about 7 miles), so nearby
checkpoints share one forecast request.

The decision I care most about here: **a missing forecast value is never treated as calm weather.** If the
provider has no value, or the ETA falls past the end of the forecast, the checkpoint is marked unknown. Its miles
are counted as unknown, never Low, and the route is flagged as incomplete. A tool that turns "no data" into "safe"
is worse than no tool.

### 6. Risk rules exactly as written
Wind bands include their lower bound (25.0 mph is Moderate). Rain and snow No Travel are strictly greater than
1.00 and 3.0 in/hr, as the brief writes them. The load rules use strict thresholds: 45–54 mph with more than
30,000 lb is No Travel, and 35–44 mph with more than 40,000 lb is Severe, so 30,000 lb exactly doesn't trigger.
Each checkpoint takes the worst of wind, rain and snow, and records which hazard set it and whether the load rule
raised it.

### 7. Ranking follows the brief literally, on unrounded numbers
Routes are compared on Severe miles, then High miles, then distance-weighted average risk, then travel time in
seconds. I rank on raw values and round only for display. Rounding before comparing caused real wrong answers in
testing: 6,001 s vs 6,010 s became a tie at the minute, and an average of 0.301 vs 0.304 became a tie at two
decimals.

Two policies sit on top of the brief's list:
- **Only routes with a complete forecast are compared.** A route with unknown stretches can't be ranked fairly
  against one without; it stays on the map, marked "Not compared". If no route is complete, the app says so and
  recommends nothing.
- **No Travel blocks the recommendation, not the ranking.** No Travel isn't one of the brief's four criteria, so
  it doesn't change which route wins the comparison. But I won't tell a driver to take a route that crosses
  No Travel weather. In that case the winner is shown as "best compared" and no route is recommended. If every
  route crosses No Travel, the app says that explicitly.

The explanation names the first criterion that separated the winner from the runner-up, mentions the time cost
when the winner is at least 5 minutes slower, and says plainly when there was only one route or an exact tie. It
never invents a reason.

### 8. The heatmap is computed once, with the plan
The heatmap is a grid of points along each route and 20 miles to either side. Each point carries a risk digit for
every hour, kept separately for wind, rain and snow, so the hazard switch and the slider only redraw a canvas, with
no network calls. Long trips use a coarser grid so one search stays within the weather API's rate limit.

I drew the heat myself instead of using a heatmap library: additive heatmaps make many Low points sum into
something that looks High, which is exactly the wrong message. Each point is a disc in its own risk colour,
painted lowest to highest and clipped to a soft band around the routes. Low risk is drawn very faintly, so real
weather is the loudest thing on the map. Missing samples are grey with a "No data" key.

### 9. Forecast slider and trip playback have separate bounds
The slider covers the brief's 0–48 hours (less only if the forecast ends sooner, with a label saying so). It never
changes when you switch routes, because it's a view of the weather, not of one trip. Playback follows the selected
route: it stops at that route's arrival, which is marked on the slider, or at the slider's end for a longer trip.
In that case the card says "Playback stopped at +48 h · Route arrives at +60 h", and the truck isn't shown as
arrived. Scrubbing past arrival parks the truck at the destination. Checkpoint scoring is unaffected by the 48-hour
display limit: a checkpoint at +55 h is scored from the forecast at +55 h.

### 10. Small UI decisions that make the map readable
- The truck sits on the drawn road line (positioned by distance along the geometry), so it never drifts off the
  road when zoomed in.
- It faces the way it's moving: along the route, turned around while scrubbing backwards, and parked with the
  route's heading at either end.
- Checkpoint dots thin out at low zoom (every 2nd, 4th, 8th…), so zooming in only ever adds dots and never moves
  them; the heatmap fades in with zoom instead of popping in.
- The follow camera glides to the truck once, then keeps it centred with small pans; dragging the map hands
  control back.
- "Continue in Google Maps" hands the selected route to the driver's navigation app, with waypoints for the
  alternatives so Google doesn't swap in its own fastest route.

### 11. Place search runs through the server
Type-ahead uses Geoapify's Address Autocomplete, called from Django, so the API key never reaches the browser. It
is limited to the US, Canada and Mexico, returns five results, and caches answers for a day. It makes one attempt
with a 5-second timeout, because a late suggestion is useless. Errors are short and never echo the key or the
upstream URL. The type-ahead has its own per-IP rate limit, separate from the planner's.

### 12. Testing at the boundary
Tests fake only the outside services (the routing, weather and place-search HTTP responses) and run everything
else for real: parsing, checkpoints, ETAs, risk, ranking, heatmap and API validation. The end-to-end test uses a
60-mile route with wind rising hour by hour and asserts exact ETAs, risk miles and the winner. It would fail if
every checkpoint used the departure time instead of its own ETA, which is the easiest bug to ship in this problem.

---

## Known limits

- Routing is car routing with a speed factor; it doesn't know truck restrictions (height, weight, hazmat).
- Wind is the sustained 10 m wind speed, not gusts, and ignores wind direction relative to the road.
- Departures are limited to today through four days out, because the free forecast covers about a week.
- Public routing and weather services are rate-limited; a first search for a long trip takes 10–15 seconds.

---

## Recommendations (not implemented; outside this assessment's scope)

These are the changes I would make next, roughly in order of impact on safety.

1. **Real truck speeds per road segment.** Use posted speed limits, truck speed limits and road type for each
   segment instead of one 0.9 factor. This changes more than the ETA: it changes **how long the truck spends inside
   bad weather**. A slow climb through a snow band is more dangerous than a fast pass through the same band, so
   risk should be weighted by time exposed, not just miles.
2. **Traffic and incidents.** Live traffic, accidents, closures and work zones shift ETAs (and with them, which
   weather the truck meets), and add risk of their own. They should feed both the timing and the score.
3. **A forecast horizon longer than 48 hours.** Multi-day trips outrun a 48-hour window. I'd extend the slider and
   scoring to the full forecast range, and show forecast confidence dropping with lead time instead of treating
   hour 90 as reliable as hour 2.
4. **Hours-of-service rest breaks.** A driver can't drive 20 hours straight. Mandatory breaks move every later ETA,
   and therefore the weather each checkpoint sees.
5. **Wind direction and gusts.** A 40 mph crosswind on a high-sided trailer is far riskier than a 40 mph tailwind.
   Compare wind direction with the road's bearing at each checkpoint and use gusts, not just sustained speed.
6. **Departure-time suggestions.** "Leave three hours later and avoid all Severe miles" is often the best advice the
   app could give, and it only needs the same scoring run over a few departure times.
7. **Truck-specific routing.** Bridge heights, weight limits, hazmat and truck-restricted roads, from a truck-aware
   routing engine.
8. **A shared cache.** Forecasts, place searches and rate-limit counters live in each server process today. With
   several workers they should move to a shared store such as Redis.

---

## Project layout

```
backend/
  config/            Django settings and URLs; serves the built frontend
  trucking/
    api/             request validation and the two endpoints
    planning/        candidates, route analysis, recommendation, heatmap, planner
    providers/       routing (OSRM), weather (Open-Meteo), place search (Geoapify)
    risk.py          the brief's risk and load rules
    geo.py           polylines, checkpoint spacing, grid snapping
    tests/           pytest, one file per module, plus an end-to-end plan test
frontend/src/
  App.tsx            page layout
  hooks/             trip search, playback clock, follow camera
  components/        sidebar (form, route cards) and map (routes, checkpoints, heat, slider, controls)
  lib/               API client, formatting, geometry, risk colours, Google Maps link
```

## API

- `GET /api/geocode?q=<text>`: up to five places in the US, Canada or Mexico as `{label, lat, lon}`.
- `POST /api/plan` with `{origin, destination, departure, load_lb, interval_miles}`: the routes with checkpoints,
  ETAs, weather and risk; the recommendation status, recommended route and comparison winner, and the reason; and
  the heatmap.

Errors are `{"detail": "..."}`: `400` for invalid input, `429` when rate limited, `502` when an outside service
fails, `503` when place search isn't configured.

---

Place search powered by [Geoapify](https://www.geoapify.com/). Map and place data © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors.
