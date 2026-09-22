import { expect, it } from 'vitest'

import { irmaaTierForMagi, packForYear } from '../params/index.js'
import { describeCalculation, withinTolerance } from '../rules/describeCalculation.js'
import { medicareAnnualPremiumPerPerson } from './medicare.js'

const pack = packForYear(2026).pack

function expectWithin(
  actual: number,
  expected: number,
  tolerance: Parameters<typeof withinTolerance>[2],
  label: string,
): void {
  expect(
    withinTolerance(actual, expected, tolerance),
    `${label} ${actual} is not within ${JSON.stringify(tolerance)} of the worksheet's ${expected}`,
  ).toBe(true)
}

describeCalculation(
  'medicare-base-part-b-premium',
  {
    example: {
      inputs: { standardPartBMonthly: 202.9, irmaaTier: 0, months: 12 },
      expected: { partBAnnual: 2_434.8, partDSurchargeAnnual: 0, irmaaSurchargeAnnual: 0 },
      tolerance: { abs: 0.005 },
    },
    worksheet: 'DOCS/calculations/medicare-and-aca/medicare-base-part-b-premium.md',
    mutation: 'DOCS/calculations/medicare-and-aca/medicare-base-part-b-premium.mutation.md',
  },
  ({ example }) => {
    const inputs = example.inputs as Record<string, number>
    const expected = example.expected as Record<string, number>

    it('annualizes the 202.90 standard monthly premium into 2,434.80 at tier 0', () => {
      expect(pack.medicare.partBStandardMonthly).toBe(inputs.standardPartBMonthly)
      const result = medicareAnnualPremiumPerPerson(pack, 0, 'single')
      expect(result.irmaaTier).toBe(inputs.irmaaTier)
      expectWithin(result.partBAnnual, expected.partBAnnual!, example.tolerance, 'partBAnnual')
      expect(result.partDSurchargeAnnual).toBe(expected.partDSurchargeAnnual)
      expect(result.irmaaSurchargeAnnual).toBe(expected.irmaaSurchargeAnnual)
      expect(result.partDSurchargeUnverified).toBe(false)
    })

    it('charges twelve months, not one', () => {
      const result = medicareAnnualPremiumPerPerson(pack, 0, 'single')
      expectWithin(
        result.partBAnnual,
        pack.medicare.partBStandardMonthly * inputs.months!,
        example.tolerance,
        'partBAnnual',
      )
    })
  },
)

describeCalculation(
  'medicare-irmaa-first-tier-boundary',
  {
    example: {
      inputs: {
        filingStatus: 'single',
        lookbackMagiAtBoundary: 109_000,
        lookbackMagiAboveBoundary: 109_001,
        firstTierMagiOver: 109_000,
        standardPartBMonthly: 202.9,
        firstTierApplicablePct: 35,
        firstTierPartDSurchargeMonthly: 14.5,
      },
      expected: {
        atBoundary: { irmaaTier: 0, partBAnnual: 2_434.8, partDSurchargeAnnual: 0, irmaaSurchargeAnnual: 0 },
        aboveBoundary: {
          irmaaTier: 1,
          partBAnnual: 3_408.72,
          partDSurchargeAnnual: 174,
          irmaaSurchargeAnnual: 1_147.92,
        },
      },
      tolerance: { abs: 0.005 },
    },
    worksheet: 'DOCS/calculations/medicare-and-aca/medicare-irmaa-first-tier-boundary.md',
    mutation: 'DOCS/calculations/medicare-and-aca/medicare-irmaa-first-tier-boundary.mutation.md',
  },
  ({ example }) => {
    const inputs = example.inputs as Record<string, number | string>
    const expected = example.expected as Record<string, Record<string, number>>
    const firstTier = pack.medicare.irmaaTiers[0]!

    it('keeps 109,000 itself in tier 0: the test is strictly greater than', () => {
      expect(firstTier.magiOver.single).toBe(inputs.firstTierMagiOver)
      const result = medicareAnnualPremiumPerPerson(pack, inputs.lookbackMagiAtBoundary as number, 'single')
      expect(result.irmaaTier).toBe(expected.atBoundary!.irmaaTier)
      expectWithin(result.partBAnnual, expected.atBoundary!.partBAnnual!, example.tolerance, 'partBAnnual')
      expect(result.partDSurchargeAnnual).toBe(expected.atBoundary!.partDSurchargeAnnual)
      expect(result.irmaaSurchargeAnnual).toBe(expected.atBoundary!.irmaaSurchargeAnnual)
    })

    it('prices 109,001 at 35/25 of standard plus the 14.50 Part D surcharge', () => {
      expect(pack.medicare.partBStandardMonthly).toBe(inputs.standardPartBMonthly)
      expect(firstTier.applicablePct).toBe(inputs.firstTierApplicablePct)
      expect(firstTier.partDSurchargeMonthly).toBe(inputs.firstTierPartDSurchargeMonthly)
      const result = medicareAnnualPremiumPerPerson(pack, inputs.lookbackMagiAboveBoundary as number, 'single')
      expect(result.irmaaTier).toBe(expected.aboveBoundary!.irmaaTier)
      for (const key of ['partBAnnual', 'partDSurchargeAnnual', 'irmaaSurchargeAnnual'] as const) {
        expectWithin(result[key], expected.aboveBoundary![key]!, example.tolerance, key)
      }
    })

    it('reads the applicable percentage as a share of program cost, not a surcharge', () => {
      // The second wrong reading: 35% as a surcharge would price Part B at
      // 273.915 a month rather than 284.06.
      const result = medicareAnnualPremiumPerPerson(pack, inputs.lookbackMagiAboveBoundary as number, 'single')
      const surchargeReadingAnnual = pack.medicare.partBStandardMonthly * 1.35 * 12
      expect(result.partBAnnual).toBeGreaterThan(surchargeReadingAnnual)
    })
  },
)

describeCalculation(
  'medicare-irmaa-two-year-lookback',
  {
    example: {
      inputs: {
        premiumYear: 2026,
        lookbackOffset: 2,
        magi2024: 109_001,
        magi2025: 0,
        magi2026: 0,
        firstTierMagiOver: 109_000,
      },
      expected: { lookbackYear: 2024, selectedMagi: 109_001, irmaaTier: 1 },
      tolerance: 'exact',
    },
    worksheet: 'DOCS/calculations/medicare-and-aca/medicare-irmaa-two-year-lookback.md',
    mutation: 'DOCS/calculations/medicare-and-aca/medicare-irmaa-two-year-lookback.mutation.md',
  },
  ({ example }) => {
    const inputs = example.inputs as Record<string, number>
    const expected = example.expected as Record<string, number>
    const magiByYear = new Map<number, number>([
      [2024, inputs.magi2024!],
      [2025, inputs.magi2025!],
      [2026, inputs.magi2026!],
    ])

    it('reads 2024 MAGI to price a 2026 premium year', () => {
      const lookbackYear = inputs.premiumYear! - inputs.lookbackOffset!
      expect(lookbackYear).toBe(expected.lookbackYear)
      const selected = magiByYear.get(lookbackYear)!
      expect(selected).toBe(expected.selectedMagi)
      expect(pack.medicare.irmaaTiers[0]!.magiOver.single).toBe(inputs.firstTierMagiOver)
      const result = medicareAnnualPremiumPerPerson(pack, selected, 'single')
      expect(result.irmaaTier).toBe(expected.irmaaTier)
      expect(irmaaTierForMagi(pack, selected, 'single')).toBe(expected.irmaaTier)
    })

    it('would sit in tier 0 on either of the two nearer years', () => {
      // The worksheet's two wrong readings: the prior year and the current
      // year both carry zero MAGI here and both fall to tier 0.
      for (const year of [2025, 2026]) {
        const result = medicareAnnualPremiumPerPerson(pack, magiByYear.get(year)!, 'single')
        expect(result.irmaaTier).toBe(0)
      }
    })
  },
)
