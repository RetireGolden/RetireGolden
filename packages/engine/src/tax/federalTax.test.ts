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

describe('modified adjusted gross income', () => {
  // IRC 1411(d) defines modified AGI for the net investment income tax as AGI
  // increased by the section 911(a)(1) exclusion, and 151(d)(5)(C)(iii)(II)
  // defines it for the senior deduction phase-out as AGI increased by amounts
  // excluded under sections 911, 931, or 933. Reading modified AGI as the AGI
  // line drops income the household really has, and it moves both numbers in
  // the taxpayer's favour at once -- less tax and more deduction.
  //
  // Single, 65+, 100,000 of AGI of which 60,000 is taxable interest, plus
  // 120,000 of excluded foreign earned income, so modified AGI is 220,000.
  //   modified AGI: NIIT on min(60,000, 220,000 - 200,000) = 20,000 -> 760;
  //                 senior 6,000 - 6% x 145,000 -> 0
  //   AGI alone:    NIIT 0, since 100,000 never reaches the 200,000 threshold;
  //                 senior 6,000 - 6% x 25,000 = 4,500
  describeRule('irc-1411-d-modified-agi-foreign-exclusion-addback', {
    readings: {
      agiPlusTheExclusion: { niit: 760, seniorDeduction: 0 },
      agiAlone: { niit: 0, seniorDeduction: 4_500 },
    },
    accepted: 'agiPlusTheExclusion',
  }, ({ accepted, readings }) => {
    it('counts excluded foreign earned income against both limits', () => {
      const d = computeFederalTax(input({
        ordinaryIncome: 100_000,
        taxableInterestIncome: 60_000,
        peopleAged65Plus: 1,
        foreignExclusionAddback: 120_000,
      }))

      // The exclusion never enters AGI; it is added back only for these limits.
      expect(d.agi).toBeCloseTo(100_000, 6)
      expect(d.magi).toBeCloseTo(220_000, 6)

      expect(d.niit).toBeCloseTo(accepted.niit, 6)
      expect(d.niit).not.toBeCloseTo(readings.agiAlone.niit, 6)
      expect(d.seniorDeduction).toBeCloseTo(accepted.seniorDeduction, 6)
      expect(d.seniorDeduction).not.toBeCloseTo(readings.agiAlone.seniorDeduction, 6)
    })

    it('leaves a return with no excluded foreign income at its AGI', () => {
      const d = computeFederalTax(input({ ordinaryIncome: 100_000, peopleAged65Plus: 1 }))

      expect(d.magi).toBe(d.agi)
      expect(d.seniorDeduction).toBeCloseTo(readings.agiAlone.seniorDeduction, 6)
    })
  })

  // IRC 1411(c)(1)(A)(i) reaches gross income from interest, and section 103
  // interest never enters gross income, so tax-exempt interest is not net
  // investment income; 1411(d) adds back only the section 911 exclusion, so it
  // does not lift the threshold leg either. Both misreadings are natural
  // because sections 86 and 36B DO add tax-exempt interest back, and each one
  // produces a different wrong tax here.
  //
  // Single, 190,000 of ordinary income of which 10,000 is taxable interest,
  // plus 50,000 of tax-exempt interest and no Social Security:
  //   outside both legs: MAGI 190,000 stays under the 200,000 threshold -> 0
  //   in the MAGI leg:   min(10,000, 240,000 - 200,000) = 10,000       -> 380
  //   in both legs:      min(60,000, 240,000 - 200,000) = 40,000     -> 1,520
  describeRule('irc-1411-tax-exempt-interest-outside-both-niit-legs', {
    readings: { outsideBothLegs: 0, inTheMagiLegOnly: 380, inBothLegs: 1_520 },
    accepted: 'outsideBothLegs',
  }, ({ accepted, readings }) => {
    it('keeps tax-exempt interest out of investment income and out of the threshold leg', () => {
      const d = computeFederalTax(input({
        ordinaryIncome: 190_000,
        taxableInterestIncome: 10_000,
        taxExemptInterest: 50_000,
      }))

      // Section 103(a): the amount never reaches AGI or taxable income either.
      expect(d.agi).toBeCloseTo(190_000, 6)
      expect(d.magi).toBeCloseTo(190_000, 6)
      expect(d.taxableIncome).toBeCloseTo(173_900, 6)

      expect(d.niit).toBeCloseTo(accepted, 6)
      expect(d.niit).not.toBeCloseTo(readings.inTheMagiLegOnly, 6)
      expect(d.niit).not.toBeCloseTo(readings.inBothLegs, 6)
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
        // peopleAged65Plus is pinned rather than left to the helper's
        // default: the senior deduction rides on top of whichever base is
        // larger, so a nonzero value would land in BOTH figures and pull the
        // ratio off two while the pack relationship was still intact. The
        // assertion still goes through computeFederalTax on purpose -- see
        // the note below.
        const single = computeFederalTax(input({
          year, ordinaryIncome: 100_000, peopleAged65Plus: 0,
        }))
        const joint = computeFederalTax(input({
          year, filingStatus: 'marriedFilingJointly', ordinaryIncome: 100_000,
          peopleAged65Plus: 0,
        }))

        // Read off the computed deduction, not pack.federalTax.standardDeduction.
        // Asserting on the pack constants would prove only that two numbers in
        // a data file sit at 2:1, and would stay green if federalTax.ts stopped
        // sourcing the joint amount from the pack at all -- a silent pass for
        // the failure that would actually reach a user. Going through the
        // engine costs a loud, labelled red if an unrelated deduction ever
        // contaminates the ratio, which is the cheaper of the two mistakes.
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

describe('SALT high-MAGI phasedown approximation (2026)', () => {
  // Observed produced pin (fixture run 2026-08-26; reconfirmed with AGI-above-
  // threshold inputs): year2026's $40,400 pack value × 1.01^(2026 - 2026) =
  // $40,400, and the itemized path adds $30,000 of mortgage interest, producing
  // $70,400 exactly as derived. The engine ignores both MAGI and AGI phasedown.
  const producedEngineItemizedTotal = 70_400

  // Single filer, 2026: AGI $605,000 + $100,000 of section 911/931/933 excluded
  // income = $705,000 MAGI. MAGI excess over $505,000 is $200,000 → $60,000
  // reduction → $10,000 statutory floor. With $30,000 mortgage interest:
  //   statute (MAGI):              $10,000 SALT + $30,000 interest = $40,000
  //   wrong AGI-based phasedown:   AGI excess $100,000 → $30,000 reduction →
  //                                $10,400 SALT + $30,000 interest = $40,400
  //   engine:                      $40,400 SALT + $30,000 interest = $70,400
  // AGI is below the $640,600 section 68 threshold, so no other itemized
  // limitation obscures the gap; both readings still itemize.
  describeRule('irc-164-b-7-B-magi-phasedown', {
    readings: {
      statuteAppliesTheTenThousandDollarFloor: 40_000,
      agiBasedPhasedownInsteadOfMagi: 40_400,
      statutoryThirtyPercentReduction: 55_400,
      engineKeepsTheFullScheduledSaltCap: producedEngineItemizedTotal,
    },
    accepted: 'statuteAppliesTheTenThousandDollarFloor',
    produced: 'engineKeepsTheFullScheduledSaltCap',
    note: '2026 MAGI $705,000 reaches the $10,000 SALT floor; mid-phase locks 30%',
  }, ({ accepted, produced, readings }) => {
    const statutorySaltCap = 10_000
    const mortgageInterest = 30_000

    function highMagiItemizer(stateAndLocalTaxes: number) {
      return input({
        ordinaryIncome: 605_000,
        foreignExclusionAddback: 100_000,
        itemizedDeductions: { stateAndLocalTaxes, mortgageInterest, charitable: 0 },
      })
    }

    // Mid-phase: MAGI $555,000 → excess $50,000 → 30% × $50,000 = $15,000
    // reduction → cap $25,400 + $30,000 interest = $55,400.
    function midPhaseItemizer(stateAndLocalTaxes: number) {
      return input({
        ordinaryIncome: 555_000,
        foreignExclusionAddback: 0,
        itemizedDeductions: { stateAndLocalTaxes, mortgageInterest, charitable: 0 },
      })
    }

    it('keeps the full scheduled cap rather than applying the high-MAGI floor', () => {
      const result = computeFederalTax(highMagiItemizer(100_000))
      const pack = packForYear(2026).pack

      expect(result.agi).toBe(605_000)
      expect(result.magi).toBe(705_000)
      expect(result.section68Limitation).toBe(0)
      expect(result.itemized).toBe(true)
      expect(saltCapForYear(pack, result.year)).toBe(40_400)
      expect(result.deduction).toBe(produced)
      expect(result.deduction).not.toBe(accepted)
      // An AGI-based phasedown (excess $100,000 → reduction $30,000 → cap
      // $10,400 → itemized $40,400) is a different wrong figure from the
      // MAGI-based statutory floor; the engine matches neither.
      expect(result.deduction).not.toBe(readings.agiBasedPhasedownInsteadOfMagi)
    })

    it('keeps the full scheduled cap mid-phase rather than the 30% reduction', () => {
      const result = computeFederalTax(midPhaseItemizer(100_000))

      expect(result.agi).toBe(555_000)
      expect(result.magi).toBe(555_000)
      expect(result.section68Limitation).toBe(0)
      expect(result.itemized).toBe(true)
      expect(result.deduction).toBe(produced)
      expect(result.deduction).not.toBe(readings.statutoryThirtyPercentReduction)
    })

    it('understates tax compared with the itemized return using the statutory floor', () => {
      const engine = computeFederalTax(highMagiItemizer(100_000))
      const statutory = computeFederalTax(highMagiItemizer(statutorySaltCap))

      expect(statutory.deduction).toBe(accepted)
      expect(statutory.deduction).toBe(statutorySaltCap + mortgageInterest)
      expect(engine.alternativeMinimumTax).toBe(0)
      expect(statutory.alternativeMinimumTax).toBe(0)
      // errorDirection: 'understatesTax'.
      expect(engine.totalTax).toBeLessThan(statutory.totalTax)
    })
  })
})

describe('qualified mortgage-insurance premium approximation (2026)', () => {
  // Mirrors irc-213-a-medical-expense-deduction: statute treats a hypothesized
  // premium as qualified residence interest → higher itemized total; the engine
  // has no PMI input → produced total without it.
  //
  // Single filer, AGI $80,000 (below the $100,000 phaseout), $30,000 SALT (under
  // the $40,400 2026 cap), $20,000 mortgage interest, $5,000 qualifying PMI:
  //   statute: $30,000 + $20,000 + $5,000 = $55,000
  //   engine:  $30,000 + $20,000           = $50,000
  // Observed produced pin: $50,000.
  const producedEngineItemizedTotal = 50_000

  describeRule('irc-163-h-3-E-i-pmi-qualified-residence-interest-restart', {
    readings: { statuteTreatsPremiumAsInterest: 55_000, engineOmitsPmiEntirely: producedEngineItemizedTotal },
    accepted: 'statuteTreatsPremiumAsInterest',
    produced: 'engineOmitsPmiEntirely',
    note: 'qualifying PMI omitted from itemized total for a household already itemizing',
  }, ({ accepted, produced }) => {
    const pmiPremiums = 5_000
    const grossIncome = 80_000
    const otherItemized = { stateAndLocalTaxes: 30_000, mortgageInterest: 20_000, charitable: 0 }
    const asMortgageInterest = (
      items: { stateAndLocalTaxes: number, mortgageInterest: number, charitable: number },
      premium: number,
    ) => ({ ...items, mortgageInterest: items.mortgageInterest + premium })
    const withExtraFacts = (
      items: typeof otherItemized,
      facts: Readonly<Record<string, number>>,
    ) => ({ ...items, ...facts }) as typeof otherItemized

    it('omits qualifying PMI from the itemized total', () => {
      const detail = computeFederalTax(input({
        ordinaryIncome: grossIncome,
        itemizedDeductions: otherItemized,
      }))

      expect(detail.agi).toBe(grossIncome)
      expect(detail.itemized).toBe(true)
      expect(detail.section68Limitation).toBe(0)
      expect(detail.deduction).toBe(produced)
      expect(detail.deduction).not.toBe(accepted)
    })

    it('ignores PMI however it is supplied under plausible field names', () => {
      const supplied = computeFederalTax(input({
        ordinaryIncome: grossIncome,
        itemizedDeductions: withExtraFacts(otherItemized, {
          mortgageInsurancePremiums: pmiPremiums,
          qualifiedMortgageInsurancePremiums: pmiPremiums,
          pmi: pmiPremiums,
          privateMortgageInsurance: pmiPremiums,
        }),
      }))

      expect(supplied.deduction).toBe(produced)
    })

    it('reaches the statutory deduction only when the premium is smuggled in as mortgage interest', () => {
      const statutory = computeFederalTax(input({
        ordinaryIncome: grossIncome,
        itemizedDeductions: asMortgageInterest(otherItemized, pmiPremiums),
      }))

      expect(statutory.deduction).toBe(accepted)
      expect(accepted - produced).toBe(pmiPremiums)
    })

    it('overstates tax, by the deduction it cannot see at the marginal rate', () => {
      const engine = computeFederalTax(input({
        ordinaryIncome: grossIncome,
        itemizedDeductions: otherItemized,
      }))
      const statutory = computeFederalTax(input({
        ordinaryIncome: grossIncome,
        itemizedDeductions: asMortgageInterest(otherItemized, pmiPremiums),
      }))

      expect(engine.alternativeMinimumTax).toBe(0)
      expect(statutory.alternativeMinimumTax).toBe(0)
      // errorDirection: 'overstatesTax'.
      expect(engine.totalTax).toBeGreaterThan(statutory.totalTax)
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

  // IRC 151(d)(5)(C)(iii)(I) reduces "the $6,000 amount in clause (i)", and
  // clause (i) allows that amount "for each qualified individual". The
  // reduction therefore runs on the per-individual amount and is taken once per
  // qualified individual. Applying it to the return's combined base instead is
  // the natural misreading, and it leaves a joint return with two spouses 65+
  // still carrying a deduction all the way to 350,000 of modified AGI.
  //
  // MFJ, both 65+, 200,000 of modified AGI:
  //   per qualified individual: (6,000 - 6% x 50,000) x 2 = 3,000 x 2 = 6,000
  //   combined base:            2 x 6,000 - 6% x 50,000   = 12,000 - 3,000 = 9,000
  describeRule('irc-151-d-5-C-iii-I-senior-deduction-per-individual-phase-out', {
    readings: { reducedPerQualifiedIndividual: 6_000, reducedOnTheCombinedBase: 9_000 },
    accepted: 'reducedPerQualifiedIndividual',
    note: 'the exact ledger amount',
  }, ({ accepted, readings }) => {
    it('reduces each qualified individual amount, not the combined total', () => {
      const d = computeFederalTax(
        input({ filingStatus: 'marriedFilingJointly', ordinaryIncome: 200_000, peopleAged65Plus: 2 }),
      )

      expect(d.magi).toBe(200_000)
      expect(d.seniorDeduction).toBeCloseTo(accepted, 6)
      expect(d.seniorDeduction).not.toBeCloseTo(readings.reducedOnTheCombinedBase, 6)
    })

    it('exhausts two shares at the same modified AGI as one share', () => {
      // 6% x (250,000 - 150,000) = 6,000 zeroes the clause (i) amount itself,
      // so neither spouse has anything left to claim. The combined-base reading
      // would still allow 12,000 - 6,000 = 6,000 to the couple here, and would
      // not run out until 350,000.
      const couple = computeFederalTax(
        input({ filingStatus: 'marriedFilingJointly', ordinaryIncome: 250_000, peopleAged65Plus: 2 }),
      )
      const single = computeFederalTax(
        input({ filingStatus: 'marriedFilingJointly', ordinaryIncome: 250_000, peopleAged65Plus: 1 }),
      )

      expect(couple.seniorDeduction).toBe(0)
      expect(single.seniorDeduction).toBe(0)
      expect(couple.seniorDeduction).not.toBeCloseTo(readings.reducedPerQualifiedIndividual, 6)
    })
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
    // AGI 100,000, so 170(b)(1)(I) disallows the first 0.5% = 500 of the gift:
    // 5,000 - 500 = 4,500 allowed. SALT 8,000 is under the 40,400 cap.
    //   itemized before 68:  8,000 + 12,000 + 4,500 = 24,500
    //   68(a)(2) base:       100,000 - 0 senior - 640,600 (37% start) < 0 -> 0
    //   68 reduction:        2/37 x min(24,500, 0) = 0
    // 24,500 > 16,100 standard, so the election goes to itemizing.
    expect(d.itemized).toBe(true)
    expect(d.section68Limitation).toBe(0)
    expect(d.deduction).toBe(24_500)
    expect(d.taxableIncome).toBe(75_500)
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
  // IRC 56(b)(1)(D) disallows the section 63(c) standard deduction, the
  // deduction for personal exemptions under section 151, and the section 642(b)
  // deduction. The senior deduction is allowed by section 151(d)(5)(C), so the
  // election to itemize -- which governs only the section 63(c) amount -- does
  // not carry it into AMTI. Adding it back only on the standard-deduction
  // branch is the natural misreading: that branch is accidentally right because
  // the total deduction already contains the senior amount.
  //
  // MFJ, both 65+, 140,000 ordinary, itemizing 30,000 SALT + 20,000 mortgage.
  // Modified AGI is under the 150,000 phase-out start, so the senior deduction
  // is the full 12,000 and this fixture does not also turn on the phase-out.
  //   taxable income:        140,000 - (50,000 + 12,000) = 78,000
  //   senior disallowed:     78,000 + 30,000 SALT + 12,000 = 120,000
  //   senior left in AMTI:   78,000 + 30,000 SALT          = 108,000
  describeRule('irc-56-b-1-D-section-151-deduction-disallowed-for-amt', {
    readings: { addedBackOnBothBranches: 120_000, survivesTheItemizedBranch: 108_000 },
    accepted: 'addedBackOnBothBranches',
  }, ({ accepted, readings }) => {
    it('adds the senior deduction back on a return that itemizes', () => {
      const d = computeFederalTax(input({
        filingStatus: 'marriedFilingJointly',
        ordinaryIncome: 140_000,
        peopleAged65Plus: 2,
        itemizedDeductions: { stateAndLocalTaxes: 30_000, mortgageInterest: 20_000, charitable: 0 },
      }))

      expect(d.itemized).toBe(true)
      expect(d.seniorDeduction).toBe(12_000)
      expect(d.taxableIncome).toBe(78_000)
      expect(d.alternativeMinimumTaxableIncome).toBeCloseTo(accepted, 6)
      expect(d.alternativeMinimumTaxableIncome)
        .not.toBeCloseTo(readings.survivesTheItemizedBranch, 6)
    })

    it('adds it back on a return that takes the standard deduction too', () => {
      // Both 63(c) and 151 are disallowed, so nothing on line 14 of the return
      // survives into AMTI and the result is AGI itself.
      const d = computeFederalTax(input({
        filingStatus: 'marriedFilingJointly',
        ordinaryIncome: 140_000,
        peopleAged65Plus: 2,
      }))

      expect(d.itemized).toBe(false)
      expect(d.deduction).toBe(35_500 + 12_000)
      expect(d.alternativeMinimumTaxableIncome).toBeCloseTo(140_000, 6)
    })
  })

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

/**
 * Registered rules covering the rate schedules, the deduction stack, the AMT
 * add-backs, and the NIIT carve-out for plan distributions. Every expected
 * figure below was derived from the statute and the 2026 revenue procedure
 * before the engine was consulted; the rejected readings name the misreading
 * each fixture exists to exclude.
 */
describe('registered rules: rate schedules, deductions, AMT, NIIT', () => {
  // IRC 1(j)(2) is a bracket table, so each rate reaches only the slice of
  // taxable income inside its own bracket. Applying the top applicable rate to
  // the whole amount is the natural misreading and overstates tax by two
  // thirds here.
  //
  // Single, 76,100 ordinary less the 16,100 standard deduction = 60,000.
  //   12,400 x 10% = 1,240; 38,000 x 12% = 4,560; 9,600 x 22% = 2,112 -> 7,912
  //   which is also the revenue procedure shortcut 5,800 + 22% over 50,400.
  //   Top rate on the whole amount: 60,000 x 22% = 13,200.
  describeRule('irc-1-j-2-progressive-ordinary-rate-schedule', {
    readings: { eachSliceAtItsOwnRate: 7_912, topRateOnTheWholeAmount: 13_200 },
    accepted: 'eachSliceAtItsOwnRate',
  }, ({ accepted, readings }) => {
    it('taxes each bracket slice at its own rate', () => {
      const result = computeFederalTax(input({ ordinaryIncome: 76_100 }))

      expect(result.taxableIncome).toBe(60_000)
      expect(result.ordinaryTax).toBeCloseTo(accepted, 6)
      expect(result.ordinaryTax).not.toBeCloseTo(readings.topRateOnTheWholeAmount, 6)
    })
  })

  // IRC 1(h)(11)(A) folds qualified dividend income into net capital gain for
  // the preferential schedule, even though it is ordinary gross income that
  // enters AGI in full. Taxing it at ordinary rates is the natural misreading.
  //
  // Single, 46,100 ordinary plus 10,000 of qualified dividends: AGI 56,100,
  // taxable 40,000 after the standard deduction. The dividends stack above
  // 30,000 of ordinary taxable income and the whole stack sits below the
  // 49,450 maximum zero rate amount, so:
  //   preferential: ordinary tax on 30,000 only = 1,240 + 2,112 = 3,352
  //   as ordinary income: 40,000 through the table = 4,552
  describeRule('irc-1-h-11-qualified-dividends-as-net-capital-gain', {
    readings: { foldedIntoNetCapitalGain: 3_352, taxedAtOrdinaryRates: 4_552 },
    accepted: 'foldedIntoNetCapitalGain',
  }, ({ accepted, readings }) => {
    it('runs qualified dividends through the preferential stack', () => {
      const result = computeFederalTax(input({
        ordinaryIncome: 46_100,
        qualifiedDividends: 10_000,
      }))

      expect(result.agi).toBe(56_100) // in AGI in full, unlike a tax-exempt item
      expect(result.preferentialIncome).toBe(10_000)
      expect(result.capitalGainsTax).toBe(0)
      expect(result.ordinaryTax + result.capitalGainsTax).toBeCloseTo(accepted, 6)
      expect(result.ordinaryTax + result.capitalGainsTax)
        .not.toBeCloseTo(readings.taxedAtOrdinaryRates, 6)
    })
  })

  // IRC 86(b)(2)(B) increases modified AGI by tax-exempt interest, so a
  // municipal bond raises the taxable share of benefits without ever entering
  // AGI. Reading provisional income as AGI plus half the benefits is the
  // natural misreading and here it zeroes the inclusion outright.
  //
  // Single, 24,000 of benefits and 20,000 of tax-exempt interest:
  //   with the add-back: provisional 20,000 + 12,000 = 32,000, between the
  //     25,000 base and the 34,000 adjusted base, so 0.5 x 7,000 = 3,500
  //   without it: provisional 12,000, under the base amount, so nothing
  describeRule('irc-86-b-2-provisional-income-modified-agi', {
    readings: { taxExemptInterestAddedBack: 3_500, agiPlusHalfBenefitsOnly: 0 },
    accepted: 'taxExemptInterestAddedBack',
  }, ({ accepted, readings }) => {
    it('counts tax-exempt interest in provisional income', () => {
      const result = computeFederalTax(input({
        ssBenefits: 24_000,
        taxExemptInterest: 20_000,
      }))

      expect(result.taxableSocialSecurity).toBeCloseTo(accepted, 6)
      expect(result.taxableSocialSecurity).not.toBeCloseTo(readings.agiPlusHalfBenefitsOnly, 6)
      expect(result.agi).toBe(3_500) // the interest itself never enters AGI
    })
  })

  // IRC 63(e)(1) makes itemizing an election that displaces the standard
  // deduction, while 63(d)(2) puts the section 151 senior deduction outside
  // the definition of itemized deductions, so it is additive to whichever base
  // is used. Two misreadings are excluded: never modelling the election, and
  // giving the senior deduction only to non-itemizers.
  //
  // Single, one person 65 or over, 70,000 ordinary, 20,000 of state and local
  // taxes. Standard base 16,100 + 2,050 = 18,150; senior 6,000 because MAGI is
  // under the 75,000 phase-out start.
  //   elect and add on top: 20,000 + 6,000 = 26,000
  //   always standard:      18,150 + 6,000 = 24,150
  //   senior denied to an itemizer: 20,000
  describeRule('irc-63-b-e-itemize-election-and-section-151-additivity', {
    readings: {
      itemizedPlusSeniorDeduction: 26_000,
      alwaysStandard: 24_150,
      seniorDeductionForNonItemizersOnly: 20_000,
    },
    accepted: 'itemizedPlusSeniorDeduction',
  }, ({ accepted, readings }) => {
    it('itemizes when larger and adds the senior deduction on top', () => {
      const result = computeFederalTax(input({
        ordinaryIncome: 70_000,
        peopleAged65Plus: 1,
        itemizedDeductions: { stateAndLocalTaxes: 20_000, mortgageInterest: 0, charitable: 0 },
      }))

      expect(result.itemized).toBe(true)
      expect(result.deduction).toBeCloseTo(accepted, 6)
      expect(result.deduction).not.toBeCloseTo(readings.alwaysStandard, 6)
      expect(result.deduction).not.toBeCloseTo(readings.seniorDeductionForNonItemizersOnly, 6)
    })
  })

  // IRC 67(h) disallows every miscellaneous itemized deduction permanently, so
  // the absence of any advisory or tax-preparation input is the right answer
  // rather than a gap. The pre-2018 67(a) two percent floor is the misreading,
  // and it would let 5,000 of advisory fees through less a 2,000 floor.
  //
  // Single, 100,000 ordinary, 20,000 of state and local taxes.
  describeRule('irc-67-h-miscellaneous-itemized-permanently-disallowed', {
    readings: { permanentlyDisallowed: 20_000, twoPercentFloorStillApplies: 23_000 },
    accepted: 'permanentlyDisallowed',
  }, ({ accepted, readings }) => {
    it('offers no channel by which a miscellaneous itemized deduction is allowed', () => {
      const result = computeFederalTax(input({
        ordinaryIncome: 100_000,
        itemizedDeductions: { stateAndLocalTaxes: 20_000, mortgageInterest: 0, charitable: 0 },
      }))

      expect(result.itemized).toBe(true)
      expect(result.deduction).toBeCloseTo(accepted, 6)
      expect(result.deduction).not.toBeCloseTo(readings.twoPercentFloorStillApplies, 6)
    })
  })

  // IRC 56(b)(1)(A)(ii) disallows the taxes described in 164(a)(1)-(3) for AMT
  // purposes and reaches nothing else, so an itemizer adds back the state and
  // local component alone. Adding back nothing, and adding back the whole
  // itemized total, are the two misreadings on either side of it.
  //
  // Single, 300,000 ordinary, 60,000 of state and local taxes capped at 40,400,
  // 10,000 charitable. 170(b)(1)(I) disallows 0.5% of the 300,000 contribution
  // base, so 10,000 - 1,500 = 8,500 of the gift is allowed; 68 does not reach a
  // 300,000 AGI at all, since the 37% bracket starts at 640,600. Itemized total
  // 40,400 + 8,500 = 48,900, taxable income 300,000 - 48,900 = 251,100.
  //   capped SALT only:      251,100 + 40,400 = 291,500
  //   no add-back:           251,100
  //   whole itemized total:  251,100 + 48,900 = 300,000
  describeRule('irc-56-b-1-A-ii-state-and-local-taxes-disallowed-for-amt', {
    readings: {
      cappedStateAndLocalTaxesOnly: 291_500,
      noAddBack: 251_100,
      wholeItemizedTotal: 300_000,
    },
    accepted: 'cappedStateAndLocalTaxesOnly',
  }, ({ accepted, readings }) => {
    it('adds back capped state and local taxes but leaves charitable gifts alone', () => {
      const result = computeFederalTax(input({
        ordinaryIncome: 300_000,
        itemizedDeductions: { stateAndLocalTaxes: 60_000, mortgageInterest: 0, charitable: 10_000 },
      }))

      expect(result.taxableIncome).toBe(251_100)
      expect(result.alternativeMinimumTaxableIncome).toBeCloseTo(accepted, 6)
      expect(result.alternativeMinimumTaxableIncome).not.toBeCloseTo(readings.noAddBack, 6)
      expect(result.alternativeMinimumTaxableIncome).not.toBeCloseTo(readings.wholeItemizedTotal, 6)
    })
  })

  // IRC 55(b)(3) caps the tentative minimum tax by carving net capital gain out
  // of the taxable excess and taxing it at the section 1(h) rates, so long-term
  // gain is never reached by the 26 and 28 percent layers. Omitting the cap is
  // the natural misreading and it invents a large minimum tax on a gain year.
  //
  // Single, 300,000 ordinary and 400,000 of gain: AGI 700,000, taxable 683,900,
  // the 16,100 standard deduction added back, so AMTI is 700,000. That is
  // 200,000 past the 500,000 phase-out start, so the 90,100 exemption is gone
  // at 50 cents per dollar and the taxable excess is the whole 700,000.
  //   with the cap: 26%/28% on the 300,000 ordinary remainder = 79,110, plus
  //     the gain stacked above it: (545,500 - 300,000) x 15% = 36,825 and
  //     (700,000 - 545,500) x 20% = 30,900 -> 146,835
  //   without it: 244,500 x 26% + 455,500 x 28% = 191,110
  describeRule('irc-55-b-3-amt-net-capital-gain-maximum-rate', {
    readings: { preferentialRatesSurviveIntoTheAmt: 146_835, gainAtAmtOrdinaryRates: 191_110 },
    accepted: 'preferentialRatesSurviveIntoTheAmt',
  }, ({ accepted, readings }) => {
    it('caps the tentative minimum tax on capital gain at the preferential rates', () => {
      const result = computeFederalTax(input({
        ordinaryIncome: 300_000,
        capitalGains: 400_000,
      }))

      expect(result.alternativeMinimumTaxableIncome).toBeCloseTo(700_000, 6)
      expect(result.amtExemption).toBe(0) // fully phased out, so the excess is all of AMTI
      expect(result.tentativeMinimumTax).toBeCloseTo(accepted, 6)
      expect(result.tentativeMinimumTax).not.toBeCloseTo(readings.gainAtAmtOrdinaryRates, 6)
    })
  })

  // IRC 1411(c)(5) keeps a distribution from a 401(a), 403, 408, 408A or
  // 457(b) plan out of net investment income entirely, while 1411(a)(1)(B)
  // still counts it in modified AGI. Treating the distribution as investment
  // income is the natural misreading and it more than triples the tax here.
  //
  // Single, 270,000 of ordinary income of which 20,000 is taxable interest and
  // the rest an IRA distribution, against the 200,000 threshold.
  //   excluded: net investment income is the 20,000 of interest -> 760
  //   included: the lesser leg becomes the 70,000 MAGI excess -> 2,660
  describeRule('irc-1411-c-5-plan-distributions-excluded-from-nii', {
    readings: { distributionIsNotInvestmentIncome: 760, distributionIsInvestmentIncome: 2_660 },
    accepted: 'distributionIsNotInvestmentIncome',
  }, ({ accepted, readings }) => {
    it('leaves plan distributions out of net investment income but not out of modified AGI', () => {
      const result = computeFederalTax(input({
        ordinaryIncome: 270_000,
        taxableInterestIncome: 20_000,
      }))

      expect(result.magi).toBe(270_000) // the distribution still lifts the MAGI leg
      expect(result.niit).toBeCloseTo(accepted, 6)
      expect(result.niit).not.toBeCloseTo(readings.distributionIsInvestmentIncome, 6)
    })
  })

  // IRC 57(a)(5)(A) adds interest on specified private activity bonds to AMTI.
  // The plan model carries tax-exempt interest as one annual amount with no
  // issue-level detail, so the engine treats all of it as non-preference and
  // adds none of it back — disclosed in the registry, pinned here so the day a
  // PAB path lands this fixture fails and the record gets reclassified.
  //
  // Single, 300,000 of ordinary income and 100,000 of tax-exempt interest that
  // is stipulated to be entirely specified-PAB interest, no Social Security.
  // Taxable income 283,900 plus the 16,100 standard-deduction add-back:
  //   treated as non-preference (engine): AMTI 300,000
  //   specified-PAB interest added back:  AMTI 400,000
  describeRule('irc-57-a-5-private-activity-bond-interest-amt-preference', {
    readings: { treatedAsNonPreference: 300_000, specifiedPabInterestAddedBack: 400_000 },
    accepted: 'specifiedPabInterestAddedBack',
    produced: 'treatedAsNonPreference',
  }, ({ accepted, produced }) => {
    it('adds no tax-exempt interest to AMTI, even when it is all PAB interest', () => {
      const result = computeFederalTax(input({
        ordinaryIncome: 300_000,
        taxExemptInterest: 100_000,
      }))

      expect(result.taxableIncome).toBe(283_900)
      expect(result.alternativeMinimumTaxableIncome).toBeCloseTo(produced, 6)
      expect(result.alternativeMinimumTaxableIncome).not.toBeCloseTo(accepted, 6)
    })
  })
})

// The projection runs in nominal dollars, so a 2046 wage arrives inflated. The
// federal figures it is measured against are re-prescribed every year by
// statute, and a stand-in pack carries only the pack year's values -- so the
// caller supplies the cumulative inflation factor and the indexed figures are
// carried forward with it. `inflationScale: 2` stands for a doubling of the
// price level, which makes every expected value below hand-checkable against
// the 2026 pack.
describe('indexed federal figures in a stand-in year', () => {
  const PROJECTED_YEAR = 2046
  const DOUBLED = 2

  // 2026 single brackets: 10% to 12,400; 12% to 50,400; 22% to 105,700; 24% to
  // 201,775. Standard deduction 16,100. At a doubled price level the statute
  // gives 24,800 / 100,800 / 211,400 and a 32,200 deduction.
  //
  // 132,200 of wages, single, nobody 65+:
  //   indexed        taxable 100,000 -> 10%x24,800 + 12%x75,200        = 11,504
  //   nothing moves  taxable 116,100 -> 1,240 + 4,560 + 12,166 + 2,496 = 20,462
  //   brackets only  taxable 116,100 -> 2,480 + 9,120 + 3,366          = 14,966
  // The third reading is the one worth naming: indexing the tables while
  // leaving the deduction behind is the half-fix, and it still overstates.
  describeRule('irc-1-j-3-B-rate-tables-adjusted-each-year', {
    readings: { statute: 11_504, frozenAtThePackYear: 20_462, tablesOnlyDeductionFrozen: 14_966 },
    accepted: 'statute',
  }, ({ accepted, readings }) => {
    it('prices nominal wages on the rate tables prescribed for that year', () => {
      const d = computeFederalTax(input({
        year: PROJECTED_YEAR,
        ordinaryIncome: 132_200,
        inflationScale: DOUBLED,
      }))

      expect(d.usesStandInPack).toBe(true)
      expect(d.deduction).toBeCloseTo(32_200, 6)
      expect(d.taxableIncome).toBeCloseTo(100_000, 6)
      expect(d.ordinaryTax).toBeCloseTo(accepted, 6)
      expect(d.ordinaryTax).not.toBeCloseTo(readings.frozenAtThePackYear, 6)
      expect(d.ordinaryTax).not.toBeCloseTo(readings.tablesOnlyDeductionFrozen, 6)
    })

    it('leaves a published year exactly as published', () => {
      // The default scale is 1, and 2026 has its own pack: the same 132,200 of
      // wages must still produce the frozen-reading figure, because for 2026
      // that reading IS the statute.
      const d = computeFederalTax(input({ year: 2026, ordinaryIncome: 132_200 }))
      expect(d.usesStandInPack).toBe(false)
      expect(d.ordinaryTax).toBeCloseTo(readings.frozenAtThePackYear, 6)
    })
  })

  // IRC 1(j)(5)(C) indexes the maximum zero-rate and maximum 15-percent amounts
  // on the same footing as the rate tables. 32,200 of wages (exactly the
  // indexed deduction) plus 150,000 of long-term gain, single:
  //   indexed        0% to 98,900, then 15% on 51,100              = 7,665.00
  //   breakpoint     0% to 49,450, then 15% on 100,550             = 15,082.50
  //     frozen (deduction still indexed)
  //   nothing moves  16,100 deduction -> 1,684 ordinary + 17,497.50 = 19,181.50
  describeRule('irc-1-h-capital-gain-stacked-on-ordinary', {
    readings: { statute: 7_665, breakpointFrozen: 15_082.5, nothingIndexed: 19_181.5 },
    accepted: 'statute',
  }, ({ accepted, readings }) => {
    it('starts the 15% layer at the breakpoint prescribed for that year', () => {
      const d = computeFederalTax(input({
        year: PROJECTED_YEAR,
        ordinaryIncome: 32_200,
        capitalGains: 150_000,
        inflationScale: DOUBLED,
      }))

      expect(d.ordinaryTaxable).toBeCloseTo(0, 6)
      expect(d.totalTax).toBeCloseTo(accepted, 6)
      expect(d.totalTax).not.toBeCloseTo(readings.breakpointFrozen, 6)
      expect(d.totalTax).not.toBeCloseTo(readings.nothingIndexed, 6)
    })
  })

  // IRC 55(d)(4)(B) indexes the exemption AND the phase-out threshold; the
  // 1,000,000 dollar threshold starts moving in 2027, which is the first
  // projected year. 632,200 of wages, single -> AMTI 632,200 under every
  // reading, so the three answers differ only in which AMT figures moved.
  it('projects the AMT exemption and its phase-out threshold together', () => {
    const d = computeFederalTax(input({
      year: PROJECTED_YEAR,
      ordinaryIncome: 632_200,
      inflationScale: DOUBLED,
    }))

    expect(d.alternativeMinimumTaxableIncome).toBeCloseTo(632_200, 6)
    expect(d.amtExemption).toBeCloseTo(180_200, 6) // 90,100 x 2, below the 1,000,000 threshold
    expect(d.amtExemption).not.toBeCloseTo(114_100, 6) // exemption indexed, threshold left at 500,000
    expect(d.amtExemption).not.toBeCloseTo(24_000, 6) // neither indexed
  })

  // The mirror-image error. IRC 151(d)(4) indexes only the paragraph (1)
  // exemption amount and is expressly subordinate to paragraph (5), where the
  // senior deduction lives, so neither the 6,000 dollars nor the 75,000 dollar
  // threshold ever moves. 2028 (its last applicable year), single, one person
  // 65+, 100,000 of MAGI:
  //   statute        6,000 - 6% x 25,000  = 4,500
  //   both indexed   12,000, phase-out entirely escaped (threshold 150,000)
  //   amount only    12,000 - 6% x 25,000 = 10,500
  describeRule('irc-151-d-5-C-senior-deduction-not-indexed', {
    readings: { statute: 4_500, bothIndexed: 12_000, amountIndexedOnly: 10_500 },
    accepted: 'statute',
  }, ({ accepted, readings }) => {
    it('holds the amount and the phase-out threshold flat in a projected year', () => {
      const d = computeFederalTax(input({
        year: 2028,
        ordinaryIncome: 100_000,
        peopleAged65Plus: 1,
        inflationScale: DOUBLED,
      }))

      expect(d.seniorDeduction).toBeCloseTo(accepted, 6)
      expect(d.seniorDeduction).not.toBeCloseTo(readings.bothIndexed, 6)
      expect(d.seniorDeduction).not.toBeCloseTo(readings.amountIndexedOnly, 6)
      // The standard deduction beside it DID move: (16,100 + 2,050) doubled.
      expect(d.deduction).toBeCloseTo(36_300 + 4_500, 6)
    })
  })

  it('leaves the section 86 provisional-income thresholds where Congress left them', () => {
    // 20,000 of benefits and 30,000 of other income -> provisional 40,000,
    // above the 34,000 tier-two start. Scaling the tiers to 50,000/68,000 would
    // drop the taxable share to zero, which is the whole reason the engine says
    // more of a benefit becomes taxable as a plan runs on.
    const d = computeFederalTax(input({
      year: PROJECTED_YEAR,
      ordinaryIncome: 30_000,
      ssBenefits: 20_000,
      inflationScale: DOUBLED,
    }))

    expect(d.taxableSocialSecurity).toBeCloseTo(9_600, 6) // 0.85x6,000 + 4,500 tier-one carry
    expect(d.taxableSocialSecurity).not.toBeCloseTo(0, 6)
  })

  it('leaves the section 1411 NIIT thresholds where Congress left them', () => {
    // 300,000 of gain, single: 100,000 over the unindexed 200,000 threshold.
    // A doubled threshold would zero the NIIT line entirely.
    const d = computeFederalTax(input({
      year: PROJECTED_YEAR,
      capitalGains: 300_000,
      inflationScale: DOUBLED,
    }))

    expect(d.niit).toBeCloseTo(3_800, 6)
    expect(d.niit).not.toBeCloseTo(0, 6)
  })

  it('leaves the SALT cap on its statutory schedule rather than an index', () => {
    // 164(b)(7) reverts the cap to 10,000 for 2030 and after. That is a
    // schedule, not a cost-of-living adjustment: the inflation factor must not
    // reach it.
    const d = computeFederalTax(input({
      year: PROJECTED_YEAR,
      ordinaryIncome: 300_000,
      itemizedDeductions: { stateAndLocalTaxes: 50_000, mortgageInterest: 30_000, charitable: 0 },
      inflationScale: DOUBLED,
    }))

    expect(d.itemized).toBe(true)
    expect(d.deduction).toBeCloseTo(40_000, 6) // 10,000 capped SALT + 30,000 interest
  })

  // A plan may assume negative inflation, and the projection deflates its
  // income when it does. IRC 1(f)(3)(A) floors the adjustment at zero only
  // against the base year, so an indexed amount can fall below the prior year's
  // -- it just cannot fall below the printed statutory figure. Freezing the
  // thresholds while the income shrinks would be bracket creep run backwards.
  const HALVED = 0.5

  it('carries the indexed figures DOWN when the plan assumes deflation', () => {
    // At half the price level the 2026 single figures give a 8,050 deduction
    // and bands of 6,200 / 25,200. 33,250 of wages -> taxable 25,200:
    //   indexed       10%x6,200 + 12%x19,000  = 2,900
    //   frozen        16,100 deduction, taxable 17,150
    //                 -> 10%x12,400 + 12%x4,750 = 1,810 (under-taxed)
    const d = computeFederalTax(input({
      year: PROJECTED_YEAR,
      ordinaryIncome: 33_250,
      inflationScale: HALVED,
    }))

    expect(d.deduction).toBeCloseTo(8_050, 6)
    expect(d.taxableIncome).toBeCloseTo(25_200, 6)
    expect(d.ordinaryTax).toBeCloseTo(2_900, 6)
    expect(d.ordinaryTax).not.toBeCloseTo(1_810, 6)
  })

  it('does not drag the unindexed figures down with a deflating scale either', () => {
    // The section 1411 threshold is 200,000 single under every reading. Halving
    // it to 100,000 would double the NIIT line; the guard has to hold in both
    // directions, not just against a scale above 1.
    const d = computeFederalTax(input({
      year: PROJECTED_YEAR,
      capitalGains: 300_000,
      inflationScale: HALVED,
    }))

    expect(d.niit).toBeCloseTo(3_800, 6)
    expect(d.niit).not.toBeCloseTo(7_600, 6)
  })
})
