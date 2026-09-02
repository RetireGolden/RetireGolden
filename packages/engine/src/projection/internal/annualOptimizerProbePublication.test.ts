import { describe, expect, it, vi } from 'vitest'

import type { YearAcaResult } from '../types.js'
import {
  annualOptimizerProbePublication,
  type AnnualOptimizerProbeInput,
} from './annualOptimizerProbePublication.js'

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child)
    Object.freeze(value)
  }
  return value
}

function input(
  overrides: Partial<AnnualOptimizerProbeInput> = {},
): AnnualOptimizerProbeInput {
  return {
    year: 2026,
    traditionalAccounts: [{
      openingBalance: 100,
      closingBalance: 80,
      inheritedOpeningBucket: false,
      hasSpouseTreatAsOwnElection: false,
      treatAsOwnEffective: false,
      rmdObligation: 0,
      ownerWithdrawal: 20,
      includedInOwnerTraditional: true,
      remainingTaxableFraction: 0.75,
      convertibleToRoth: true,
    }],
    ordinaryAction: null,
    conversionAction: null,
    qcdAction: null,
    runtimeOccurrences: [],
    exogenousStrategyDebits: [],
    rmdTotal: 10,
    rmdNontaxable: 2,
    inheritedOrdinaryIncome: 0,
    qcdIncomeOffset: 0,
    namedQcdIncomeOffset: 0,
    qcdFromRmd: 0,
    namedQcdRmdSatisfied: 0,
    incomeBeforeConversion: 50,
    taxableSocialSecurity: 5,
    preWithdrawalCapitalResult: -3,
    qualifiedDividends: 2,
    iraNontaxableFinal: 1,
    namedRothConversionExecuted: 0,
    namedRothConversionNontaxable: 0,
    retirementActionProceeds: 0,
    expensesTotal: 30,
    contributions: 4,
    incomesTotal: 25,
    taxableYieldReinvested: 3,
    traditionalInflow: 6,
    otherInflow: 7,
    taxableInflow: 8,
    grossSocialSecurity: 9,
    taxExemptInterest: 10,
    acaForeignExclusionAddback: 11,
    yearAcaResult: undefined,
    maxFplPctForCredit: 400,
    totalRothConversionTaxable: 0,
    traditionalWithdrawal: 20,
    taxableWithdrawal: 12,
    totalRothConversion: 0,
    taxableAmountForGrossConversion: (gross) => gross * 0.8,
    seppTotal: 0,
    peopleAged65Plus: 1,
    ssa44IrmaaRedetermination: false,
    ...overrides,
  }
}

function actionableAca(): YearAcaResult {
  return {
    readiness: 'actionable',
    supportCodes: ['actionable'],
    householdMagi: 30_000,
    magiComponents: {
      federalAgi: 30_000,
      nontaxableSocialSecurity: 0,
      taxExemptInterest: 0,
      foreignExclusionAddback: 0,
      requiredFilerDependentMagi: 0,
    },
    fplRegion: 'contiguous',
    federalPovertyLine: 20_000,
    fplPct: 150,
    taxFamilySize: 1,
    taxFamilyMembers: [],
    coveredMembers: [],
    grossEnrollmentPremium: 0,
    applicableSlcspPremium: 0,
    modeledAllowablePtc: 1_234,
    economicNetPremium: 0,
    aptcModeled: false,
    form8962ReconciliationSupported: false,
    cliffState: 'below-cliff',
    convergence: {
      converged: true,
      iterations: 1,
      maxIterations: 5,
      residualDollars: 0,
      grossPremiumFallback: false,
    },
  }
}

describe('annualOptimizerProbePublication', () => {
  it('publishes the settled annual scalar and marginal-fraction contract', () => {
    const result = annualOptimizerProbePublication(input())

    expect(result).toMatchObject({
      year: 2026,
      startTraditional: 100,
      startInheritedTraditional: 0,
      rmd: 10,
      rmdTaxable: 8,
      inheritedDistribution: 0,
      incumbentTraditionalDistribution: 30,
      traditionalWithdrawalTaxableFraction: 0.9,
      rothConversionTaxableFraction: 0.8,
      ordinaryIncomeBase: 47,
      capitalGainsBase: 2,
      forcedDistributionOrdinaryIncomeExclusion: 0,
      forcedDistributionCashDiversion: 0,
      committedConversionOrdinaryIncome: 0,
      committedActionProceeds: 0,
      incumbentModeledMagiBeforeTaxableWithdrawalGains: 76,
      incumbentTaxableWithdrawal: 12,
      spendingNeed: 34,
      exogenousCash: 22,
      traditionalInflow: 6,
      otherInflow: 7,
      taxableInflow: 8,
      ssBenefits: 9,
      taxableSsBase: 5,
      ssProvisionalIncomeAddbacks: 21,
      magiTaxExemptInterest: 10,
      acaConversionMagiHeadroom: null,
      acaModeledAllowablePtc: null,
      acaCliffState: null,
      incumbentRothConversion: 0,
      peopleAged65Plus: 1,
      ssa44IrmaaRedetermination: false,
    })
    expect(result.committedActionAccountMovement).toEqual([])
    expect(result.exogenousStrategyAccountMovement).toEqual([])
  })

  it('remaps post-flip S2 obligations and folds exact-cent action movements in account order', () => {
    const result = annualOptimizerProbePublication(input({
      traditionalAccounts: [
        {
          openingBalance: 120,
          closingBalance: 100,
          inheritedOpeningBucket: true,
          hasSpouseTreatAsOwnElection: true,
          treatAsOwnEffective: true,
          rmdObligation: 10,
          ownerWithdrawal: 7,
          includedInOwnerTraditional: true,
          remainingTaxableFraction: 0.6,
          convertibleToRoth: true,
        },
        {
          openingBalance: 80,
          closingBalance: 60,
          inheritedOpeningBucket: false,
          hasSpouseTreatAsOwnElection: false,
          treatAsOwnEffective: false,
          rmdObligation: 0,
          ownerWithdrawal: 3,
          includedInOwnerTraditional: true,
          remainingTaxableFraction: 0.5,
          convertibleToRoth: true,
        },
      ],
      ordinaryAction: {
        committed: true,
        balances: [{
          accountId: 'b',
          openingBalanceCents: 10_000n,
          closingBalanceCents: 8_000n,
        }],
      },
      conversionAction: {
        committed: true,
        evidence: [
          {
            outcome: 'executed',
            destinationRothAccountId: 'z',
            allocations: [
              { sourceAccountId: 'b', executedAmountCents: 500n },
              { sourceAccountId: 'a', executedAmountCents: 200n },
            ],
          },
          {
            outcome: 'refused',
            destinationRothAccountId: 'ignored',
            allocations: [{
              sourceAccountId: 'ignored',
              executedAmountCents: 999n,
            }],
          },
        ],
      },
      qcdAction: {
        committed: true,
        evidence: [
          { sourceAccountId: 'a', executedAmountCents: 300n },
          { sourceAccountId: 'ignored', executedAmountCents: 0n },
        ],
      },
      rmdTotal: 20,
      rmdNontaxable: 4,
      inheritedOrdinaryIncome: 5,
      qcdIncomeOffset: 3,
      namedQcdIncomeOffset: 2,
      qcdFromRmd: 4,
      namedQcdRmdSatisfied: 3,
      incomeBeforeConversion: 30,
      taxableSocialSecurity: 2,
      yearAcaResult: actionableAca(),
      totalRothConversionTaxable: 8,
      traditionalWithdrawal: 10,
      totalRothConversion: 10,
    }))

    expect(result).toMatchObject({
      startTraditional: 80,
      startInheritedTraditional: 120,
      rmd: 10,
      rmdTaxable: 8,
      inheritedDistribution: 15,
      forcedDistributionOrdinaryIncomeExclusion: 7,
      forcedDistributionCashDiversion: 7,
      ordinaryIncomeBase: 16,
      acaConversionMagiHeadroom: 50_000,
      acaModeledAllowablePtc: 1_234,
      acaCliffState: 'below-cliff',
      rothConversionTaxableFraction: 0.8,
    })
    expect(result.committedActionAccountMovement).toEqual([
      { accountId: 'a', amount: -5 },
      { accountId: 'b', amount: -25 },
      { accountId: 'z', amount: 7 },
    ])
  })

  it('folds strategy debits, rollover credits, and SEPP proceeds without re-deriving producers', () => {
    const result = annualOptimizerProbePublication(input({
      runtimeOccurrences: [
        {
          sourceAccountId: 'x',
          kind: 'legacyQcd',
          grossAmountPlanDollars: 1.23,
        },
        {
          sourceAccountId: 'y',
          kind: 'automaticSeppDistribution',
          grossAmountPlanDollars: 2.34,
        },
        {
          sourceAccountId: 'x',
          kind: 'rolloverInflow',
          grossAmountPlanDollars: 5,
        },
        {
          sourceAccountId: null,
          kind: 'legacyQcd',
          grossAmountPlanDollars: 99,
        },
      ],
      exogenousStrategyDebits: [{
        accountId: 'y',
        amountPlanDollars: 1.11,
      }],
      seppTotal: 2.34,
    }))

    expect(result.exogenousStrategyAccountMovement).toEqual([
      { accountId: 'x', amount: 3.77 },
      { accountId: 'y', amount: -3.45 },
    ])
    expect(result.exogenousStrategyProceeds).toBe(2.34)
  })

  it('ignores uncommitted evidence and returns fresh movement containers', () => {
    const translator = vi.fn((gross: number) => gross * 0.625)
    const source = deepFreeze(input({
      traditionalAccounts: [{
        ...input().traditionalAccounts[0]!,
        closingBalance: 100,
        ownerWithdrawal: 0,
        remainingTaxableFraction: 0.6,
      }],
      rmdTotal: 0,
      rmdNontaxable: 0,
      traditionalWithdrawal: 0,
      totalRothConversion: 0,
      ordinaryAction: {
        committed: false,
        balances: [{
          accountId: 'forged',
          openingBalanceCents: 0n,
          closingBalanceCents: 1_000n,
        }],
      },
      conversionAction: {
        committed: false,
        evidence: [{
          outcome: 'executed',
          destinationRothAccountId: 'forged',
          allocations: [{
            sourceAccountId: 'forged',
            executedAmountCents: 1_000n,
          }],
        }],
      },
      qcdAction: {
        committed: false,
        evidence: [{
          sourceAccountId: 'forged',
          executedAmountCents: 1_000n,
        }],
      },
      taxableAmountForGrossConversion: translator,
    }))

    const first = annualOptimizerProbePublication(source)
    const second = annualOptimizerProbePublication(source)

    expect(first.committedActionAccountMovement).toEqual([])
    expect(first.traditionalWithdrawalTaxableFraction).toBe(0.6)
    expect(first.rothConversionTaxableFraction).toBe(0.625)
    expect(translator).toHaveBeenCalledWith(100)
    expect(translator).toHaveBeenCalledTimes(2)
    expect(first).not.toBe(second)
    expect(first.committedActionAccountMovement).not.toBe(
      second.committedActionAccountMovement,
    )
    expect(first.exogenousStrategyAccountMovement).not.toBe(
      second.exogenousStrategyAccountMovement,
    )

    const empty = annualOptimizerProbePublication(input({
      traditionalAccounts: [],
      rmdTotal: 0,
      rmdNontaxable: 0,
      traditionalWithdrawal: 0,
      totalRothConversion: 0,
    }))
    expect(empty.traditionalWithdrawalTaxableFraction).toBe(1)
    expect(empty.rothConversionTaxableFraction).toBe(1)
  })
})
