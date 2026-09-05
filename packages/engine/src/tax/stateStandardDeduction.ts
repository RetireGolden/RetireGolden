/**
 * Pure helpers for state standard-deduction mechanics that sit outside the
 * generic bracket stack in `stateTax.ts`.
 */

/**
 * Apply a proportional standard-deduction phase-out to a raw total deduction.
 *
 * Statute form: allowed = total − total × min(1, max(0, (income − start) / range)).
 * Callers supply published positive `start` and `range`; this helper does not
 * invent law for invalid parameters.
 */
export function phaseOutStandardDeduction(
  totalStandardDeduction: number,
  annualIncome: number,
  start: number,
  range: number,
): number {
  const fraction = Math.min(1, Math.max(0, (annualIncome - start) / range))
  return totalStandardDeduction - totalStandardDeduction * fraction
}
