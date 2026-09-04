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

const OPTIONAL_PUBLICATION_KEYS = [
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
] as const

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
  const retirementRuntimeSource = Object.freeze({
    marker: 'retirement-runtime',
  }) as unknown as NonNullable<YearResult['retirementRuntimeSource']>
  const retirementRuntimeApplicationSource = Object.freeze({
    marker: 'retirement-runtime-application',
  }) as unknown as NonNullable<
    YearResult['retirementRuntimeApplicationSource']
  >
  const ownedNonRothIraPostGrowthSource = Object.freeze({
    marker: 'owned-non-roth-post-growth',
  }) as unknown as NonNullable<
    YearResult['ownedNonRothIraPostGrowthSource']
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
      retirementRuntimeSource,
      retirementRuntimeApplicationSource,
      ownedNonRothIraPostGrowthSource,
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
      irmaaLookbackMagi: 103,
      irmaaLookbackMagiSource: 'planFallback',
      irmaaLookbackMagiYear: 2028,
      irmaaNextTierThreshold: 104,
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
        propertyTotal: 8,
        debtTotal: 1e16,
        hecmLoanTotal: 44,
        hecmEffectiveDebt: 1,
        insuranceCashValueTotal: 4,
      },
      ladderValue: 2,
      deathBenefit: 45,
      hecmDraw: 46,
    },
  }
}

describe('annualYearResultAssembly netPortfolioNeed', () => {
  // Hand worksheet, from the published definition
  // (`max(0, expenses.total + tax + penalties - incomes.total)`) and nothing
  // else. Both arms use the same four inputs so the floor is the only
  // difference between them.
  it('publishes 0 when incomes cover every outflow', () => {
    // expenses.total 37 + tax 31 + penalties 22 = 90 of outflow.
    // incomes.total 101. 90 - 101 = -11, a surplus year, so the need floors
    // at 0 rather than publishing a negative "need".
    const result = annualYearResultAssembly(baseInput())
    expect(result.netPortfolioNeed).toBe(0)
  })

  it('publishes the uncovered outflow when incomes fall short', () => {
    const base = baseInput()
    const input: AnnualYearResultAssemblyInput = {
      ...base,
      ledger: {
        ...base.ledger,
        expenses: { total: 500 } as YearResult['expenses'],
      },
    }
    // expenses.total 500 + tax 31 + penalties 22 = 553 of outflow.
    // incomes.total 101. 553 - 101 = 452, all of which the portfolio supplies.
    const result = annualYearResultAssembly(input)
    expect(result.netPortfolioNeed).toBe(452)
  })

  it('reads only the four published inputs, at the settled boundary', () => {
    // Each input moved one at a time from the surplus fixture, so no arm can
    // pass by coincidence: +463 expense, +463 tax, +463 penalty each land the
    // same 452, and +463 of income deepens the surplus and stays floored.
    const base = baseInput()
    const withExpenses = annualYearResultAssembly({
      ...base,
      ledger: { ...base.ledger, expenses: { total: 500 } as YearResult['expenses'] },
    })
    const withTax = annualYearResultAssembly({
      ...base,
      tax: { ...base.tax, tax: 494 },
    })
    const withPenalties = annualYearResultAssembly({
      ...base,
      tax: { ...base.tax, penalties: 485 },
    })
    const withIncome = annualYearResultAssembly({
      ...base,
      ledger: {
        ...base.ledger,
        incomes: { taxableYield: 23, total: 564 } as YearResult['incomes'],
      },
    })
    expect(withExpenses.netPortfolioNeed).toBe(452)
    expect(withTax.netPortfolioNeed).toBe(452)
    expect(withPenalties.netPortfolioNeed).toBe(452)
    expect(withIncome.netPortfolioNeed).toBe(0)
  })
})

describe('annualYearResultAssembly', () => {
  beforeEach(() => {
    cashFlowSeam.calls.length = 0
  })

  it('publishes coordinator results by identity and preserves exact folds', () => {
    const input = baseInput()
    const before = structuredClone(input)

    const result = annualYearResultAssembly(input)

    for (const [label, actual, expected] of [
      ['people', result.people, input.chronology.people],
      ['incomes', result.incomes, input.ledger.incomes],
      ['expenses', result.expenses, input.ledger.expenses],
      [
        'ownedNonRothIraBalancesBeforeGrowth',
        result.ownedNonRothIraBalancesBeforeGrowth,
        input.ledger.ownedNonRothIraBalancesBeforeGrowth,
      ],
      [
        'ownedNonRothIraPhysicalBalancesBeforeGrowth',
        result.ownedNonRothIraPhysicalBalancesBeforeGrowth,
        input.ledger.ownedNonRothIraPhysicalBalancesBeforeGrowth,
      ],
      [
        'ownedNonRothIraPhysicalOpeningBalances',
        result.ownedNonRothIraPhysicalOpeningBalances,
        input.ledger.ownedNonRothIraPhysicalOpeningBalances,
      ],
      [
        'ownedRothIraPoolActivity',
        result.ownedRothIraPoolActivity,
        input.entityFacts.ownedRothIraPoolActivity,
      ],
      [
        'employerRothAccountActivity',
        result.employerRothAccountActivity,
        input.entityFacts.employerRothAccountActivity,
      ],
      [
        'ownedTraditionalIraAggregateActivity',
        result.ownedTraditionalIraAggregateActivity,
        input.entityFacts.ownedTraditionalIraAggregateActivity,
      ],
      [
        'retirementRuntimeSource',
        result.retirementRuntimeSource,
        input.retirement.retirementRuntimeSource,
      ],
      [
        'retirementRuntimeApplicationSource',
        result.retirementRuntimeApplicationSource,
        input.retirement.retirementRuntimeApplicationSource,
      ],
      [
        'ownedNonRothIraPostGrowthSource',
        result.ownedNonRothIraPostGrowthSource,
        input.retirement.ownedNonRothIraPostGrowthSource,
      ],
      [
        'qualifiedAnnuityPayments',
        result.qualifiedAnnuityPayments,
        input.ledger.qualifiedAnnuityPayments,
      ],
      [
        'socialSecurityStreams',
        result.socialSecurityStreams,
        input.ledger.socialSecurityStreams,
      ],
      [
        'rmdShortfallExciseDetails',
        result.rmdShortfallExciseDetails,
        input.retirement.rmdShortfallExciseDetails,
      ],
      ['advisoryFederalTax', result.advisoryFederalTax, input.tax.advisoryFederalTax],
      ['withdrawals', result.withdrawals, input.funding.withdrawals],
      ['flexibleGoals', result.flexibleGoals, input.funding.flexibleGoals],
      ['balances', result.balances, input.balanceSheet.snapshot.balanceRecord],
    ] as const) {
      expect(actual, label).toBe(expected)
    }
    expect(result).toMatchObject({
      year: 2030,
      inflationScale: 1.25,
      filingStatus: 'single',
      contributions: 11,
      ownedNonRothIraContributions: 12,
      employerMatch: 14,
      rmd: 15,
      rmdShortfallExciseTax: 16,
      sepp: 17,
      inheritedDistribution: 18,
      inheritedTraditionalDistribution: 19,
      qcd: 20,
      rothConversion: 21,
      penalties: 22,
      taxableYield: 23,
      magi: 24,
      medicarePremiums: 25,
      irmaaSurcharge: 26,
      irmaaTier: 2,
      irmaaLookbackMagi: 103,
      irmaaLookbackMagiSource: 'planFallback',
      irmaaLookbackMagiYear: 2028,
      irmaaNextTierThreshold: 104,
      amt: 27,
      ltcgZeroHeadroom: 28,
      ssEarningsTestWithheld: 29,
      ssdiPaid: 30,
      tax: 31,
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
      investableTotal: 1e16,
      insuranceCashValue: 4,
      ladderValue: 2,
      deathBenefit: 45,
      hecmDraw: 46,
      hecmLoanBalance: 44,
    })
    expect(result.realizedGains).toBe(1)
    // (((((1e16 + 8) - 1e16) + 4) + 2) - 1) keeps every term
    // effective and differs from plausible regroupings.
    expect(result.netWorth).toBe(13)
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
    expect(Object.keys(result)).toEqual([
      'year',
      'inflationScale',
      'people',
      'filingStatus',
      'incomes',
      'expenses',
      'contributions',
      'ownedNonRothIraContributions',
      'ownedNonRothIraBalancesBeforeGrowth',
      'ownedNonRothIraPhysicalBalancesBeforeGrowth',
      'ownedNonRothIraPhysicalOpeningBalances',
      'ownedRothIraPoolActivity',
      'employerRothAccountActivity',
      'ownedTraditionalIraAggregateActivity',
      'qualifiedAnnuityPayments',
      'socialSecurityStreams',
      'employerMatch',
      'rmd',
      'rmdShortfallExciseTax',
      'rmdShortfallExciseDetails',
      'sepp',
      'inheritedDistribution',
      'inheritedTraditionalDistribution',
      'inheritedAccounts',
      'qcd',
      'rothConversion',
      'aggregateRothConversionAllocationBalances',
      'aggregateRothConversionAllocationDesired',
      'retirementRuntimeSource',
      'retirementRuntimeApplicationSource',
      'ownedNonRothIraPostGrowthSource',
      'retirementActionExecution',
      'retirementActionPublication',
      'conversionLinkedWithdrawalGroupExecution',
      'rothConversionActionExecution',
      'qcdActionPrerequisites',
      'qcdActionExecution',
      'penalties',
      'magi',
      'aca',
      'medicarePremiums',
      'irmaaSurcharge',
      'irmaaTier',
      'irmaaLookbackMagi',
      'irmaaLookbackMagiSource',
      'irmaaLookbackMagiYear',
      'irmaaNextTierThreshold',
      'advisoryFederalTax',
      'amt',
      'ltcgZeroHeadroom',
      'ssEarningsTestWithheld',
      'ssdiPaid',
      'tax',
      'withdrawals',
      'realizedGains',
      'taxableYield',
      'taxExemptInterest',
      'capitalLossUsedAgainstGains',
      'capitalLossUsedAgainstOrdinary',
      'capitalLossCarryforwardRemaining',
      'surplusInvested',
      'shortfall',
      'requiredShortfall',
      'targetShortfall',
      'idealShortfall',
      'excessShortfall',
      'guardrailAction',
      'flexibleGoals',
      'balances',
      'investableTotal',
      'insuranceCashValue',
      'ladderValue',
      'deathBenefit',
      'hecmDraw',
      'hecmLoanBalance',
      'netWorth',
      'cashFlow',
      'netPortfolioNeed',
    ])

    const absent = annualYearResultAssembly(base)
    for (const key of OPTIONAL_PUBLICATION_KEYS) {
      expect(Object.hasOwn(absent, key), key).toBe(false)
    }
    // These legacy keys are present even when their values are undefined.
    expect(Object.hasOwn(absent, 'irmaaLookbackMagi')).toBe(true)
    expect(Object.hasOwn(absent, 'irmaaLookbackMagiSource')).toBe(true)
    expect(Object.hasOwn(absent, 'irmaaLookbackMagiYear')).toBe(true)
    expect(Object.hasOwn(absent, 'irmaaNextTierThreshold')).toBe(true)
  })

  it('keeps every optional channel independent and fails QCD execution closed', () => {
    const base = baseInput()
    const inheritedAccounts = Object.freeze([{ marker: 'inherited-only' }]) as unknown as
      NonNullable<YearResult['inheritedAccounts']>
    const allocationBalances = Object.freeze({ 'account-only': 101 })
    const retirementActionExecution = Object.freeze({ marker: 'ordinary-only' }) as unknown as
      NonNullable<YearResult['retirementActionExecution']>
    const retirementActionPublication = Object.freeze({ marker: 'publication-only' }) as unknown as
      NonNullable<YearResult['retirementActionPublication']>
    const linkedExecution = Object.freeze({ marker: 'linked-only' }) as unknown as
      NonNullable<YearResult['conversionLinkedWithdrawalGroupExecution']>
    const rothExecution = Object.freeze({ marker: 'roth-only' }) as unknown as
      NonNullable<YearResult['rothConversionActionExecution']>
    const aca = Object.freeze({ marker: 'aca-only' }) as unknown as
      NonNullable<YearResult['aca']>
    const cashFlowInput = Object.freeze({ marker: 'cash-only' }) as unknown as
      AssembleYearCashFlowInput
    const cases: ReadonlyArray<{
      readonly key: (typeof OPTIONAL_PUBLICATION_KEYS)[number]
      readonly expected: unknown
      readonly input: AnnualYearResultAssemblyInput
    }> = [
      {
        key: 'inheritedAccounts',
        expected: inheritedAccounts,
        input: {
          ...base,
          retirement: { ...base.retirement, inheritedAccounts },
        },
      },
      {
        key: 'aggregateRothConversionAllocationBalances',
        expected: allocationBalances,
        input: {
          ...base,
          retirement: {
            ...base.retirement,
            aggregateRothConversionAllocationBalances: allocationBalances,
          },
        },
      },
      {
        key: 'aggregateRothConversionAllocationDesired',
        expected: 102,
        input: {
          ...base,
          retirement: {
            ...base.retirement,
            aggregateRothConversionAllocationDesired: 102,
          },
        },
      },
      {
        key: 'retirementActionExecution',
        expected: retirementActionExecution,
        input: {
          ...base,
          retirement: {
            ...base.retirement,
            retirementActionExecution,
          },
        },
      },
      {
        key: 'retirementActionPublication',
        expected: retirementActionPublication,
        input: {
          ...base,
          settlement: { retirementActionPublication },
        },
      },
      {
        key: 'conversionLinkedWithdrawalGroupExecution',
        expected: linkedExecution,
        input: {
          ...base,
          settlement: {
            conversionLinkedWithdrawalGroupExecution: linkedExecution,
          },
        },
      },
      {
        key: 'rothConversionActionExecution',
        expected: rothExecution,
        input: {
          ...base,
          retirement: {
            ...base.retirement,
            rothConversionActionExecution: rothExecution,
          },
        },
      },
      {
        key: 'aca',
        expected: aca,
        input: { ...base, tax: { ...base.tax, aca } },
      },
      {
        key: 'cashFlow',
        expected: cashFlowSeam.output,
        input: { ...base, cashFlowInput },
      },
    ]

    for (const testCase of cases) {
      const result = annualYearResultAssembly(testCase.input)
      expect(Reflect.get(result, testCase.key), testCase.key).toBe(
        testCase.expected,
      )
      for (const otherKey of OPTIONAL_PUBLICATION_KEYS) {
        if (otherKey === testCase.key) continue
        expect(Object.hasOwn(result, otherKey), `${testCase.key} -> ${otherKey}`)
          .toBe(false)
      }
    }

    const qcdActionPrerequisites = Object.freeze([
      { marker: 'prerequisite-only' },
    ]) as unknown as NonNullable<YearResult['qcdActionPrerequisites']>
    const prerequisitesOnly = annualYearResultAssembly({
      ...base,
      settlement: {
        qcdActionPrerequisites: {
          evidence: qcdActionPrerequisites,
        } as unknown as NonNullable<
          AnnualYearResultAssemblyInput['settlement']['qcdActionPrerequisites']
        >,
      },
    })
    expect(prerequisitesOnly.qcdActionPrerequisites).toBe(
      qcdActionPrerequisites,
    )
    expect(prerequisitesOnly).not.toHaveProperty('qcdActionExecution')

    const qcdActionExecution = Object.freeze({
      marker: 'execution-without-prerequisite',
    }) as unknown as NonNullable<YearResult['qcdActionExecution']>
    const executionOnly = annualYearResultAssembly({
      ...base,
      retirement: { ...base.retirement, qcdActionExecution },
    })
    expect(executionOnly).not.toHaveProperty('qcdActionPrerequisites')
    expect(executionOnly).not.toHaveProperty('qcdActionExecution')
  })
})
