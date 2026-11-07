import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

/** Playback speeds: how many hours of travel pass per real second. */
export const SPEEDS = [
  { label: '1×', hoursPerSecond: 0.5 },
  { label: '2×', hoursPerSecond: 1 },
  { label: '4×', hoursPerSecond: 2 },
  { label: '8×', hoursPerSecond: 4 },
] as const

export const DEFAULT_SPEED_INDEX = 1

/** The simulation state and actions the map controls need. */
export interface SimControls {
  playing: boolean
  onPlayPause: () => void
  speedIndex: number
  onCycleSpeed: () => void
  /** Whether the camera follows the truck. The map turns it off when the user drags it away. */
  follow: boolean
  /** True after scrubbing back in time: the truck is moving back along the route, so it faces the other way. */
  reversed: boolean
  onFollowChange: (follow: boolean) => void
}

/**
 * The trip clock. `hour` is hours since the slider's zero and advances every animation frame while
 * playing (continuous time keeps the truck's motion smooth). Playback stops at `stopAt`.
 */
export function useSimulation(stopAt: number) {
  const [hour, setHour] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speedIndex, setSpeedIndex] = useState(DEFAULT_SPEED_INDEX)
  const [follow, setFollow] = useState(false)
  const [reversed, setReversed] = useState(false)
  // The frame loop reads the current hour and stop point from refs so it never goes stale or restarts.
  const hourRef = useRef(0)
  const stopAtRef = useRef(stopAt)
  useEffect(() => {
    stopAtRef.current = stopAt
  })

  const moveTo = useCallback((h: number) => {
    hourRef.current = h
    setHour(h)
  }, [])

  useEffect(() => {
    if (!playing) return
    const hoursPerSecond = SPEEDS[speedIndex].hoursPerSecond
    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      // Cap the step so returning to a background tab doesn't teleport the truck.
      const dt = Math.min(now - last, 100) / 1000
      last = now
      const next = Math.min(stopAtRef.current, hourRef.current + dt * hoursPerSecond)
      moveTo(next)
      if (next >= stopAtRef.current) {
        setPlaying(false)
        return
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing, speedIndex, moveTo])

  const sim: SimControls = useMemo(
    () => ({
      playing,
      onPlayPause: () => {
        if (playing) {
          setPlaying(false)
          return
        }
        // Pressing play after the trip has ended starts it again from the beginning.
        if (hourRef.current >= stopAtRef.current - 0.01) moveTo(0)
        setReversed(false) // playback always runs forwards
        setPlaying(true)
      },
      speedIndex,
      onCycleSpeed: () => setSpeedIndex((i) => (i + 1) % SPEEDS.length),
      follow,
      onFollowChange: setFollow,
      reversed,
    }),
    [playing, speedIndex, follow, reversed, moveTo],
  )

  /** Scrubbing the slider takes over from playback. Its direction decides which way the truck faces. */
  const scrub = useCallback(
    (h: number) => {
      setPlaying(false)
      if (h !== hourRef.current) setReversed(h < hourRef.current)
      moveTo(h)
    },
    [moveTo],
  )
  const rewind = useCallback(() => {
    setPlaying(false)
    setReversed(false)
    moveTo(0)
  }, [moveTo])

  return { hour, sim, scrub, rewind }
}
