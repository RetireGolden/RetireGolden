/**
 * The year a plan starts, and the calendar every "this year" reads.
 *
 * A leaf module: it imports no engine code, so a field component can ask for
 * the plan's start year without pulling the projection (and the engine
 * simulation it imports) into its bundle. `projection.ts` re-exports it.
 */

import { useEffect, useState } from 'react'
import type { Plan } from '@retiregolden/engine/model/plan'
import { EXAMPLE_FIXED_YEAR } from './planner/examples/exampleClock'

/**
 * The clock's calendar year, on the local calendar.
 *
 * A default for a NEW item only (a goal's first year, a new election's year,
 * the year a comparison of user plans starts in). A stored plan is projected
 * from `projectionStartYear(plan)`, never from this: an example runs from the
 * year its copy is written for, whatever the clock says.
 */
export function currentStartYear(now: Date = new Date()): number {
  return now.getFullYear()
}

/**
 * The year a plan's projection starts: EXAMPLE_FIXED_YEAR for a library
 * example (`origin: 'example'`), otherwise the clock's local calendar year.
 *
 * An example is written as a snapshot of that year: its balances, ages, dated
 * events and printed figures are all 2026's, so running it from a later year
 * would re-read every one of them as of that year and turn its copy false
 * (decision D-2027-ROLLOVER, 2026-09-28). A user plan's balances are "as of
 * today", so it runs from the clock's year. One resolver, used by every page
 * that projects a plan, by the save check that judges dated inputs, and by the
 * editor's floors, so the three can never disagree about which year "now" is.
 */
export function projectionStartYear(plan: Pick<Plan, 'origin'>, now: Date = new Date()): number {
  return plan.origin === 'example' ? EXAMPLE_FIXED_YEAR : now.getFullYear()
}

/**
 * The calendar year a save stamp falls in, on the same local calendar as
 * `projectionStartYear`. A stamp is written in UTC (`toISOString`), so east of
 * UTC a save made just after local midnight on 1 January carries the old
 * year's UTC date, and west of UTC one made on the evening of 31 December
 * carries the new one. Reading it on the local calendar keeps "last saved in"
 * and "starts in" on one calendar. Null for a stamp that is not a date.
 */
export function stampCalendarYear(iso: string): number | null {
  const ms = Date.parse(iso)
  return Number.isFinite(ms) ? new Date(ms).getFullYear() : null
}

/** The month (01-12) a save stamp falls in, on the same local calendar. */
export function stampCalendarMonth(iso: string): string | null {
  const ms = Date.parse(iso)
  return Number.isFinite(ms) ? String(new Date(ms).getMonth() + 1).padStart(2, '0') : null
}

/**
 * The one year two compared plans are projected from (the engine compares two
 * plans only from one start year). Two library examples run from
 * EXAMPLE_FIXED_YEAR, the year their copy is written for, so an A-B pair
 * compares as its example pages describe it. Any comparison that includes a
 * user plan runs from the clock's year, the user plan's own: an example beside
 * it then runs from that year too, and the page says so
 * (`compareExampleNote`).
 */
export function compareStartYear(
  a: Pick<Plan, 'origin'>,
  b: Pick<Plan, 'origin'>,
  now: Date = new Date(),
): number {
  return a.origin === 'example' && b.origin === 'example' ? EXAMPLE_FIXED_YEAR : now.getFullYear()
}

/**
 * The word a page puts before "dollars" or "$" for this plan's start-year
 * dollars: "today's" for a user plan, which starts in the clock's year, and
 * the start year itself for a library example ("2026 dollars", "2026 $").
 *
 * An example runs from EXAMPLE_FIXED_YEAR whatever the clock says, so its
 * entered amounts and every figure shown in start-year dollars are 2026
 * dollars; "today's dollars" would be false of it from 1 January 2027, and
 * "2026 dollars" is true of it in every year (D-2027-ROLLOVER). One helper,
 * read by every label, so no page can say one thing while another says the
 * other.
 */
export function startYearDollarsWord(plan: Pick<Plan, 'origin'>): string {
  return plan.origin === 'example' ? String(EXAMPLE_FIXED_YEAR) : "today's"
}

/**
 * When the plan's entered amounts are as of: "today" for a user plan, "the
 * start of 2026" for a library example, whose balances and values are a 2026
 * snapshot (review M5, D-2027-ROLLOVER). Every "as of today" or "valued today"
 * on a page that can show an example reads this, as the dollar labels read
 * `startYearDollarsWord`.
 */
export function startYearAsOf(plan: Pick<Plan, 'origin'>): string {
  return plan.origin === 'example' ? `the start of ${EXAMPLE_FIXED_YEAR}` : 'today'
}

/** `startYearAsOf` for a short label in brackets: "today" or "start of 2026". */
export function startYearAsOfShort(plan: Pick<Plan, 'origin'>): string {
  return plan.origin === 'example' ? `start of ${EXAMPLE_FIXED_YEAR}` : 'today'
}

/** `startYearDollarsWord` at the start of a sentence or a button: "Today's" or "2026". */
export function startYearDollarsWordCapitalized(plan: Pick<Plan, 'origin'>): string {
  const word = startYearDollarsWord(plan)
  return word === "today's" ? "Today's" : word
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
 * It lives here, beside the one clock resolver (`currentStartYear`): the
 * planner's clock-read guard (`planner/clockReads.guard.test.ts`) keeps every
 * other read of the clock out of the pages, and a module of its own would
 * name the shared simulation-core chunk the bundle budget reads by name.
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
