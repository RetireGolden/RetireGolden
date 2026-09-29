/**
 * The local clock's calendar year, re-read when a new one begins, so a page
 * left open across New Year renders again from the new year with no click
 * (decision D-2027-ROLLOVER; PR #768 review issues 3, 4 and 8).
 *
 * A user plan's first year is the clock's (`projectionStartYear`), read when
 * a component renders. A page nobody touches does not render, so without a
 * trigger the tab open across midnight on 31 December kept last year's start
 * until the next edit or click. This hook is that trigger: it holds the year
 * in state, sets a timer for the next local 1 January, and re-reads the year
 * when the timer fires, when the window regains focus and when the page
 * becomes visible (a timer can fire late after the computer sleeps). A
 * component that calls it renders again when the year changes, and with it
 * everything that reads the start year during render.
 */
import { useEffect, useState } from 'react'

import { currentStartYear } from './startYear'

/** A browser timer cannot wait longer than 2^31 - 1 ms; a longer wait is re-armed. */
const LONGEST_TIMER_MS = 2 ** 31 - 1
/** Past midnight by this much, so the re-read lands in the new year. */
const PAST_MIDNIGHT_MS = 50
/** Never re-arm sooner than this, so a clock that does not move cannot spin. */
const SHORTEST_TIMER_MS = 1_000

/** Milliseconds from `now` to just past the next local midnight on 1 January. */
export function msUntilNextLocalNewYear(now: Date): number {
  const next = new Date(now.getFullYear() + 1, 0, 1)
  return next.getTime() - now.getTime() + PAST_MIDNIGHT_MS
}

export function useClockYear(): number {
  const [year, setYear] = useState(() => currentStartYear())
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null
    const read = () => setYear(currentStartYear())
    const arm = () => {
      const wait = Math.min(Math.max(msUntilNextLocalNewYear(new Date()), SHORTEST_TIMER_MS), LONGEST_TIMER_MS)
      timer = setTimeout(() => {
        read()
        arm()
      }, wait)
    }
    const onVisibility = () => {
      if (document.visibilityState === 'visible') read()
    }
    arm()
    window.addEventListener('focus', read)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      if (timer !== null) clearTimeout(timer)
      window.removeEventListener('focus', read)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])
  return year
}
