/**
 * Typed access to annual parameter packs.
 *
 * Future years resolve to the latest published pack with `isStandIn: true`
 * (same pattern as v1's ssaWageData "latest published" fallback) — projections
 * inflate from the latest pack rather than failing on unpublished years.
 */

import type { FilingStatus, ParameterPack, PerStatus } from './types.js'
import { year2026 } from './data/year2026.js'

export { PARAMETER_PROVENANCE } from './provenance.js'
export type { ParameterSource } from './provenance.js'
export { REAL_YIELD_CURVE_2026 as EMBEDDED_REAL_YIELD_CURVE } from './data/realYieldCurve2026.js'
export type { RealYieldCurve, RealYieldCurvePoint } from './types.js'

const packs: ParameterPack[] = [year2026]
// Keep sorted ascending by year as packs are added each fall.

export const EARLIEST_PACK_YEAR = packs[0]!.year
export const LATEST_PACK_YEAR = packs[packs.length - 1]!.year

/**
 * When the tax/limit figures in the parameter packs were last compiled, and the
 * published rules they reflect. Surfaced in the disclaimer so users know the
 * data's vintage. Bump on each annual refresh.
 */
export const PARAMETER_DATA_AS_OF = 'June 2026'
export const PARAMETER_DATA_BASIS = '2025 published federal and state rules'

/**
 * Default Social Security trust-fund haircut per the OASDI Trustees Report:
 * the 2026 report projects combined depletion in Q3 2034 with 83% of benefits
 * payable (a 17% cut). (OASI alone depletes 2032 at 78% payable — RetireGolden's
 * default follows the combined convention, domain rules §4.)
 * Single source for the toggle default in Assumptions, the scenario chip, and
 * example plans; revisit per DOCS/maintenance-schedule.md when the Trustees
 * projection moves.
 */
export const TRUSTEES_DEFAULT_SS_HAIRCUT = { fromYear: 2034, cutPct: 17 } as const

export interface PackLookup {
  pack: ParameterPack
  /** True when `year` has no published pack and a neighboring year is standing in. */
  isStandIn: boolean
}

export function packForYear(year: number): PackLookup {
  const exact = packs.find((p) => p.year === year)
  if (exact) return { pack: exact, isStandIn: false }
  if (year > LATEST_PACK_YEAR) return { pack: packs[packs.length - 1]!, isStandIn: true }
  return { pack: packs[0]!, isStandIn: true }
}

/**
 * The federal income-tax figures Congress adjusts for inflation every year,
 * projected onto a year the published pack only stands in for.
 *
 * The projection runs in nominal dollars, so a year's wages, pensions and
 * withdrawals all arrive inflated. Measuring that income against a frozen
 * pack-year rate table is bracket creep the statute does not create: IRC
 * 1(j)(3)(B) directs the Secretary to prescribe adjusted tables for every year
 * after 2018, so the thresholds rise with the income. The same is true of every
 * other figure scaled here, each under its own provision:
 *
 * - rate-bracket lower bounds -- IRC 1(j)(3)(B)
 * - basic standard deduction -- IRC 63(c)(7)(B)(ii) (base year 2024)
 * - age-65 addition -- IRC 63(c)(4), which reaches "subsection (f)" amounts
 * - 15% and 20% capital-gain breakpoints -- IRC 1(j)(5)(C)
 * - AMT exemption and its phase-out threshold -- IRC 55(d)(4)(B)
 * - AMT 28%-rate threshold -- IRC 55(d)(3)(B)(i)
 *
 * The base years differ (2016, 2017, 2024, 2025, 2011) and so do the rounding
 * steps (50 dollars, 100 dollars), but neither matters here: the published pack
 * figure has already absorbed every adjustment through the pack year, so
 * projecting forward is one multiplication for all of them. What is NOT
 * reproduced is the statutory rounding, and the index is the plan's assumed
 * general inflation rather than the C-CPI-U of 1(f)(3) -- the same two
 * approximations `limitScale` already makes for contribution limits.
 *
 * Figures deliberately left alone, because no provision indexes them:
 * the section 86 provisional-income thresholds, the section 1411 NIIT
 * thresholds, the section 121 exclusion, the section 1211(b) ordinary offset,
 * the section 151(d)(5)(C) senior deduction and its MAGI threshold, and the
 * SALT cap (which follows the explicit 164(b)(7) schedule, not an index).
 * Scaling any of those would be a new defect in the opposite direction.
 *
 * The scale runs both ways. A plan may assume negative inflation
 * (`assumptions.inflationPct` is bounded only by `gt(-100)`), in which case the
 * cumulative factor the caller hands in is below 1 and these figures come down
 * with the price level. That is the statute's own direction: 1(f)(3)(A) floors
 * the adjustment at zero only against the BASE year -- "the percentage (if any)
 * by which the C-CPI-U for the preceding calendar year exceeds the CPI for
 * calendar year 2016" -- so a year's amount can fall below the previous year's,
 * it simply cannot fall below the printed statutory amount. Refusing to move
 * down would freeze the thresholds while the income deflating against them
 * shrinks, which is bracket creep run backwards and under-taxes the household.
 * Only a non-finite or non-positive factor is ignored; a factor of exactly 1 --
 * the default, and what a year with its own published pack gets -- returns the
 * pack untouched.
 */
export function indexFederalTaxPack(pack: ParameterPack, inflationScale: number): ParameterPack {
  if (!Number.isFinite(inflationScale) || inflationScale <= 0 || inflationScale === 1) return pack
  const scale = inflationScale
  const perStatus = (amounts: PerStatus<number>): PerStatus<number> => ({
    single: amounts.single * scale,
    marriedFilingJointly: amounts.marriedFilingJointly * scale,
  })
  const { federalTax, capitalGains } = pack
  return {
    ...pack,
    federalTax: {
      ...federalTax,
      brackets: {
        single: federalTax.brackets.single.map((b) => ({ ...b, lowerBound: b.lowerBound * scale })),
        marriedFilingJointly: federalTax.brackets.marriedFilingJointly.map(
          (b) => ({ ...b, lowerBound: b.lowerBound * scale }),
        ),
      },
      standardDeduction: perStatus(federalTax.standardDeduction),
      age65Addition: perStatus(federalTax.age65Addition),
      amt: {
        ...federalTax.amt,
        exemption: perStatus(federalTax.amt.exemption),
        exemptionPhaseOutStart: perStatus(federalTax.amt.exemptionPhaseOutStart),
        rate28StartsAbove: federalTax.amt.rate28StartsAbove * scale,
      },
    },
    capitalGains: {
      rate15StartsAbove: perStatus(capitalGains.rate15StartsAbove),
      rate20StartsAbove: perStatus(capitalGains.rate20StartsAbove),
    },
  }
}

/** RMD start age per SECURE 2.0. Pre-1951 cohorts already started under older rules. */
export function rmdStartAgeForBirthYear(birthYear: number): number {
  if (birthYear <= 1950) return 72
  if (birthYear <= 1959) return 73
  return 75
}

export function uniformLifetimeDivisor(pack: ParameterPack, age: number): number | undefined {
  if (age > 120) return pack.rmd.uniformLifetimeTable[120]
  return pack.rmd.uniformLifetimeTable[age]
}

/**
 * Expected-return multiple (remaining life expectancy in years) for a
 * single-life ordinary annuity starting at `ageAtStart`, from IRS Pub 939
 * Table V. Linear interpolation between whole-age entries; clamped to the
 * table's endpoints outside its range. Drives the non-qualified exclusion
 * ratio: exclusion ratio = investment-in-contract ÷ (annual payment × multiple).
 */
export function annuityExpectedReturnMultiple(pack: ParameterPack, ageAtStart: number): number {
  const table = pack.annuities.expectedReturnMultiples
  const ages = Object.keys(table)
    .map(Number)
    .sort((a, b) => a - b)
  if (ages.length === 0) return 0
  const lo = ages[0]!
  const hi = ages[ages.length - 1]!
  if (ageAtStart <= lo) return table[lo]!
  if (ageAtStart >= hi) return table[hi]!
  const whole = Math.floor(ageAtStart)
  const lower = table[whole]
  const upper = table[whole + 1]
  if (lower === undefined) return table[hi]!
  if (upper === undefined || ageAtStart === whole) return lower
  return lower + (upper - lower) * (ageAtStart - whole)
}

/**
 * Planning-default HECM principal-limit factor (percent of home value) for the
 * youngest borrower's age at open, from the pack's published factor table
 * (compiled at the pack's expected rate — a lender quote at the actual rate
 * always wins; this is the fallback approximation). Linear interpolation
 * between published ages; clamped to the endpoints outside the table.
 */
export function hecmPrincipalLimitFactorPct(pack: ParameterPack, ageAtOpen: number): number {
  const table = pack.hecm.principalLimitFactorPctByAge
  const ages = Object.keys(table)
    .map(Number)
    .sort((a, b) => a - b)
  if (ages.length === 0) return 0
  if (ageAtOpen <= ages[0]!) return table[ages[0]!]!
  if (ageAtOpen >= ages[ages.length - 1]!) return table[ages[ages.length - 1]!]!
  for (let i = 0; i < ages.length - 1; i++) {
    const lo = ages[i]!
    const hi = ages[i + 1]!
    if (ageAtOpen >= lo && ageAtOpen <= hi) {
      return table[lo]! + ((table[hi]! - table[lo]!) * (ageAtOpen - lo)) / (hi - lo)
    }
  }
  return table[ages[ages.length - 1]!]!
}

/**
 * A premium year together with the inflation path used to reach it.
 *
 * The two travel as one value because the IRMAA table does not move as one
 * table: the top row is indexed from a different base year than the rows
 * beneath it, so a bare scale factor cannot say what it is a scale *to*, and a
 * caller that hands over only a factor has already lost the information the
 * carve-out turns on.
 */
export interface IrmaaThresholdYear {
  /** The premium year the thresholds are being read for. */
  readonly premiumYear: number
  /**
   * Cumulative general inflation from the pack year to `year`. Must return 1
   * for any year at or before the pack year.
   */
  readonly inflationFactorToYear: (year: number) => number
}

/**
 * Last premium year for which 42 USC 1395r(i)(5)(C)(i) holds the top row still.
 * Indexing resumes for calendar years after this one under (i)(5)(C)(ii).
 */
export const IRMAA_TOP_TIER_FROZEN_THROUGH_YEAR = 2027

/** The August base period (i)(5)(C)(ii) measures the resumed adjustment from. */
const IRMAA_TOP_TIER_RESUMED_BASE_YEAR = 2026

/**
 * The MAGI floor for one IRMAA tier in a premium year.
 *
 * 42 USC 1395r(i)(5)(A) indexes every dollar amount in the paragraph (2) or (3)
 * tables to consumer prices measured against August 2006, but it is expressly
 * subject to (i)(5)(C), which carves out the $500,000 amounts twice over.
 * (i)(5)(C)(i) removes them from that adjustment outright, and (i)(5)(C)(ii)
 * brings them back only for calendar years after 2027, measured against August
 * 2026 rather than August 2006. Because the August of the preceding calendar
 * year is what both provisions read, an August 2026 base is exactly one year
 * behind the general one: the resumed factor is the general factor evaluated a
 * year earlier. The carve-out reaches only the $500,000 amounts, not paragraph
 * (3) at large, so the four rows beneath the top one never stop indexing.
 *
 * The joint figure follows the individual one because (i)(3)(C)(ii) sets the
 * last row at 150 percent of the individual amount rather than twice it, which
 * is why the pack carries 500,000 and 750,000 where every lower row is an exact
 * double.
 *
 * @see tax rule `usc-42-1395r-i-5-C-top-irmaa-threshold-frozen`
 */
export function irmaaTierThreshold(
  pack: ParameterPack,
  tierIndex: number,
  filingStatus: FilingStatus,
  at?: IrmaaThresholdYear,
): number {
  const magiOver = pack.medicare.irmaaTiers[tierIndex]!.magiOver[filingStatus]
  if (at === undefined) return magiOver

  const isTopTier = tierIndex === pack.medicare.irmaaTiers.length - 1
  if (!isTopTier) {
    // Every row but the last indexes under (i)(5)(A) without interruption.
    // (i)(5)(B) rounds these to the nearest 1,000 too and the engine does not,
    // which is pre-existing behaviour named on the rule rather than changed
    // here as a side effect of the carve-out.
    return magiOver * at.inflationFactorToYear(at.premiumYear)
  }
  if (pack.year > IRMAA_TOP_TIER_FROZEN_THROUGH_YEAR) {
    // Once a published pack is itself post-freeze its top figure already
    // carries the resumed adjustment through its own year, so from there the
    // row grows at the general rate. It is still an amount increased under
    // subparagraph (C) rather than (A) -- (C)(i) removed it from (A) with no
    // end date -- so the (i)(5)(B) rounding follows it forward, exactly as it
    // does on the resumed branch below. Splitting that would round the same
    // statutory row in one year and not the next.
    return roundToNearestThousand(magiOver * at.inflationFactorToYear(at.premiumYear))
  }
  if (at.premiumYear <= IRMAA_TOP_TIER_FROZEN_THROUGH_YEAR) return magiOver

  // The resumed adjustment carries the growth from August of the base year to
  // August of the year before the premium year. `inflationFactorToYear` is
  // anchored at the pack year and returns 1 for anything at or before it, so it
  // can express that span only while the pack year IS the resumed base year, in
  // which case the span is the general factor read one year early.
  //
  // (i)(5)(C)(i) freezes the top row with no end date of its own, so a 2027
  // pack is publishable and would reach this branch. Its factor starts at 2027
  // and cannot reach back to the August 2026 base, so the adjustment would be
  // measured over the wrong years without saying so: a 2029 premium year would
  // price the 2027-to-2029 span where (C)(ii) asks for 2026-to-2028. Refuse
  // instead, because the fix belongs with the pack that introduces the problem.
  if (pack.year !== IRMAA_TOP_TIER_RESUMED_BASE_YEAR) {
    throw new RangeError(
      `IRMAA top-tier indexing resumes from August ${IRMAA_TOP_TIER_RESUMED_BASE_YEAR} under 42 USC 1395r(i)(5)(C)(ii), a base a ${pack.year} pack cannot measure from; give IrmaaThresholdYear a pre-pack base before publishing one`,
    )
  }
  return roundToNearestThousand(magiOver * at.inflationFactorToYear(at.premiumYear - 1))
}

/**
 * (i)(5)(B): a dollar amount increased under subparagraph (A) or (C) that is
 * not a multiple of 1,000 is rounded to the nearest one. Applied to the top row
 * on both of its (C) branches; the lower rows keep their pre-existing unrounded
 * (A) treatment, which is recorded on the rule rather than left as a silent
 * asymmetry.
 */
function roundToNearestThousand(amount: number): number {
  return Math.round(amount / 1_000) * 1_000
}

export function irmaaTierForMagi(
  pack: ParameterPack,
  magiTwoYearsPrior: number,
  filingStatus: FilingStatus,
  at?: IrmaaThresholdYear,
): number {
  let tier = 0
  for (let i = 0; i < pack.medicare.irmaaTiers.length; i++) {
    const threshold = irmaaTierThreshold(pack, i, filingStatus, at)
    const isTopTier = i === pack.medicare.irmaaTiers.length - 1
    // CMS publishes lower tiers as "greater than" the floor; the final tier is inclusive.
    if (isTopTier ? magiTwoYearsPrior >= threshold : magiTwoYearsPrior > threshold) tier = i + 1
  }
  return tier
}

/** Total monthly Part B premium for a MAGI (2-year-lookback) and filing status. */
export function partBMonthlyPremium(
  pack: ParameterPack,
  magiTwoYearsPrior: number,
  filingStatus: FilingStatus,
): number {
  const base = pack.medicare.partBStandardMonthly
  let applicablePct = 25
  const tier = irmaaTierForMagi(pack, magiTwoYearsPrior, filingStatus)
  if (tier > 0) applicablePct = pack.medicare.irmaaTiers[tier - 1]!.applicablePct
  // Standard premium is 25% of program cost; IRMAA tiers pay a higher share.
  return Math.round(base * (applicablePct / 25) * 100) / 100
}

export function standardDeduction(
  pack: ParameterPack,
  filingStatus: FilingStatus,
  peopleAged65Plus: number,
): number {
  const base = pack.federalTax.standardDeduction[filingStatus]
  const addition = pack.federalTax.age65Addition[filingStatus] * peopleAged65Plus
  return base + addition
}
