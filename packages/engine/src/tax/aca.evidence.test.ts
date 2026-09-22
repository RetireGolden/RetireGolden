import { expect, it } from 'vitest'

import { packForYear } from '../params/index.js'
import { describeCalculation, withinTolerance } from '../rules/describeCalculation.js'
import {
  acaApplicablePct,
  acaEconomicPremiumByMonth,
  acaFederalPovertyLine,
  buildAcaHouseholdMagi,
} from './aca.js'

const pack = packForYear(2026).pack

/** Twelve equal months of an annual premium, the shape the module takes. */
function byMonth(annual: number): number[] {
  return new Array<number>(12).fill(annual / 12)
}

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
  'aca-400-percent-cliff',
  {
    example: {
      inputs: {
        householdSize: 2,
        contiguousFpl: 21_150,
        magiAtCliff: 84_600,
        magiAboveCliff: 84_601,
        slcspPremium: 12_000,
        enrollmentPremium: 10_000,
        maxFplPctForCredit: 400,
        // The worksheet's FPL-percentage bound; the fixture tolerance below is
        // its dollar bound, and booleans are compared exactly.
        fplPctTolerance: 1e-9,
      },
      expected: {
        creditAtCliff: 3_573.84,
        fplPctAtCliff: 400,
        creditAboveCliff: 0,
        netPremiumAboveCliff: 10_000,
      },
      tolerance: { abs: 0.005 },
    },
    worksheet: 'DOCS/calculations/medicare-and-aca/aca-400-percent-cliff.md',
    mutation: 'DOCS/calculations/medicare-and-aca/aca-400-percent-cliff.mutation.md',
  },
  ({ example }) => {
    const inputs = example.inputs as Record<string, number>
    const expected = example.expected as Record<string, number>
    const resultFor = (magi: number) =>
      acaEconomicPremiumByMonth(
        pack,
        inputs.householdSize!,
        magi,
        byMonth(inputs.enrollmentPremium!),
        byMonth(inputs.slcspPremium!),
      )

    it('allows the credit at exactly 400% of the poverty line', () => {
      expect(pack.aca.maxFplPctForCredit).toBe(inputs.maxFplPctForCredit)
      expect(acaFederalPovertyLine(pack, inputs.householdSize!)).toBe(inputs.contiguousFpl)
      const atCliff = resultFor(inputs.magiAtCliff!)
      expect(atCliff.overCliff).toBe(false)
      expectWithin(atCliff.fplPct, expected.fplPctAtCliff!, { abs: inputs.fplPctTolerance! }, 'fplPct')
      expectWithin(
        atCliff.modeledAllowablePtc,
        expected.creditAtCliff!,
        example.tolerance,
        'modeledAllowablePtc',
      )
    })

    it('denies the credit one dollar above the ceiling and charges the whole premium', () => {
      const aboveCliff = resultFor(inputs.magiAboveCliff!)
      expect(aboveCliff.overCliff).toBe(true)
      expect(aboveCliff.fplPct).toBeGreaterThan(inputs.maxFplPctForCredit!)
      expectWithin(
        aboveCliff.modeledAllowablePtc,
        expected.creditAboveCliff!,
        example.tolerance,
        'modeledAllowablePtc',
      )
      expectWithin(
        aboveCliff.economicNetPremium,
        expected.netPremiumAboveCliff!,
        example.tolerance,
        'economicNetPremium',
      )
    })

    it('keeps the separate below-100% floor as its own answer', () => {
      // The claim's other boundary: the ceiling is not the only gate, and a
      // household under the floor is denied for a different reason.
      const belowFloor = resultFor(1_000)
      expect(belowFloor.belowEligibilityFloor).toBe(true)
      expect(belowFloor.overCliff).toBe(false)
      expect(belowFloor.modeledAllowablePtc).toBe(0)
    })
  },
)

describeCalculation(
  'aca-expected-contribution',
  {
    example: {
      inputs: {
        householdSize: 2,
        firstPersonFpl: 15_650,
        perAdditionalPersonFpl: 5_500,
        householdMagi: 42_300,
        applicablePctAt200: 6.6,
        slcspPremium: 12_000,
        enrollmentPremium: 10_000,
      },
      expected: { federalPovertyLine: 21_150, fplPct: 200, expectedContribution: 2_791.8 },
      tolerance: { abs: 0.005 },
    },
    worksheet: 'DOCS/calculations/medicare-and-aca/aca-expected-contribution.md',
    mutation: 'DOCS/calculations/medicare-and-aca/aca-expected-contribution.mutation.md',
  },
  ({ example }) => {
    const inputs = example.inputs as Record<string, number>
    const expected = example.expected as Record<string, number>

    it('builds a 21,150 poverty line for two people and contributes 6.60% of 42,300', () => {
      expect(pack.federalPovertyLine.contiguous.firstPerson).toBe(inputs.firstPersonFpl)
      expect(pack.federalPovertyLine.contiguous.perAdditionalPerson).toBe(inputs.perAdditionalPersonFpl)
      // The worksheet's FPL and FPL percentage are exact integers.
      expect(acaFederalPovertyLine(pack, inputs.householdSize!)).toBe(expected.federalPovertyLine)
      expect(acaApplicablePct(pack, expected.fplPct!)).toBe(inputs.applicablePctAt200)

      const result = acaEconomicPremiumByMonth(
        pack,
        inputs.householdSize!,
        inputs.householdMagi!,
        byMonth(inputs.enrollmentPremium!),
        byMonth(inputs.slcspPremium!),
      )
      expect(result.fplPct).toBe(expected.fplPct)
      expectWithin(
        result.expectedContribution,
        expected.expectedContribution!,
        example.tolerance,
        'expectedContribution',
      )
    })

    it('counts every household member in the poverty line, not just the first', () => {
      // The first wrong reading: a one-person line puts the same MAGI at about
      // 270% of poverty and interpolates a different rate.
      const onePersonLine = acaFederalPovertyLine(pack, 1)
      expect(onePersonLine).toBe(inputs.firstPersonFpl)
      expect(acaFederalPovertyLine(pack, inputs.householdSize!)).toBeGreaterThan(onePersonLine)
    })
  },
)

describeCalculation(
  'aca-allowable-premium-tax-credit',
  {
    example: {
      inputs: {
        householdSize: 2,
        householdMagi: 42_300,
        applicableSlcspPremium: 12_000,
        expectedContribution: 2_791.8,
        grossEnrollmentPremium: 10_000,
      },
      expected: { modeledAllowablePtc: 9_208.2 },
      tolerance: { abs: 0.005 },
    },
    worksheet: 'DOCS/calculations/medicare-and-aca/aca-allowable-premium-tax-credit.md',
    mutation: 'DOCS/calculations/medicare-and-aca/aca-allowable-premium-tax-credit.mutation.md',
  },
  ({ example }) => {
    const inputs = example.inputs as Record<string, number>
    const expected = example.expected as Record<string, number>

    it('credits the 12,000 benchmark less the 2,791.80 contribution, under the 10,000 enrollment cap', () => {
      const result = acaEconomicPremiumByMonth(
        pack,
        inputs.householdSize!,
        inputs.householdMagi!,
        byMonth(inputs.grossEnrollmentPremium!),
        byMonth(inputs.applicableSlcspPremium!),
      )
      // The worksheet's contribution really is the one this call derives.
      expectWithin(
        result.expectedContribution,
        inputs.expectedContribution!,
        example.tolerance,
        'expectedContribution',
      )
      expect(result.applicableSlcspPremium).toBe(inputs.applicableSlcspPremium)
      expect(result.grossEnrollmentPremium).toBe(inputs.grossEnrollmentPremium)
      expectWithin(
        result.modeledAllowablePtc,
        expected.modeledAllowablePtc!,
        example.tolerance,
        'modeledAllowablePtc',
      )
    })

    it('caps the credit at the enrollment premium when the benchmark is dearer than the plan bought', () => {
      // The claim's cap: a 2,000 enrollment premium cannot draw the 9,208.20
      // the benchmark alone would allow.
      const capped = acaEconomicPremiumByMonth(
        pack,
        inputs.householdSize!,
        inputs.householdMagi!,
        byMonth(2_000),
        byMonth(inputs.applicableSlcspPremium!),
      )
      expectWithin(capped.modeledAllowablePtc, 2_000, example.tolerance, 'modeledAllowablePtc')
    })

    it('floors the credit at zero when the contribution exceeds the benchmark', () => {
      const none = acaEconomicPremiumByMonth(
        pack,
        inputs.householdSize!,
        84_000,
        byMonth(inputs.grossEnrollmentPremium!),
        byMonth(4_000),
      )
      expect(none.modeledAllowablePtc).toBe(0)
    })
  },
)

describeCalculation(
  'aca-economic-net-premium',
  {
    example: {
      inputs: {
        householdSize: 2,
        householdMagi: 42_300,
        applicableSlcspPremium: 12_000,
        grossEnrollmentPremium: 10_000,
        modeledAllowablePtc: 9_208.2,
      },
      expected: { economicNetPremium: 791.8 },
      tolerance: { abs: 0.005 },
    },
    worksheet: 'DOCS/calculations/medicare-and-aca/aca-economic-net-premium.md',
    mutation: 'DOCS/calculations/medicare-and-aca/aca-economic-net-premium.mutation.md',
  },
  ({ example }) => {
    const inputs = example.inputs as Record<string, number>
    const expected = example.expected as Record<string, number>

    it('bears 791.80 of the 10,000 gross premium after a 9,208.20 credit', () => {
      const result = acaEconomicPremiumByMonth(
        pack,
        inputs.householdSize!,
        inputs.householdMagi!,
        byMonth(inputs.grossEnrollmentPremium!),
        byMonth(inputs.applicableSlcspPremium!),
      )
      expectWithin(
        result.modeledAllowablePtc,
        inputs.modeledAllowablePtc!,
        example.tolerance,
        'modeledAllowablePtc',
      )
      expectWithin(
        result.economicNetPremium,
        expected.economicNetPremium!,
        example.tolerance,
        'economicNetPremium',
      )
      // The backward-compatible alias must not drift from the named field.
      expect(result.netAnnualPremium).toBe(result.economicNetPremium)
    })

    it('never falls below zero, because each month\'s credit is capped at that month\'s premium', () => {
      const result = acaEconomicPremiumByMonth(
        pack,
        inputs.householdSize!,
        inputs.householdMagi!,
        byMonth(1_200),
        byMonth(inputs.applicableSlcspPremium!),
      )
      expect(result.economicNetPremium).toBe(0)
    })
  },
)

describeCalculation(
  'aca-household-magi-composition',
  {
    example: {
      inputs: {
        federalAgi: 50_000,
        grossSocialSecurity: 20_000,
        taxableSocialSecurity: 5_000,
        taxExemptInterestKnown: 1_000,
        foreignExclusionAddbackKnown: 2_000,
        requiredFilerDependentMagi: 3_000,
        nonRequiredFilerDependentMagi: 4_000,
      },
      expected: {
        magi: 71_000,
        components: {
          federalAgi: 50_000,
          nontaxableSocialSecurity: 15_000,
          taxExemptInterest: 1_000,
          foreignExclusionAddback: 2_000,
          requiredFilerDependentMagi: 3_000,
        },
      },
      tolerance: 'exact',
    },
    worksheet: 'DOCS/calculations/medicare-and-aca/aca-household-magi-composition.md',
    mutation: 'DOCS/calculations/medicare-and-aca/aca-household-magi-composition.mutation.md',
  },
  ({ example }) => {
    const inputs = example.inputs as Record<string, number>
    const expected = example.expected as { magi: number; components: Record<string, number> }
    const build = (dependentFilingStatus: 'required' | 'notRequired' | 'unknown' = 'required') =>
      buildAcaHouseholdMagi({
        federalAgi: inputs.federalAgi!,
        grossSocialSecurity: inputs.grossSocialSecurity!,
        taxableSocialSecurity: inputs.taxableSocialSecurity!,
        taxExemptInterest: { state: 'known', amount: inputs.taxExemptInterestKnown! },
        foreignExclusionAddback: { state: 'known', amount: inputs.foreignExclusionAddbackKnown! },
        dependents: [
          { personId: 'd1', requiredToFile: dependentFilingStatus, magi: inputs.requiredFilerDependentMagi! },
          { personId: 'd2', requiredToFile: 'notRequired', magi: inputs.nonRequiredFilerDependentMagi! },
        ],
      })

    it('sums 50,000 + 15,000 + 1,000 + 2,000 + 3,000 into a 71,000 actionable household MAGI', () => {
      const result = build()
      expect(result.actionable).toBe(true)
      expect(result.blockers).toEqual([])
      expectWithin(result.magi!, expected.magi, example.tolerance, 'magi')
      for (const [key, value] of Object.entries(expected.components)) {
        expectWithin(
          result.components[key as keyof typeof result.components],
          value,
          example.tolerance,
          `components.${key}`,
        )
      }
    })

    it('excludes the dependent who is not required to file', () => {
      const result = build()
      const excluded = result.dependents.find((dependent) => dependent.personId === 'd2')
      if (excluded === undefined) throw new Error('missing dependent row')
      expect(excluded.includedMagi).toBe(0)
    })

    it('blocks rather than guesses when a dependent\'s filing status is unknown', () => {
      const result = build('unknown')
      expect(result.actionable).toBe(false)
      expect(result.magi).toBeNull()
      expect(result.blockers).toEqual(['dependent-filing-status-unknown'])
    })
  },
)
