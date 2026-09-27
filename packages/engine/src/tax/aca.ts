/**
 * ACA planning-year premium-tax-credit math.
 *
 * This module models current-year allowable PTC and the household's economic
 * net premium. It does not model APTC cash timing, refunds/balances due, or a
 * filing-grade Form 8962 reconciliation.
 *
 * @see DOCS/domain/domain-rules-reference.md §8
 */

import type { AcaPricingParameters } from '../params/acaCoverageYears.js'

export type AcaFplRegion = 'contiguous' | 'alaska' | 'hawaii'

export interface AcaResult {
  /** MAGI as a percentage of the federal poverty line. */
  fplPct: number
  /** Expected annual contribution toward the benchmark premium. */
  expectedContribution: number
  /** Backward-compatible alias for modeledAllowablePtc. */
  credit: number
  /** Backward-compatible alias for economicNetPremium. */
  netAnnualPremium: number
  grossEnrollmentPremium: number
  applicableSlcspPremium: number
  modeledAllowablePtc: number
  economicNetPremium: number
  /** True only above (not at) the 400% ceiling. */
  overCliff: boolean
  /** Below 100% FPL; exception pathways are outside this slice. */
  belowEligibilityFloor: boolean
}

export type AcaMagiBlockerCode =
  | 'dependent-filing-status-unknown'
  | 'tax-exempt-interest-unknown'
  | 'foreign-exclusion-addback-unknown'

export interface AcaHouseholdMagiInput {
  federalAgi: number
  grossSocialSecurity: number
  taxableSocialSecurity: number
  taxExemptInterest: { state: 'known' | 'notApplicable' | 'unknown'; amount: number | null }
  foreignExclusionAddback: { state: 'known' | 'notApplicable' | 'unknown'; amount: number | null }
  dependents: readonly {
    personId: string
    requiredToFile: 'required' | 'notRequired' | 'unknown'
    magi: number
  }[]
}

export interface AcaHouseholdMagiResult {
  actionable: boolean
  magi: number | null
  blockers: AcaMagiBlockerCode[]
  components: {
    federalAgi: number
    nontaxableSocialSecurity: number
    taxExemptInterest: number
    foreignExclusionAddback: number
    requiredFilerDependentMagi: number
  }
  dependents: Array<{
    personId: string
    requiredToFile: 'required' | 'notRequired' | 'unknown'
    magi: number
    includedMagi: number
  }>
}

/**
 * Program-specific household MAGI. Addbacks change ACA MAGI evidence only;
 * callers must not feed them back into ordinary taxable income.
 */
export function buildAcaHouseholdMagi(input: AcaHouseholdMagiInput): AcaHouseholdMagiResult {
  const blockers: AcaMagiBlockerCode[] = []
  if (input.taxExemptInterest.state === 'unknown') blockers.push('tax-exempt-interest-unknown')
  if (input.foreignExclusionAddback.state === 'unknown') blockers.push('foreign-exclusion-addback-unknown')

  const dependents = input.dependents.map((dependent) => {
    if (dependent.requiredToFile === 'unknown') blockers.push('dependent-filing-status-unknown')
    return {
      ...dependent,
      includedMagi: dependent.requiredToFile === 'required' ? Math.max(0, dependent.magi) : 0,
    }
  })
  const components = {
    // Preserve signed return AGI until all household addbacks are assembled.
    // A capital-loss deduction can make AGI negative and must offset positive
    // ACA addbacks before the final household-income floor is applied.
    federalAgi: input.federalAgi,
    nontaxableSocialSecurity: Math.max(0, input.grossSocialSecurity - input.taxableSocialSecurity),
    taxExemptInterest:
      input.taxExemptInterest.state === 'known' ? Math.max(0, input.taxExemptInterest.amount ?? 0) : 0,
    foreignExclusionAddback:
      input.foreignExclusionAddback.state === 'known' ? Math.max(0, input.foreignExclusionAddback.amount ?? 0) : 0,
    requiredFilerDependentMagi: dependents.reduce((sum, dependent) => sum + dependent.includedMagi, 0),
  }
  const actionable = blockers.length === 0
  return {
    actionable,
    magi: actionable
      ? Math.max(
          0,
          components.federalAgi +
            components.nontaxableSocialSecurity +
            components.taxExemptInterest +
            components.foreignExclusionAddback +
            components.requiredFilerDependentMagi,
        )
      : null,
    blockers: [...new Set(blockers)],
    components,
    dependents,
  }
}

export function acaFederalPovertyLine(
  pack: AcaPricingParameters,
  householdSize: number,
  region: AcaFplRegion = 'contiguous',
  fplScale = 1,
): number {
  const table = pack.federalPovertyLine[region]
  return (
    (table.firstPerson + table.perAdditionalPerson * Math.max(0, householdSize - 1)) *
    fplScale
  )
}

/**
 * The poverty-line percentage the applicable percentage is read at: the exact
 * percentage with its fraction dropped. Form 8962's Worksheet 2, line 4, is
 * the IRS's own computation: "Do not round; instead, multiply this number by
 * 100 (to express it as a percentage) and then drop any numbers after the
 * decimal point." The billionth added before the floor keeps a percentage
 * that is a whole number in exact arithmetic from dropping a point to binary
 * representation error (29,206.80 of 15,960 is 183% and evaluates to
 * 182.99999999999997). Only the table is read at this figure: the 100% and
 * 400% tests compare the exact percentage, as the form's own cliff test
 * compares income with 4 times the poverty line.
 */
export function acaWholeFplPct(fplPct: number): number {
  return Math.floor(fplPct + 1e-9)
}

/**
 * Piecewise-linear applicable percentage with the statutory step at 133%,
 * rounded to the nearest one-hundredth of one percent, half up, as 26 CFR
 * 1.36B-3(g)(1) requires ("increases on a sliding scale in a linear manner
 * and is rounded to the nearest one-hundredth of one percent"; its example
 * rounds 8.775 to 8.78). The billionth added before rounding keeps a tie that
 * is exact in decimal from rounding down when its binary value lands a hair
 * below the half: at 141.5% in 2027 the rate is 3.765 in decimal, but
 * 3.23 + 0.5 × (4.30 − 3.23) evaluates to 3.7649999999999997, which would
 * round to 3.76 instead of 3.77. The credit reads the table at a whole-number
 * percentage (acaWholeFplPct), where no tie in the 2026 or 2027 table needs
 * it (5.395 at 175% in 2026 is exactly 539.5 after × 100); it guards a
 * fractional read and future tables.
 */
export function acaApplicablePct(pack: AcaPricingParameters, fplPct: number): number {
  return Math.round(interpolatedApplicablePct(pack, fplPct) * 100 + 1e-9) / 100
}

function interpolatedApplicablePct(pack: AcaPricingParameters, fplPct: number): number {
  const points = pack.aca.applicablePctBreakpoints
  if (fplPct < points[0]!.fplPct) return pack.aca.applicablePctBelowFirstBreakpoint
  if (fplPct === points[0]!.fplPct) return points[0]!.applicablePct
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]!
    const next = points[i]!
    if (fplPct <= next.fplPct) {
      const t = (fplPct - prev.fplPct) / (next.fplPct - prev.fplPct)
      return prev.applicablePct + t * (next.applicablePct - prev.applicablePct)
    }
  }
  return points[points.length - 1]!.applicablePct
}

function noCreditResult(
  fplPct: number,
  grossEnrollmentPremium: number,
  applicableSlcspPremium: number,
  overCliff: boolean,
  belowEligibilityFloor: boolean,
): AcaResult {
  return {
    fplPct,
    expectedContribution: 0,
    credit: 0,
    netAnnualPremium: grossEnrollmentPremium,
    grossEnrollmentPremium,
    applicableSlcspPremium,
    modeledAllowablePtc: 0,
    economicNetPremium: grossEnrollmentPremium,
    overCliff,
    belowEligibilityFloor,
  }
}

/**
 * Monthly planning-year allowable PTC. The SLCSP determines the preliminary
 * credit; actual enrollment premium caps the allowable credit. The annual
 * expected contribution is MAGI times the applicable percentage read at the
 * whole-number poverty-line percentage and rounded to a hundredth of a
 * percent (`acaWholeFplPct`, `acaApplicablePct`), and it is applied month by
 * month as one twelfth against each month's benchmark premium: `min(enrollment,
 * max(0, benchmark − contribution / 12))`, summed over the months with
 * enrollment. The contribution and the credit are kept to the cent and beyond:
 * Form 8962 rounds its lines 8a and 8b to whole dollars, which the engine does
 * not (a stated limit on the calculation records).
 */
export function acaEconomicPremiumByMonth(
  pack: AcaPricingParameters,
  householdSize: number,
  magi: number,
  enrollmentPremiums: readonly number[],
  slcspBenchmarkPremiums: readonly number[],
  region: AcaFplRegion = 'contiguous',
  fplScale = 1,
): AcaResult {
  const grossEnrollmentPremium = enrollmentPremiums.reduce((sum, premium) => sum + Math.max(0, premium), 0)
  const applicableSlcspPremium = slcspBenchmarkPremiums.reduce(
    (sum, premium, month) =>
      sum + (Math.max(0, enrollmentPremiums[month] ?? 0) > 0 ? Math.max(0, premium) : 0),
    0,
  )
  const fpl = acaFederalPovertyLine(pack, householdSize, region, fplScale)
  const fplPct = fpl > 0 ? (magi / fpl) * 100 : Infinity
  const overCliff = fplPct > pack.aca.maxFplPctForCredit
  const belowEligibilityFloor = fplPct < pack.aca.minFplPctForCredit

  if (overCliff || belowEligibilityFloor || grossEnrollmentPremium <= 0 || applicableSlcspPremium <= 0) {
    return noCreditResult(
      fplPct,
      grossEnrollmentPremium,
      applicableSlcspPremium,
      overCliff,
      belowEligibilityFloor,
    )
  }

  const expectedContribution = (acaApplicablePct(pack, acaWholeFplPct(fplPct)) / 100) * magi
  let modeledAllowablePtc = 0
  for (let month = 0; month < 12; month++) {
    const enrollment = Math.max(0, enrollmentPremiums[month] ?? 0)
    const benchmark = Math.max(0, slcspBenchmarkPremiums[month] ?? 0)
    if (enrollment <= 0 || benchmark <= 0) continue
    modeledAllowablePtc += Math.min(enrollment, Math.max(0, benchmark - expectedContribution / 12))
  }
  const economicNetPremium = grossEnrollmentPremium - modeledAllowablePtc
  return {
    fplPct,
    expectedContribution,
    credit: modeledAllowablePtc,
    netAnnualPremium: economicNetPremium,
    grossEnrollmentPremium,
    applicableSlcspPremium,
    modeledAllowablePtc,
    economicNetPremium,
    overCliff,
    belowEligibilityFloor,
  }
}

/** Backward-compatible annual helper: enrollment premium is also the benchmark. */
export function acaNetAnnualPremium(
  pack: AcaPricingParameters,
  householdSize: number,
  magi: number,
  fullAnnualPremium: number,
  fplScale = 1,
): AcaResult {
  const monthly = new Array<number>(12).fill(fullAnnualPremium / 12)
  return acaEconomicPremiumByMonth(pack, householdSize, magi, monthly, monthly, 'contiguous', fplScale)
}

/** Backward-compatible monthly helper: enrollment premium is also the benchmark. */
export function acaNetAnnualPremiumByMonth(
  pack: AcaPricingParameters,
  householdSize: number,
  magi: number,
  monthlyPremiums: readonly number[],
  fplScale = 1,
): AcaResult {
  return acaEconomicPremiumByMonth(
    pack,
    householdSize,
    magi,
    monthlyPremiums,
    monthlyPremiums,
    'contiguous',
    fplScale,
  )
}
