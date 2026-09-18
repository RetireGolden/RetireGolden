import { expect, it, vi } from 'vitest'
import { irmaaTierThreshold, packForYear } from '../../params/index.js'
import { describeCalculation, withinTolerance } from '../../rules/describeCalculation.js'
import { couplePlan } from '../../testing/planFixtures.js'
import type { DetectorContext } from '../types.js'
import { irmaaTierEdge } from './irmaaTierEdge.js'

vi.mock('../../tax/medicare.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../tax/medicare.js')>()
  return {
    ...original,
    medicareAnnualPremiumPerPerson: vi.fn(),
  }
})

import { medicareAnnualPremiumPerPerson } from '../../tax/medicare.js'

const mockedPremium = vi.mocked(medicareAnnualPremiumPerPerson)

const START_YEAR = 2026
const MAGI_YEAR = 2026
const PREMIUM_YEAR = MAGI_YEAR + 2
const pack = packForYear(START_YEAR).pack
const tierOneThreshold = irmaaTierThreshold(pack, 0, 'marriedFilingJointly', {
  premiumYear: PREMIUM_YEAR,
  inflationFactorToYear: () => 1,
})

/**
 * Constructed DetectorContext: MAGI one dollar over the first IRMAA
 * threshold so the proximity screen fires; two Medicare-age people in the
 * charge year 2028. The worksheet's already-resolved per-person premiums
 * ($4,200 above, $2,400 below) are passed through the mocked helper.
 */
function context(): DetectorContext {
  const plan = couplePlan({ p1Dob: '1956-01-01', p2Dob: '1956-01-01' })
  plan.assumptions.inflationPct = 0
  plan.assumptions.healthcareExtraInflationPct = 0
  const years = [
    {
      year: MAGI_YEAR,
      magi: tierOneThreshold + 1,
      rothConversion: 0,
      people: [
        { personId: 'p1', alive: true, ageAttained: 70 },
        { personId: 'p2', alive: true, ageAttained: 70 },
      ],
    },
    { year: MAGI_YEAR + 1, magi: 0, rothConversion: 0, people: [] },
    {
      year: PREMIUM_YEAR,
      magi: 0,
      rothConversion: 0,
      people: [
        { personId: 'p1', alive: true, ageAttained: 72 },
        { personId: 'p2', alive: true, ageAttained: 72 },
      ],
    },
  ]
  return {
    plan,
    params: pack,
    projection: { startYear: START_YEAR, result: { years } },
  } as unknown as DetectorContext
}

describeCalculation(
  'insight-irmaa-tier-edge-premium-cliff',
  {
    example: {
      inputs: {
        medicareEnrollees: 2,
        premiumBelow: 2_400,
        premiumAbove: 4_200,
        magiToPremiumLag: 2,
      },
      expected: { annualPremiumCliff: 3_600 },
      tolerance: 'exact',
    },
    worksheet: 'DOCS/calculations/insights/insight-irmaa-tier-edge-premium-cliff.md',
    mutation: 'DOCS/calculations/insights/insight-irmaa-tier-edge-premium-cliff.mutation.md',
  },
  ({ example }) => {
    it('publishes a $3,600 household cliff from two enrollees × $1,800', () => {
      mockedPremium.mockImplementation((_pack, magi: number) => {
        const above = magi >= tierOneThreshold
        return {
          partBAnnual: above ? 4_200 : 2_400,
          partDSurchargeAnnual: 0,
          irmaaSurchargeAnnual: 0,
          irmaaTier: above ? 1 : 0,
          partDSurchargeUnverified: false,
        }
      })
      const card = irmaaTierEdge.screen(context())
      expect(card).not.toBeNull()
      const row = card!.evidence.find((entry) => entry.label.startsWith('Medicare premium cliff'))
      if (row === undefined) throw new Error('missing premium-cliff evidence')
      const cliff = Number(row.value.replace(/[$,]/gu, ''))
      const expected = example.expected.annualPremiumCliff as number
      expect(
        withinTolerance(cliff, expected, example.tolerance),
        `annualPremiumCliff ${cliff} is not within ${JSON.stringify(example.tolerance)} of the worksheet's ${expected}`,
      ).toBe(true)
      expect(card!.impact.endingAfterTaxEstateDelta).toBe(expected)
    })
  },
)
