/**
 * Medicare premiums with IRMAA, per person 65+.
 *
 * IRMAA brackets are cliffs determined by MAGI from two years prior. Beyond
 * the latest parameter pack, premiums are indexed at the healthcare inflation
 * rate and bracket thresholds at general inflation (both are statutorily
 * indexed; this is the projection's stand-in). The thresholds take a premium
 * year rather than a bare scale factor because the top row is indexed from a
 * different base year than the rows beneath it -- see `irmaaTierThreshold`.
 *
 * @see DOCS/domain/domain-rules-reference.md §7
 */

import { irmaaTierForMagi, type IrmaaThresholdYear } from '../params/index.js'
import type { FilingStatus, ParameterPack } from '../params/types.js'

export interface MedicarePremiumResult {
  partBAnnual: number
  partDSurchargeAnnual: number
  /** Annual Part B + Part D amount above the standard Part B premium. */
  irmaaSurchargeAnnual: number
  /** 0 = standard premium; 1–5 = IRMAA tier. */
  irmaaTier: number
  /** True when an IRMAA tier with an unverified Part D surcharge was hit. */
  partDSurchargeUnverified: boolean
}

export function medicareAnnualPremiumPerPerson(
  pack: ParameterPack,
  magiTwoYearsPrior: number,
  filingStatus: FilingStatus,
  at?: IrmaaThresholdYear,
  premiumScale = 1,
): MedicarePremiumResult {
  const tier = irmaaTierForMagi(pack, magiTwoYearsPrior, filingStatus, at)

  const base = pack.medicare.partBStandardMonthly
  let partDSurchargeMonthly = 0
  let partDSurchargeUnverified = false
  let partBTotalMonthly = base
  if (tier > 0) {
    const t = pack.medicare.irmaaTiers[tier - 1]!
    partBTotalMonthly = t.partBTotalMonthly
    if (t.partDSurchargeMonthly === null) {
      partDSurchargeUnverified = true
    } else {
      partDSurchargeMonthly = t.partDSurchargeMonthly
    }
  }
  // CMS's published tier total; a projected year grows it as it grows the standard premium.
  const partBMonthly = partBTotalMonthly * premiumScale

  return {
    partBAnnual: partBMonthly * 12,
    partDSurchargeAnnual: partDSurchargeMonthly * 12 * premiumScale,
    irmaaSurchargeAnnual:
      Math.max(0, partBMonthly - base * premiumScale) * 12 +
      partDSurchargeMonthly * 12 * premiumScale,
    irmaaTier: tier,
    partDSurchargeUnverified,
  }
}
