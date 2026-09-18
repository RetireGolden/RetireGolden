import { expect, it } from 'vitest'
import { describeCalculation, withinTolerance } from '../../rules/describeCalculation.js'
import { singlePersonPlan } from '../../testing/planFixtures.js'
import type { DetectorContext } from '../types.js'
import { spendingGuardrails } from './spendingGuardrails.js'

/**
 * Constructed DetectorContext: a depleting plan with first-year investable
 * $150,000 and base annual spending $60,000, matching the worksheet's two
 * cases. The floor is the generator's published requiredAnnual (80% of base,
 * or the plan's explicit requiredAnnual when present).
 */
function context(requiredAnnual?: number): DetectorContext {
  const plan = singlePersonPlan({ dob: '1961-01-01' })
  plan.expenses.baseAnnual = 60_000
  if (requiredAnnual !== undefined) plan.expenses.requiredAnnual = requiredAnnual
  return {
    plan,
    params: { year: 2026 },
    projection: {
      startYear: 2026,
      result: { years: [{ year: 2026, investableTotal: 150_000 }] },
      summary: { depletionYear: 2040 },
    },
  } as unknown as DetectorContext
}

function publishedFloor(card: NonNullable<ReturnType<typeof spendingGuardrails.screen>>): number {
  const row = card.evidence[0]
  return Number(row.value.replace(/[$,]/gu, ''))
}

describeCalculation(
  'insight-spending-guardrails-illustrative-floor',
  {
    example: {
      inputs: {
        fallback: { depletes: true, firstYearInvestable: 150_000, baseAnnual: 60_000, explicitRequiredAnnual: null },
        explicit: { depletes: true, firstYearInvestable: 150_000, baseAnnual: 60_000, explicitRequiredAnnual: 42_000 },
      },
      expected: { fallbackRequiredAnnual: 48_000, explicitRequiredAnnual: 42_000 },
      tolerance: { abs: 0.01 },
    },
    worksheet: 'DOCS/calculations/insights/insight-spending-guardrails-illustrative-floor.md',
    mutation: 'DOCS/calculations/insights/insight-spending-guardrails-illustrative-floor.mutation.md',
  },
  ({ example }) => {
    it('falls back to 80% of $60,000 = $48,000 when no explicit floor is set', () => {
      const card = spendingGuardrails.screen(context())
      expect(card).not.toBeNull()
      expect(card!.evidence[0]!.label).toBe(
        'Illustrative spending floor (80% of base spending, scenario-generated)',
      )
      const floor = publishedFloor(card!)
      const expected = example.expected.fallbackRequiredAnnual as number
      expect(
        withinTolerance(floor, expected, example.tolerance),
        `fallbackRequiredAnnual ${floor} is not within ${JSON.stringify(example.tolerance)} of the worksheet's ${expected}`,
      ).toBe(true)
    })

    it('selects the explicit $42,000 floor without applying 80% again', () => {
      const card = spendingGuardrails.screen(context(42_000))
      expect(card).not.toBeNull()
      expect(card!.evidence[0]!.label).toBe('Required spending floor')
      const floor = publishedFloor(card!)
      const expected = example.expected.explicitRequiredAnnual as number
      expect(
        withinTolerance(floor, expected, example.tolerance),
        `explicitRequiredAnnual ${floor} is not within ${JSON.stringify(example.tolerance)} of the worksheet's ${expected}`,
      ).toBe(true)
    })
  },
)
