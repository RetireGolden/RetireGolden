import { describe, expect, it } from 'vitest'

import {
  annualExpenseSummary,
  type AnnualExpenseSummaryInput,
} from './annualExpenseSummary.js'

function completeInput(
  overrides: Partial<AnnualExpenseSummaryInput> = {},
): AnnualExpenseSummaryInput {
  return {
    requiredLifestyle: 0,
    targetLifestyle: 0,
    targetLifestyleFunded: 0,
    idealLifestyle: 0,
    idealLifestyleFunded: 0,
    excessLifestyle: 0,
    excessLifestyleFunded: 0,
    systemRequired: 0,
    oneTimeGoalsFunded: 0,
    requiredGoalsFunded: 0,
    targetGoalsFunded: 0,
    idealGoalsFunded: 0,
    excessGoalsFunded: 0,
    skippedRequiredNominal: 0,
    skippedTargetNominal: 0,
    skippedIdealNominal: 0,
    skippedExcessNominal: 0,
    debtService: 0,
    propertyCosts: 0,
    healthcare: 0,
    insurancePremiums: 0,
    careCost: 0,
    ltcBenefit: 0,
    discretionaryMultiplier: 1,
    ...overrides,
  }
}

describe('annualExpenseSummary', () => {
  it('assembles every published expense field and each downstream layer base', () => {
    const result = annualExpenseSummary(completeInput({
      requiredLifestyle: 2,
      targetLifestyle: 3,
      targetLifestyleFunded: 5,
      idealLifestyle: 7,
      idealLifestyleFunded: 11,
      excessLifestyle: 13,
      excessLifestyleFunded: 17,
      systemRequired: 19,
      oneTimeGoalsFunded: 23,
      requiredGoalsFunded: 29,
      targetGoalsFunded: 31,
      idealGoalsFunded: 37,
      excessGoalsFunded: 41,
      skippedRequiredNominal: 43,
      skippedTargetNominal: 47,
      skippedIdealNominal: 53,
      skippedExcessNominal: 59,
      debtService: 61,
      propertyCosts: 67,
      healthcare: 71,
      insurancePremiums: 73,
      careCost: 79,
      ltcBenefit: 83,
      discretionaryMultiplier: 0.75,
    }))

    expect(result).toEqual({
      expenses: {
        baseSpending: 35,
        oneTimeGoals: 23,
        debtService: 61,
        propertyCosts: 67,
        healthcare: 71,
        insurancePremiums: 73,
        careCost: 79,
        ltcBenefit: 83,
        requiredSpending: 93,
        targetSpending: 174,
        idealSpending: 97,
        excessSpending: 113,
        intendedSpending: 384,
        guardrailFactor: 0.75,
        total: 326,
      },
      requiredSpendingBase: 50,
      targetSpendingBase: 84,
      idealSpendingBase: 44,
      excessSpendingBase: 54,
    })
  })

  it('preserves the original left-to-right floating-point associations', () => {
    const baseResult = annualExpenseSummary(completeInput({
      requiredLifestyle: 10_000_000_000_000_000,
      targetLifestyleFunded: 1_000_000_000_000_000,
      idealLifestyleFunded: 1,
      excessLifestyleFunded: 1,
    }))
    const totalResult = annualExpenseSummary(completeInput({
      requiredLifestyle: 10_000_000_000_000_000,
      oneTimeGoalsFunded: 1_000_000_000,
      debtService: 1_000_000_000,
      propertyCosts: 1_000_000_000,
      healthcare: 1_000_000_000,
      insurancePremiums: 1_000_000_000,
      careCost: 1,
      ltcBenefit: 1_000_000_000_000_000,
    }))
    const layerResult = annualExpenseSummary(completeInput({
      systemRequired: 10_000_000_000_000_000,
      requiredLifestyle: 1,
      targetLifestyle: 1,
      requiredGoalsFunded: 1,
      targetGoalsFunded: 1,
      idealLifestyle: 1,
      idealGoalsFunded: 1,
      excessLifestyle: 1,
      excessGoalsFunded: 1,
      skippedRequiredNominal: 1,
      skippedTargetNominal: 1,
      skippedIdealNominal: 1,
      skippedExcessNominal: 1,
    }))

    expect(baseResult.expenses.baseSpending).toBe(11_000_000_000_000_000)
    expect(baseResult.expenses.baseSpending).not.toBe(
      10_000_000_000_000_000 + (1_000_000_000_000_000 + (1 + 1)),
    )
    expect(totalResult.expenses.total).toBe(9_000_005_000_000_000)
    expect(totalResult.expenses.total).not.toBe(
      totalResult.expenses.baseSpending +
      1_000_000_000 +
      1_000_000_000 +
      1_000_000_000 +
      1_000_000_000 +
      1_000_000_000 +
      (1 - 1_000_000_000_000_000),
    )

    expect(layerResult.requiredSpendingBase).toBe(10_000_000_000_000_000)
    expect(layerResult.requiredSpendingBase).not.toBe(
      10_000_000_000_000_000 + (1 + 1),
    )
    expect(layerResult.targetSpendingBase).toBe(10_000_000_000_000_000)
    expect(layerResult.targetSpendingBase).not.toBe(
      10_000_000_000_000_000 + (1 + (1 + (1 + 1))),
    )
    expect(layerResult.expenses.requiredSpending).toBe(
      10_000_000_000_000_000,
    )
    expect(layerResult.expenses.requiredSpending).not.toBe(
      10_000_000_000_000_000 + (1 + 1 + 1),
    )
    expect(layerResult.expenses.targetSpending).toBe(
      10_000_000_000_000_000,
    )
    expect(layerResult.expenses.targetSpending).not.toBe(
      10_000_000_000_000_000 + (1 + 1 + 1 + 1 + 1 + 1),
    )
    expect(layerResult.expenses.intendedSpending).toBe(
      10_000_000_000_000_004,
    )
    expect(layerResult.expenses.intendedSpending).not.toBe(
      10_000_000_000_000_000 +
      (1 + 1 + 1 + 1 + (1 + 1) + (1 + 1) + 1 + 1 + 1 + 1),
    )
  })

  it('returns a fresh mutable expenses object without retaining call state', () => {
    const input = completeInput({ healthcare: 123, careCost: 456 })
    const first = annualExpenseSummary(input)
    const second = annualExpenseSummary(input)

    expect(first.expenses).not.toBe(second.expenses)
    first.expenses.healthcare = 999
    first.expenses.total = -1
    expect(second.expenses.healthcare).toBe(123)
    expect(second.expenses.total).toBe(579)
  })
})
