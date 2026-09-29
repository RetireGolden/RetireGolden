/**
 * "Refine to the month" repeats whole passes, visiting the claimants older
 * first, until a pass changes no claim (decision D-PEOPLE-ORDER, rule R7).
 * The independent review's L4 found that no test noticed a single pass, a
 * pass limit of two, a window that drifts with the incumbent, a loop that
 * never records a change, or a visit order other than older first (mutants
 * G01, G02, G04, G06, A12, A13): the old fixture reached its fixed point
 * whatever the loop did. From annuity-purchases-estate's current claims
 * (Jordan 70, Taylor 67), on the after-tax-estate objective, a single pass
 * stops at Jordan 69y3m and $3,284,964; the fixed point is Jordan 69y6m,
 * Taylor 66y0m and $3,285,820, whichever person is listed first.
 *
 * Since #758 the refinement is the engine's (decisions/claimAgeSweep.ts
 * #refineClaimAgeMonthly), each month priced through the decision engine; the
 * pass count and the window are pinned there too (claimAgeSweep.refine
 * .evidence.test.ts, case R-B).
 */
import { describe, expect, it, vi } from 'vitest'

import type { Plan } from '@retiregolden/engine/model/plan'

import { appExamplePlanById } from '../testSupport/appExamples'
import { estateSweep, refineFromClaims } from '../testSupport/refineFromClaims'
import { EXAMPLE_FIXED_YEAR } from './examples/buildContext'

const JORDAN = 'annuity-purchases-estate--me'
const TAYLOR = 'annuity-purchases-estate--partner'

/** Every plan the refinement simulates, as "Jordan's claim / Taylor's claim", once recording is on. */
const simulated = vi.hoisted(() => ({ on: false, runs: [] as string[] }))

vi.mock('@retiregolden/engine/projection/simulate', async (importOriginal) => {
  const original = await importOriginal<typeof import('@retiregolden/engine/projection/simulate')>()
  return {
    ...original,
    simulatePlan: (...args: Parameters<typeof original.simulatePlan>) => {
      if (simulated.on) {
        const claim = (personId: string) => {
          const stream = args[0].incomes.find((income) => income.type === 'socialSecurity' && income.personId === personId)
          return stream?.type === 'socialSecurity' ? `${stream.claimAge.years}y${stream.claimAge.months}m` : '-'
        }
        simulated.runs.push(`${claim(JORDAN)} / ${claim(TAYLOR)}`)
      }
      return original.simulatePlan(...args)
    },
  }
})

const START = { [JORDAN]: 70, [TAYLOR]: 67 }

function reversed(plan: Plan): Plan {
  const next = structuredClone(plan)
  next.household.people.reverse()
  return next
}

describe('refine to the month: older first, repeated to the fixed point (review L4)', () => {
  for (const order of ['listed', 'reversed'] as const) {
    it(`${order}: from Jordan 70 and Taylor 67 it settles at 69y6m and 66y0m, $3,285,820`, () => {
      const listed = appExamplePlanById('annuity-purchases-estate')
      const plan = order === 'listed' ? listed : reversed(listed)
      const sweep = estateSweep(plan, EXAMPLE_FIXED_YEAR)
      simulated.runs.length = 0
      simulated.on = true
      let refined
      try {
        refined = refineFromClaims(plan, sweep, START, EXAMPLE_FIXED_YEAR)!
      } finally {
        simulated.on = false
      }
      expect(refined.claimByPersonId).toEqual({ [JORDAN]: { years: 69, months: 6 }, [TAYLOR]: { years: 66, months: 0 } })
      expect(refined.endingAfterTaxEstate).toBeCloseTo(3_285_820.3141, 3)
      // The months priced (the refinement's own runs, after the decision
      // context prices the plan as entered): the first moves Jordan's claim,
      // the older person's. A combination already priced is not priced
      // again: 13 + 35 in pass one (Jordan settling at 69y3m, then Taylor at
      // 66y0m), 12 + 34 in pass two (Jordan moving to 69y6m), and nothing in
      // the third, confirming pass, whose every combination pass two priced.
      expect(simulated.runs[0]).toBe('70y0m / 67y0m')
      const months = simulated.runs.slice(1)
      expect(months[0]).toBe('69y0m / 67y0m')
      expect([months.length, refined.evaluations]).toEqual([94, 94])
      // The window stays around the starting whole years on every pass:
      // Jordan 69y0m-70y0m and Taylor 66y0m-68y11m, never around the incumbent.
      const inMonths = (claim: string) => Number(claim.split('y')[0]) * 12 + Number(claim.split('y')[1]!.replace('m', ''))
      for (const run of months) {
        const [jordan, taylor] = run.split(' / ') as [string, string]
        expect(inMonths(jordan) >= 69 * 12 && inMonths(jordan) <= 70 * 12, run).toBe(true)
        expect(inMonths(taylor) >= 66 * 12 && inMonths(taylor) <= 68 * 12 + 11, run).toBe(true)
      }
    }, 300_000)
  }
})
