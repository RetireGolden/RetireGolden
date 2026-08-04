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
 */
export function indexFederalTaxPack(pack: ParameterPack, inflationScale: number): ParameterPack {
  if (!Number.isFinite(inflationScale) || inflationScale <= 1) return pack
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

export function irmaaTierForMagi(
  pack: ParameterPack,
  magiTwoYearsPrior: number,
  filingStatus: FilingStatus,
  thresholdScale = 1,
): number {
  let tier = 0
  for (let i = 0; i < pack.medicare.irmaaTiers.length; i++) {
    const threshold = pack.medicare.irmaaTiers[i]!.magiOver[filingStatus] * thresholdScale
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
