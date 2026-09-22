import { expect, it } from 'vitest'

import { describeCalculation, withinTolerance } from '../rules/describeCalculation.js'
import type { Plan } from '../model/plan.js'
import { singlePersonPlan, traditionalAccount, validatePlan } from '../testing/planFixtures.js'
import { createFlatTaxCalculator } from '../testing/flatTax.js'
import { createDecisionContext } from './evaluateCandidate.js'
import { evaluateInsightAction } from './insightsAdapter.js'
import type { DecisionContext } from './types.js'

const YEAR = 2026
const FLAT_TAX_RATE_PCT = 25
const HEIR_TAX_RATE_PCT = 50
const TRADITIONAL_BALANCE = 1_800_000

/**
 * Two real one-year projections whose summaries land on the worksheet's four
 * figures exactly. A 63-year-old single filer (over 59.5 so no early
 * distribution rule, under 65 so no Medicare premium), one traditional
 * account, zero return and zero inflation, and a flat 25% tax double. At a
 * flat rate r the withdrawal that funds spending S is S / (1 - r) and the tax
 * is r x that, so lifetime tax is 200,000 at S = 600,000 and 185,000 at
 * S = 555,000; the estate is the remaining balance net of a 50% heir rate.
 */
function baselinePlan(baseAnnual: number): Plan {
  const plan = singlePersonPlan({ dob: '1963-01-01', planningAge: 95 })
  plan.assumptions.heirTaxRatePct = HEIR_TAX_RATE_PCT
  plan.accounts = [traditionalAccount('trad', TRADITIONAL_BALANCE)]
  plan.expenses.baseAnnual = baseAnnual
  return validatePlan(plan)
}

function context(baseAnnual: number): DecisionContext {
  return createDecisionContext(baselinePlan(baseAnnual), {
    startYear: YEAR,
    horizonEndYear: YEAR,
    taxCalculator: createFlatTaxCalculator(FLAT_TAX_RATE_PCT),
  })
}

describeCalculation(
  'insight-impact-estate-and-lifetime-tax-deltas',
  {
    example: {
      inputs: {
        baselineEndingAfterTaxEstate: 500_000,
        candidateEndingAfterTaxEstate: 530_000,
        baselineLifetimeTaxesAndPenalties: 200_000,
        candidateLifetimeTaxesAndPenalties: 185_000,
        baselineBaseAnnual: 600_000,
        candidateBaseAnnual: 555_000,
      },
      expected: {
        endingAfterTaxEstateDelta: 30_000,
        lifetimeTaxDelta: -15_000,
        reversedEstateDeltaWrongReading: -30_000,
        reversedTaxDeltaWrongReading: 15_000,
      },
      tolerance: { abs: 0.005 },
    },
    worksheet: 'DOCS/calculations/insights/insight-impact-estate-and-lifetime-tax-deltas.md',
    mutation: 'DOCS/calculations/insights/insight-impact-estate-and-lifetime-tax-deltas.mutation.md',
  },
  ({ example }) => {
    const inputs = example.inputs as Record<string, number>
    const expected = example.expected as Record<string, number>

    function expectWithin(actual: number, target: number, label: string): void {
      expect(
        withinTolerance(actual, target, example.tolerance),
        `${label} ${actual} is not within ${JSON.stringify(example.tolerance)} of ${target}`,
      ).toBe(true)
    }

    function evaluated() {
      const ctx = context(inputs.baselineBaseAnnual!)
      return evaluateInsightAction(
        ctx,
        {
          id: 'worksheet-case',
          category: 'accounts-contributions',
          title: 'Spend less',
          rationale: 'A candidate that leaves more in the portfolio and pays less tax.',
        },
        {
          kind: 'preview-scenario',
          scenarioName: 'Spend less',
          patch: { expenses: { baseAnnual: inputs.candidateBaseAnnual } },
        },
      )
    }

    it('subtracts baseline from candidate on both summaries', () => {
      const { evaluation, impact } = evaluated()

      // The two constructed runs really do carry the worksheet's four summary
      // figures.
      expectWithin(
        evaluation.baselineSummary.endingAfterTaxEstate,
        inputs.baselineEndingAfterTaxEstate!,
        'baseline endingAfterTaxEstate',
      )
      expectWithin(
        evaluation.candidateSummary.endingAfterTaxEstate,
        inputs.candidateEndingAfterTaxEstate!,
        'candidate endingAfterTaxEstate',
      )
      expectWithin(
        evaluation.baselineSummary.lifetimeTaxesAndPenalties,
        inputs.baselineLifetimeTaxesAndPenalties!,
        'baseline lifetimeTaxesAndPenalties',
      )
      expectWithin(
        evaluation.candidateSummary.lifetimeTaxesAndPenalties,
        inputs.candidateLifetimeTaxesAndPenalties!,
        'candidate lifetimeTaxesAndPenalties',
      )

      expectWithin(impact.endingAfterTaxEstateDelta!, expected.endingAfterTaxEstateDelta!, 'endingAfterTaxEstateDelta')
      expectWithin(impact.lifetimeTaxDelta!, expected.lifetimeTaxDelta!, 'lifetimeTaxDelta')
      // An estate improvement is positive and a tax saving is negative: the
      // same subtraction order on both fields.
      expect(impact.endingAfterTaxEstateDelta!).toBeGreaterThan(0)
      expect(impact.lifetimeTaxDelta!).toBeLessThan(0)
      expect(impact.endingAfterTaxEstateDelta).toBe(evaluation.deltas.endingAfterTaxEstate)
      expect(impact.lifetimeTaxDelta).toBe(evaluation.deltas.lifetimeTax)

      // The worksheet's first two wrong readings: both subtractions reversed,
      // and the candidate totals reported in place of the deltas.
      expect(
        withinTolerance(impact.endingAfterTaxEstateDelta!, expected.reversedEstateDeltaWrongReading!, example.tolerance),
      ).toBe(false)
      expect(
        withinTolerance(impact.lifetimeTaxDelta!, expected.reversedTaxDeltaWrongReading!, example.tolerance),
      ).toBe(false)
      expect(
        withinTolerance(impact.endingAfterTaxEstateDelta!, inputs.candidateEndingAfterTaxEstate!, example.tolerance),
      ).toBe(false)
      expect(
        withinTolerance(impact.lifetimeTaxDelta!, inputs.candidateLifetimeTaxesAndPenalties!, example.tolerance),
      ).toBe(false)
    })
  },
)
