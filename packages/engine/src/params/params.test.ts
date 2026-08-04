import { describe, expect, it } from 'vitest'

import { describeRule } from '../rules/describeRule.js'
import { SGA_ANNUAL_MONTHS, ssdiSuspendedBySga } from '../socialSecurity/disability.js'

import {
  annuityExpectedReturnMultiple,
  EARLIEST_PACK_YEAR,
  irmaaTierForMagi,
  irmaaTierThreshold,
  LATEST_PACK_YEAR,
  packForYear,
  partBMonthlyPremium,
  rmdStartAgeForBirthYear,
  standardDeduction,
  uniformLifetimeDivisor,
} from './index.js'

describe('packForYear', () => {
  it('returns the exact pack for a published year', () => {
    const { pack, isStandIn } = packForYear(2026)
    expect(pack.year).toBe(2026)
    expect(isStandIn).toBe(false)
  })

  it('falls back to the latest pack for future years', () => {
    const { pack, isStandIn } = packForYear(LATEST_PACK_YEAR + 10)
    expect(pack.year).toBe(LATEST_PACK_YEAR)
    expect(isStandIn).toBe(true)
  })

  it('falls back to the earliest pack for past years', () => {
    const { pack, isStandIn } = packForYear(EARLIEST_PACK_YEAR - 5)
    expect(pack.year).toBe(EARLIEST_PACK_YEAR)
    expect(isStandIn).toBe(true)
  })
})

describe('2026 pack contents', () => {
  const pack = packForYear(2026).pack

  it('has seven ascending ordinary brackets per status', () => {
    for (const status of ['single', 'marriedFilingJointly'] as const) {
      const brackets = pack.federalTax.brackets[status]
      expect(brackets).toHaveLength(7)
      expect(brackets[0]).toEqual({ lowerBound: 0, ratePct: 10 })
      expect(brackets.at(-1)!.ratePct).toBe(37)
      for (let i = 1; i < brackets.length; i++) {
        expect(brackets[i]!.lowerBound).toBeGreaterThan(brackets[i - 1]!.lowerBound)
        expect(brackets[i]!.ratePct).toBeGreaterThan(brackets[i - 1]!.ratePct)
      }
    }
  })

  it('MFJ thresholds are double single through the 32% bracket', () => {
    const s = pack.federalTax.brackets.single
    const m = pack.federalTax.brackets.marriedFilingJointly
    for (let i = 1; i <= 4; i++) {
      expect(m[i]!.lowerBound).toBe(s[i]!.lowerBound * 2)
    }
  })

  it('IRMAA tiers ascend in both threshold and applicable percentage', () => {
    const tiers = pack.medicare.irmaaTiers
    expect(tiers).toHaveLength(5)
    for (let i = 1; i < tiers.length; i++) {
      expect(tiers[i]!.magiOver.single).toBeGreaterThan(tiers[i - 1]!.magiOver.single)
      expect(tiers[i]!.applicablePct).toBeGreaterThan(tiers[i - 1]!.applicablePct)
    }
    expect(tiers.map((t) => t.applicablePct)).toEqual([35, 50, 65, 80, 85])
  })

  it('uniform lifetime table is monotonically decreasing from 72 to 120', () => {
    for (let age = 73; age <= 120; age++) {
      const prev = uniformLifetimeDivisor(pack, age - 1)!
      const cur = uniformLifetimeDivisor(pack, age)!
      expect(cur).toBeLessThanOrEqual(prev)
    }
    expect(uniformLifetimeDivisor(pack, 73)).toBe(26.5)
    expect(uniformLifetimeDivisor(pack, 125)).toBe(2.0)
    expect(uniformLifetimeDivisor(pack, 71)).toBeUndefined()
  })

  it('annuity expected-return multiple matches Pub 939 Table V, interpolating and clamping', () => {
    expect(annuityExpectedReturnMultiple(pack, 65)).toBe(20.0)
    expect(annuityExpectedReturnMultiple(pack, 70)).toBe(16.0)
    // Half-way between 65 (20.0) and 66 (19.2) → 19.6.
    expect(annuityExpectedReturnMultiple(pack, 65.5)).toBeCloseTo(19.6, 5)
    // Clamp outside the table's [50, 95] range.
    expect(annuityExpectedReturnMultiple(pack, 40)).toBe(annuityExpectedReturnMultiple(pack, 50))
    expect(annuityExpectedReturnMultiple(pack, 110)).toBe(annuityExpectedReturnMultiple(pack, 95))
  })
})

describe('rmdStartAgeForBirthYear (SECURE 2.0)', () => {
  // IRC 401(a)(9)(C)(v) is written on attainment windows, not a rising
  // sequence. A 1960 birth attains 73 in 2033 -- outside the "73 before 2033"
  // window -- and 74 in 2034, which lands in the "attains 74 after 2032" rule
  // and gives 75. There is no cohort with an applicable age of 74, so reading
  // the schedule as a progression through 74 invents a year that does not
  // exist and would defer a whole cohort's first distribution by a year.
  describeRule('irc-401-a-9-C-v-applicable-age', {
    readings: { statuteSkipsSeventyFour: 75, progressionThroughSeventyFour: 74 },
    accepted: 'statuteSkipsSeventyFour',
  }, ({ accepted, readings }) => {
    it('sends the first post-window cohort straight to 75', () => {
      expect(rmdStartAgeForBirthYear(1960)).toBe(accepted)
      expect(rmdStartAgeForBirthYear(1960)).not.toBe(readings.progressionThroughSeventyFour)
      // 1959 attains 73 in 2032, still inside the window.
      expect(rmdStartAgeForBirthYear(1959)).toBe(73)
    })
  })

  it('maps cohorts to 72/73/75', () => {
    expect(rmdStartAgeForBirthYear(1950)).toBe(72)
    expect(rmdStartAgeForBirthYear(1951)).toBe(73)
    expect(rmdStartAgeForBirthYear(1959)).toBe(73)
    expect(rmdStartAgeForBirthYear(1960)).toBe(75)
    expect(rmdStartAgeForBirthYear(1975)).toBe(75)
  })
})

describe('partBMonthlyPremium', () => {
  const pack = packForYear(2026).pack

  it('returns the standard premium below the first tier', () => {
    expect(partBMonthlyPremium(pack, 109_000, 'single')).toBe(202.9)
    expect(partBMonthlyPremium(pack, 50_000, 'marriedFilingJointly')).toBe(202.9)
  })

  it('applies tier multiples above thresholds (statutory share of cost)', () => {
    // 35% tier: 202.90 * 1.4
    expect(partBMonthlyPremium(pack, 109_001, 'single')).toBeCloseTo(284.06, 2)
    // Top tier: 202.90 * 3.4
    expect(partBMonthlyPremium(pack, 500_000, 'single')).toBeCloseTo(689.86, 2)
    expect(partBMonthlyPremium(pack, 750_000, 'marriedFilingJointly')).toBeCloseTo(689.86, 2)
  })

  it('treats tier thresholds as cliffs', () => {
    const atEdge = partBMonthlyPremium(pack, 137_000, 'single')
    const overEdge = partBMonthlyPremium(pack, 137_001, 'single')
    expect(overEdge).toBeGreaterThan(atEdge)
    const belowTopEdge = partBMonthlyPremium(pack, 499_999, 'single')
    const atTopEdge = partBMonthlyPremium(pack, 500_000, 'single')
    expect(atTopEdge).toBeGreaterThan(belowTopEdge)
  })
})

describe('standardDeduction', () => {
  const pack = packForYear(2026).pack

  it('adds the 65+ amounts per qualifying person', () => {
    expect(standardDeduction(pack, 'single', 0)).toBe(16_100)
    expect(standardDeduction(pack, 'single', 1)).toBe(16_100 + 2_050)
    expect(standardDeduction(pack, 'marriedFilingJointly', 2)).toBe(32_200 + 2 * 1_650)
  })
})

describe('applicable age for the 1959 cohort', () => {
  // IRC 401(a)(9)(C)(v) catches a 1959 birth twice over: such a person attains
  // age 73 in 2032, inside clause (I)'s window, and age 74 in 2033, inside
  // clause (II)'s. The enacted text resolves nothing, the final regulation
  // reserved Treas. Reg. 1.401(a)(9)-2(b)(2)(v), and only a proposed rule fills
  // it with age 73. This fixture pins the reading the engine took so a later
  // reader cannot "correct" it to 75 without noticing the question was
  // researched. Two distribution calendar years of forced ordinary income for
  // the whole cohort ride on it.
  describeRule('treas-reg-1-401-a-9-2-b-2-v-applicable-age-1959', {
    readings: { proposedRegulationAgeSeventyThree: 73, clauseTwoOnItsOwnTermsAgeSeventyFive: 75 },
    accepted: 'proposedRegulationAgeSeventyThree',
  }, ({ accepted, readings }) => {
    it('takes the proposed regulation reading for a 1959 birth', () => {
      expect(rmdStartAgeForBirthYear(1959)).toBe(accepted)
      expect(rmdStartAgeForBirthYear(1959)).not.toBe(readings.clauseTwoOnItsOwnTermsAgeSeventyFive)
      // The neighbours are unambiguous: 1958 is caught by clause (I) alone and
      // 1960 by clause (II) alone, so only 1959 is doubly covered.
      expect(rmdStartAgeForBirthYear(1958)).toBe(73)
      expect(rmdStartAgeForBirthYear(1960)).toBe(75)
    })
  })
})


/**
 * Parameter-pack provenance.
 *
 * Every figure below is a published number that some authority fixes and some
 * authority (or none) indexes. Each fixture names the value the authority
 * produces alongside the value a live misreading produces -- a stale year, the
 * wrong index, a joint figure assumed to be double, a step function treated as
 * continuous -- so the two cannot both pass.
 */
describe('parameter pack provenance', () => {
  const pack = packForYear(2026).pack
  const NATIONAL_AVERAGE_WAGE_INDEX_2024 = 69_846.57
  const NATIONAL_AVERAGE_WAGE_INDEX_2000 = 32_154.82
  const NATIONAL_AVERAGE_WAGE_INDEX_1998 = 28_861.44
  const NATIONAL_AVERAGE_WAGE_INDEX_1992 = 22_935.42
  const roundToNearest = (amount: number, step: number): number => Math.round(amount / step) * step

  // The 2026 determination multiplies the 2000 amount of $700 by the ratio of
  // the national average wage index for 2024 to that for 1998, producing
  // $1,694.05, rounds it to $1,690, and names $1,620 as the amount superseded.
  // The projection compares annual wages against twelve times the monthly
  // figure, so a stale month is not a small error: it suspends the benefit
  // outright for someone earning between the old level and the new one.
  describeRule('cfr-20-404-1574-b-2-sga-non-blind-monthly-amount', {
    readings: { determination2026: 20_280, superseded2025Amount: 19_440 },
    accepted: 'determination2026',
    note: 'Values are the annual gate the projection uses, twelve times the published monthly amount.',
  }, ({ accepted, readings }) => {
    it('derives the monthly amount from the wage index the regulation names', () => {
      const statutory = roundToNearest(
        700 * (NATIONAL_AVERAGE_WAGE_INDEX_2024 / NATIONAL_AVERAGE_WAGE_INDEX_1998),
        10,
      )
      expect(statutory).toBe(1_690)
      expect(pack.socialSecurity.sgaMonthlyNonBlind).toBe(statutory)
    })

    it('gates SSDI on the 2026 substantial gainful activity amount', () => {
      const annualSgaLimit = pack.socialSecurity.sgaMonthlyNonBlind * SGA_ANNUAL_MONTHS
      expect(annualSgaLimit).toBe(accepted)
      expect(annualSgaLimit).not.toBe(readings.superseded2025Amount)
      // Wages between the superseded amount and the current one. The benefit
      // survives under the 2026 determination and is suspended under the 2025
      // one, which is the whole consequence of carrying the stale figure.
      expect(ssdiSuspendedBySga(20_000, annualSgaLimit)).toBe(false)
    })
  })

  // 42 USC 1395r(i)(5)(C)(i) takes the 500,000 amounts out of the (i)(5)(A)
  // adjustment and (i)(5)(C)(ii) starts indexing them only for years after
  // 2027. A 2027 premium year at 2 percent therefore moves the first tier
  // floor from 109,000 to 111,180 and leaves the top one at exactly 500,000,
  // so a single filer at 505,000 is in the top tier under the statute and one
  // tier below it under a uniform scale.
  describeRule('usc-42-1395r-i-5-C-top-irmaa-threshold-frozen', {
    readings: { statuteTopTierFrozen: 5, uniformScaleAcrossAllTiers: 4 },
    accepted: 'statuteTopTierFrozen',
    note: 'Values are the IRMAA tier for a single filer with 505,000 of MAGI in a 2027 premium year at 2 percent inflation.',
  }, ({ accepted, readings }) => {
    const oneYearOfInflation = 1.02

    it('holds the top tier still while the rows beneath it index', () => {
      expect(irmaaTierForMagi(pack, 505_000, 'single', oneYearOfInflation)).toBe(accepted)
      expect(irmaaTierForMagi(pack, 505_000, 'single', oneYearOfInflation))
        .not.toBe(readings.uniformScaleAcrossAllTiers)
      expect(irmaaTierThreshold(pack, 4, 'single', oneYearOfInflation)).toBe(500_000)
    })

    it('still moves the lower tiers, so this is a carve-out and not a frozen table', () => {
      expect(irmaaTierThreshold(pack, 0, 'single', oneYearOfInflation)).toBeCloseTo(111_180, 6)
      // 110,000 clears the pack-year floor of 109,000 but not the projected one.
      expect(irmaaTierForMagi(pack, 110_000, 'single', oneYearOfInflation)).toBe(0)
      expect(irmaaTierForMagi(pack, 110_000, 'single')).toBe(1)
    })

    it('carves out the 150 percent joint figure with it', () => {
      expect(irmaaTierThreshold(pack, 4, 'marriedFilingJointly', oneYearOfInflation)).toBe(750_000)
      expect(irmaaTierForMagi(pack, 757_000, 'marriedFilingJointly', oneYearOfInflation)).toBe(5)
      // Every row beneath the last is an exact double; the last is not.
      expect(pack.medicare.irmaaTiers[0]!.magiOver.marriedFilingJointly)
        .toBe(pack.medicare.irmaaTiers[0]!.magiOver.single * 2)
      expect(pack.medicare.irmaaTiers[4]!.magiOver.marriedFilingJointly)
        .toBe(pack.medicare.irmaaTiers[4]!.magiOver.single * 1.5)
    })
  })

  // The promulgated premium is 50 percent of the aged monthly actuarial rate
  // plus a repayment amount required under current law. Half of 405.40 is
  // 202.70; the notice promulgates 202.90.
  describeRule('usc-42-1395r-a-3-part-b-standard-premium', {
    readings: { promulgatedStandardPremium: 202.9, halfOfTheAgedActuarialRateAlone: 202.7 },
    accepted: 'promulgatedStandardPremium',
    note: 'The twenty cents between them is the repayment amount, which the promulgated figure carries and a re-derivation from the actuarial rate drops.',
  }, ({ accepted, readings }) => {
    const agedMonthlyActuarialRate2026 = 405.4

    it('carries the promulgated premium rather than half the actuarial rate', () => {
      expect(pack.medicare.partBStandardMonthly).toBe(accepted)
      expect(pack.medicare.partBStandardMonthly).not.toBe(readings.halfOfTheAgedActuarialRateAlone)
      expect(agedMonthlyActuarialRate2026 / 2).toBeCloseTo(readings.halfOfTheAgedActuarialRateAlone, 10)
      expect(pack.medicare.partBStandardMonthly - agedMonthlyActuarialRate2026 / 2).toBeCloseTo(0.2, 10)
    })
  })

  // Section 230(b) scales the 1994 base by the ratio of national average wages,
  // not by the benefit cost-of-living increase. Both roundings are to the
  // nearest 300, so the gap between the readings is the index and nothing else.
  describeRule('usc-42-430-b-contribution-and-benefit-base', {
    readings: { wageIndexedUnderSection230b: 184_500, priceIndexedFromThePriorBase: 180_900 },
    accepted: 'wageIndexedUnderSection230b',
    note: 'The price reading takes the 2025 base of 176,100 and the benefit increase the same notice announces for 2026.',
  }, ({ accepted, readings }) => {
    it('derives the base from the wage index rather than from prices', () => {
      const statutory = roundToNearest(
        60_600 * (NATIONAL_AVERAGE_WAGE_INDEX_2024 / NATIONAL_AVERAGE_WAGE_INDEX_1992),
        300,
      )
      expect(statutory).toBe(accepted)
      expect(pack.socialSecurity.taxableWageBase).toBe(accepted)

      const priceIndexed = roundToNearest(176_100 * (1 + pack.socialSecurity.colaPct / 100), 300)
      expect(priceIndexed).toBe(readings.priceIndexedFromThePriorBase)
      expect(pack.socialSecurity.taxableWageBase).not.toBe(priceIndexed)
    })
  })

  // The same wage index governs the earnings test exempt amounts, off two
  // different base amounts and two different reference years.
  describeRule('usc-42-403-f-8-earnings-test-exempt-amounts', {
    readings: { wageIndexedUnderSection203f8B: 24_480, priceIndexedFromThePriorAmount: 24_000 },
    accepted: 'wageIndexedUnderSection203f8B',
    note: 'Values are the lower annual exempt amount, twelve times the monthly one.',
  }, ({ accepted, readings }) => {
    it('derives the lower exempt amount from the wage index rather than from prices', () => {
      const statutoryMonthly = roundToNearest(
        670 * (NATIONAL_AVERAGE_WAGE_INDEX_2024 / NATIONAL_AVERAGE_WAGE_INDEX_1992),
        10,
      )
      expect(statutoryMonthly * 12).toBe(accepted)
      expect(pack.socialSecurity.earningsTestBelowFraAnnual).toBe(accepted)

      const priceIndexed = roundToNearest(1_950 * (1 + pack.socialSecurity.colaPct / 100), 10) * 12
      expect(priceIndexed).toBe(readings.priceIndexedFromThePriorAmount)
      expect(pack.socialSecurity.earningsTestBelowFraAnnual).not.toBe(priceIndexed)
    })

    it('derives the higher exempt amount from its own base and reference year', () => {
      const statutoryMonthly = roundToNearest(
        2_500 * (NATIONAL_AVERAGE_WAGE_INDEX_2024 / NATIONAL_AVERAGE_WAGE_INDEX_2000),
        10,
      )
      expect(statutoryMonthly * 12).toBe(65_160)
      expect(pack.socialSecurity.earningsTestFraYearAnnual).toBe(65_160)
      // Not a multiple of the lower amount, so neither can stand in for the other.
      expect(pack.socialSecurity.earningsTestFraYearAnnual % pack.socialSecurity.earningsTestBelowFraAnnual)
        .not.toBe(0)
    })
  })

  // Section 86 states four dollar figures and no cost-of-living provision. The
  // joint amounts are not double the unmarried ones, which is the habit the
  // standard deduction teaches and this rule has to survive.
  describeRule('irc-86-c-provisional-income-thresholds', {
    readings: { statuteJointIsNotDouble: 44_000, jointDoublesLikeTheStandardDeduction: 68_000 },
    accepted: 'statuteJointIsNotDouble',
    note: 'Values are the joint adjusted base amount, above which up to 85 percent of the benefit is included.',
  }, ({ accepted, readings }) => {
    it('keeps the joint amounts at the figures the statute states', () => {
      expect(pack.ssBenefitTaxation.tier85Start.marriedFilingJointly).toBe(accepted)
      expect(pack.ssBenefitTaxation.tier85Start.marriedFilingJointly)
        .not.toBe(readings.jointDoublesLikeTheStandardDeduction)
      expect(pack.ssBenefitTaxation.tier50Start.marriedFilingJointly).toBe(32_000)
      expect(pack.ssBenefitTaxation.tier50Start.marriedFilingJointly)
        .not.toBe(pack.ssBenefitTaxation.tier50Start.single * 2)
    })

    it('is the opposite of the standard deduction, which does double', () => {
      expect(pack.federalTax.standardDeduction.marriedFilingJointly)
        .toBe(pack.federalTax.standardDeduction.single * 2)
    })
  })

  // 414(v)(7)(E) rounds any increase down to a multiple of 5,000, so the
  // threshold stands still for a year or more and then jumps a whole step. It
  // is never the base amount scaled by a year of inflation.
  describeRule('irc-414-v-7-E-roth-catch-up-wage-threshold', {
    readings: { adjusted2026Threshold: 150_000, unadjustedStatutoryBase: 145_000 },
    accepted: 'adjusted2026Threshold',
  }, ({ accepted, readings }) => {
    it('carries the adjusted threshold on a five-thousand-dollar step', () => {
      expect(pack.contributionLimits.rothCatchUpWageThreshold).toBe(accepted)
      expect(pack.contributionLimits.rothCatchUpWageThreshold).not.toBe(readings.unadjustedStatutoryBase)
      expect((accepted - readings.unadjustedStatutoryBase) % 5_000).toBe(0)
    })
  })

  // Notice 2025-67 raises the 415(c)(1)(A) limit from 70,000 to 72,000, a whole
  // 415(d)(4)(B) step. Every limit that borrows the same mechanism sits on its
  // own step, which is the point of recording the mechanism rather than a year.
  describeRule('irc-415-d-cost-of-living-adjustment-anchor', {
    readings: { adjusted2026Limit: 72_000, priorYear2025Limit: 70_000 },
    accepted: 'adjusted2026Limit',
  }, ({ accepted, readings }) => {
    it('moves the annual additions limit on a thousand-dollar step', () => {
      expect(pack.contributionLimits.section415cLimit).toBe(accepted)
      expect(pack.contributionLimits.section415cLimit).not.toBe(readings.priorYear2025Limit)
      expect((accepted - readings.priorYear2025Limit) % 1_000).toBe(0)
    })

    it('leaves every borrowing limit on the step its own provision names', () => {
      expect(pack.contributionLimits.rothCatchUpWageThreshold % 5_000).toBe(0)
      expect(pack.annuities.qlacPremiumCap % 10_000).toBe(0)
    })
  })

  // The regulation adjusts the 200,000 base like the 415(d) limits but rounds
  // increments down to a multiple of 10,000, and Notice 2025-67 states the cap
  // remains 210,000 for 2026. A pack that fell back to the base would be a
  // whole step low and would refuse a premium the regulation allows.
  describeRule('treas-reg-1-401-a-9-6-q-2-qlac-premium-dollar-limit', {
    readings: { publishedCap2026: 210_000, unadjustedRegulationBase: 200_000 },
    accepted: 'publishedCap2026',
  }, ({ accepted, readings }) => {
    it('carries the published cap on a ten-thousand-dollar step', () => {
      expect(pack.annuities.qlacPremiumCap).toBe(accepted)
      expect(pack.annuities.qlacPremiumCap).not.toBe(readings.unadjustedRegulationBase)
      expect((accepted - readings.unadjustedRegulationBase) % 10_000).toBe(0)
    })
  })

  // 3101(a) imposes the tax on the employee at a flat 6.2 percent. The
  // employer pays the same again and a self-employed individual pays both, so
  // quoting one figure for the other is a factor of two rather than a rounding.
  describeRule('irc-3101-a-oasdi-employee-tax-rate', {
    readings: { employeeShare: 6.2, combinedEmployerAndEmployee: 12.4 },
    accepted: 'employeeShare',
  }, ({ accepted, readings }) => {
    it('carries the employee side rather than the combined rate', () => {
      expect(pack.socialSecurity.oasdiEmployeeRatePct).toBe(accepted)
      expect(pack.socialSecurity.oasdiEmployeeRatePct).not.toBe(readings.combinedEmployerAndEmployee)
      expect(pack.socialSecurity.oasdiEmployeeRatePct * 2)
        .toBeCloseTo(readings.combinedEmployerAndEmployee, 10)
    })
  })
})
