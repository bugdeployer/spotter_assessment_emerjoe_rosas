export type RiskLabel = 'low' | 'moderate' | 'high' | 'severe' | 'no_travel'

export interface Place {
  lat: number
  lon: number
  label: string
}

export interface Checkpoint {
  mile: number
  lat: number
  lon: number
  eta: string
  /** null where the forecast has no value for this ETA (outside its range, or a missing observation). */
  weather: { wind_mph: number | null; rain_in_hr: number | null; snow_in_hr: number | null }
  /** False when any hazard is unknown; risk is then null rather than a guess. */
  forecast_available: boolean
  risk: RiskLabel | null
  risk_level: number | null
  drivers: string[]
  load_rule: boolean
  segment_miles: number
}

export interface Route {
  id: number
  name: string
  /** The route to drive. False everywhere when no route can be recommended. */
  recommended: boolean
  /** Best on the brief's criteria among routes with a complete forecast (may still have No Travel miles). */
  comparison_winner: boolean
  distance_mi: number
  duration_s: number
  arrival: string
  roads: string[]
  geometry: [number, number][]
  checkpoints: Checkpoint[]
  miles_by_risk: Record<RiskLabel, number>
  /** Miles whose checkpoint has no forecast; not counted in any risk level. */
  unknown_miles: number
  /** null while part of the route has no forecast. */
  avg_risk: number | null
  /** Worst known level; null when no checkpoint has a forecast. */
  max_risk: RiskLabel | null
  load_rule_checkpoints: number
  forecast_complete: boolean
}

/** What the heatmap colours by: the worst of the three, or one hazard alone. */
export type Hazard = 'all' | 'wind' | 'rain' | 'snow'

/** One character per hour from the slider's start: 0 Low, 1 Moderate, 2 High, 3 Severe, 4 No travel, - no data. */
export interface HeatPoint {
  lat: number
  lon: number
  wind: string
  rain: string
  snow: string
}

export interface HazardLegend {
  unit: string
  /** Range text for Low, Moderate, High, Severe, No travel, e.g. "25–34". */
  bands: string[]
}

export type RecommendationStatus = 'recommended' | 'winner_has_no_travel' | 'all_routes_no_travel' | 'no_complete_forecast'

export interface PlanResponse {
  routes: Route[]
  /** How many distinct routes were asked for; fewer may come back. */
  routes_requested: number
  recommendation_status: RecommendationStatus
  /** The route to drive, or null when none can be recommended. */
  recommended_id: number | null
  /** Best on the brief's criteria; null when no route has a complete forecast. */
  comparison_winner_id: number | null
  explanation: string
  heatmap: {
    start: string
    /** Last forecast hour the slider can show (48 when the forecast covers it). */
    hours: number
    /** The brief's slider length: 48. */
    max_hours: number
    /** False when the forecast covers no slider hour at all. */
    available: boolean
    cell_miles: number
    legend: Record<Exclude<Hazard, 'all'>, HazardLegend>
    points: HeatPoint[]
  }
}

export interface PlanRequest {
  origin: Place
  destination: Place
  departure: string
  load_lb: number
  interval_miles: 10 | 25 | 50
}
