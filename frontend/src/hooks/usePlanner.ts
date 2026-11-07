import { useCallback, useRef, useState } from 'react'
import { planTrip } from '../lib/api'
import type { PlanRequest, PlanResponse } from '../types'

/** Runs trip searches and holds their outcome: the latest plan, loading and error state, and which route is selected. */
export function usePlanner() {
  const [plan, setPlan] = useState<PlanResponse | null>(null)
  const [req, setReq] = useState<PlanRequest | null>(null) // latest search, used by Try again
  const [planReq, setPlanReq] = useState<PlanRequest | null>(null) // the search that produced `plan`
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selectedId, setSelectedId] = useState(0)
  const [editing, setEditing] = useState(false) // true while the user re-opens the trip form after a search
  const abort = useRef<AbortController | null>(null)

  const submit = useCallback(async (r: PlanRequest) => {
    abort.current?.abort()
    const ctl = new AbortController()
    abort.current = ctl
    setLoading(true)
    setError('')
    setReq(r)
    try {
      const result = await planTrip(r, ctl.signal)
      setPlan(result)
      setPlanReq(r)
      setEditing(false)
      // Start on the route to drive; with none, on the comparison winner; failing that, the first route.
      setSelectedId(result.recommended_id ?? result.comparison_winner_id ?? result.routes[0]?.id ?? 0)
    } catch (e) {
      if (ctl.signal.aborted) return
      setError(e instanceof Error ? e.message : 'Something went wrong')
      setEditing(true) // keep the form open so the user can adjust and retry
    } finally {
      if (abort.current === ctl) setLoading(false)
    }
  }, [])

  const cancel = useCallback(() => {
    abort.current?.abort()
    setLoading(false)
  }, [])

  const expandForm = useCallback(() => setEditing(true), [])

  return { plan, req, planReq, loading, error, selectedId, setSelectedId, editing, submit, cancel, expandForm }
}
