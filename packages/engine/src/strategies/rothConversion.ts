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
 * Threshold scaling matches the projection's expense model: IRMAA thresholds
 * and the FPL index at general inflation beyond the published pack; bracket
 * bounds stay at the latest pack's nominal values (as the tax engine itself
 * does for stand-in years).
 */

import type { Plan } from '../model/plan.js'
import type { FilingStatus, ParameterPack } from '../params/types.js'
import type { TaxYearInput } from '../projection/types.js'
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
  /** Scale applied to IRMAA thresholds / FPL for years beyond the pack. */
  inflationScale: number
  /** Itemized deductions (nominal) so bracket/MAGI targets use the right deduction. */
  itemizedDeductions?: TaxYearInput['itemizedDeductions']
}

export type SizingResult =
  | { ok: true; amount: number }
  | { ok: false; reason: 'bad_target' | 'already_over_ceiling' }

function metricFor(target: FillTarget['target'], detail: FederalTaxDetail): number {
  return target === 'topOfBracket' ? detail.taxableIncome : detail.magi
}

function ceilingFor(strategy: FillTarget, input: ConversionSizingInput): number | null {
  const { pack, filingStatus } = input
  switch (strategy.target) {
    case 'topOfBracket': {
      const brackets = pack.federalTax.brackets[filingStatus]
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
      const fpl =
        pack.federalPovertyLine.firstPerson +
        pack.federalPovertyLine.perAdditionalPerson * Math.max(0, input.householdSize - 1)
      return fpl * input.inflationScale * (pack.aca.maxFplPctForCredit / 100)
    }
    case 'fixedMagi':
      return strategy.targetValue !== null && strategy.targetValue > 0 ? strategy.targetValue : null
  }
}

/** Largest conversion keeping the strategy's metric at or under its ceiling. */
export function sizeRothConversion(strategy: FillTarget, input: ConversionSizingInput): SizingResult {
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
        ssBenefits: input.ssBenefits,
        peopleAged65Plus: input.peopleAged65Plus,
        itemizedDeductions: input.itemizedDeductions,
      }),
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
