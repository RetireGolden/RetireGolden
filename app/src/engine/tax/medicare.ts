/**
 * Medicare premiums with IRMAA, per person 65+.
 *
 * IRMAA brackets are cliffs determined by MAGI from two years prior. Beyond
 * the latest parameter pack, premiums are indexed at the healthcare inflation
 * rate and bracket thresholds at general inflation (both are statutorily
 * indexed; this is the projection's stand-in).
 *
 * @see DOCS/domain/domain-rules-reference.md §7
 */

import { irmaaTierForMagi } from '../params'
import type { FilingStatus, ParameterPack } from '../params/types'

export interface MedicarePremiumResult {
  partBAnnual: number
  partDSurchargeAnnual: number
  /** 0 = standard premium; 1–5 = IRMAA tier. */
  irmaaTier: number
  /** True when an IRMAA tier with an unverified Part D surcharge was hit. */
  partDSurchargeUnverified: boolean
}

export function medicareAnnualPremiumPerPerson(
  pack: ParameterPack,
  magiTwoYearsPrior: number,
  filingStatus: FilingStatus,
  thresholdScale = 1,
  premiumScale = 1,
): MedicarePremiumResult {
  const tier = irmaaTierForMagi(pack, magiTwoYearsPrior, filingStatus, thresholdScale)

  const base = pack.medicare.partBStandardMonthly
  let partDSurchargeMonthly = 0
  let partDSurchargeUnverified = false
  let applicablePct = 25
  if (tier > 0) {
    const t = pack.medicare.irmaaTiers[tier - 1]!
    applicablePct = t.applicablePct
    if (t.partDSurchargeMonthly === null) {
      partDSurchargeUnverified = true
    } else {
      partDSurchargeMonthly = t.partDSurchargeMonthly
    }
  }
  // Standard premium is 25% of program cost; IRMAA tiers pay a larger share.
  const partBMonthly = base * (applicablePct / 25) * premiumScale

  return {
    partBAnnual: partBMonthly * 12,
    partDSurchargeAnnual: partDSurchargeMonthly * 12 * premiumScale,
    irmaaTier: tier,
    partDSurchargeUnverified,
  }
}
