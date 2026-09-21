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
 * so planUsesAssetAllocation is true. The worksheet's two generator-order
 * candidate lists (preferred id present but not the largest exposure; preferred
 * id absent so the first candidate is published) are passed through the
 * generator. Ending-estate deltas are stated inputs the screen ignores.
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

function publishedExposure(card: NonNullable<ReturnType<typeof assetLocation.screen>>): number {
  const row = card.evidence.find((entry) => entry.label === 'Swappable class exposure')
  if (row === undefined) throw new Error('missing swappable exposure evidence')
  return Number(row.value.replace(/[$,]/gu, ''))
}

describeCalculation(
  'insight-asset-location-swappable-exposure',
  {
    example: {
      inputs: {
        preferredIdPresent: [
          {
            id: 'asset-location-stocks-to-roth',
            swappableExposure: 80_000,
            endingAfterTaxEstateDelta: 10_000,
          },
          {
            id: 'asset-location-bonds-to-traditional',
            swappableExposure: 120_000,
            endingAfterTaxEstateDelta: -2_000,
          },
          {
            id: 'asset-location-stocks-to-traditional',
            swappableExposure: 150_000,
            endingAfterTaxEstateDelta: 20_000,
          },
        ],
        preferredIdAbsent: [
          {
            id: 'asset-location-bonds-to-roth',
            swappableExposure: 70_000,
            endingAfterTaxEstateDelta: -1_000,
          },
          {
            id: 'asset-location-stocks-to-traditional',
            swappableExposure: 200_000,
            endingAfterTaxEstateDelta: 30_000,
          },
          {
            id: 'asset-location-stocks-to-roth',
            swappableExposure: 100_000,
            endingAfterTaxEstateDelta: 5_000,
          },
        ],
      },
      expected: { preferredIdPresentExposure: 120_000, preferredIdAbsentExposure: 70_000 },
      tolerance: 'exact',
    },
    worksheet: 'DOCS/calculations/insights/insight-asset-location-swappable-exposure.md',
    mutation: 'DOCS/calculations/insights/insight-asset-location-swappable-exposure.mutation.md',
  },
  ({ example }) => {
    it('publishes the preferred id\'s $120,000 exposure even though a later candidate has $150,000', () => {
      const rows = example.inputs.preferredIdPresent as Array<{
        id: string
        swappableExposure: number
        endingAfterTaxEstateDelta: number
      }>
      mockedGenerate.mockReturnValue(
        rows.map((row) => candidateOf(row.id, row.swappableExposure, row.endingAfterTaxEstateDelta)),
      )
      const card = assetLocation.screen(context())
      expect(card).not.toBeNull()
      const exposure = publishedExposure(card!)
      const expected = example.expected.preferredIdPresentExposure as number
      expect(
        withinTolerance(exposure, expected, example.tolerance),
        `swappableExposure ${exposure} is not within ${JSON.stringify(example.tolerance)} of the worksheet's ${expected}`,
      ).toBe(true)
    })

    it('publishes the first candidate\'s $70,000 exposure when the preferred id is absent', () => {
      const rows = example.inputs.preferredIdAbsent as Array<{
        id: string
        swappableExposure: number
        endingAfterTaxEstateDelta: number
      }>
      mockedGenerate.mockReturnValue(
        rows.map((row) => candidateOf(row.id, row.swappableExposure, row.endingAfterTaxEstateDelta)),
      )
      const card = assetLocation.screen(context())
      expect(card).not.toBeNull()
      const exposure = publishedExposure(card!)
      const expected = example.expected.preferredIdAbsentExposure as number
      expect(
        withinTolerance(exposure, expected, example.tolerance),
        `swappableExposure ${exposure} is not within ${JSON.stringify(example.tolerance)} of the worksheet's ${expected}`,
      ).toBe(true)
    })
  },
)
