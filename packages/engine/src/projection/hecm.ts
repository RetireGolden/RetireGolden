/**
 * HECM MIP accrual helpers for HUD-validated lines.
 *
 * Opening MCA / principal limit / initial MIP live in `hecmHudValidated.ts`.
 * This module owns the distinct annual MIP component on outstanding balance
 * so it is not confused with legacy `upfrontCostPct` quote estimates.
 *
 * Monthly MIP is priced only from a caller-supplied outstanding-balance
 * sequence. The simple annual helper is a disclosed starting-balance figure
 * only — shared annual property/loan wiring remains outside this leaf.
 */
import {
  hecmAnnualMipOnOutstandingBalance,
  type HecmCaseYearLimits,
  type HecmSimpleAnnualMipResult,
} from './hecmHudValidated.js'

export {
  computeHecmHudValidatedOpening,
  hecmAnnualMipOnOutstandingBalance,
  hecmCaseYearLimitsFromPack,
  priceHecmMonthlyMipFromOutstandingBalances,
  type HecmCalculationMode,
  type HecmCaseYearLimits,
  type HecmHudValidatedOpeningInput,
  type HecmHudValidatedOpeningResult,
  type HecmMonthlyOutstandingBalanceMipInput,
  type HecmMonthlyOutstandingBalanceMipResult,
  type HecmSimpleAnnualMipResult,
} from './hecmHudValidated.js'

export interface HecmAnnualMipAccrualInput {
  readonly outstandingLoanBalance: number
  readonly annualMipRate: number
}

/**
 * Simple annual MIP dollars on the outstanding balance before monthly timing /
 * capitalization conventions. Use the ledger-supplied monthly balance helper
 * when pricing monthly assessments.
 */
export function accrueHecmAnnualMip(
  input: Readonly<HecmAnnualMipAccrualInput>,
): HecmSimpleAnnualMipResult {
  return hecmAnnualMipOnOutstandingBalance(
    input.outstandingLoanBalance,
    input.annualMipRate,
  )
}

export function hecmAnnualMipRateFromCaseLimits(
  limits: Readonly<HecmCaseYearLimits>,
): number {
  return limits.annualMipRate
}
