import { describe, expect, it } from 'vitest'
import type { YearExpenses } from './types.js'
import {
  beginSimulatorAnnualPassTransaction,
  SimulatorAnnualPassTransactionSettledError,
  type SimulatorAnnualPassBalanceRecord,
  type SimulatorAnnualPassStateBindings,
  type SimulatorAnnualPassValueBinding,
} from './annualPassTransaction.js'

interface ScalarState {
  nextRetirementRuntimeMutationOrdinal: number
  unassignedCash: number
  priorYearPortfolioReturnPct: number
  capitalLossPool: number
  hsaReimbursablePool: number
  depletionYear: number | null
  conversionNontaxable: number
  healthcare: number
  qualifiedMedicalThisYear: number
  hsaQualifiedCap: number
  requiredSpendingBase: number
  targetSpendingBase: number
}

function valueBinding<Key extends keyof ScalarState>(
  state: ScalarState,
  key: Key,
): SimulatorAnnualPassValueBinding<ScalarState[Key]> {
  return {
    read: () => state[key],
    write: (value) => {
      state[key] = value
    },
  }
}

function expenses(): YearExpenses {
  return {
    baseSpending: 10,
    oneTimeGoals: 20,
    debtService: 30,
    propertyCosts: 40,
    healthcare: 50,
    insurancePremiums: 60,
    careCost: 70,
    ltcBenefit: 80,
    requiredSpending: 90,
    targetSpending: 100,
    idealSpending: 110,
    excessSpending: 120,
    intendedSpending: 130,
    guardrailFactor: 0.9,
    total: 140,
  }
}

function fixture(): {
  bindings: SimulatorAnnualPassStateBindings
  scalars: ScalarState
  originalBalances: SimulatorAnnualPassBalanceRecord[]
} {
  const scalars: ScalarState = {
    nextRetirementRuntimeMutationOrdinal: 3,
    unassignedCash: 1,
    priorYearPortfolioReturnPct: 2,
    capitalLossPool: 3,
    hsaReimbursablePool: 4,
    depletionYear: null,
    conversionNontaxable: 5,
    healthcare: 6,
    qualifiedMedicalThisYear: 7,
    hsaQualifiedCap: 8,
    requiredSpendingBase: 9,
    targetSpendingBase: 10,
  }
  const originalBalances: SimulatorAnnualPassBalanceRecord[] = [
    { account: { id: 'cash' }, balance: 1_000, costBasis: 0 },
    { account: { id: 'brokerage' }, balance: 2_000, costBasis: 1_250 },
  ]
  const bindings: SimulatorAnnualPassStateBindings = {
    balances: [...originalBalances],
    retirementRuntimeOccurrences: [{
      producerOccurrenceKey: '["ownedIraRmd","ira"]',
      kind: 'ownedIraRmd',
      grossAmountPlanDollars: 10,
      ownerPersonId: 'owner',
      sourceAccountId: 'ira',
      executionDate: null,
      executionSequence: null,
      movementAuthorityId: null,
    }],
    retirementRuntimeApplications: [
      {
        applicationKind: 'debit',
        producerOccurrenceKey: '["ownedIraRmd","ira"]',
        simulatorPhase: 'ownerRmdDistribution',
        mutationOrdinal: 1,
        ownerPersonId: 'owner',
        sourceAccountId: 'ira',
        sourceBalanceBeforePlanDollars: 100,
        appliedAmountPlanDollars: 10,
        sourceBalanceAfterPlanDollars: 90,
      },
      {
        applicationKind: 'aggregateRothDestinationCredit',
        simulatorPhase: 'legacyRothConversionAggregateDestinationCredit',
        mutationOrdinal: 2,
        producerOccurrenceKey: null,
        ownerPersonId: null,
        sourceAccountId: null,
        sourceBalanceBeforePlanDollars: null,
        sourceBalanceAfterPlanDollars: null,
        producerOccurrenceKeys: ['["legacyRothConversion","ira","roth"]'],
        sourceOwnerPersonIds: ['owner'],
        destinationRothAccountId: 'roth',
        destinationOwnerPersonId: 'owner',
        destinationBalanceBeforePlanDollars: 0,
        destinationCreditedAmountPlanDollars: 5,
        destinationBalanceAfterPlanDollars: 5,
      },
    ],
    nextRetirementRuntimeMutationOrdinal:
      valueBinding(scalars, 'nextRetirementRuntimeMutationOrdinal'),
    iraProRata: new Map([
      ['owner', { basis: 900, nontaxableFraction: 0.3 }],
      ['deleted-owner', { basis: 100, nontaxableFraction: 0.1 }],
    ]),
    iraBasisByOwner: new Map([
      ['owner', 900],
      ['deleted-owner', 100],
    ]),
    rothBasis: new Map([
      [
        'owner',
        {
          contributionBasis: 600,
          conversionLayers: [
            { year: 2028, amount: 400, taxableAmount: 350 },
            { year: 2029, amount: 300, taxableAmount: 250 },
          ],
        },
      ],
      ['deleted-owner', { contributionBasis: 10, conversionLayers: [] }],
    ]),
    rothAssumedContributionRemaining: new Map([
      ['owner', 150],
      ['deleted-owner', 10],
    ]),
    rothCounterfactualFreeCoverConsumed: new Map([
      ['owner', 25],
      ['deleted-owner', 5],
    ]),
    propertyValues: new Map([
      ['home', 500_000],
      ['deleted-property', 50_000],
    ]),
    hecmStates: new Map([
      ['home', { principalLimit: 200_000, loanBalance: 25_000 }],
      ['deleted-property', { principalLimit: 10_000, loanBalance: 1_000 }],
    ]),
    insuranceCashValues: new Map([
      ['whole-life', 20_000],
      ['deleted-policy', 2_000],
    ]),
    allocationTrack: new Map([
      [
        'brokerage',
        {
          policy: {
            mode: 'static',
            rebalancing: 'annual',
            weights: { usStocks: 60, intlStocks: 10, bonds: 25, cash: 5 },
          },
          weights: [60, 10, 25, 5],
        },
      ],
      [
        'deleted-account',
        {
          policy: {
            mode: 'static',
            rebalancing: 'none',
            weights: { usStocks: 0, intlStocks: 0, bonds: 0, cash: 100 },
          },
          weights: [0, 0, 0, 100],
        },
      ],
    ]),
    seppAmortAmount: new Map([
      ['sepp-account', 12_000],
      ['deleted-sepp-account', 1_200],
    ]),
    magiHistory: new Map([
      [2029, 75_000],
      [2028, 70_000],
    ]),
    namedQcdOffsetConsumedByDonor: new Map([
      ['donor', 1_200],
      ['deleted-donor', 300],
    ]),
    namedQcdOffsetHistoryUnprovable: new Set([
      'unprovable-donor',
      'deleted-unprovable-donor',
    ]),
    warnings: new Set(['first warning', 'second warning']),
    unassignedCash: valueBinding(scalars, 'unassignedCash'),
    priorYearPortfolioReturnPct: valueBinding(scalars, 'priorYearPortfolioReturnPct'),
    capitalLossPool: valueBinding(scalars, 'capitalLossPool'),
    hsaReimbursablePool: valueBinding(scalars, 'hsaReimbursablePool'),
    depletionYear: valueBinding(scalars, 'depletionYear'),
    conversionNontaxable: valueBinding(scalars, 'conversionNontaxable'),
    healthcare: valueBinding(scalars, 'healthcare'),
    qualifiedMedicalThisYear: valueBinding(scalars, 'qualifiedMedicalThisYear'),
    hsaQualifiedCap: valueBinding(scalars, 'hsaQualifiedCap'),
    requiredSpendingBase: valueBinding(scalars, 'requiredSpendingBase'),
    targetSpendingBase: valueBinding(scalars, 'targetSpendingBase'),
    expenses: expenses(),
  }
  return { bindings, scalars, originalBalances }
}

function stateBytes(bindings: SimulatorAnnualPassStateBindings): string {
  return JSON.stringify({
    balances: bindings.balances.map(({ account, balance, costBasis }) => ({ id: account.id, balance, costBasis })),
    retirementRuntimeOccurrences: bindings.retirementRuntimeOccurrences,
    retirementRuntimeApplications: bindings.retirementRuntimeApplications,
    nextRetirementRuntimeMutationOrdinal:
      bindings.nextRetirementRuntimeMutationOrdinal.read(),
    iraProRata: [...bindings.iraProRata],
    iraBasisByOwner: [...bindings.iraBasisByOwner],
    rothBasis: [...bindings.rothBasis],
    rothAssumedContributionRemaining: [...bindings.rothAssumedContributionRemaining],
    rothCounterfactualFreeCoverConsumed: [...bindings.rothCounterfactualFreeCoverConsumed],
    propertyValues: [...bindings.propertyValues],
    hecmStates: [...bindings.hecmStates],
    insuranceCashValues: [...bindings.insuranceCashValues],
    allocationTrack: [...bindings.allocationTrack],
    seppAmortAmount: [...bindings.seppAmortAmount],
    magiHistory: [...bindings.magiHistory],
    namedQcdOffsetConsumedByDonor: [...bindings.namedQcdOffsetConsumedByDonor],
    namedQcdOffsetHistoryUnprovable: [
      ...bindings.namedQcdOffsetHistoryUnprovable,
    ],
    warnings: [...bindings.warnings],
    scalars: {
      unassignedCash: bindings.unassignedCash.read(),
      priorYearPortfolioReturnPct: bindings.priorYearPortfolioReturnPct.read(),
      capitalLossPool: bindings.capitalLossPool.read(),
      hsaReimbursablePool: bindings.hsaReimbursablePool.read(),
      depletionYear: bindings.depletionYear.read(),
      conversionNontaxable: bindings.conversionNontaxable.read(),
      healthcare: bindings.healthcare.read(),
      qualifiedMedicalThisYear: bindings.qualifiedMedicalThisYear.read(),
      hsaQualifiedCap: bindings.hsaQualifiedCap.read(),
      requiredSpendingBase: bindings.requiredSpendingBase.read(),
      targetSpendingBase: bindings.targetSpendingBase.read(),
    },
    expenses: bindings.expenses,
  })
}

function mutateEntireAnnualPass(bindings: SimulatorAnnualPassStateBindings): void {
  const removedBalance = bindings.balances.shift()!
  removedBalance.balance = 901
  removedBalance.costBasis = 902
  bindings.balances[0]!.balance = 903
  bindings.balances[0]!.costBasis = 904
  bindings.balances.push({ account: { id: 'added-balance' }, balance: 905, costBasis: 906 })
  bindings.balances.reverse()

  ;(bindings.retirementRuntimeOccurrences[0]! as {
    grossAmountPlanDollars: number
  }).grossAmountPlanDollars = 999
  bindings.retirementRuntimeOccurrences.push({
    producerOccurrenceKey: '["automaticSeppDistribution","ira"]',
    kind: 'automaticSeppDistribution',
    grossAmountPlanDollars: 11,
    ownerPersonId: 'owner',
    sourceAccountId: 'ira',
    executionDate: null,
    executionSequence: null,
    movementAuthorityId: null,
  })
  const firstApplication = bindings.retirementRuntimeApplications[0]!
  if (firstApplication.applicationKind === 'aggregateRothDestinationCredit') {
    throw new Error('expected debit application')
  }
  ;(firstApplication as {
    sourceBalanceAfterPlanDollars: number
  }).sourceBalanceAfterPlanDollars = 1
  const aggregateApplication = bindings.retirementRuntimeApplications[1]!
  if (aggregateApplication.applicationKind !==
      'aggregateRothDestinationCredit') {
    throw new Error('expected aggregate credit application')
  }
  ;(aggregateApplication.producerOccurrenceKeys as string[]).push('foreign')
  ;(aggregateApplication.sourceOwnerPersonIds as Array<string | null>)
    .push('foreign-owner')
  bindings.retirementRuntimeApplications.push({
    applicationKind: 'aggregateRothDestinationCredit',
    simulatorPhase: 'legacyRothConversionAggregateDestinationCredit',
    mutationOrdinal: 2,
    producerOccurrenceKey: null,
    ownerPersonId: null,
    sourceAccountId: null,
    sourceBalanceBeforePlanDollars: null,
    sourceBalanceAfterPlanDollars: null,
    producerOccurrenceKeys: ['["legacyRothConversion","ira","roth"]'],
    sourceOwnerPersonIds: ['owner'],
    destinationRothAccountId: 'roth',
    destinationOwnerPersonId: 'owner',
    destinationBalanceBeforePlanDollars: 0,
    destinationCreditedAmountPlanDollars: 5,
    destinationBalanceAfterPlanDollars: 5,
  })
  bindings.nextRetirementRuntimeMutationOrdinal.write(99)

  const proRata = bindings.iraProRata.get('owner')!
  proRata.basis = 801
  proRata.nontaxableFraction = 0.8
  bindings.iraProRata.delete('deleted-owner')
  bindings.iraProRata.set('added-owner', { basis: 802, nontaxableFraction: 0.2 })
  bindings.iraBasisByOwner.set('owner', 803)
  bindings.iraBasisByOwner.delete('deleted-owner')
  bindings.iraBasisByOwner.set('added-owner', 804)

  const roth = bindings.rothBasis.get('owner')!
  roth.contributionBasis = 701
  roth.conversionLayers[0]!.year = 2031
  roth.conversionLayers[0]!.amount = 702
  roth.conversionLayers[0]!.taxableAmount = 703
  roth.conversionLayers.pop()
  roth.conversionLayers.push({ year: 2032, amount: 704, taxableAmount: 705 })
  bindings.rothBasis.delete('deleted-owner')
  bindings.rothBasis.set('added-owner', { contributionBasis: 706, conversionLayers: [] })
  bindings.rothAssumedContributionRemaining.set('owner', 707)
  bindings.rothAssumedContributionRemaining.delete('deleted-owner')
  bindings.rothAssumedContributionRemaining.set('added-owner', 708)
  bindings.rothCounterfactualFreeCoverConsumed.set('owner', 709)
  bindings.rothCounterfactualFreeCoverConsumed.delete('deleted-owner')
  bindings.rothCounterfactualFreeCoverConsumed.set('added-owner', 710)

  bindings.propertyValues.set('home', 601)
  bindings.propertyValues.delete('deleted-property')
  bindings.propertyValues.set('added-property', 602)
  const hecm = bindings.hecmStates.get('home')!
  hecm.principalLimit = 603
  hecm.loanBalance = 604
  bindings.hecmStates.delete('deleted-property')
  bindings.hecmStates.set('added-property', { principalLimit: 605, loanBalance: 606 })
  bindings.insuranceCashValues.set('whole-life', 607)
  bindings.insuranceCashValues.delete('deleted-policy')
  bindings.insuranceCashValues.set('added-policy', 608)

  const allocation = bindings.allocationTrack.get('brokerage')!
  if (allocation.policy.mode !== 'static') throw new Error('fixture policy changed unexpectedly')
  allocation.policy.rebalancing = 'none'
  allocation.policy.weights.usStocks = 1
  allocation.policy.weights.intlStocks = 2
  allocation.policy.weights.bonds = 3
  allocation.policy.weights.cash = 94
  allocation.weights.splice(0, allocation.weights.length, 1, 2, 3, 94, 999)
  bindings.allocationTrack.delete('deleted-account')
  bindings.allocationTrack.set('added-account', {
    policy: {
      mode: 'static',
      rebalancing: 'annual',
      weights: { usStocks: 25, intlStocks: 25, bonds: 25, cash: 25 },
    },
    weights: [25, 25, 25, 25],
  })
  bindings.seppAmortAmount.set('sepp-account', 609)
  bindings.seppAmortAmount.delete('deleted-sepp-account')
  bindings.seppAmortAmount.set('added-sepp-account', 610)

  bindings.magiHistory.set(2029, 501)
  bindings.magiHistory.delete(2028)
  bindings.magiHistory.set(2030, 502)
  bindings.namedQcdOffsetConsumedByDonor.set('donor', 1_900)
  bindings.namedQcdOffsetConsumedByDonor.delete('deleted-donor')
  bindings.namedQcdOffsetConsumedByDonor.set('added-donor', 700)
  bindings.namedQcdOffsetHistoryUnprovable.delete('deleted-unprovable-donor')
  bindings.namedQcdOffsetHistoryUnprovable.add('added-unprovable-donor')
  bindings.warnings.clear()
  bindings.warnings.add('probe-only warning')

  bindings.unassignedCash.write(401)
  bindings.priorYearPortfolioReturnPct.write(402)
  bindings.capitalLossPool.write(403)
  bindings.hsaReimbursablePool.write(404)
  bindings.depletionYear.write(2035)
  bindings.conversionNontaxable.write(406)
  bindings.healthcare.write(407)
  bindings.qualifiedMedicalThisYear.write(408)
  bindings.hsaQualifiedCap.write(409)
  bindings.requiredSpendingBase.write(410)
  bindings.targetSpendingBase.write(411)

  for (const key of Object.keys(bindings.expenses) as Array<keyof YearExpenses>) {
    bindings.expenses[key] += 1_000
  }
  delete (bindings.expenses as unknown as Record<string, unknown>).healthcare
  ;(bindings.expenses as unknown as Record<string, unknown>).probeOnly = 999
}

describe('simulator annual-pass transaction', () => {
  it('restores original binding references after hostile replacements', () => {
    const { bindings } = fixture()
    const references = { ...bindings }
    const balanceRecords = [...bindings.balances]
    const accounts = bindings.balances.map((record) => record.account)
    const capitalLossPoolRead = bindings.capitalLossPool.read
    const capitalLossPoolWrite = bindings.capitalLossPool.write
    const transaction = beginSimulatorAnnualPassTransaction(bindings)

    bindings.balances = bindings.balances.map((record) => ({
      account: { ...record.account },
      balance: record.balance,
      costBasis: record.costBasis,
    }))
    bindings.retirementRuntimeOccurrences = [
      ...bindings.retirementRuntimeOccurrences,
    ]
    bindings.iraBasisByOwner = new Map(bindings.iraBasisByOwner)
    bindings.capitalLossPool = {
      read: references.capitalLossPool.read,
      write: references.capitalLossPool.write,
    }
    ;(references.capitalLossPool as {
      read: () => number
      write: (value: number) => void
    }).read = () => capitalLossPoolRead() + 1
    ;(references.capitalLossPool as {
      read: () => number
      write: (value: number) => void
    }).write = () => {}
    bindings.expenses = { ...bindings.expenses }

    transaction.rollback()

    for (const key of Object.keys(references) as
      Array<keyof SimulatorAnnualPassStateBindings>) {
      expect(bindings[key]).toBe(references[key])
    }
    bindings.balances.forEach((record, index) => {
      expect(record).toBe(balanceRecords[index])
      expect(record.account).toBe(accounts[index])
    })
    expect(bindings.capitalLossPool.read).toBe(capitalLossPoolRead)
    expect(bindings.capitalLossPool.write).toBe(capitalLossPoolWrite)
  })

  it('exactly rolls back every named container/local and restores balance member identity', () => {
    const { bindings, originalBalances } = fixture()
    const before = stateBytes(bindings)
    const originalContainers = {
      balances: bindings.balances,
      retirementRuntimeOccurrences: bindings.retirementRuntimeOccurrences,
      retirementRuntimeApplications: bindings.retirementRuntimeApplications,
      iraProRata: bindings.iraProRata,
      rothBasis: bindings.rothBasis,
      seppAmortAmount: bindings.seppAmortAmount,
      warnings: bindings.warnings,
      expenses: bindings.expenses,
    }
    const transaction = beginSimulatorAnnualPassTransaction<{ amount: number }>(bindings)
    transaction.defer({ amount: 123 })

    mutateEntireAnnualPass(bindings)
    const settlement = transaction.rollback()

    expect(transaction.status).toBe('rolledBack')
    expect(settlement).toEqual({ status: 'rolledBack', deferredEffects: [] })
    expect(Object.isFrozen(settlement)).toBe(true)
    expect(Object.isFrozen(settlement.deferredEffects)).toBe(true)
    expect(stateBytes(bindings)).toBe(before)
    expect(bindings.balances).toBe(originalContainers.balances)
    expect(bindings.balances[0]).toBe(originalBalances[0])
    expect(bindings.balances[1]).toBe(originalBalances[1])
    expect(bindings.retirementRuntimeOccurrences).toBe(
      originalContainers.retirementRuntimeOccurrences,
    )
    expect(bindings.retirementRuntimeApplications).toBe(
      originalContainers.retirementRuntimeApplications,
    )
    expect(bindings.iraProRata).toBe(originalContainers.iraProRata)
    expect(bindings.rothBasis).toBe(originalContainers.rothBasis)
    expect(bindings.seppAmortAmount).toBe(originalContainers.seppAmortAmount)
    expect(bindings.warnings).toBe(originalContainers.warnings)
    expect(bindings.expenses).toBe(originalContainers.expenses)
    expect([...bindings.warnings]).toEqual(['first warning', 'second warning'])
  })

  it('restores the named-QCD donor ledgers a rolled-back attempt wrote', () => {
    // The two ledgers the simulator keeps across the year loop: how much of a
    // donor's post-70½ deductible-contribution offset this run's own gifts have
    // already spent, and which donors' offset history the run cannot state at
    // all. Both are written inside the annual pass and read by the next one, so
    // an attempt that is rolled back must leave neither behind: an abandoned
    // gift that kept its consumption standing would make the retry -- or the
    // legacy fallback the simulator drops to after a rolled-back settlement --
    // charge a second gift against an offset no committed gift ever consumed.
    //
    // Asserted byte-equal rather than economically equal, and on the original
    // containers rather than on replacements, because the simulator holds these
    // two by reference in closures that outlive the transaction.
    const { bindings } = fixture()
    const consumed = bindings.namedQcdOffsetConsumedByDonor
    const unprovable = bindings.namedQcdOffsetHistoryUnprovable
    const before = stateBytes(bindings)
    const transaction = beginSimulatorAnnualPassTransaction(bindings)

    consumed.set('donor', 2_400)
    consumed.set('gifted-this-attempt', 5_000)
    consumed.delete('deleted-donor')
    unprovable.add('unprovable-this-attempt')
    unprovable.delete('deleted-unprovable-donor')

    transaction.rollback()

    expect(stateBytes(bindings)).toBe(before)
    expect(bindings.namedQcdOffsetConsumedByDonor).toBe(consumed)
    expect(bindings.namedQcdOffsetHistoryUnprovable).toBe(unprovable)
    expect([...consumed]).toEqual([['donor', 1_200], ['deleted-donor', 300]])
    expect([...unprovable])
      .toEqual(['unprovable-donor', 'deleted-unprovable-donor'])
  })

  it('does not freeze or otherwise take ownership of simulator-provided state', () => {
    const { bindings, originalBalances } = fixture()
    beginSimulatorAnnualPassTransaction(bindings)

    expect(Object.isFrozen(bindings.balances)).toBe(false)
    expect(Object.isFrozen(originalBalances[0])).toBe(false)
    expect(Object.isFrozen(bindings.rothBasis.get('owner'))).toBe(false)
    expect(Object.isFrozen(bindings.rothBasis.get('owner')!.conversionLayers)).toBe(false)
    expect(Object.isFrozen(bindings.allocationTrack.get('brokerage')!.policy)).toBe(false)
    expect(Object.isFrozen(bindings.expenses)).toBe(false)
  })

  it('commits mutations and flushes inert deferred values exactly once in order', () => {
    const { bindings } = fixture()
    const transaction = beginSimulatorAnnualPassTransaction<{ id: string }>(bindings)
    const first = { id: 'first' }
    const second = { id: 'second' }
    transaction.defer(first)
    transaction.defer(second)
    bindings.unassignedCash.write(42)
    bindings.warnings.add('committed warning')

    const settlement = transaction.commit()

    expect(transaction.status).toBe('committed')
    expect(settlement).toEqual({ status: 'committed', deferredEffects: [first, second] })
    expect(settlement.deferredEffects[0]).toBe(first)
    expect(Object.isFrozen(settlement)).toBe(true)
    expect(Object.isFrozen(settlement.deferredEffects)).toBe(true)
    expect(Object.isFrozen(first)).toBe(false)
    expect(bindings.unassignedCash.read()).toBe(42)
    expect(bindings.warnings.has('committed warning')).toBe(true)
    expect(() => transaction.commit()).toThrow(SimulatorAnnualPassTransactionSettledError)
    expect(() => transaction.rollback()).toThrow(SimulatorAnnualPassTransactionSettledError)
    expect(() => transaction.defer({ id: 'late' })).toThrow(SimulatorAnnualPassTransactionSettledError)
  })

  it('drops deferred values on rollback and rejects every later settlement/defer operation', () => {
    const { bindings } = fixture()
    const transaction = beginSimulatorAnnualPassTransaction<{ id: string }>(bindings)
    transaction.defer({ id: 'discarded' })

    transaction.rollback()

    expect(() => transaction.rollback()).toThrow(SimulatorAnnualPassTransactionSettledError)
    expect(() => transaction.commit()).toThrow(SimulatorAnnualPassTransactionSettledError)
    expect(() => transaction.defer({ id: 'late' })).toThrow(SimulatorAnnualPassTransactionSettledError)
  })

  it('makes a rollback/retry byte-equivalent to one clean application with no double-applied effect', () => {
    const retry = fixture()
    const clean = fixture()
    const before = stateBytes(retry.bindings)

    const abandoned = beginSimulatorAnnualPassTransaction<{ amount: number }>(retry.bindings)
    mutateEntireAnnualPass(retry.bindings)
    abandoned.defer({ amount: 25 })
    abandoned.rollback()
    expect(stateBytes(retry.bindings)).toBe(before)

    const retried = beginSimulatorAnnualPassTransaction<{ amount: number }>(retry.bindings)
    mutateEntireAnnualPass(retry.bindings)
    retried.defer({ amount: 25 })
    const retrySettlement = retried.commit()

    const direct = beginSimulatorAnnualPassTransaction<{ amount: number }>(clean.bindings)
    mutateEntireAnnualPass(clean.bindings)
    direct.defer({ amount: 25 })
    const directSettlement = direct.commit()

    expect(stateBytes(retry.bindings)).toBe(stateBytes(clean.bindings))
    expect(retrySettlement).toEqual(directSettlement)
    expect(retrySettlement.deferredEffects).toHaveLength(1)
  })
})
