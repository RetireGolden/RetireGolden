/**
 * Nondeductible traditional-IRA basis and the Form 8606 pro-rata rule
 * (account/HSA/fixed-asset depth plan, step 5).
 *
 * When an owner's traditional IRAs hold after-tax (nondeductible) basis, every
 * distribution and Roth conversion from ANY of that owner's IRAs is part
 * basis, part pre-tax — in the ratio of total basis to the total aggregated
 * IRA balance. The taxpayer cannot choose to distribute "just the basis"
 * (IRS Form 8606, line 6 aggregation; IRC §408(d)(2)).
 *
 * THIS MODULE IS THE FALLBACK, not the engine's only pro-rata measure, and an
 * earlier version of this note left that out. The owned-non-Roth-IRA annual
 * settlement prices the year wherever it can, off the December 31 pool balance
 * plus lines 7 and 8 (`actions/ownedNonRothIraWithdrawalCharacter.ts`, fed the
 * post-growth balances by `internal/ownedNonRothIraRuntimeSourceSeries.ts`), and
 * the attempt driver re-runs the whole annual pass until the characters it
 * assumed are the ones the run produced. What is below governs only a year the
 * settlement published nothing usable for.
 *
 * Planning-grade simplifications (documented in domain rules §15):
 * - The nontaxable fraction uses basis ÷ (aggregate balance measured just
 *   before the year's distributions). THAT IS NOT THE FORM 8606 DENOMINATOR,
 *   and an earlier version of this note claimed it was. Because the ledger
 *   credits growth after distributions, the pre-distribution balance equals
 *   year-end-BEFORE-growth plus the year's distributions — where line 9 is
 *   line 6 plus distributions, and line 6 is the December 31 value AFTER a
 *   year of return on whatever the account retained. §408(d)(2)(C) fixes the
 *   §72 contract value at the close of the calendar year for exactly that
 *   reason. The two measures agree only in a flat year; they differ by the
 *   growth on the retained balance, so THIS module's denominator is invariant
 *   to the return assumption and the statute's is not — a departure of the
 *   fallback, not of the engine. Registered as
 *   `irc-408-d-2-C-projection-pro-rata-measurement-instant`, with a produced
 *   fixture pinning the fallback's invariance and a second suite pinning that
 *   the settled path does move with the return.
 * - Employer plans are excluded from the aggregation (only IRAs aggregate),
 *   and inherited IRAs are excluded (a beneficiary files a separate 8606).
 * - Basis is entered in dollars and never indexed (basis is historical cost).
 */

export interface IraProRataYear {
  /** Remaining nondeductible basis in the owner's aggregated IRAs. */
  basis: number
  /**
   * Nontaxable fraction applied to this year's IRA distributions/conversions:
   * basis ÷ aggregate pre-distribution IRA balance, in [0, 1].
   */
  nontaxableFraction: number
}

/**
 * Fix the year's pro-rata fraction from the owner's aggregated pre-distribution
 * IRA balance. Zero balance with positive basis returns fraction 1 (everything
 * distributed is basis — the balance IS the basis or less, after losses).
 */
export function openIraProRataYear(basis: number, aggregateIraBalance: number): IraProRataYear {
  if (basis <= 0) return { basis: Math.max(0, basis), nontaxableFraction: 0 }
  if (aggregateIraBalance <= 0) return { basis, nontaxableFraction: 1 }
  return { basis, nontaxableFraction: Math.min(1, basis / aggregateIraBalance) }
}

export interface IraDistributionSplit {
  /** Portion of the distribution that is return of basis (not taxed). */
  nontaxable: number
  /** Portion taxed as ordinary income. */
  taxable: number
  /** Year state after the distribution (basis depleted by the nontaxable part). */
  next: IraProRataYear
}

/**
 * Split one distribution (or Roth conversion) from the owner's aggregated IRAs
 * under the year's fixed pro-rata fraction. Nontaxable is capped at the
 * remaining basis so repeated draws can never recover more basis than exists.
 */
export function splitIraDistribution(state: IraProRataYear, amount: number): IraDistributionSplit {
  if (amount <= 0) return { nontaxable: 0, taxable: 0, next: state }
  const nontaxable = Math.min(state.basis, amount * state.nontaxableFraction)
  return {
    nontaxable,
    taxable: amount - nontaxable,
    next: { basis: state.basis - nontaxable, nontaxableFraction: state.nontaxableFraction },
  }
}
