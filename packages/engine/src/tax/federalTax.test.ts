import { describe, expect, it } from 'vitest'

import { describeRule } from '../rules/describeRule.js'

import { EARLIEST_PACK_YEAR, LATEST_PACK_YEAR, packForYear } from '../params/index.js'
import type { TaxCalculator, TaxYearInput } from '../projection/types.js'
import {
  applyCapitalLossCarryforward,
  combineTaxCalculators,
  computeFederalTax,
  createFederalTaxCalculator,
  saltCapForYear,
  taxableSocialSecurity,
} from './federalTax.js'

function input(partial: Partial<TaxYearInput>): TaxYearInput {
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

describe('ordinary brackets and standard deduction (2026)', () => {
  it('MFJ, $100k wages: 10% and 12% brackets after the standard deduction', () => {
    const d = computeFederalTax(input({ filingStatus: 'marriedFilingJointly', ordinaryIncome: 100_000 }))
    expect(d.deduction).toBe(32_200)
    expect(d.taxableIncome).toBe(67_800)
    // 10%×24,800 + 12%×43,000
    expect(d.ordinaryTax).toBeCloseTo(7_640, 6)
    expect(d.totalTax).toBeCloseTo(7_640, 6)
  })

  it('single, $250k wages: climbs through the 32% bracket', () => {
    const d = computeFederalTax(input({ ordinaryIncome: 250_000 }))
    expect(d.taxableIncome).toBe(233_900)
    // 1,240 + 4,560 + 12,166 + 23,058 + 10,280
    expect(d.ordinaryTax).toBeCloseTo(51_304, 6)
  })

  it('zero income is zero tax', () => {
    const d = computeFederalTax(input({}))
    expect(d.totalTax).toBe(0)
    expect(d.taxableIncome).toBe(0)
  })
})

describe('Social Security taxation (provisional income)', () => {
  const pack = packForYear(2026).pack

  // IRC 86(a)(2)(A) is a sum, not a single percentage: 85 percent of the excess
  // over the adjusted base amount PLUS the tier-one amount already includible
  // between the base and adjusted base. Dropping that carry is the natural
  // misreading, and it understates inclusion by the whole tier-one band.
  //
  // Single filer, 20,000 of benefits, 30,000 of other AGI -> provisional 40,000.
  // Carry = min(10,000, 0.5 x (34,000 - 25,000)) = 4,500, which is the statute's
  // 4,500 cap arrived at from the threshold spread.
  // With carry:    0.85 x (40,000 - 34,000) + 4,500 = 9,600
  // Without carry: 0.85 x (40,000 - 34,000)         = 5,100
  describeRule('irc-86-a-taxable-social-security-two-tier', {
    readings: { tierOneCarriesIntoTheEightyFiveBand: 9_600, eightyFivePercentOfExcessAlone: 5_100 },
    accepted: 'tierOneCarriesIntoTheEightyFiveBand',
  }, ({ accepted, readings }) => {
    it('carries the capped tier-one amount into the 85 percent band', () => {
      const result = taxableSocialSecurity(pack, 'single', 30_000, 20_000)

      expect(result).toBeCloseTo(accepted, 6)
      expect(result).not.toBeCloseTo(readings.eightyFivePercentOfExcessAlone, 6)
    })
  })


  it('is zero below the first threshold', () => {
    expect(taxableSocialSecurity(pack, 'single', 10_000, 20_000)).toBe(0)
  })

  it('phases in at 50% between thresholds', () => {
    // provisional = 20,000 + 12,000 = 32,000 -> min(12,000, 0.5×7,000)
    expect(taxableSocialSecurity(pack, 'single', 20_000, 24_000)).toBeCloseTo(3_500, 6)
  })

  it('caps at 85% of benefits above the second threshold', () => {
    // provisional = 75,000 -> 0.85×41,000 + 4,500 = 39,350, capped at 25,500
    expect(taxableSocialSecurity(pack, 'single', 60_000, 30_000)).toBeCloseTo(25_500, 6)
  })

  it('flows into AGI in the full computation', () => {
    const d = computeFederalTax(input({ ordinaryIncome: 20_000, ssBenefits: 24_000 }))
    expect(d.taxableSocialSecurity).toBeCloseTo(3_500, 6)
    expect(d.agi).toBeCloseTo(23_500, 6)
  })

  it('includes a foreign exclusion in provisional income without taxing the exclusion itself', () => {
    const d = computeFederalTax(
      input({
        ordinaryIncome: 10_000,
        ssBenefits: 20_000,
        foreignExclusionAddback: 10_000,
      }),
    )
    // Provisional income is 30,000, so $2,500 of SS becomes taxable. The
    // excluded $10,000 itself never enters AGI.
    expect(d.taxableSocialSecurity).toBeCloseTo(2_500, 6)
    expect(d.agi).toBeCloseTo(12_500, 6)
  })

  it('preserves signed pre-floor AGI without changing ordinary tax behavior', () => {
    const d = computeFederalTax(input({ capitalGains: -3_000 }))
    expect(d.agiBeforeFloor).toBe(-3_000)
    expect(d.agi).toBe(0)
    expect(d.magi).toBe(0)
    expect(d.taxableIncome).toBe(0)
    expect(d.totalTax).toBe(0)
  })
})

describe('section 1411 net investment income tax', () => {
  // IRC 1411(a)(1) taxes the LESSER of net investment income or the excess of
  // MAGI over the threshold. The natural misreading taxes the investment income
  // itself once the threshold is crossed, which overstates the tax whenever
  // income is mostly non-investment.
  //
  // Single filer, threshold 200,000. Ordinary 160,000 plus 50,000 of long-term
  // gains -> MAGI 210,000, so the excess is 10,000 while NII is 50,000.
  //   lesser-of:  0.038 x 10,000 = 380
  //   full NII:   0.038 x 50,000 = 1,900
  describeRule('irc-1411-a-net-investment-income-tax', {
    readings: { lesserOfNiiAndMagiExcess: 380, fullNetInvestmentIncome: 1_900 },
    accepted: 'lesserOfNiiAndMagiExcess',
  }, ({ accepted, readings }) => {
    it('taxes the smaller of investment income and the threshold excess', () => {
      const result = computeFederalTax(input({
        ordinaryIncome: 160_000,
        capitalGains: 50_000,
      }))

      expect(result.niit).toBeCloseTo(accepted, 6)
      expect(result.niit).not.toBeCloseTo(readings.fullNetInvestmentIncome, 6)
    })
  })
})

describe('section 1211 capital loss limitation', () => {
  // IRC 1211(b) allows a net capital loss against ordinary income only up to
  // the lower of 3,000 dollars or the excess of losses over gains. The rest is
  // not forfeited -- 1212(b) carries it forward -- so the discriminating point
  // is how much lands in THIS year, not whether the loss is usable at all.
  //
  // A 10,000 loss with no gains: 3,000 is deducted now and 7,000 carries.
  describeRule('irc-1211-b-capital-loss-ordinary-offset', {
    readings: { cappedAtThreeThousand: 3_000, wholeLossAgainstOrdinary: 10_000 },
    accepted: 'cappedAtThreeThousand',
  }, ({ accepted, readings }) => {
    it('deducts only the annual cap and carries the rest forward', () => {
      const result = applyCapitalLossCarryforward(0, 80_000, -10_000, 3_000)

      expect(result.usedAgainstOrdinary).toBe(accepted)
      expect(result.usedAgainstOrdinary).not.toBe(readings.wholeLossAgainstOrdinary)
      // 1212(b): the balance is carried, not forfeited.
      expect(result.remaining).toBe(7_000)
    })
  })
})

describe('section 55 alternative minimum tax', () => {
  // IRC 55(a) imposes the AMT as the EXCESS of the tentative minimum tax over
  // the regular tax. Treating the tentative amount as the tax owed is the
  // natural misreading and would add a phantom liability to every year where
  // regular tax already exceeds it -- which is most of them.
  //
  // Single filer, 200,000 ordinary. Taxable is 183,900 after the 16,100
  // standard deduction, and that deduction is added back as a preference, so
  // AMTI is 200,000. Below the 500,000 phase-out start the exemption is the
  // full 90,100, leaving a 109,900 taxable excess taxed at 26 percent = 28,574.
  // Regular tax on 183,900 is larger, so nothing is owed.
  describeRule('irc-55-a-amt-is-the-excess-over-regular-tax', {
    readings: { excessOverRegularTax: 0, tentativeMinimumTaxItself: 28_574 },
    accepted: 'excessOverRegularTax',
  }, ({ accepted, readings }) => {
    it('owes nothing when the regular tax already exceeds the tentative amount', () => {
      const result = computeFederalTax(input({ ordinaryIncome: 200_000 }))

      expect(result.tentativeMinimumTax).toBeCloseTo(readings.tentativeMinimumTaxItself, 6)
      expect(result.alternativeMinimumTax).toBe(accepted)
    })
  })

  // Pub. L. 119-21 substitutes 50 percent for 25 percent from 2026. A reader
  // checking the unamended text of 55(d) will conclude the pack is wrong, so
  // this fixture exists to answer that objection with a number.
  //
  // Single filer, AMTI 600,000 -- 100,000 over the 500,000 threshold:
  //   at 50 percent: 90,100 - 50,000 = 40,100
  //   at 25 percent: 90,100 - 25,000 = 65,100
  describeRule('irc-55-d-exemption-phase-out-rate', {
    readings: { fiftyPercentPerDollar: 40_100, twentyFivePercentPerDollar: 65_100 },
    accepted: 'fiftyPercentPerDollar',
  }, ({ accepted, readings }) => {
    it('reduces the exemption by fifty cents per dollar above the threshold', () => {
      const result = computeFederalTax(input({ ordinaryIncome: 600_000 }))

      expect(result.amtExemption).toBe(accepted)
      expect(result.amtExemption).not.toBe(readings.twentyFivePercentPerDollar)
    })
  })
})

describe('capital gains stacking', () => {
  // IRC 1(h)(1) measures the preferential bands from where ordinary taxable
  // income ends, not from zero. Taxing the gain independently is the natural
  // misreading and it can zero the liability outright.
  //
  // Single filer, 2026. 56,100 ordinary and 20,000 of gains, less the 16,100
  // standard deduction, gives 40,000 of ordinary taxable income with the gain
  // sitting from 40,000 to 60,000. The 15 percent band opens above 49,450:
  //   stacked:      (60,000 - 49,450) x 0.15 = 1,582.50
  //   from zero:    20,000 sits entirely below 49,450, so nothing is taxed
  describeRule('irc-1-h-capital-gain-stacked-on-ordinary', {
    readings: { stackedOnOrdinaryIncome: 1_582.5, taxedIndependentlyFromZero: 0 },
    accepted: 'stackedOnOrdinaryIncome',
  }, ({ accepted, readings }) => {
    it('measures the preferential bands from the top of ordinary income', () => {
      const result = computeFederalTax(input({
        ordinaryIncome: 56_100,
        capitalGains: 20_000,
      }))

      expect(result.ordinaryTaxable).toBe(40_000)
      expect(result.capitalGainsTax).toBeCloseTo(accepted, 6)
      expect(result.capitalGainsTax).not.toBeCloseTo(readings.taxedIndependentlyFromZero, 6)
    })
  })

  it('keeps gains in the 0% bracket when ordinary income is low (MFJ)', () => {
    const d = computeFederalTax(
      input({ filingStatus: 'marriedFilingJointly', ordinaryIncome: 50_000, capitalGains: 80_000 }),
    )
    expect(d.ordinaryTaxable).toBe(17_800)
    expect(d.preferentialIncome).toBe(80_000)
    expect(d.capitalGainsTax).toBe(0) // stack tops out at 97,800 < 98,900
    expect(d.ordinaryTax).toBeCloseTo(1_780, 6)
  })

  it('taxes only the portion stacked above the 0% threshold at 15%', () => {
    const d = computeFederalTax(
      input({ filingStatus: 'marriedFilingJointly', ordinaryIncome: 50_000, capitalGains: 100_000 }),
    )
    // Stack runs 17,800 -> 117,800; 0% to 98,900, then 15% on 18,900.
    expect(d.capitalGainsTax).toBeCloseTo(2_835, 6)
  })

  it('stacks qualified dividends at preferential rates while including them in AGI', () => {
    const d = computeFederalTax(
      input({ filingStatus: 'marriedFilingJointly', ordinaryIncome: 50_000, qualifiedDividends: 100_000 }),
    )
    expect(d.agi).toBe(150_000)
    expect(d.preferentialIncome).toBe(100_000)
    expect(d.capitalGainsTax).toBeCloseTo(2_835, 6)
  })

  it('does not let capital losses offset qualified dividends', () => {
    const d = computeFederalTax(input({ ordinaryIncome: 100_000, capitalGains: -3_000, qualifiedDividends: 50_000 }))
    expect(d.agi).toBe(147_000)
    expect(d.preferentialIncome).toBe(50_000)
  })

  it('applies NIIT over the MAGI threshold', () => {
    const d = computeFederalTax(input({ ordinaryIncome: 150_000, capitalGains: 100_000 }))
    expect(d.magi).toBe(250_000)
    expect(d.niit).toBeCloseTo(1_900, 6) // 3.8% × min(100k, 50k over 200k)
    expect(d.capitalGainsTax).toBeCloseTo(15_000, 6) // all gains in the 15% layer
    expect(d.ordinaryTax).toBeCloseTo(24_734, 6)
    expect(d.totalTax).toBeCloseTo(41_634, 6)
  })

  it('includes taxable interest and dividends in NIIT investment income', () => {
    const d = computeFederalTax(
      input({
        ordinaryIncome: 250_000,
        capitalGains: 30_000,
        qualifiedDividends: 20_000,
        taxableInterestIncome: 10_000,
        ordinaryDividends: 5_000,
      }),
    )
    expect(d.magi).toBe(300_000)
    expect(d.niit).toBeCloseTo(65_000 * 0.038, 6)
  })
})

describe('standard deduction structure', () => {
  // IRC 63(c)(2)(A) defines the joint amount AS 200 percent of the unmarried
  // one, so the two are not independently indexed figures that happen to sit
  // near a 2:1 ratio -- the ratio is the rule. Carrying them as unrelated pack
  // constants invites them drifting apart at a future re-index, and nothing
  // downstream would notice.
  describeRule('irc-63-c-2-joint-standard-deduction-doubles', {
    readings: { exactlyTwiceTheUnmarriedAmount: 2, anyOtherRatio: 1.95 },
    accepted: 'exactlyTwiceTheUnmarriedAmount',
  }, ({ accepted, readings }) => {
    it('keeps the joint amount at exactly twice the unmarried one', () => {
      // Every published pack, not the helper's default year alone. The drift
      // this rule guards against arrives *with* a pack refresh, so a fixture
      // pinned to one year would go on passing through the very refresh that
      // broke the ratio -- green, and blind to the only event that matters.
      const publishedYears = Array.from(
        { length: LATEST_PACK_YEAR - EARLIEST_PACK_YEAR + 1 },
        (_, offset) => EARLIEST_PACK_YEAR + offset,
      ).filter((year) => !packForYear(year).isStandIn)

      // An empty sweep would pass vacuously, which is the failure this file
      // exists to refuse.
      expect(publishedYears).toContain(LATEST_PACK_YEAR)

      for (const year of publishedYears) {
        const single = computeFederalTax(input({ year, ordinaryIncome: 100_000 }))
        const joint = computeFederalTax(input({
          year, filingStatus: 'marriedFilingJointly', ordinaryIncome: 100_000,
        }))

        const ratio = joint.deduction / single.deduction
        expect(ratio, `pack ${year}`).toBeCloseTo(accepted, 10)
        expect(ratio, `pack ${year}`).not.toBeCloseTo(readings.anyOtherRatio, 3)
      }
    })
  })
})

describe('SALT cap schedule', () => {
  // IRC 164(b)(7) is a written schedule, not an indexed figure, and 2030 is a
  // REVERSION: 40,400 in 2026, stepping 101 percent a year, then 10,000 flat.
  // Holding the 2026 cap -- or projecting it at general inflation like an
  // indexed limit -- overstates the deduction roughly fourfold for every year
  // from 2030 on, which for a retiree in a high-tax state is most of a horizon.
  //
  // 2030, single, 50,000 of state tax and 30,000 of mortgage interest:
  //   cap reverts to 10,000:  10,000 + 30,000 = 40,000 itemized
  //   2026 cap held:          40,400 + 30,000 = 70,400 itemized
  describeRule('irc-164-b-7-salt-cap-schedule', {
    readings: { revertsToTenThousand: 40_000, holdsTheTwentyTwentySixCap: 70_400 },
    accepted: 'revertsToTenThousand',
  }, ({ accepted, readings }) => {
    it('drops the cap to ten thousand for years after 2029', () => {
      const d = computeFederalTax(input({
        year: 2030,
        ordinaryIncome: 300_000,
        itemizedDeductions: { stateAndLocalTaxes: 50_000, mortgageInterest: 30_000, charitable: 0 },
      }))

      expect(d.deduction).toBeCloseTo(accepted, 6)
      expect(d.deduction).not.toBeCloseTo(readings.holdsTheTwentyTwentySixCap, 6)
    })

    // 164(b)(7)(A)(iii) compounds on "the dollar amount in effect ... for the
    // preceding calendar year", so each step multiplies the year before it and
    // the run compounds off the 2026 base: 40,400 -> 40,804 -> 41,212.04 ->
    // 41,624.1604. Stepping off the 2025 figure instead, or applying a single
    // one percent to the whole run, both land low.
    it('compounds the one percent steps on the preceding year through 2029', () => {
      const pack = packForYear(2026).pack

      expect(saltCapForYear(pack, 2026)).toBeCloseTo(40_400, 6)
      expect(saltCapForYear(pack, 2027)).toBeCloseTo(40_804, 6)
      expect(saltCapForYear(pack, 2028)).toBeCloseTo(41_212.04, 6)
      expect(saltCapForYear(pack, 2029)).toBeCloseTo(41_624.1604, 6)
      expect(saltCapForYear(pack, 2030)).toBe(10_000)
    })

    // (A)(i) names calendar year 2025 exactly, not "2025 and earlier". The
    // pre-OBBBA applicable limitation was 10,000, and 164(b)(6) itself reaches
    // only taxable years beginning after 2017 -- earlier ones were uncapped.
    // Carrying 40,000 backwards overstates the cap fourfold, the same error in
    // the same direction as holding 40,400 past 2029.
    it('does not carry the 2025 figure back before the schedule begins', () => {
      const pack = packForYear(2026).pack

      expect(saltCapForYear(pack, 2025)).toBe(40_000)
      expect(saltCapForYear(pack, 2024)).toBe(10_000)
      expect(saltCapForYear(pack, 2018)).toBe(10_000)
      expect(saltCapForYear(pack, 2017)).toBe(Number.POSITIVE_INFINITY)
    })
  })
})

describe('age-based deductions', () => {
  // IRC 63(f)(1) grants the additional amount separately for the taxpayer under
  // (A) and for a qualifying spouse under (B). On a joint return with two
  // qualifying people it is taken twice. Treating it as one household amount
  // is the natural misreading and understates the deduction by a full share.
  //
  // MFJ, both 65+: 32,200 base + 2 x 1,650 + 12,000 senior = 47,500.
  // One household share instead: 32,200 + 1,650 + 12,000 = 45,850.
  describeRule('irc-63-f-additional-standard-deduction-aged', {
    readings: { perQualifyingPerson: 47_500, oneAmountPerHousehold: 45_850 },
    accepted: 'perQualifyingPerson',
  }, ({ accepted, readings }) => {
    it('takes the addition once for each person who has attained 65', () => {
      const result = computeFederalTax(input({
        filingStatus: 'marriedFilingJointly',
        ordinaryIncome: 100_000,
        peopleAged65Plus: 2,
      }))

      expect(result.deduction).toBe(accepted)
      expect(result.deduction).not.toBe(readings.oneAmountPerHousehold)
    })
  })

  it('adds 65+ amounts and the OBBBA senior deduction (MFJ, both 65+)', () => {
    const d = computeFederalTax(
      input({ filingStatus: 'marriedFilingJointly', ordinaryIncome: 100_000, peopleAged65Plus: 2 }),
    )
    expect(d.seniorDeduction).toBe(12_000)
    expect(d.deduction).toBe(32_200 + 2 * 1_650 + 12_000)
    expect(d.ordinaryTax).toBeCloseTo(5_804, 6)
  })

  it('phases out the senior deduction at 6% of MAGI over the threshold', () => {
    const d = computeFederalTax(
      input({ filingStatus: 'marriedFilingJointly', ordinaryIncome: 200_000, peopleAged65Plus: 2 }),
    )
    expect(d.seniorDeduction).toBeCloseTo(9_000, 6) // 12,000 − 6%×50,000
  })

  it('drops the senior deduction after its statutory last year', () => {
    const d = computeFederalTax(input({ year: 2030, ordinaryIncome: 100_000, peopleAged65Plus: 1 }))
    expect(d.seniorDeduction).toBe(0)
    expect(d.usesStandInPack).toBe(true) // 2030 rides the 2026 pack
  })
})

describe('calculators', () => {
  it('federal calculator matches the detailed computation', () => {
    const calc = createFederalTaxCalculator()
    const i = input({ ordinaryIncome: 80_000, capitalGains: 10_000, ssBenefits: 20_000 })
    expect(calc.compute(i)).toBe(computeFederalTax(i).totalTax)
  })

  it('combined calculator sums its parts', () => {
    const flat: TaxCalculator = { compute: (i) => Math.max(0, i.ordinaryIncome) * 0.05 }
    const combined = combineTaxCalculators(createFederalTaxCalculator(), flat)
    const i = input({ ordinaryIncome: 100_000 })
    expect(combined.compute(i)).toBeCloseTo(computeFederalTax(i).totalTax + 5_000, 6)
  })
})

describe('itemized deductions (2026)', () => {
  it('uses the standard deduction when itemized is smaller', () => {
    const d = computeFederalTax(input({ ordinaryIncome: 100_000, itemizedDeductions: { stateAndLocalTaxes: 3_000, mortgageInterest: 2_000, charitable: 1_000 } }))
    expect(d.itemized).toBe(false)
    expect(d.deduction).toBe(16_100) // standard, single
  })

  it('uses itemized when it beats the standard deduction', () => {
    const d = computeFederalTax(input({ ordinaryIncome: 100_000, itemizedDeductions: { stateAndLocalTaxes: 8_000, mortgageInterest: 12_000, charitable: 5_000 } }))
    expect(d.itemized).toBe(true)
    expect(d.deduction).toBe(25_000) // 8k + 12k + 5k
    expect(d.taxableIncome).toBe(75_000)
  })

  it('caps the SALT component at the pack saltCap', () => {
    const d = computeFederalTax(input({ ordinaryIncome: 200_000, itemizedDeductions: { stateAndLocalTaxes: 60_000, mortgageInterest: 0, charitable: 0 } }))
    expect(d.deduction).toBe(40_400) // SALT capped, beats standard
    expect(d.itemized).toBe(true)
  })

  it('adds the OBBBA senior deduction on top of itemized', () => {
    const d = computeFederalTax(input({ ordinaryIncome: 60_000, peopleAged65Plus: 1, itemizedDeductions: { stateAndLocalTaxes: 20_000, mortgageInterest: 5_000, charitable: 0 } }))
    // itemized 25,000 > standard(16,100+2,050); senior 6,000 (MAGI 60k < 75k phase-out) on top.
    expect(d.itemized).toBe(true)
    expect(d.deduction).toBe(31_000)
  })
})

describe('AMT screen (2026)', () => {
  it('is zero when tentative minimum tax does not exceed regular tax', () => {
    const d = computeFederalTax(input({ ordinaryIncome: 100_000 }))
    expect(d.alternativeMinimumTaxableIncome).toBeCloseTo(100_000, 6)
    expect(d.alternativeMinimumTax).toBe(0)
    expect(d.totalTax).toBeCloseTo(d.ordinaryTax + d.capitalGainsTax + d.niit, 6)
  })

  it('adds only the tentative-minimum-tax excess over regular income tax', () => {
    const d = computeFederalTax(input({ ordinaryIncome: 100_000, amtPreferenceItems: 300_000 }))
    expect(d.amtPreferenceItems).toBeCloseTo(300_000 + d.deduction, 6)
    expect(d.alternativeMinimumTaxableIncome).toBeCloseTo(400_000, 6)
    expect(d.tentativeMinimumTax).toBeGreaterThan(d.ordinaryTax + d.capitalGainsTax)
    expect(d.alternativeMinimumTax).toBeCloseTo(d.tentativeMinimumTax - d.ordinaryTax - d.capitalGainsTax, 6)
    expect(d.totalTax).toBeCloseTo(d.ordinaryTax + d.capitalGainsTax + d.alternativeMinimumTax + d.niit, 6)
  })

  it('preserves preferential rates for LTCG and qualified dividends in tentative minimum tax', () => {
    const d = computeFederalTax(input({ capitalGains: 800_000 }))
    const expectedPreferentialTmt = (545_500 - 49_450) * 0.15 + (800_000 - 545_500) * 0.2
    const naiveAmtRateTax = 244_500 * 0.26 + (800_000 - 244_500) * 0.28
    expect(d.alternativeMinimumTaxableIncome).toBeCloseTo(800_000, 6)
    expect(d.tentativeMinimumTax).toBeCloseTo(expectedPreferentialTmt, 6)
    expect(d.tentativeMinimumTax).toBeLessThan(naiveAmtRateTax - 90_000)
  })

  it('treats qualifying surviving spouse as the joint AMT and regular-tax table', () => {
    const qss = computeFederalTax(input({ filingStatus: 'qualifyingSurvivingSpouse', ordinaryIncome: 120_000 }))
    const mfj = computeFederalTax(input({ filingStatus: 'marriedFilingJointly', ordinaryIncome: 120_000 }))
    expect(qss.deduction).toBe(mfj.deduction)
    expect(qss.ordinaryTax).toBe(mfj.ordinaryTax)
    expect(qss.amtExemption).toBe(mfj.amtExemption)
  })
})

describe('zeroRateLtcgHeadroom (gain-harvesting advisory)', () => {
  it('reports room up to the 15% threshold when taxable income is low (no SS)', () => {
    // Single, $30k ordinary − $16,100 standard = $13,900 taxable; 0% LTCG to $49,450.
    const d = computeFederalTax(input({ ordinaryIncome: 30_000 }))
    expect(d.zeroRateLtcgHeadroom).toBeCloseTo(49_450 - 13_900, 0)
  })

  it('is zero once taxable income is above the 15% threshold', () => {
    const d = computeFederalTax(input({ ordinaryIncome: 120_000 }))
    expect(d.zeroRateLtcgHeadroom).toBe(0)
  })

  it('shrinks as realized gains fill the 0% bracket (no SS)', () => {
    const noGains = computeFederalTax(input({ ordinaryIncome: 30_000 })).zeroRateLtcgHeadroom
    const withGains = computeFederalTax(input({ ordinaryIncome: 30_000, capitalGains: 10_000 })).zeroRateLtcgHeadroom
    expect(withGains).toBeCloseTo(noGains - 10_000, 0)
  })

  it('accounts for Social Security phase-in (less than the naive estimate)', () => {
    // Single, $40k SS, no other income. Naively the whole $49,450 looks free, but
    // realizing gains makes more SS taxable, so the safe 0% harvest is smaller.
    const d = computeFederalTax(input({ ordinaryIncome: 0, ssBenefits: 40_000 }))
    expect(d.zeroRateLtcgHeadroom).toBeGreaterThan(0)
    expect(d.zeroRateLtcgHeadroom).toBeLessThan(45_000)
    // Realized gains stay below the threshold: confirm taxable income holds at it.
    const realized = computeFederalTax(input({ ordinaryIncome: 0, ssBenefits: 40_000, capitalGains: d.zeroRateLtcgHeadroom }))
    expect(realized.taxableIncome).toBeLessThanOrEqual(49_450 + 1)
  })
})

describe('applyCapitalLossCarryforward', () => {
  const LIMIT = 3_000

  it('absorbs realized gains first, then deducts $3k as a net loss, carrying the rest', () => {
    // $50k pool, $2k gain, $40k income: gain absorbed, $3k net-loss deduction, $45k carries.
    const r = applyCapitalLossCarryforward(50_000, 40_000, 2_000, LIMIT)
    expect(r.usedAgainstGains).toBe(2_000)
    expect(r.usedAgainstOrdinary).toBe(3_000)
    expect(r.netCapitalGain).toBe(-3_000) // gains absorbed, then a $3k deductible net loss
    expect(r.ordinaryAfter).toBe(40_000) // ordinary income itself is unchanged
    expect(r.remaining).toBe(45_000)
  })

  it('still deducts $3k in a year with no realized gains', () => {
    const r = applyCapitalLossCarryforward(50_000, 40_000, 0, LIMIT)
    expect(r.usedAgainstGains).toBe(0)
    expect(r.usedAgainstOrdinary).toBe(3_000)
    expect(r.netCapitalGain).toBe(-3_000)
    expect(r.remaining).toBe(47_000)
  })

  it('only offsets the gains it can when the pool is smaller than the gains', () => {
    const r = applyCapitalLossCarryforward(1_000, 40_000, 5_000, LIMIT)
    expect(r.usedAgainstGains).toBe(1_000)
    expect(r.netCapitalGain).toBe(4_000) // gains remain, taxed
    expect(r.usedAgainstOrdinary).toBe(0) // pool exhausted by gains
    expect(r.remaining).toBe(0)
  })

  it('a large gain can consume the whole pool, leaving nothing to deduct', () => {
    const r = applyCapitalLossCarryforward(50_000, 40_000, 50_000, LIMIT)
    expect(r.netCapitalGain).toBe(0)
    expect(r.usedAgainstOrdinary).toBe(0)
    expect(r.remaining).toBe(0)
  })

  it('deducts the full $3k even when other income is below $3k (the loss is a capital line, not an ordinary offset)', () => {
    // Regression for the SS/AGI cascade: the deduction is NOT capped at other income.
    const r = applyCapitalLossCarryforward(50_000, 1_000, 0, LIMIT)
    expect(r.usedAgainstOrdinary).toBe(3_000)
    expect(r.netCapitalGain).toBe(-3_000)
    expect(r.ordinaryAfter).toBe(1_000)
    expect(r.remaining).toBe(47_000)
  })

  it('depletes over multiple years until exhausted', () => {
    let pool = 8_000
    const used: number[] = []
    for (let y = 0; y < 4; y++) {
      const r = applyCapitalLossCarryforward(pool, 40_000, 0, LIMIT)
      used.push(r.usedAgainstOrdinary)
      pool = r.remaining
    }
    expect(used).toEqual([3_000, 3_000, 2_000, 0]) // $8k drains in 3 years
    expect(pool).toBe(0)
  })

  it('is a no-op when the pool is zero', () => {
    const r = applyCapitalLossCarryforward(0, 40_000, 10_000, LIMIT)
    expect(r.ordinaryAfter).toBe(40_000)
    expect(r.netCapitalGain).toBe(10_000)
    expect(r.remaining).toBe(0)
  })

  it.each([
    {
      carryforward: 0,
      ordinaryIncome: 50_000,
      current: -20_000,
      limit: LIMIT,
      netCapitalGain: -3_000,
      remaining: 17_000,
      usedAgainstGains: 0,
      usedAgainstOrdinary: 3_000,
    },
    {
      carryforward: 5_000,
      ordinaryIncome: 50_000,
      current: -10_000,
      limit: LIMIT,
      netCapitalGain: -3_000,
      remaining: 12_000,
      usedAgainstGains: 0,
      usedAgainstOrdinary: 3_000,
    },
    {
      carryforward: 10_000,
      ordinaryIncome: 50_000,
      current: 8_000,
      limit: LIMIT,
      netCapitalGain: -2_000,
      remaining: 0,
      usedAgainstGains: 8_000,
      usedAgainstOrdinary: 2_000,
    },
    {
      carryforward: 10_000,
      ordinaryIncome: 50_000,
      current: 15_000,
      limit: LIMIT,
      netCapitalGain: 5_000,
      remaining: 0,
      usedAgainstGains: 10_000,
      usedAgainstOrdinary: 0,
    },
    {
      carryforward: 0,
      ordinaryIncome: 50_000,
      current: -2_000,
      limit: LIMIT,
      netCapitalGain: -2_000,
      remaining: 0,
      usedAgainstGains: 0,
      usedAgainstOrdinary: 2_000,
    },
    {
      carryforward: 0,
      ordinaryIncome: 50_000,
      current: -20_000,
      limit: 0,
      netCapitalGain: 0,
      remaining: 20_000,
      usedAgainstGains: 0,
      usedAgainstOrdinary: 0,
    },
    {
      carryforward: 0,
      ordinaryIncome: 0,
      current: -20_000,
      limit: LIMIT,
      netCapitalGain: -3_000,
      remaining: 17_000,
      usedAgainstGains: 0,
      usedAgainstOrdinary: 3_000,
    },
  ])('nets signed current capital result %#', (expected) => {
    const result = applyCapitalLossCarryforward(
      expected.carryforward,
      expected.ordinaryIncome,
      expected.current,
      expected.limit,
    )

    expect(result).toEqual({
      ordinaryAfter: Math.max(0, expected.ordinaryIncome),
      netCapitalGain: expected.netCapitalGain,
      usedAgainstGains: expected.usedAgainstGains,
      usedAgainstOrdinary: expected.usedAgainstOrdinary,
      remaining: expected.remaining,
    })
  })

  it('reduces taxable Social Security even with little other income (bot-flagged case)', () => {
    // $60k SS, $1k other income, $3k net loss from the carryforward and no gains:
    // the loss lowers provisional income, so less SS is taxable and MAGI drops.
    const loss = applyCapitalLossCarryforward(50_000, 1_000, 0, LIMIT)
    const base = computeFederalTax(input({ ordinaryIncome: 1_000, ssBenefits: 60_000 }))
    const withLoss = computeFederalTax(
      input({ ordinaryIncome: loss.ordinaryAfter, capitalGains: loss.netCapitalGain, ssBenefits: 60_000 }),
    )
    expect(base.taxableSocialSecurity).toBeCloseTo(3_000, 0)
    expect(withLoss.taxableSocialSecurity).toBeCloseTo(1_500, 0) // $3k loss → $1.5k less taxable SS
    expect(withLoss.magi).toBeLessThan(base.magi)
  })

  it('floors AGI/MAGI at zero when a net capital loss exceeds other income', () => {
    const d = computeFederalTax(input({ ordinaryIncome: 1_000, capitalGains: -3_000 }))
    expect(d.agi).toBe(0)
    expect(d.taxableIncome).toBe(0)
    expect(d.totalTax).toBe(0)
  })
})
