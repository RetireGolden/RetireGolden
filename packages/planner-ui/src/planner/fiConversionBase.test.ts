/**
 * The FI number leaves out a conversion's one-off costs wherever they land
 * (decision D-FI-CONVERSION-TAX, independent review M1): the independent
 * reviewer's case, annuity-purchases-estate with Taylor retiring at 65, so the
 * priced year is 2028, and one conversion in 2026. The 2026 conversion sets
 * 2028's IRMAA through the two-year MAGI lookback and drains the taxable
 * account that 2028 would have drawn on, so reading 2028 from the projection
 * itself priced those costs as permanent spending ($3,059,085 at head
 * 41e6df50). Read from the run without conversions it is the no-conversion
 * figure, about $2,792,288, and converting more cannot lower it.
 */
import { describe, expect, it } from 'vitest'

import { parsePlan, type Plan } from '@retiregolden/engine/model/plan'

import { projectPlan } from '../projection'
import { appExamplePlanById } from '../testSupport/appExamples'
import { EXAMPLE_FIXED_YEAR } from './examples/buildContext'

function variant(window: [number, number] | null): Plan {
  const plan = structuredClone(appExamplePlanById('annuity-purchases-estate'))
  plan.household.people.find((p) => p.name === 'Taylor')!.retirementAge = 65
  if (window === null) plan.strategies.rothConversion = { mode: 'none' }
  else Object.assign(plan.strategies.rothConversion, { startYear: window[0], endYear: window[1] })
  const parsed = parsePlan(plan)
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  return parsed.plan
}

describe('FI base after an earlier conversion (review M1)', () => {
  it('prices 2028 without the 2026 conversion\'s knock-on costs, and converting more does not lower it', () => {
    const fi = (window: [number, number] | null) => projectPlan(variant(window), EXAMPLE_FIXED_YEAR).summary
    const once = fi([2026, 2026])
    const none = fi(null)
    const more = fi([2026, 2028])
    expect(once.fiBasis).toMatchObject({ spendingYear: 2028, spendingSource: 'conversionFreeProjection' })
    expect(none.fiBasis).toMatchObject({ spendingYear: 2028, spendingSource: 'projection' })
    expect(Math.round(once.fiNumber!)).toBe(2_792_288)
    expect(once.fiNumber).toBe(none.fiNumber)
    expect(more.fiNumber).toBe(none.fiNumber)
    expect(more.fiNumber).toBeGreaterThanOrEqual(once.fiNumber!)
  })
})
