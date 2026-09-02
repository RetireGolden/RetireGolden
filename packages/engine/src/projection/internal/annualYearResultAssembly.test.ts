import { beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  AssembleYearCashFlowInput,
} from '../annualCashFlowCapture.js'
import type { YearCashFlow, YearResult } from '../types.js'
import type {
  AnnualYearResultAssemblyInput,
} from './annualYearResultAssembly.js'

const cashFlowSeam = vi.hoisted(() => ({
  calls: [] as AssembleYearCashFlowInput[],
  output: Object.freeze({ marker: 'assembled-cash-flow' }),
}))

vi.mock('../annualCashFlowCapture.js', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('../annualCashFlowCapture.js')>()
  return {
    ...original,
    assembleYearCashFlow: (
      input: AssembleYearCashFlowInput,
    ): YearCashFlow => {
      cashFlowSeam.calls.push(input)
      return cashFlowSeam.output as unknown as YearCashFlow
    },
  }
})

import { annualYearResultAssembly } from './annualYearResultAssembly.js'

function baseInput(): AnnualYearResultAssemblyInput {
  const people = ([
    { personId: 'person-1', age: 70, alive: true },
  ]) as unknown as YearResult['people']
  const incomes = { taxableYield: 23, total: 101 } as YearResult['incomes']
  const expenses = { total: 37 } as YearResult['expenses']
  const withdrawals = { total: 41 } as YearResult['withdrawals']
  const balances = { 'account-1': 1e16 }
  const ownedRothIraPoolActivity = Object.freeze([
    { ownerPersonId: 'person-1', marker: 'owned-roth' },
  ]) as unknown as NonNullable<YearResult['ownedRothIraPoolActivity']>
  const employerRothAccountActivity = Object.freeze([
    { accountId: 'employer-roth', marker: 'employer-roth' },
  ]) as unknown as NonNullable<YearResult['employerRothAccountActivity']>
  const ownedTraditionalIraAggregateActivity = Object.freeze([
    { ownerPersonId: 'person-1', marker: 'traditional' },
  ]) as unknown as NonNullable<
    YearResult['ownedTraditionalIraAggregateActivity']
  >

  return {
    chronology: {
      year: 2030,
      inflationScale: 1.25,
      people,
      filingStatus: 'single',
    },
    ledger: {
      incomes,
      expenses,
      contributions: 11,
      ownedNonRothIraContributions: 12,
      ownedNonRothIraBalancesBeforeGrowth: { 'account-1': 13 },
      ownedNonRothIraPhysicalBalancesBeforeGrowth: [],
      ownedNonRothIraPhysicalOpeningBalances: [],
      qualifiedAnnuityPayments: [],
      socialSecurityStreams: [],
      employerMatch: 14,
    },
    entityFacts: {
      ownedRothIraPoolActivity,
      employerRothAccountActivity,
      ownedTraditionalIraAggregateActivity,
    },
    retirement: {
      rmd: 15,
      rmdShortfallExciseTax: 16,
      rmdShortfallExciseDetails: [],
      sepp: 17,
      inheritedDistribution: 18,
      inheritedTraditionalDistribution: 19,
      inheritedAccounts: undefined,
      qcd: 20,
      rothConversion: 21,
      aggregateRothConversionAllocationBalances: undefined,
      aggregateRothConversionAllocationDesired: undefined,
      retirementRuntimeSource: undefined,
      retirementRuntimeApplicationSource: undefined,
      ownedNonRothIraPostGrowthSource: undefined,
      retirementActionExecution: undefined,
      rothConversionActionExecution: undefined,
      qcdActionExecution: undefined,
    },
    settlement: {},
    tax: {
      penalties: 22,
      magi: 24,
      aca: undefined,
      medicarePremiums: 25,
      irmaaSurcharge: 26,
      irmaaTier: 2,
      irmaaLookbackMagi: undefined,
      irmaaLookbackMagiSource: undefined,
      irmaaLookbackMagiYear: undefined,
      irmaaNextTierThreshold: undefined,
      advisoryFederalTax: {
        input: { marker: 'tax-input' } as unknown as NonNullable<
          YearResult['advisoryFederalTax']
        >['input'],
        detail: {
          alternativeMinimumTax: 27,
        } as NonNullable<YearResult['advisoryFederalTax']>['detail'],
      },
      ltcgZeroHeadroom: 28,
      ssEarningsTestWithheld: 29,
      ssdiPaid: 30,
      tax: 31,
    },
    funding: {
      withdrawals,
      // Cancellation-sensitive association: (1e16 - 1e16) + 1 is 1,
      // while 1e16 + (-1e16 + 1) is 0.
      realizedGains: {
        withdrawal: 1e16,
        rebalance: -1e16,
        retirementAction: 1,
      },
      taxExemptInterest: 32,
      capitalLossUsedAgainstGains: 33,
      capitalLossUsedAgainstOrdinary: 34,
      capitalLossCarryforwardRemaining: 35,
      surplusInvested: 36,
      shortfall: 38,
      requiredShortfall: 39,
      targetShortfall: 40,
      idealShortfall: 42,
      excessShortfall: 43,
      guardrailAction: 'hold',
      flexibleGoals: {
        funded: 1,
        partiallyFunded: 2,
        deferred: 3,
        skipped: 4,
        fundedAmount: 5,
        unfundedAmount: 6,
      },
    },
    balanceSheet: {
      snapshot: {
        balanceRecord: balances,
        investableTotal: 1e16,
        propertyTotal: 1,
        debtTotal: 1e16,
        hecmLoanTotal: 44,
        hecmEffectiveDebt: 1,
        insuranceCashValueTotal: 1,
      },
      ladderValue: 0,
      deathBenefit: 45,
      hecmDraw: 46,
    },
  }
}

describe('annualYearResultAssembly', () => {
  beforeEach(() => {
    cashFlowSeam.calls.length = 0
  })

  it('publishes coordinator results by identity and preserves exact folds', () => {
    const input = baseInput()
    const before = structuredClone(input)

    const result = annualYearResultAssembly(input)

    expect(result.people).toBe(input.chronology.people)
    expect(result.incomes).toBe(input.ledger.incomes)
    expect(result.ownedRothIraPoolActivity).toBe(
      input.entityFacts.ownedRothIraPoolActivity,
    )
    expect(result.employerRothAccountActivity).toBe(
      input.entityFacts.employerRothAccountActivity,
    )
    expect(result.ownedTraditionalIraAggregateActivity).toBe(
      input.entityFacts.ownedTraditionalIraAggregateActivity,
    )
    expect(result.balances).toBe(input.balanceSheet.snapshot.balanceRecord)
    expect(result.advisoryFederalTax).toBe(input.tax.advisoryFederalTax)
    expect(result.amt).toBe(27)
    expect(result.realizedGains).toBe(1)
    expect(result.netWorth).toBe(0)
    expect(result.taxableYield).toBe(23)
    expect(result).not.toHaveProperty('cashFlow')
    expect(cashFlowSeam.calls).toHaveLength(0)
    expect(input).toEqual(before)
  })

  it('owns every optional publication gate and delegates cash-flow assembly', () => {
    const base = baseInput()
    const inheritedAccounts = (Object.freeze([{ marker: 'inherited' }])) as unknown as
      NonNullable<YearResult['inheritedAccounts']>
    const retirementActionExecution = (Object.freeze({ marker: 'ordinary' })) as unknown as
      NonNullable<YearResult['retirementActionExecution']>
    const rothConversionActionExecution = (Object.freeze({ marker: 'roth' })) as unknown as
      NonNullable<YearResult['rothConversionActionExecution']>
    const qcdActionExecution = (Object.freeze({ marker: 'qcd' })) as unknown as
      NonNullable<YearResult['qcdActionExecution']>
    const retirementActionPublication = (Object.freeze({ marker: 'publication' })) as unknown as
      NonNullable<YearResult['retirementActionPublication']>
    const conversionLinkedWithdrawalGroupExecution = Object.freeze({
      marker: 'linked-group',
    }) as unknown as NonNullable<
      YearResult['conversionLinkedWithdrawalGroupExecution']
    >
    const qcdActionPrerequisites = (Object.freeze([{ marker: 'prerequisite' }])) as unknown as
      NonNullable<YearResult['qcdActionPrerequisites']>
    const cashFlowInput = (Object.freeze({ marker: 'cash-flow-input' })) as unknown as
      AssembleYearCashFlowInput
    const input: AnnualYearResultAssemblyInput = {
      ...base,
      retirement: {
        ...base.retirement,
        inheritedAccounts,
        aggregateRothConversionAllocationBalances: { 'account-1': 47 },
        aggregateRothConversionAllocationDesired: 48,
        retirementActionExecution,
        rothConversionActionExecution,
        qcdActionExecution,
      },
      settlement: {
        retirementActionPublication,
        conversionLinkedWithdrawalGroupExecution,
        qcdActionPrerequisites: {
          evidence: qcdActionPrerequisites,
        } as unknown as NonNullable<
          AnnualYearResultAssemblyInput['settlement']['qcdActionPrerequisites']
        >,
      },
      tax: {
        ...base.tax,
        aca: (Object.freeze({ marker: 'aca' })) as unknown as
          NonNullable<YearResult['aca']>,
      },
      cashFlowInput,
    }

    const result = annualYearResultAssembly(input)

    expect(result.inheritedAccounts).toBe(inheritedAccounts)
    expect(result.aggregateRothConversionAllocationBalances).toBe(
      input.retirement.aggregateRothConversionAllocationBalances,
    )
    expect(result.aggregateRothConversionAllocationDesired).toBe(48)
    expect(result.retirementActionExecution).toBe(retirementActionExecution)
    expect(result.retirementActionPublication).toBe(
      retirementActionPublication,
    )
    expect(result.conversionLinkedWithdrawalGroupExecution).toBe(
      conversionLinkedWithdrawalGroupExecution,
    )
    expect(result.rothConversionActionExecution).toBe(
      rothConversionActionExecution,
    )
    expect(result.qcdActionPrerequisites).toBe(qcdActionPrerequisites)
    expect(result.qcdActionExecution).toBe(qcdActionExecution)
    expect(result.aca).toBe(input.tax.aca)
    expect(result.cashFlow).toBe(cashFlowSeam.output)
    expect(cashFlowSeam.calls).toEqual([cashFlowInput])

    const absent = annualYearResultAssembly(base)
    for (const key of [
      'inheritedAccounts',
      'aggregateRothConversionAllocationBalances',
      'aggregateRothConversionAllocationDesired',
      'retirementActionExecution',
      'retirementActionPublication',
      'conversionLinkedWithdrawalGroupExecution',
      'rothConversionActionExecution',
      'qcdActionPrerequisites',
      'qcdActionExecution',
      'aca',
      'cashFlow',
    ]) {
      expect(Object.hasOwn(absent, key), key).toBe(false)
    }
    // These legacy keys are present even when their values are undefined.
    expect(Object.hasOwn(absent, 'irmaaLookbackMagi')).toBe(true)
    expect(Object.hasOwn(absent, 'irmaaLookbackMagiSource')).toBe(true)
    expect(Object.hasOwn(absent, 'irmaaLookbackMagiYear')).toBe(true)
    expect(Object.hasOwn(absent, 'irmaaNextTierThreshold')).toBe(true)
  })
})
