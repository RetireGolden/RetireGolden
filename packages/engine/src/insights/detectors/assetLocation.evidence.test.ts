import { expect, it, vi } from 'vitest'
import type { DecisionCandidate } from '../../decisions/types.js'
import { describeCalculation, withinTolerance } from '../../rules/describeCalculation.js'
import { singlePersonPlan, traditionalAccount } from '../../testing/planFixtures.js'
import type { DetectorContext } from '../types.js'
import { assetLocation } from './assetLocation.js'

vi.mock('../../decisions/generators.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../decisions/generators.js')>()
  return {
    ...original,
    assetLocationGenerator: {
      ...original.assetLocationGenerator,
      generate: vi.fn(),
    },
  }
})

import { assetLocationGenerator } from '../../decisions/generators.js'

const mockedGenerate = vi.mocked(assetLocationGenerator.generate)

function candidateOf(
  id: string,
  swappedDollars: number,
  endingAfterTaxEstateDelta: number,
): DecisionCandidate {
  return {
    id,
    source: 'heuristic',
    category: 'asset-location',
    label: id,
    explanation: 'worksheet candidate',
    planPatch: { accounts: [] },
    metadata: { swappedDollars, endingAfterTaxEstateDelta },
  }
}

/**
 * Constructed DetectorContext: a traditional account with static allocation
 * so planUsesAssetAllocation is true. The worksheet's three candidates A/B/C
 * (exposures 80k/120k/150k, estate deltas +4k/+3k/−1k) are passed through
 * the generator rather than produced by a full allocation scan.
 */
function context(): DetectorContext {
  const plan = singlePersonPlan({ dob: '1961-01-01' })
  const ira = traditionalAccount('ira', 500_000, 'p1')
  plan.accounts = [
    {
      ...ira,
      allocation: { mode: 'static', rebalancing: 'annual', weights: { usStocks: 50, intlStocks: 0, bonds: 50, cash: 0 } },
    } as never,
  ]
  return {
    plan,
    params: { year: 2026 },
    projection: { startYear: 2026, result: { years: [] } },
  } as unknown as DetectorContext
}

describeCalculation(
  'insight-asset-location-swappable-exposure',
  {
    example: {
      inputs: {
        candidates: [
          { id: 'A', swappableExposure: 80_000, endingAfterTaxEstateDelta: 4_000 },
          { id: 'B', swappableExposure: 120_000, endingAfterTaxEstateDelta: 3_000 },
          { id: 'C', swappableExposure: 150_000, endingAfterTaxEstateDelta: -1_000 },
        ],
      },
      expected: { swappableExposure: 80_000 },
      tolerance: { abs: 1e-9 },
    },
    worksheet: 'DOCS/calculations/insights/insight-asset-location-swappable-exposure.md',
    mutation: 'DOCS/calculations/insights/insight-asset-location-swappable-exposure.mutation.md',
  },
  ({ example }) => {
    it('publishes candidate A\'s $80,000 swappable exposure, not C\'s larger harmful exposure', () => {
      // A is named as the preferred bonds-to-traditional id so screen()
      // selects it; the worksheet's unique-best-beneficial identity is
      // evaluate()'s, and A is also the unique largest positive delta.
      mockedGenerate.mockReturnValue([
        candidateOf('asset-location-bonds-to-traditional', 80_000, 4_000),
        candidateOf('B', 120_000, 3_000),
        candidateOf('C', 150_000, -1_000),
      ])
      const card = assetLocation.screen(context())
      expect(card).not.toBeNull()
      const row = card!.evidence.find((entry) => entry.label === 'Swappable class exposure')
      if (row === undefined) throw new Error('missing swappable exposure evidence')
      const exposure = Number(row.value.replace(/[$,]/gu, ''))
      const expected = example.expected.swappableExposure as number
      expect(
        withinTolerance(exposure, expected, example.tolerance),
        `swappableExposure ${exposure} is not within ${JSON.stringify(example.tolerance)} of the worksheet's ${expected}`,
      ).toBe(true)
    })
  },
)
