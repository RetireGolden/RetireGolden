import { expect, it } from 'vitest'

import { packForYear, standardDeduction } from '../params/index.js'
import type { TaxYearInput } from '../projection/types.js'
import { describeCalculation, withinTolerance } from '../rules/describeCalculation.js'
import { applyCapitalLossCarryforward, computeFederalTax, taxableSocialSecurity } from './federalTax.js'

const pack = packForYear(2026).pack

/** A 2026 single filer with nothing set but the fields a case names. */
function singleFiler(partial: Partial<TaxYearInput>): TaxYearInput {
  return {
    year: 2026,
    filingStatus: 'single',
    ordinaryIncome: 0,
    capitalGains: 0,
    ssBenefits: 0,
    peopleAged65Plus: 0,
    ...partial,
  }
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
  'capital-loss-carryforward-netting',
  {
    example: {
      inputs: {
        openingCarryforward: 20_000,
        ordinaryIncome: 50_000,
        currentCapitalGains: 5_000,
        ordinaryOffsetLimit: 3_000,
      },
      expected: {
        ordinaryAfter: 50_000,
        netCapitalGain: -3_000,
        usedAgainstGains: 5_000,
        usedAgainstOrdinary: 3_000,
        remaining: 12_000,
      },
      tolerance: 'exact',
    },
    worksheet: 'DOCS/calculations/taxes/capital-loss-carryforward-netting.md',
    mutation: 'DOCS/calculations/taxes/capital-loss-carryforward-netting.mutation.md',
  },
  ({ example }) => {
    const inputs = example.inputs as Record<string, number>
    const expected = example.expected as Record<string, number>

    it('spends 5,000 of the pool against gains, reports a 3,000 loss on the capital line, and carries 12,000 forward', () => {
      // The limit is the pack's, not a literal: the worksheet names
      // year2026.federalTax.capitalLossOrdinaryOffsetLimit.
      expect(pack.federalTax.capitalLossOrdinaryOffsetLimit).toBe(inputs.ordinaryOffsetLimit)
      const netting = applyCapitalLossCarryforward(
        inputs.openingCarryforward!,
        inputs.ordinaryIncome!,
        inputs.currentCapitalGains!,
        pack.federalTax.capitalLossOrdinaryOffsetLimit,
      )
      for (const key of [
        'ordinaryAfter',
        'netCapitalGain',
        'usedAgainstGains',
        'usedAgainstOrdinary',
        'remaining',
      ] as const) {
        expectWithin(netting[key], expected[key]!, example.tolerance, key)
      }
    })

    it('leaves ordinary income untouched, so the offset is not an ordinary-income deduction', () => {
      const netting = applyCapitalLossCarryforward(
        inputs.openingCarryforward!,
        inputs.ordinaryIncome!,
        inputs.currentCapitalGains!,
        pack.federalTax.capitalLossOrdinaryOffsetLimit,
      )
      expect(netting.ordinaryAfter).toBe(inputs.ordinaryIncome)
    })
  },
)

describeCalculation(
  'federal-amt-screen',
  {
    example: {
      inputs: {
        filingStatus: 'single',
        amti: 200_000,
        preferentialIncome: 0,
        regularTax: 20_000,
        exemption: 90_100,
        phaseOutStartsAbove: 500_000,
        phaseOutRatePct: 50,
        rate28StartsAbove: 244_500,
        rate26Pct: 26,
        rate28Pct: 28,
      },
      expected: { amtExemption: 90_100, tentativeMinimumTax: 28_574, alternativeMinimumTax: 8_574 },
      tolerance: 'exact',
    },
    worksheet: 'DOCS/calculations/taxes/federal-amt-screen.md',
    mutation: 'DOCS/calculations/taxes/federal-amt-screen.mutation.md',
  },
  ({ example }) => {
    const inputs = example.inputs as Record<string, number>
    const expected = example.expected as Record<string, number>
    // The rate and exemption helpers are internal, so the screen is asserted
    // through computeFederalTax. The worksheet's AMTI and regular tax are not
    // calculator inputs: 130,275 of ordinary income less the 16,100 single
    // standard deduction leaves 114,175 of taxable income, whose bracket tax is
    // exactly the worksheet's 20,000 regular tax, and that standard deduction
    // returns as an add-back, so 69,725 of advanced preference items brings
    // AMTI to the worksheet's 200,000.
    const ORDINARY_INCOME = 130_275
    const ADVANCED_PREFERENCE_ITEMS = 69_725

    it('prices AMT at 8,574: 26% of the 109,900 excess over the 90,100 exemption, less 20,000 of regular tax', () => {
      expect(pack.federalTax.amt.exemption.single).toBe(inputs.exemption)
      expect(pack.federalTax.amt.exemptionPhaseOutStart.single).toBe(inputs.phaseOutStartsAbove)
      expect(pack.federalTax.amt.exemptionPhaseOutRatePct).toBe(inputs.phaseOutRatePct)
      expect(pack.federalTax.amt.rate28StartsAbove).toBe(inputs.rate28StartsAbove)
      expect(pack.federalTax.amt.rate26Pct).toBe(inputs.rate26Pct)
      expect(pack.federalTax.amt.rate28Pct).toBe(inputs.rate28Pct)

      const detail = computeFederalTax(
        singleFiler({ ordinaryIncome: ORDINARY_INCOME, amtPreferenceItems: ADVANCED_PREFERENCE_ITEMS }),
      )
      // The constructed case really is the worksheet's case.
      expectWithin(detail.alternativeMinimumTaxableIncome, inputs.amti!, example.tolerance, 'AMTI')
      expectWithin(detail.preferentialIncome, inputs.preferentialIncome!, example.tolerance, 'preferentialIncome')
      expectWithin(detail.ordinaryTax + detail.capitalGainsTax, inputs.regularTax!, example.tolerance, 'regularTax')

      expectWithin(detail.amtExemption, expected.amtExemption!, example.tolerance, 'amtExemption')
      expectWithin(detail.tentativeMinimumTax, expected.tentativeMinimumTax!, example.tolerance, 'tentativeMinimumTax')
      expectWithin(
        detail.alternativeMinimumTax,
        expected.alternativeMinimumTax!,
        example.tolerance,
        'alternativeMinimumTax',
      )
    })

    it('publishes no AMT when regular tax already exceeds the tentative minimum tax', () => {
      // The screen's floor: the same AMTI with no advanced preference items
      // leaves far more regular tax than tentative minimum tax.
      const detail = computeFederalTax(singleFiler({ ordinaryIncome: inputs.amti }))
      expect(detail.ordinaryTax).toBeGreaterThan(detail.tentativeMinimumTax)
      expect(detail.alternativeMinimumTax).toBe(0)
    })
  },
)

describeCalculation(
  'federal-ltcg-stacking',
  {
    example: {
      inputs: {
        filingStatus: 'single',
        ordinaryTaxableIncome: 45_000,
        preferentialIncome: 10_000,
        rate15StartsAbove: 49_450,
        rate20StartsAbove: 545_500,
      },
      expected: { capitalGainsTax: 832.5 },
      tolerance: { abs: 0.005 },
    },
    worksheet: 'DOCS/calculations/taxes/federal-ltcg-stacking.md',
    mutation: 'DOCS/calculations/taxes/federal-ltcg-stacking.mutation.md',
  },
  ({ example }) => {
    const inputs = example.inputs as Record<string, number>
    const expected = example.expected as Record<string, number>

    it('taxes only the 5,550 of preferential income above the 49,450 zero-rate ceiling', () => {
      expect(pack.capitalGains.rate15StartsAbove.single).toBe(inputs.rate15StartsAbove)
      expect(pack.capitalGains.rate20StartsAbove.single).toBe(inputs.rate20StartsAbove)
      // Gross income chosen so that taxable income net of the 2026 single
      // standard deduction is the worksheet's 45,000 ordinary plus 10,000
      // preferential.
      const standardBase = standardDeduction(pack, 'single', 0)
      const detail = computeFederalTax(
        singleFiler({
          ordinaryIncome: inputs.ordinaryTaxableIncome! + standardBase,
          capitalGains: inputs.preferentialIncome!,
        }),
      )
      expect(detail.ordinaryTaxable).toBe(inputs.ordinaryTaxableIncome)
      expect(detail.preferentialIncome).toBe(inputs.preferentialIncome)
      expectWithin(detail.capitalGainsTax, expected.capitalGainsTax!, example.tolerance, 'capitalGainsTax')
    })

    it('charges nothing when every preferential dollar fits under the 15% threshold', () => {
      // The 0% band: ordinary taxable income plus the gain stays below t15.
      const standardBase = standardDeduction(pack, 'single', 0)
      const detail = computeFederalTax(
        singleFiler({ ordinaryIncome: 40_000 + standardBase, capitalGains: 4_000 }),
      )
      expect(detail.capitalGainsTax).toBe(0)
    })
  },
)

describeCalculation(
  'federal-ordinary-bracket-tax',
  {
    example: {
      inputs: {
        filingStatus: 'single',
        ordinaryTaxableIncome: 60_000,
        bracketStarts: [0, 12_400, 50_400, 105_700, 201_775, 256_225, 640_600],
        ratesPct: [10, 12, 22, 24, 32, 35, 37],
      },
      expected: { ordinaryTax: 7_912 },
      tolerance: 'exact',
    },
    worksheet: 'DOCS/calculations/taxes/federal-ordinary-bracket-tax.md',
    mutation: 'DOCS/calculations/taxes/federal-ordinary-bracket-tax.mutation.md',
  },
  ({ example }) => {
    const inputs = example.inputs as Record<string, unknown>
    const expected = example.expected as Record<string, number>

    it('layers 1,240 + 4,560 + 2,112 into 7,912 on 60,000 of ordinary taxable income', () => {
      expect(pack.federalTax.brackets.single.map((bracket) => bracket.lowerBound)).toEqual(
        inputs.bracketStarts,
      )
      expect(pack.federalTax.brackets.single.map((bracket) => bracket.ratePct)).toEqual(inputs.ratesPct)
      const standardBase = standardDeduction(pack, 'single', 0)
      const detail = computeFederalTax(
        singleFiler({ ordinaryIncome: (inputs.ordinaryTaxableIncome as number) + standardBase }),
      )
      expect(detail.ordinaryTaxable).toBe(inputs.ordinaryTaxableIncome)
      expectWithin(detail.ordinaryTax, expected.ordinaryTax!, example.tolerance, 'ordinaryTax')
    })

    it('does not apply the top reached rate to every dollar', () => {
      const standardBase = standardDeduction(pack, 'single', 0)
      const detail = computeFederalTax(singleFiler({ ordinaryIncome: 60_000 + standardBase }))
      expect(detail.ordinaryTax).toBeLessThan(60_000 * 0.22)
    })
  },
)

describeCalculation(
  'federal-standard-deduction-age-65',
  {
    example: {
      inputs: {
        filingStatus: 'single',
        basicDeduction: 16_100,
        age65Addition: 2_050,
        peopleAged65Plus: 1,
      },
      expected: { standardDeduction: 18_150 },
      tolerance: 'exact',
    },
    worksheet: 'DOCS/calculations/taxes/federal-standard-deduction-age-65.md',
    mutation: 'DOCS/calculations/taxes/federal-standard-deduction-age-65.mutation.md',
  },
  ({ example }) => {
    const inputs = example.inputs as Record<string, number>
    const expected = example.expected as Record<string, number>

    it('composes 16,100 + 1 x 2,050 into an 18,150 standard deduction', () => {
      expect(pack.federalTax.standardDeduction.single).toBe(inputs.basicDeduction)
      expect(pack.federalTax.age65Addition.single).toBe(inputs.age65Addition)
      const composed = standardDeduction(pack, 'single', inputs.peopleAged65Plus!)
      expectWithin(composed, expected.standardDeduction!, example.tolerance, 'standardDeduction')
    })

    it('is the deduction computeFederalTax elects once the separate senior deduction has phased out', () => {
      // 200,000 of MAGI is past the 2026 single senior-deduction phase-out, so
      // the published deduction is this composition and nothing else.
      const detail = computeFederalTax(
        singleFiler({ ordinaryIncome: 200_000, peopleAged65Plus: inputs.peopleAged65Plus! }),
      )
      expect(detail.seniorDeduction).toBe(0)
      expectWithin(detail.deduction, expected.standardDeduction!, example.tolerance, 'deduction')
    })
  },
)

describeCalculation(
  'federal-taxable-social-security-tiers',
  {
    example: {
      inputs: {
        filingStatus: 'single',
        grossSsBenefits: 20_000,
        taxExemptInterest: 0,
        foreignExclusionAddback: 0,
        agiExcludingSsBelowBase: 10_000,
        agiExcludingSsTier50: 20_000,
        agiExcludingSsTier85: 30_000,
        tier50Start: 25_000,
        tier85Start: 34_000,
      },
      expected: { belowBase: 0, tier50: 2_500, tier85: 9_600 },
      tolerance: 'exact',
    },
    worksheet: 'DOCS/calculations/taxes/federal-taxable-social-security-tiers.md',
    mutation: 'DOCS/calculations/taxes/federal-taxable-social-security-tiers.mutation.md',
  },
  ({ example }) => {
    const inputs = example.inputs as Record<string, number>
    const expected = example.expected as Record<string, number>
    const taxableFor = (agiExcludingSs: number): number =>
      taxableSocialSecurity(
        pack,
        'single',
        agiExcludingSs,
        inputs.grossSsBenefits!,
        inputs.taxExemptInterest!,
        inputs.foreignExclusionAddback!,
      )

    it('publishes 0, 2,500 and 9,600 across the three 2026 single-filer tiers', () => {
      expect(pack.ssBenefitTaxation.tier50Start.single).toBe(inputs.tier50Start)
      expect(pack.ssBenefitTaxation.tier85Start.single).toBe(inputs.tier85Start)
      expectWithin(taxableFor(inputs.agiExcludingSsBelowBase!), expected.belowBase!, example.tolerance, 'belowBase')
      expectWithin(taxableFor(inputs.agiExcludingSsTier50!), expected.tier50!, example.tolerance, 'tier50')
      expectWithin(taxableFor(inputs.agiExcludingSsTier85!), expected.tier85!, example.tolerance, 'tier85')
    })

    it('counts half the benefit in provisional income, so the below-base case sits exactly at 20,000', () => {
      // Without the half-benefit term the first case would test 10,000
      // against the 25,000 floor and every case would tier lower.
      expect(taxableFor(inputs.agiExcludingSsBelowBase!)).toBe(0)
      expect(taxableFor(inputs.agiExcludingSsBelowBase! + 5_001)).toBeGreaterThan(0)
    })

    it('returns nothing when there is no benefit to tax', () => {
      expect(taxableSocialSecurity(pack, 'single', 100_000, 0)).toBe(0)
    })
  },
)
