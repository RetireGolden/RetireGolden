import type { Plan } from '@retiregolden/engine/model/plan'
import { detectorProjection } from '@retiregolden/engine/insights/detectorProjection'
import type { DetectorContext } from '@retiregolden/engine/insights/types'
import { packForYear } from '@retiregolden/engine/params'

import { stampCalendarMonth, stampCalendarYear, type ProjectionView } from '../../projection'

/**
 * The context every Insights detector runs on, built once for the page and
 * the card preview so the two cannot drift: the plan, the engine's own
 * projection view of this run (today's dollars by its published inflation
 * factor), the parameter set of the run's start year, and the plan's save
 * stamp read on the start year's calendar.
 *
 * The planner starts a projection on the local calendar (`projectionStartYear`)
 * and the save stamp is UTC, so the stamp's local year and month are passed as
 * `planSavedOn` (decision D-2027-ROLLOVER): east of UTC a plan saved just after
 * local midnight on 1 January no longer reads "Plan last saved in" the old year
 * beside a new-year start, and west of UTC one saved on New Year's Eve evening
 * no longer reads as saved in the new year.
 */
export function insightDetectorContext(plan: Plan, view: ProjectionView): DetectorContext {
  const savedYear = stampCalendarYear(plan.updatedAtIso)
  const savedMonth = stampCalendarMonth(plan.updatedAtIso)
  return {
    plan,
    projection: detectorProjection(view.result, view.summary),
    params: packForYear(view.startYear).pack,
    ...(savedYear !== null && savedMonth !== null ? { planSavedOn: { year: savedYear, month: savedMonth } } : {}),
  }
}
