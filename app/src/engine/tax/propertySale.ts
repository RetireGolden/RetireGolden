/**
 * Fixed-asset (property) disposition tax treatment (account/HSA/fixed-asset
 * depth plan, step 6).
 *
 * With a cost basis on the property account, a sale is priced exactly instead
 * of via the legacy tax-free `expectedNetProceeds` estimate:
 *
 *   amount realized = sale price − selling costs
 *   gain            = amount realized − adjusted basis
 *   ordinary part   = min(gain, depreciation recapture)   (never excludable)
 *   capital part    = gain − ordinary part − §121 exclusion (primary residence)
 *
 * §121 exclusion: $250k single / $500k joint (parameter pack; statutory and
 * never indexed — IRS Topic 701 / Pub 523). Depreciation attributable to
 * post-May-1997 business use cannot be excluded under §121 and is recaptured
 * as ordinary income (planning-grade stand-in for the §1250 25% cap). A loss
 * on personal-use property is nondeductible, so gain floors at zero.
 */

import type { ParameterPack, FilingStatus } from '../params/types'

export interface PropertySaleInput {
  /** Projected market value in the sale year (nominal dollars). */
  salePrice: number
  /** Adjusted cost basis (purchase + improvements, historical dollars). */
  costBasis: number
  /** Selling costs as a percent of the sale price (commissions, closing). */
  sellingCostPct?: number
  /** Primary residence: apply the §121 exclusion to the capital gain. */
  primaryResidence?: boolean
  /** Accumulated depreciation recaptured as ordinary income (≤ gain). */
  depreciationRecapture?: number
  filingStatus: FilingStatus
  pack: ParameterPack
}

export interface PropertySaleResult {
  /** Cash entering the portfolio: sale price − selling costs (taxes ride the normal flow). */
  netProceeds: number
  /** Gain taxed as ordinary income (depreciation recapture). */
  ordinaryGain: number
  /** Gain taxed as long-term capital gain, after any §121 exclusion. */
  capitalGain: number
  /** Gain shielded by the §121 exclusion. */
  excludedGain: number
  /** Selling costs deducted from the amount realized. */
  sellingCosts: number
}

export function propertySaleTax(input: PropertySaleInput): PropertySaleResult {
  const sellingCosts = Math.max(0, input.salePrice) * (Math.max(0, input.sellingCostPct ?? 0) / 100)
  const amountRealized = Math.max(0, input.salePrice) - sellingCosts
  // Personal-use losses are nondeductible; gain floors at zero.
  const gain = Math.max(0, amountRealized - Math.max(0, input.costBasis))
  const ordinaryGain = Math.min(gain, Math.max(0, input.depreciationRecapture ?? 0))
  const gainAfterRecapture = gain - ordinaryGain
  const exclusionCap = input.primaryResidence ? input.pack.federalTax.section121Exclusion[input.filingStatus] : 0
  const excludedGain = Math.min(gainAfterRecapture, exclusionCap)
  return {
    netProceeds: amountRealized,
    ordinaryGain,
    capitalGain: gainAfterRecapture - excludedGain,
    excludedGain,
    sellingCosts,
  }
}
