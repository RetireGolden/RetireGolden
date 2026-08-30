import type { TaxCalculator, TaxYearInput } from '../projection/types.js'

/**
 * Deterministic flat-rate tax double for test fixtures: one effective rate
 * applied to ordinary income, capital gains, qualified dividends, and 85% of
 * Social Security benefits.
 *
 * This is not a tax model and is not the shipped calculator. Production
 * composes createFederalTaxCalculator() with createStateTaxCalculator()
 * through combineTaxCalculators(); only test suites inject this one. The 85%
 * share is the statutory maximum inclusion under IRC 86, applied
 * unconditionally rather than computed from the provisional-income test — so
 * this double must never be used as an oracle for tax correctness.
 *
 * Keep the arithmetic exactly as it is. Its value is that a fixture can assert
 * an exact dollar without recomputing federal law; adding precision would
 * churn every fixture that depends on it and still would not be statute.
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
