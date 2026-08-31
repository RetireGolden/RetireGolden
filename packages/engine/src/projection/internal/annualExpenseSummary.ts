/**
 * Materialize the mutable expense summary and spending-layer bases for one
 * projection year.
 *
 * This is a pure boundary around the former final expense-assembly block. The
 * returned `expenses` object is deliberately fresh and mutable: the caller's
 * ACA fixed-point pass can replace healthcare and adjust the published totals
 * in place before the same object is attached to the year result. The two base
 * scalars are returned separately because that pass adjusts them independently
 * before shortfall attribution.
 *
 * Arithmetic order is part of the contract. In particular, `total` retains the
 * original left-to-right `... + careCost - ltcBenefit` expression rather than
 * grouping the LTC values as `+ (careCost - ltcBenefit)`. IEEE-754 addition is
 * not associative, so even algebraically equivalent regrouping can move the
 * last bit.
 */
import type { YearExpenses } from './types/yearLedger.js'

export interface AnnualExpenseSummaryInput {
  readonly requiredLifestyle: number
  readonly targetLifestyle: number
  readonly targetLifestyleFunded: number
  readonly idealLifestyle: number
  readonly idealLifestyleFunded: number
  readonly excessLifestyle: number
  readonly excessLifestyleFunded: number
  readonly systemRequired: number
  readonly oneTimeGoalsFunded: number
  readonly requiredGoalsFunded: number
  readonly targetGoalsFunded: number
  readonly idealGoalsFunded: number
  readonly excessGoalsFunded: number
  readonly skippedRequiredNominal: number
  readonly skippedTargetNominal: number
  readonly skippedIdealNominal: number
  readonly skippedExcessNominal: number
  readonly debtService: number
  readonly propertyCosts: number
  readonly healthcare: number
  readonly insurancePremiums: number
  readonly careCost: number
  readonly ltcBenefit: number
  readonly discretionaryMultiplier: number
}

export interface AnnualExpenseSummary {
  /** Fresh, caller-owned object; ACA may mutate it later in the annual pass. */
  readonly expenses: YearExpenses
  /** Mutable at the caller: ACA adds the converged healthcare delta. */
  readonly requiredSpendingBase: number
  /** Mutable at the caller: ACA adds the converged healthcare delta. */
  readonly targetSpendingBase: number
  readonly idealSpendingBase: number
  readonly excessSpendingBase: number
}

export function annualExpenseSummary(
  input: AnnualExpenseSummaryInput,
): AnnualExpenseSummary {
  const baseSpending =
    input.requiredLifestyle +
    input.targetLifestyleFunded +
    input.idealLifestyleFunded +
    input.excessLifestyleFunded
  const requiredSpendingBase =
    input.systemRequired + input.requiredLifestyle + input.requiredGoalsFunded
  const targetSpendingBase =
    input.systemRequired +
    input.requiredLifestyle +
    input.targetLifestyle +
    input.targetGoalsFunded +
    input.requiredGoalsFunded
  const idealSpendingBase = input.idealLifestyle + input.idealGoalsFunded
  const excessSpendingBase = input.excessLifestyle + input.excessGoalsFunded

  const expenses: YearExpenses = {
    baseSpending,
    oneTimeGoals: input.oneTimeGoalsFunded,
    debtService: input.debtService,
    propertyCosts: input.propertyCosts,
    healthcare: input.healthcare,
    insurancePremiums: input.insurancePremiums,
    careCost: input.careCost,
    ltcBenefit: input.ltcBenefit,
    requiredSpending:
      requiredSpendingBase + input.skippedRequiredNominal,
    targetSpending:
      targetSpendingBase +
      input.skippedTargetNominal +
      input.skippedRequiredNominal,
    idealSpending: idealSpendingBase + input.skippedIdealNominal,
    excessSpending: excessSpendingBase + input.skippedExcessNominal,
    intendedSpending:
      targetSpendingBase +
      idealSpendingBase +
      excessSpendingBase +
      input.skippedTargetNominal +
      input.skippedRequiredNominal +
      input.skippedIdealNominal +
      input.skippedExcessNominal,
    guardrailFactor: input.discretionaryMultiplier,
    total:
      baseSpending +
      input.oneTimeGoalsFunded +
      input.debtService +
      input.propertyCosts +
      input.healthcare +
      input.insurancePremiums +
      input.careCost -
      input.ltcBenefit,
  }

  return {
    expenses,
    requiredSpendingBase,
    targetSpendingBase,
    idealSpendingBase,
    excessSpendingBase,
  }
}
