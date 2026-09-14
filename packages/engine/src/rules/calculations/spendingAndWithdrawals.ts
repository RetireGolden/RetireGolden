/**
 * Spending-and-withdrawals calculation records.
 *
 * One slice of the calculation registry. `../calculationRegistry.ts` composes
 * every slice into `CALCULATION_REGISTRY`; read it for what a record must carry.
 */
import type { CalculationRecord } from '../calculationRegistry.js'

export const spendingAndWithdrawalsRecords = {
  'abw-annuity-due-payment': {
    title: 'Amortization-based withdrawal, growing annuity-due payment',
    purpose: 'This year\'s ABW payment from a start-of-year balance over the remaining horizon.',
    kind: 'formula',
    // annualLifestyleLayers supplies the ABW payment as baseAnnualNominal;
    // annualExpenseSummary then publishes that amount as
    // YearResult.expenses.baseSpending. It is not the solver's independent
    // sustainable-spending result, nor the broader targetSpending total that
    // also includes system costs and goals.
    outputs: ['spending-base-annual'],
    statement:
      'Given a start-of-year balance B, expected return r, planned payment growth g, and remaining years n including the current year, the beginning-of-period payment is P = B(1−x)/(1−x^n) where x = (1+g)/(1+r), or P = B/n when x = 1. Payments are withdrawn before growth. Domain: finite B > 0 and n ≥ 1; n ≤ 1 spends the whole balance. Rounding: none — the production function returns a binary float.',
    formula: {
      expression: 'P = B(1-x)/(1-x^n), x=(1+g)/(1+r); P=B/n when x=1',
      variables: [
        { symbol: 'P', meaning: 'This year\'s beginning-of-period payment', unit: 'usd', domain: 'P ≥ 0' },
        { symbol: 'B', meaning: 'Start-of-year portfolio balance', unit: 'usd', domain: 'B > 0 and finite' },
        { symbol: 'r', meaning: 'Expected return over the period', unit: '1', domain: 'r > -1 so that 1+r ≠ 0' },
        { symbol: 'g', meaning: 'Planned payment growth over the period', unit: '1', domain: 'g > -1 so that 1+g ≠ 0' },
        { symbol: 'n', meaning: 'Remaining periods including the current one', unit: 'count', domain: 'integer n ≥ 1' },
        { symbol: 'x', meaning: 'Payment-growth ratio (1+g)/(1+r)', unit: '1', domain: 'x > 0' },
      ],
      timing: 'beginning of period, annual',
      rounding: 'none',
    },
    justification: {
      kind: 'derivation',
      worksheet: 'DOCS/calculations/spending-and-withdrawals/abw-annuity-due-payment.md',
    },
    limits: ['The chosen expected return is an assumption, not proven by the identity'],
    implementedBy: ['packages/engine/src/spending/abw.ts'],
    implementedByFunctions: ['packages/engine/src/spending/abw.ts#abwAnnualPayment'],
    verifiedOn: '2026-09-14',
    provenance: { derivedBy: 'claude-orchestrator', implementedBy: 'grok', reviewedBy: 'unreviewed' },
  },
} satisfies Record<string, CalculationRecord>
