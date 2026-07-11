import type { TaxCalculator, TaxYearInput } from './types.js'

/**
 * V1 placeholder: one flat effective rate over all income, with 85% of Social
 * Security included (the statutory maximum taxable share). Replaced by the
 * real federal engine in roadmap phase V2 — do not add precision here.
 */
export function createFlatTaxCalculator(effectiveRatePct: number): TaxCalculator {
  const rate = effectiveRatePct / 100
  return {
    compute(input: TaxYearInput): number {
      const base = input.ordinaryIncome + input.capitalGains + (input.qualifiedDividends ?? 0) + 0.85 * input.ssBenefits
      return Math.max(0, base * rate)
    },
  }
}
