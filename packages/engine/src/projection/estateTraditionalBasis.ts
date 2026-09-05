/**
 * Traditional-account taxable pretax base for the after-tax estate metric.
 *
 * Remaining household nondeductible IRA basis is allocated by gross across
 * every traditional balance. Grouping matches the former inline compare.ts
 * arithmetic. The allocation is a disclosed approximation of assumed future
 * income-tax exposure, not a death-year Form 8606.
 */
export function estateTraditionalTaxableBase(
  grossBalance: number,
  endingTraditionalBalance: number,
  endingNondeductibleIraBasis: number,
): number {
  const basisTotal = Math.min(endingNondeductibleIraBasis, endingTraditionalBalance)
  const allocatedBasis = endingTraditionalBalance > 0 ? basisTotal * (grossBalance / endingTraditionalBalance) : 0
  return Math.max(0, grossBalance - allocatedBasis)
}
