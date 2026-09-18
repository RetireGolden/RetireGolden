import { expect, it, vi } from 'vitest'
import type { RelocationComparison } from '../../projection/relocation.js'
import { describeCalculation, withinTolerance } from '../../rules/describeCalculation.js'
import { cashAccount, singlePersonPlan } from '../../testing/planFixtures.js'
import type { DetectorContext } from '../types.js'
import { stateRelocation } from './stateRelocation.js'

vi.mock('../../projection/relocation.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../projection/relocation.js')>()
  return {
    ...original,
    compareRelocationCandidates: vi.fn(),
  }
})

import { compareRelocationCandidates } from '../../projection/relocation.js'

const mockedCompare = vi.mocked(compareRelocationCandidates)

function row(
  partial: Pick<
    RelocationComparison['rows'][number],
    'id' | 'label' | 'candidate' | 'error' | 'destinationState' | 'lifetimeTaxesAndPenalties' | 'stateTaxByYear'
  >,
): RelocationComparison['rows'][number] {
  return {
    modeled: partial.error === null,
    lifetimeStateLocalTax: 0,
    endingAfterTaxEstate: 0,
    endingNetWorth: 0,
    depletionYear: null,
    endYear: 2028,
    successRate: null,
    drivers: null,
    warnings: [],
    ...partial,
  }
}

/**
 * Constructed DetectorContext: Kentucky, no moves, start year 2026, deflate
 * = amount / 1.03^(year − 2026). The worksheet's sweep rows (baseline,
 * FL/TX tied at $120,000 lifetime taxes and penalties, WA failed) and the
 * three-year state-tax series are passed through the mocked sweep rather
 * than running four ledgers.
 */
function context(): DetectorContext {
  const plan = singlePersonPlan({ dob: '1961-01-01', state: 'KY' })
  plan.accounts = [cashAccount('cash', 200_000)] as never
  plan.household.stateMoves = []
  return {
    plan,
    params: { year: 2026 },
    projection: {
      startYear: 2026,
      result: { years: [] },
      deflate: (year: number, amount: number) => amount / Math.pow(1.03, year - 2026),
    },
  } as unknown as DetectorContext
}

describeCalculation(
  'insight-state-relocation-lifetime-state-tax-savings',
  {
    example: {
      inputs: {
        currentState: 'KY',
        startYear: 2026,
        selection: [
          { id: 'baseline', error: null, lifetimeTaxesAndPenalties: 150_000 },
          { id: 'FL', error: null, lifetimeTaxesAndPenalties: 120_000, order: 1 },
          { id: 'TX', error: null, lifetimeTaxesAndPenalties: 120_000, order: 2 },
          { id: 'WA', error: 'calculation failed', order: 3 },
        ],
        annualStateTax: [
          { year: 2026, baseline: 6_000, fl: 3_000 },
          { year: 2027, baseline: 6_180, fl: 0 },
          { year: 2028, baseline: 0, fl: 3_182.7 },
        ],
        deflate: 'amount / 1.03^(year-2026)',
      },
      expected: { selectedCandidate: 'FL', lifetimeStateTaxSavings: 6_000 },
      tolerance: { abs: 0.000001 },
    },
    worksheet: 'DOCS/calculations/insights/insight-state-relocation-lifetime-state-tax-savings.md',
    mutation: 'DOCS/calculations/insights/insight-state-relocation-lifetime-state-tax-savings.mutation.md',
  },
  ({ example }) => {
    it('selects FL on the strict-< tie and publishes $6,000 of lifetime state-tax savings', () => {
      mockedCompare.mockReturnValue({
        startYear: 2026,
        rows: [
          row({
            id: 'baseline',
            label: 'Stay in KY',
            candidate: null,
            error: null,
            destinationState: 'KY',
            lifetimeTaxesAndPenalties: 150_000,
            stateTaxByYear: [
              { year: 2026, tax: 6_000 },
              { year: 2027, tax: 6_180 },
            ],
          }),
          row({
            id: 'candidate-0',
            label: 'Move to FL',
            candidate: { state: 'FL', moveYear: 2026 },
            error: null,
            destinationState: 'FL',
            lifetimeTaxesAndPenalties: 120_000,
            stateTaxByYear: [
              { year: 2026, tax: 3_000 },
              { year: 2028, tax: 3_182.7 },
            ],
          }),
          row({
            id: 'candidate-1',
            label: 'Move to TX',
            candidate: { state: 'TX', moveYear: 2026 },
            error: null,
            destinationState: 'TX',
            lifetimeTaxesAndPenalties: 120_000,
            stateTaxByYear: [],
          }),
          row({
            id: 'candidate-2',
            label: 'Move to WA',
            candidate: { state: 'WA', moveYear: 2026 },
            error: 'calculation failed',
            destinationState: 'WA',
            lifetimeTaxesAndPenalties: 0,
            stateTaxByYear: [],
          }),
        ],
        monteCarlo: null,
      } satisfies RelocationComparison)

      const result = stateRelocation.evaluate!(context())
      expect(result.action.kind).toBe('preview-scenario')
      if (result.action.kind !== 'preview-scenario') throw new Error('expected a preview')
      expect(result.action.scenarioName).toContain(example.expected.selectedCandidate as string)
      const qualitative = result.impact?.qualitative ?? ''
      const match = qualitative.match(/\$[\d,]+/u)
      if (match === null) throw new Error(`no dollar amount in ${qualitative}`)
      const savings = Number(match[0].replace(/[$,]/gu, ''))
      const expected = example.expected.lifetimeStateTaxSavings as number
      expect(
        withinTolerance(savings, expected, example.tolerance),
        `lifetimeStateTaxSavings ${savings} is not within ${JSON.stringify(example.tolerance)} of the worksheet's ${expected}`,
      ).toBe(true)
    })
  },
)
