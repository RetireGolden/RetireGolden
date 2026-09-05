/**
 * Terminal HSA income-tax exposure for the after-tax estate metric.
 *
 * Spouse-designated continuation under IRC 223(f)(8)(A) is a zero inclusion.
 * Any other modeled destination uses the ending gross balance as the inclusion
 * base — the same arithmetic previously inlined in compare.ts. This is assumed
 * terminal exposure at the horizon, not an annual tax computation, and it does
 * not apply the 223(f)(8)(B)(ii)(I) predeath-expense reduction.
 */
import type { EstateBeneficiary } from '../model/plan.js'

export function estateHsaIncomeBase(
  grossBalance: number,
  destination: EstateBeneficiary['destination'],
): number {
  return destination === 'spouse' ? 0 : grossBalance
}
