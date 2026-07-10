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
 * Planning-grade simplifications (documented in domain rules §15):
 * - The nontaxable fraction uses basis ÷ (aggregate balance measured just
 *   before the year's distributions), which equals the 8606 method (year-end
 *   balance + distributions) when growth is credited after distributions —
 *   exactly the ledger's year ordering.
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
