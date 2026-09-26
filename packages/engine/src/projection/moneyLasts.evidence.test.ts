import { expect, it } from 'vitest'

import { describeCalculation } from '../rules/describeCalculation.js'
import { cashAccount, productionTaxCalculator, singlePersonPlan, validatePlan } from '../testing/planFixtures.js'
import { lastFundedYear, moneyLasts } from './moneyLasts.js'
import { simulatePlan } from './simulate.js'
import type { ProjectionResult } from './types.js'

/** The plan of the longevity-depletion-year worksheet: 25,000 in cash, 10,000 a year of spending, nothing else. */
function depletionRun(annualSpending: number, endYear: number): ProjectionResult {
  const plan = singlePersonPlan({ dob: '1975-06-15', planningAge: 95 })
  plan.accounts = [cashAccount('only-account', 25_000)]
  plan.expenses.baseAnnual = annualSpending
  return simulatePlan(validatePlan(plan), { startYear: 2026, horizonEndYear: endYear, taxCalculator: productionTaxCalculator() })
}

describeCalculation(
  'display-years-before-plan-end',
  {
    example: {
      inputs: {
        caseA: { startYear: 2026, endYear: 2028, depletionYear: 2028, annualSpending: 10_000 },
        caseB: { startYear: 2026, endYear: 2030, depletionYear: 2028, annualSpending: 10_000 },
        caseC: { startYear: 2026, endYear: 2028, depletionYear: null, annualSpending: 5_000 },
        caseD: { startYear: 2026, endYear: 2060, depletionYear: 2026 },
        caseE: { startYear: 2026, endYear: 2030, depletionYear: 2031 },
      },
      expected: {
        caseA: { depletionYear: 2028, lastFundedYear: 2027, endYear: 2028, yearsShortOfPlanEnd: 1 },
        caseB: { depletionYear: 2028, lastFundedYear: 2027, endYear: 2030, yearsShortOfPlanEnd: 3 },
        caseC: { depletionYear: null, lastFundedYear: 2028, endYear: 2028, yearsShortOfPlanEnd: 0 },
        caseD: { depletionYear: 2026, lastFundedYear: 2025, endYear: 2060, yearsShortOfPlanEnd: 35 },
        retiredSentenceA: 0,
        retiredSentenceB: 2,
        retiredSentenceD: 34,
        retiredLastsThroughC: 2029,
      },
      tolerance: 'exact',
    },
    worksheet: 'DOCS/calculations/longevity/display-years-before-plan-end.md',
    mutation: 'DOCS/calculations/longevity/display-years-before-plan-end.mutation.md',
  },
  ({ example }) => {
    type Case = { startYear: number; endYear: number; depletionYear: number | null; annualSpending?: number }
    const inputs = example.inputs as Record<string, Case>
    const expected = example.expected as Record<string, unknown>

    for (const key of ['caseA', 'caseB', 'caseD'] as const) {
      it(`${key}: the last funded year and the years short of the plan's end`, () => {
        const c = inputs[key]!
        expect(moneyLasts(c)).toEqual(expected[key])
        // The retired sentence counted endYear - depletionYear.
        expect(c.endYear - c.depletionYear!).toBe(expected[`retiredSentence${key.slice(-1)}`])
      })
    }

    it('caseC: a plan that never depletes is funded through its last year, not a year past it', () => {
      const c = inputs.caseC!
      expect(moneyLasts(c)).toEqual(expected.caseC)
      expect(lastFundedYear(c)).not.toBe(expected.retiredLastsThroughC)
    })

    it('reads the depletion year the ledger publishes (the depletion worksheet plan, to 2028 and to 2030)', () => {
      for (const key of ['caseA', 'caseB', 'caseC'] as const) {
        const c = inputs[key]!
        const result = depletionRun(c.annualSpending!, c.endYear)
        expect(result.depletionYear, key).toBe(c.depletionYear)
        expect(moneyLasts(result), key).toEqual(expected[key])
      }
    })

    it('refuses a depletion year the ledger cannot publish', () => {
      expect(() => moneyLasts(inputs.caseE!)).toThrow(RangeError)
      expect(() => moneyLasts({ startYear: 2026, endYear: 2030, depletionYear: 2025 })).toThrow(RangeError)
    })

    it('moves every money-lasts difference by nothing: both conventions shift each result by one year', () => {
      const retired = (r: { depletionYear: number | null; endYear: number }) => r.depletionYear ?? r.endYear + 1
      const results = [
        { depletionYear: null, endYear: 2035 },
        { depletionYear: 2034, endYear: 2035 },
        { depletionYear: 2026, endYear: 2060 },
        { depletionYear: null, endYear: 2060 },
        { depletionYear: 2040, endYear: 2052 },
      ]
      for (const candidate of results) {
        for (const baseline of results) {
          expect(lastFundedYear(candidate) - lastFundedYear(baseline)).toBe(retired(candidate) - retired(baseline))
        }
      }
    })
  },
)
