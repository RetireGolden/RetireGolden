import type { Plan } from '@retiregolden/engine/model/plan'

import { EXAMPLE_FIXED_YEAR } from './examples/exampleClock'
import { getExampleById } from './examples/registry'

/**
 * What the page says about a plan written for another year than the one the
 * comparison runs from (D-2027-ROLLOVER): a library example beside a user
 * plan runs from the user plan's year, and a plan saved from an example runs
 * from the clock's year, so neither shows its example page's figures once
 * that year is later than the year the example is set in. Null when the plan
 * runs from its example's own year, or is neither.
 */
export function compareExampleNote(plan: Plan, startYear: number): string | null {
  if (startYear === EXAMPLE_FIXED_YEAR) return null
  const title = plan.exampleSourceId ? getExampleById(plan.exampleSourceId)?.title ?? plan.name : plan.name
  if (plan.origin === 'example') {
    return (
      `${title} is an example set in ${EXAMPLE_FIXED_YEAR}. Here it runs from ${startYear}, like your plan, ` +
      'so its figures differ from its example page.'
    )
  }
  if (plan.exampleSourceId) {
    return (
      `${plan.name} was saved from the example ${title}, which is set in ${EXAMPLE_FIXED_YEAR}. ` +
      `It runs from ${startYear}, so its figures differ from the example page.`
    )
  }
  return null
}
