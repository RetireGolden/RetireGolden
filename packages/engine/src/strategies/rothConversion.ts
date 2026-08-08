/**
 * Roth-conversion sizing (roadmap V3).
 *
 * Fill-to-target strategies size each year's conversion so a chosen metric
 * lands on a ceiling:
 *   - topOfBracket: federal taxable income fills the chosen rate bracket
 *   - irmaaTier:    MAGI stays just under a chosen IRMAA tier threshold
 *   - acaCliff:     MAGI stays just under 400% FPL (pre-65 credit cliff)
 *   - fixedMagi:    MAGI lands on a user-set nominal ceiling
 *
 * Sizing is solved by bisection against the federal tax engine, because the
 * metrics are monotone in the conversion amount but kinked (taxable Social
 * Security phases in at up to 1.85× per converted dollar). The sizing model
 * is always the federal engine, regardless of which TaxCalculator the
 * projection runs — strategies target federal-law boundaries by definition.
 *
 * Threshold scaling matches the projection: IRMAA thresholds, the FPL, and the
 * federal rate-bracket bounds all index at general inflation beyond the
 * published pack, because each is adjusted annually by statute and the metric
 * being compared against them is nominal. A `fixedMagi` ceiling is the user's
 * own nominal number and is left exactly as entered.
 */

import type { Plan } from '../model/plan.js'
import type { FilingStatus, ParameterPack } from '../params/types.js'
import type { TaxYearInput } from '../projection/types.js'
import { indexFederalTaxPack } from '../params/index.js'
import { acaFederalPovertyLine, type AcaFplRegion } from '../tax/aca.js'
import { computeFederalTax, type FederalTaxDetail } from '../tax/federalTax.js'

export type FillTarget = Extract<Plan['strategies']['rothConversion'], { mode: 'fillToTarget' }>

export interface ConversionSizingInput {
  year: number
  pack: ParameterPack
  filingStatus: FilingStatus
  /** Ordinary income before any conversion (wages − pre-tax contributions + RMD − QCD + pensions etc.). */
  ordinaryIncomeBase: number
  /** Capital gains known before withdrawals (one-time events). */
  capitalGains: number
  /** Qualified dividends known before withdrawals; included in MAGI and preferential stacking. */
  qualifiedDividends?: number
  ssBenefits: number
  peopleAged65Plus: number
  /** Living household size (FPL). */
  householdSize: number
  /** Characterized tax-exempt interest for IRMAA/fixed-MAGI sizing; ACA-independent. */
  taxExemptInterest?: number
  /** Required for ACA-cliff sizing; absent/non-actionable fails closed. */
  aca?: {
    actionable: boolean
    taxFamilySize: number
    fplRegion: AcaFplRegion
    /** Foreign exclusion + required-filer dependent MAGI, added once to the ACA metric. */
    fixedMagiAddbacks: number
    taxExemptInterest: number
    /** Foreign exclusion also participates in §86 provisional income without becoming ordinary income. */
    foreignExclusionAddback: number
  }
  /** Scale applied to IRMAA thresholds, the FPL, and the indexed federal tax figures for years beyond the pack. */
  inflationScale: number
  /** Itemized deductions (nominal) so bracket/MAGI targets use the right deduction. */
  itemizedDeductions?: TaxYearInput['itemizedDeductions']
}

export type SizingResult =
  | { ok: true; amount: number }
  | { ok: false; reason: 'bad_target' | 'already_over_ceiling' | 'aca_nonactionable' }

function characterizedTaxExemptInterest(input: ConversionSizingInput): number {
  return input.taxExemptInterest ?? input.aca?.taxExemptInterest ?? 0
}

function metricFor(target: FillTarget['target'], detail: FederalTaxDetail, input: ConversionSizingInput): number {
  const taxExemptInterest = characterizedTaxExemptInterest(input)
  if (target === 'topOfBracket') return detail.taxableIncome
  if (target === 'acaCliff') {
    return (
      detail.agiBeforeFloor +
      Math.max(0, input.ssBenefits - detail.taxableSocialSecurity) +
      taxExemptInterest +
      (input.aca?.fixedMagiAddbacks ?? 0)
    )
  }
  // Match the projection's realized MAGI history used for IRMAA lookback and
  // fixed-MAGI reporting: signed pre-floor AGI plus characterized tax-exempt
  // interest, floored only after the addition. Foreign-exclusion addback can
  // affect taxable Social Security, but is not itself part of this metric.
  return Math.max(0, detail.agiBeforeFloor + taxExemptInterest)
}

function ceilingFor(strategy: FillTarget, input: ConversionSizingInput): number | null {
  const { pack, filingStatus } = input
  switch (strategy.target) {
    case 'topOfBracket': {
      // The ceiling is compared against nominal taxable income, so it has to be
      // the bracket bound as the tax engine will apply it in `input.year`.
      const brackets = indexFederalTaxPack(pack, input.inflationScale).federalTax.brackets[filingStatus]
      const i = brackets.findIndex((b) => b.ratePct === strategy.targetValue)
      if (i < 0 || i + 1 >= brackets.length) return null // unknown rate or open-ended top bracket
      return brackets[i + 1]!.lowerBound
    }
    case 'irmaaTier': {
      const tier = strategy.targetValue
      if (tier === null || !Number.isInteger(tier) || tier < 1 || tier > pack.medicare.irmaaTiers.length) return null
      return pack.medicare.irmaaTiers[tier - 1]!.magiOver[filingStatus] * input.inflationScale
    }
    case 'acaCliff': {
      if (!input.aca?.actionable) return null
      const fpl = acaFederalPovertyLine(
        pack,
        input.aca.taxFamilySize,
        input.aca.fplRegion,
        input.inflationScale,
      )
      return fpl * (pack.aca.maxFplPctForCredit / 100)
    }
    case 'fixedMagi':
      return strategy.targetValue !== null && strategy.targetValue > 0 ? strategy.targetValue : null
  }
}

/** Largest conversion keeping the strategy's metric at or under its ceiling. */
export function sizeRothConversion(strategy: FillTarget, input: ConversionSizingInput): SizingResult {
  if (strategy.target === 'acaCliff' && !input.aca?.actionable) {
    return { ok: false, reason: 'aca_nonactionable' }
  }
  const ceiling = ceilingFor(strategy, input)
  if (ceiling === null) return { ok: false, reason: 'bad_target' }

  const metricAt = (conversion: number) =>
    metricFor(
      strategy.target,
      computeFederalTax({
        year: input.year,
        filingStatus: input.filingStatus,
        ordinaryIncome: input.ordinaryIncomeBase + conversion,
        capitalGains: input.capitalGains,
        qualifiedDividends: input.qualifiedDividends ?? 0,
        taxExemptInterest: characterizedTaxExemptInterest(input),
        foreignExclusionAddback: input.aca?.foreignExclusionAddback,
        ssBenefits: input.ssBenefits,
        peopleAged65Plus: input.peopleAged65Plus,
        itemizedDeductions: input.itemizedDeductions,
        inflationScale: input.inflationScale,
      }),
      input,
    )

  const base = metricAt(0)
  if (base >= ceiling) return { ok: false, reason: 'already_over_ceiling' }

  // Taxable income can rise $0 per converted dollar until deductions are
  // consumed, so expand the upper bound until it brackets the ceiling.
  let lo = 0
  let hi = Math.max(ceiling - base, 1_000)
  for (let i = 0; i < 30 && metricAt(hi) <= ceiling; i++) hi *= 2
  for (let i = 0; i < 60 && hi - lo > 0.01; i++) {
    const mid = (lo + hi) / 2
    if (metricAt(mid) > ceiling) hi = mid
    else lo = mid
  }
  return { ok: true, amount: lo }
}
