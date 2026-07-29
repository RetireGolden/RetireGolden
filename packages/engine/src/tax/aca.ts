/**
 * ACA planning-year premium-tax-credit math.
 *
 * This module models current-year allowable PTC and the household's economic
 * net premium. It does not model APTC cash timing, refunds/balances due, or a
 * filing-grade Form 8962 reconciliation.
 *
 * @see DOCS/domain/domain-rules-reference.md §8
 */

import type { ParameterPack } from '../params/types.js'

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
    federalAgi: Math.max(0, input.federalAgi),
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
      ? components.federalAgi +
        components.nontaxableSocialSecurity +
        components.taxExemptInterest +
        components.foreignExclusionAddback +
        components.requiredFilerDependentMagi
      : null,
    blockers: [...new Set(blockers)],
    components,
    dependents,
  }
}

/** HHS 2025 poverty guidelines used for 2026 Marketplace coverage. */
const HHS_2025_FPL: Record<AcaFplRegion, { firstPerson: number; perAdditionalPerson: number }> = {
  contiguous: { firstPerson: 15_650, perAdditionalPerson: 5_500 },
  alaska: { firstPerson: 19_550, perAdditionalPerson: 6_880 },
  hawaii: { firstPerson: 17_990, perAdditionalPerson: 6_330 },
}

export function acaFederalPovertyLine(
  pack: ParameterPack,
  householdSize: number,
  region: AcaFplRegion = 'contiguous',
  fplScale = 1,
): number {
  const table =
    region === 'contiguous'
      ? pack.federalPovertyLine
      : HHS_2025_FPL[region]
  return (
    (table.firstPerson + table.perAdditionalPerson * Math.max(0, householdSize - 1)) *
    fplScale
  )
}

/** Piecewise-linear applicable percentage with the statutory step at 133%. */
export function acaApplicablePct(pack: ParameterPack, fplPct: number): number {
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
 * credit; actual enrollment premium caps the allowable credit.
 */
export function acaEconomicPremiumByMonth(
  pack: ParameterPack,
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

  const expectedContribution = (acaApplicablePct(pack, fplPct) / 100) * magi
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
  pack: ParameterPack,
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
  pack: ParameterPack,
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
