import { useEffect, useMemo, useState } from 'react'

import type { Plan } from '@retiregolden/engine/model/plan'
import { currentStartYear, projectPlan, type ProjectPlanOptions, type ProjectionView } from '../projection'

export { taxCalculatorFor } from '../planTaxCalculator'
export {
  compareStartYear,
  currentStartYear,
  projectPlan,
  projectionStartYear,
  stampCalendarMonth,
  stampCalendarYear,
  startYearDollarsWord,
  startYearDollarsWordCapitalized,
  type ProjectPlanOptions,
  type ProjectionView,
} from '../projection'

export type UseProjectionOptions = Pick<ProjectPlanOptions, 'captureAnnualCashFlow'>

/**
 * The plan's deterministic projection from `startYear`, memoized on the plan
 * object and the year. The year is the caller's, with no clock default: a
 * workspace page passes `projectionStartYear(plan)`. Keying the memo on the
 * year too means a tab left open over New Year re-projects from the new year
 * on its next render instead of keeping the old one.
 */
export function useProjection(plan: Plan, startYear: number, opts?: UseProjectionOptions): ProjectionView {
  const captureAnnualCashFlow = opts?.captureAnnualCashFlow === true
  return useMemo(
    () =>
      captureAnnualCashFlow
        ? projectPlan(plan, { startYear, captureAnnualCashFlow: true })
        : projectPlan(plan, startYear),
    [plan, startYear, captureAnnualCashFlow],
  )
}

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
 *
 * It lives in this module, beside `useProjection`, so the shared chunk both
 * belong to keeps this module's name, which the bundle budget reads
 * (`app/scripts/bundleBudget.mjs`, "engine simulation core").
 */
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
