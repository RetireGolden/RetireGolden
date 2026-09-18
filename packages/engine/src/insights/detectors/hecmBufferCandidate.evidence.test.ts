import { expect, it, vi } from 'vitest'
import { packForYear } from '../../params/index.js'
import { describeCalculation, withinTolerance } from '../../rules/describeCalculation.js'
import { cashAccount, singlePersonPlan, taxableAccount, traditionalAccount } from '../../testing/planFixtures.js'
import type { DetectorContext } from '../types.js'
import { hecmBufferCandidate } from './hecmBufferCandidate.js'

vi.mock('../../params/index.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../params/index.js')>()
  return {
    ...original,
    hecmPrincipalLimitFactorPct: vi.fn(() => 45),
  }
})

/**
 * Constructed DetectorContext: youngest borrower age 65 (DOB 1961, start 2026),
 * primary residence $400,000, no HECM, investable accounts totaling $400,000
 * as the worksheet states. The already-resolved principal-limit factor of 45%
 * is passed through the mocked helper rather than re-read from the pack table.
 */
function context(): DetectorContext {
  const plan = singlePersonPlan({ dob: '1961-01-01' })
  plan.accounts = [
    {
      id: 'home',
      name: 'Home',
      type: 'property',
      value: 400_000,
      primaryResidence: true,
      plannedSaleYear: null,
    },
    cashAccount('cash', 20_000),
    taxableAccount('taxable', 90_000, 90_000),
    { id: 'rsu', name: 'RSU', type: 'equityComp', balance: 10_000 } as never,
    traditionalAccount('trad', 180_000, 'p1'),
    { id: 'roth', name: 'Roth', type: 'roth', ownerPersonId: 'p1', kind: 'ira', balance: 80_000 } as never,
    { id: 'hsa', name: 'HSA', type: 'hsa', ownerPersonId: 'p1', balance: 20_000 } as never,
  ] as never
  return {
    plan,
    params: packForYear(2026).pack,
    projection: { startYear: 2026, result: { years: [] } },
  } as unknown as DetectorContext
}

function evidenceUsd(card: NonNullable<ReturnType<typeof hecmBufferCandidate.screen>>, label: string): number {
  const row = card.evidence.find((entry) => entry.label === label)
  if (row === undefined) throw new Error(`missing evidence "${label}"`)
  return Number(row.value.replace(/[$,]/gu, ''))
}

describeCalculation(
  'insight-hecm-buffer-illustrative-credit-line',
  {
    example: {
      inputs: {
        youngestBorrowerAge: 65,
        primaryResidenceValue: 400_000,
        principalLimitFactorPct: 45,
        cash: 20_000,
        taxable: 90_000,
        equityComp: 10_000,
        traditional: 180_000,
        roth: 80_000,
        hsa: 20_000,
        existingHecm: false,
      },
      expected: { creditLine: 180_000, investable: 400_000 },
      tolerance: 'exact',
    },
    worksheet: 'DOCS/calculations/insights/insight-hecm-buffer-illustrative-credit-line.md',
    mutation: 'DOCS/calculations/insights/insight-hecm-buffer-illustrative-credit-line.mutation.md',
  },
  ({ example }) => {
    it('illustrates a $180,000 credit line against $400,000 investable at a 45% factor', () => {
      const card = hecmBufferCandidate.screen(context())
      expect(card).not.toBeNull()
      const creditLine = evidenceUsd(card!, 'Illustrative credit line')
      const investable = evidenceUsd(card!, 'Investable portfolio')
      const expectedLine = example.expected.creditLine as number
      const expectedInvestable = example.expected.investable as number
      expect(
        withinTolerance(creditLine, expectedLine, example.tolerance),
        `creditLine ${creditLine} is not within ${JSON.stringify(example.tolerance)} of the worksheet's ${expectedLine}`,
      ).toBe(true)
      expect(
        withinTolerance(investable, expectedInvestable, example.tolerance),
        `investable ${investable} is not within ${JSON.stringify(example.tolerance)} of the worksheet's ${expectedInvestable}`,
      ).toBe(true)
    })
  },
)
