import type { Place, PlanRequest, PlanResponse } from '../types'

const BASE = import.meta.env.VITE_API_URL ?? ''

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, init)
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(describeError(body, res.status) || `Request failed (${res.status})`)
  return body as T
}

/** DRF validation errors are {field: [msgs]}; our own errors are {detail}. */
const FIELD_NAMES: Record<string, string> = {
  departure: 'Departure',
  load_lb: 'Load',
  origin: 'Origin',
  destination: 'Destination',
  interval_miles: 'Checkpoint interval',
}

function describeError(body: Record<string, unknown>, status: number): string {
  // 503 means a missing server setting: retrying won't help, so don't suggest it.
  if (typeof body.detail === 'string') return status === 503 ? `${body.detail}.` : `${body.detail}. Please try again in a moment.`
  return Object.entries(body)
    .map(([field, msgs]) => `${FIELD_NAMES[field] ?? field}: ${Array.isArray(msgs) ? msgs.join(' ') : JSON.stringify(msgs)}`)
    .join('. ')
}

export const geocode = (q: string, signal?: AbortSignal) =>
  request<Place[]>(`/api/geocode?q=${encodeURIComponent(q)}`, { signal })

export const planTrip = (body: PlanRequest, signal?: AbortSignal) =>
  request<PlanResponse>('/api/plan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  })
