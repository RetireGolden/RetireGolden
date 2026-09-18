import { expect, it, vi } from 'vitest'
import type { BridgeSizing } from '../../ladder/bridge.js'
import { describeCalculation, withinTolerance } from '../../rules/describeCalculation.js'
import { cashAccount, couplePlan, socialSecurityIncome } from '../../testing/planFixtures.js'
import type { DetectorContext } from '../types.js'
import { ssBridgeGap } from './ssBridgeGap.js'

vi.mock('../../ladder/bridge.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../ladder/bridge.js')>()
  return {
    ...original,
    sizeBridge: vi.fn(),
  }
})

import { sizeBridge } from '../../ladder/bridge.js'

const mockedSize = vi.mocked(sizeBridge)

function sized(
  ladderCost: number,
  annualRealAmount: number,
  startYear: number,
  endYear: number,
): BridgeSizing {
  return {
    monthlyAge62Benefit: annualRealAmount / 12,
    annualRealAmount,
    startYear,
    endYear,
    years: endYear - startYear + 1,
    ladderCost,
  }
}

/**
 * Constructed DetectorContext: three delaying SS claimants. A and C are
 * uncovered; B is already covered by a plan ladder spanning 2030–2032. The
 * worksheet's household liquid balance and already-sized ladder costs and
 * annual amounts are passed through the mocked sizeBridge rather than
 * re-priced on the embedded curve. The screen applies one household gate
 * after aggregation (liquid >= 0.5 × total eligible cost) and does not use
 * per-claimant funding ratios.
 */
function context(liquidBalance: number): DetectorContext {
  const plan = couplePlan({ p1Dob: '1962-01-01', p2Dob: '1962-01-01', p1RetirementAge: 62, p2RetirementAge: 62 })
  plan.household.people.push({
    id: 'p3',
    name: 'Chris',
    dob: '1962-01-01',
    sex: 'average',
    retirementAge: 62,
    longevity: { planningAge: 90, source: 'manual' },
  } as never)
  plan.accounts = [cashAccount('cash', liquidBalance)] as never
  plan.incomes = [
    socialSecurityIncome('ss-a', 2_000, 67, 'p1'),
    socialSecurityIncome('ss-b', 1_500, 67, 'p2'),
    socialSecurityIncome('ss-c', 1_000, 67, 'p3'),
  ] as never
  // Coverage is by year-window, not by claimant: a ladder covering 2027–2029
  // would also cover A and C. B is given a distinct window (2030–2032) that
  // this ladder covers and the others' windows do not.
  plan.incomeFloor = {
    ladders: [{ id: 'cover-b', startYear: 2030, endYear: 2032, annualRealAmount: 14_000 }],
  } as never
  return {
    plan,
    params: { year: 2026 },
    projection: { startYear: 2026, result: { years: [] } },
  } as unknown as DetectorContext
}

function stubSizedBridges(): void {
  mockedSize.mockImplementation((input) => {
    if (input.piaMonthly === 2_000) return sized(120_000, 18_000, 2027, 2029)
    if (input.piaMonthly === 1_500) return sized(90_000, 14_000, 2030, 2032)
    if (input.piaMonthly === 1_000) return sized(80_000, 12_000, 2027, 2029)
    return null
  })
}

describeCalculation(
  'insight-ss-bridge-gap-total',
  {
    example: {
      inputs: {
        liquidBalance: 120_000,
        totalEligibleCost: 200_000,
        claimants: [
          { id: 'A', delays: true, gapCovered: false, ladderCost: 120_000, annualBridge: 18_000 },
          { id: 'B', delays: true, gapCovered: true, ladderCost: 90_000, annualBridge: 14_000 },
          { id: 'C', delays: true, gapCovered: false, ladderCost: 80_000, annualBridge: 12_000 },
        ],
      },
      expected: { totalCost: 200_000, annualTotal: 30_000 },
      tolerance: 'exact',
    },
    worksheet: 'DOCS/calculations/insights/insight-ss-bridge-gap-total.md',
    mutation: 'DOCS/calculations/insights/insight-ss-bridge-gap-total.mutation.md',
  },
  ({ example }) => {
    it('sums A and C only: $200,000 cost and $30,000/year when household liquid $120,000 clears the 50% gate', () => {
      stubSizedBridges()
      const card = ssBridgeGap.screen(context(example.inputs.liquidBalance as number))
      expect(card).not.toBeNull()
      const costRow = card!.evidence.find((entry) => entry.label === 'TIPS bridge cost')
      const annualRow = card!.evidence.find((entry) =>
        entry.label.startsWith('Approximate annual bridge income'),
      )
      if (costRow === undefined || annualRow === undefined) throw new Error('missing bridge evidence')
      const totalCost = Number(costRow.value.replace(/[$,]/gu, ''))
      const annualTotal = Number(annualRow.value.replace(/[~$,/yr]/gu, ''))
      const expectedCost = example.expected.totalCost as number
      const expectedAnnual = example.expected.annualTotal as number
      expect(
        withinTolerance(totalCost, expectedCost, example.tolerance),
        `totalCost ${totalCost} is not within ${JSON.stringify(example.tolerance)} of the worksheet's ${expectedCost}`,
      ).toBe(true)
      expect(
        withinTolerance(annualTotal, expectedAnnual, example.tolerance),
        `annualTotal ${annualTotal} is not within ${JSON.stringify(example.tolerance)} of the worksheet's ${expectedAnnual}`,
      ).toBe(true)
    })
  },
)
