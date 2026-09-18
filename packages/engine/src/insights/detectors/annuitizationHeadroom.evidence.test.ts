import { expect, it, vi } from 'vitest'
import { describeCalculation, withinTolerance } from '../../rules/describeCalculation.js'
import { cashAccount, singlePersonPlan } from '../../testing/planFixtures.js'
import type { DetectorContext } from '../types.js'
import { annuitizationHeadroom } from './annuitizationHeadroom.js'

vi.mock('../../decisions/spiaQuotes.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../decisions/spiaQuotes.js')>()
  return {
    ...original,
    spiaPayoutRate: vi.fn(() => 0.066),
  }
})

/**
 * Constructed DetectorContext: planning age 97, one $800,000 cash account,
 * start year 2026, no annuity or pension. The worksheet's already-resolved
 * spiaPayoutRate(startAge) = 6.6%/year is passed through the mocked helper
 * rather than re-quoted from the SPIA table.
 */
function context(): DetectorContext {
  const plan = singlePersonPlan({ dob: '1961-01-01', planningAge: 97 })
  plan.accounts = [cashAccount('cash', 800_000)]
  return {
    plan,
    params: { year: 2026 },
    projection: { startYear: 2026, result: { years: [] } },
  } as unknown as DetectorContext
}

function evidenceUsd(card: NonNullable<ReturnType<typeof annuitizationHeadroom.screen>>, label: string): number {
  const row = card.evidence.find((entry) => entry.label === label)
  if (row === undefined) throw new Error(`missing evidence "${label}"`)
  return Number(row.value.replace(/[$,]/gu, ''))
}

describeCalculation(
  'insight-annuitization-headroom-illustrative-spia',
  {
    example: {
      inputs: {
        planningAge: 97,
        largestLiquidAccount: 800_000,
        existingAnnuityOrPension: false,
        spiaPayoutRatePct: 6.6,
      },
      expected: { premium: 200_000, monthlyPayout: 1_100 },
      tolerance: 'exact',
    },
    worksheet: 'DOCS/calculations/insights/insight-annuitization-headroom-illustrative-spia.md',
    mutation: 'DOCS/calculations/insights/insight-annuitization-headroom-illustrative-spia.mutation.md',
  },
  ({ example }) => {
    it('illustrates a $200,000 premium and $1,100/month from a quarter of $800,000 at 6.6%', () => {
      const card = annuitizationHeadroom.screen(context())
      expect(card).not.toBeNull()
      const premium = evidenceUsd(card!, 'Illustrative SPIA premium')
      const expectedPremium = example.expected.premium as number
      expect(
        withinTolerance(premium, expectedPremium, example.tolerance),
        `premium ${premium} is not within ${JSON.stringify(example.tolerance)} of the worksheet's ${expectedPremium}`,
      ).toBe(true)

      const monthlyRow = card!.evidence.find((entry) => entry.label.startsWith('Illustrative monthly income'))
      if (monthlyRow === undefined) throw new Error('missing monthly income evidence')
      const monthly = Number(monthlyRow.value.replace(/[$,/mo]/gu, ''))
      const expectedMonthly = example.expected.monthlyPayout as number
      expect(
        withinTolerance(monthly, expectedMonthly, example.tolerance),
        `monthlyPayout ${monthly} is not within ${JSON.stringify(example.tolerance)} of the worksheet's ${expectedMonthly}`,
      ).toBe(true)
    })
  },
)
