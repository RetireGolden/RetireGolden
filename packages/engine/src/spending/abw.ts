/**
 * Amortization-based withdrawal (ABW) — spending-paths & SWR-lenses plan, Goal 2.
 *
 * The rule the Bogleheads wiki formalized and that VPW, TPAW, and CAPE-based
 * rules are parameterizations of: every year, re-amortize the *actual*
 * start-of-year portfolio over the remaining horizon at an expected return,
 * and spend this year's payment. Because the payment is recomputed from the
 * real balance annually, the rule self-corrects after market surprises and —
 * by the amortization identity — depletes exactly at the horizon when realized
 * returns equal expected returns.
 *
 * Timing convention matches the ledger (simulate.ts): expenses are funded from
 * the start-of-year balance and growth applies to what remains at year end —
 * an annuity-due. With payments planned to grow at a real tilt g and an
 * expected real return r, the payment ratio x = (1+g)/(1+r) is the same in
 * real and nominal terms (inflation cancels), so the payment can be computed
 * directly on the nominal start-of-year balance:
 *
 *   payment = balance × (1 − x) / (1 − x^n)   (x ≠ 1), or balance / n (x = 1)
 *
 * where n is the remaining years including the current one. n = 1 spends the
 * whole remaining balance — the exact-depletion terminal case.
 *
 * These functions are pure; the ledger owns per-year state and funds the
 * payment through the same tax/withdrawal cascade as every other expense.
 */

import type { AbwPolicy } from '../model/plan.js'

/** Defaults documented in DOCS/domain/domain-rules-reference.md §14 ("Spending paths & SWR lenses"). */
export const ABW_DEFAULTS = {
  /**
   * VPW-style fixed expected real return: the Bogleheads VPW table's global
   * internal rates of return (stocks 5.0%/yr real, bonds 1.9%/yr real)
   * weighted 60/40 ⇒ 3.8%/yr real.
   */
  fixedRealReturnPct: 3.8,
  /** Matches the CAPE-conditioned market model's default starting CAPE. */
  startingCape: 25,
  equitySharePct: 60,
  /** Long-run TIPS real yield near the mid-2026 curve (~2%/yr real). */
  bondRealYieldPct: 2.0,
  tiltPct: 0,
  horizon: 'planningAge' as const,
}

/**
 * Expected real return %/yr implied by the policy's return source:
 * fixed as entered; CAPE = 100/CAPE (the cyclically-adjusted earnings yield)
 * blended with the bond real yield at the equity share; TIPS = the bond real
 * yield alone.
 */
export function abwExpectedRealReturnPct(abw: AbwPolicy | undefined): number {
  const source = abw?.returnSource ?? 'fixed'
  const bond = abw?.bondRealYieldPct ?? ABW_DEFAULTS.bondRealYieldPct
  if (source === 'tips') return bond
  if (source === 'cape') {
    const cape = abw?.startingCape ?? ABW_DEFAULTS.startingCape
    const equityShare = (abw?.equitySharePct ?? ABW_DEFAULTS.equitySharePct) / 100
    const caey = 100 / cape
    return caey * equityShare + bond * (1 - equityShare)
  }
  return abw?.fixedRealReturnPct ?? ABW_DEFAULTS.fixedRealReturnPct
}

/**
 * This year's amortized payment from a start-of-year balance over
 * `remainingYears` (current year inclusive) at `realReturnPct` expected real
 * return, with payments planned to grow `tiltPct`%/yr real. Balance ≤ 0 or a
 * non-finite input pays 0; remainingYears ≤ 1 pays the whole balance.
 */
export function abwAnnualPayment(
  balance: number,
  realReturnPct: number,
  tiltPct: number,
  remainingYears: number,
): number {
  if (!Number.isFinite(balance) || balance <= 0) return 0
  const n = Math.floor(remainingYears)
  if (n <= 1) return balance
  const x = (1 + tiltPct / 100) / (1 + realReturnPct / 100)
  if (!Number.isFinite(x) || x <= 0) return balance / n
  if (Math.abs(x - 1) < 1e-9) return balance / n
  return (balance * (1 - x)) / (1 - Math.pow(x, n))
}
