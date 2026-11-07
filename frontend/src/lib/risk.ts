import type { RiskLabel } from '../types'

/** How each risk level is named and coloured, from Low to No travel. */
export const RISK_ORDER: RiskLabel[] = ['low', 'moderate', 'high', 'severe', 'no_travel']

export const RISK_COLOR: Record<RiskLabel, string> = {
  low: '#16a34a',
  moderate: '#ca8a04',
  high: '#ea580c',
  severe: '#dc2626',
  no_travel: '#581c87',
}

/** Colours of the weather heat on the map, and of the matching legend swatches. */
export const HEAT_COLOR: Record<RiskLabel, string> = {
  low: '#16a34a',
  moderate: '#eab308',
  high: '#f97316',
  severe: '#dc2626',
  no_travel: '#581c87',
}

/** Colour for anything without a forecast: checkpoints, route bars and heat samples. */
export const UNKNOWN_COLOR = '#9ca3af'

export const RISK_NAME: Record<RiskLabel, string> = {
  low: 'Low',
  moderate: 'Moderate',
  high: 'High',
  severe: 'Severe',
  no_travel: 'No travel',
}
