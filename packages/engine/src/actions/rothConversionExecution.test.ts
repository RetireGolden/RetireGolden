import { describe, expect, it } from 'vitest'

import type { Plan } from '../model/plan.js'
import { singlePersonPlan, traditionalAccount } from '../testing/planFixtures.js'
import { rothConversionRequestSchema, type RothConversionRequest } from './contract.js'
import { asUsdCents } from './money.js'
import {
  executeRothConversions,
  type ExecuteRothConversionsInput,
} from './rothConversionExecution.js'

const year = 2030

function plan(): Plan {
  const value = singlePersonPlan({ dob: '1960-01-01', planningAge: 100 })
  value.accounts = [
    traditionalAccount('traditional-a', 100, 'p1'),
    traditionalAccount('traditional-b', 100, 'p1'),
    {
      id: 'roth-a',
      name: 'Roth A',
      type: 'roth',
      kind: 'ira',
      ownerPersonId: 'p1',
      balance: 0,
      annualContribution: 0,
      annualReturnPct: 0,
    },
  ]
  value.retirementActionEligibilityFacts = {
    iraClassifications: ['traditional-a', 'traditional-b'].map((sourceAccountId) => ({
      sourceAccountId,
      subtype: 'traditional' as const,
      evidenceId: `classification-${sourceAccountId}`,
      provenance: { source: 'manual' as const },
    })),
    sepSimpleActivities: [],
    deductibleIraContributions: [],
  }
  return value
}

function request(
  actionId = 'conversion-a',
  sequence = 1,
  allocations = [
    { allocationId: 'allocation-a', sourceAccountId: 'traditional-a', requestedAmount: 6_000 },
    { allocationId: 'allocation-b', sourceAccountId: 'traditional-b', requestedAmount: 4_000 },
  ],
): RothConversionRequest {
  return rothConversionRequestSchema.parse({
    actionId,
    kind: 'rothConversion',
    personId: 'p1',
    year,
    executionDate: '2030-12-15',
    executionSequence: sequence,
    requestedAmount: allocations.reduce((sum, allocation) => sum + allocation.requestedAmount, 0),
    allocations,
    destinationRothAccountId: 'roth-a',
    taxFunding: { kind: 'noneExpected' },
    provenance: { source: 'manual' },
  })
}

function input(requests: readonly RothConversionRequest[] = [request()]): ExecuteRothConversionsInput {
  return {
    year,
    plan: plan(),
    requests,
    openingBalances: [
      { accountId: 'traditional-a', openingBalance: asUsdCents(8_000) },
      { accountId: 'traditional-b', openingBalance: asUsdCents(5_000) },
      { accountId: 'roth-a', openingBalance: asUsdCents(1_000) },
    ],
    runtimeEvidence: {
      personAliveEvidence: requests.map((value) => ({
        evidenceId: `alive-${value.actionId}`,
        actionId: value.actionId,
        personId: value.personId,
        actionYear: value.year,
        actionDate: value.executionDate ?? null,
        alive: true,
      })),
    },
  }
}

describe('executeRothConversions', () => {
  it('publishes request-keyed prerequisite evidence without moving money', () => {
    const result = executeRothConversions(input())

    expect(result).toMatchObject({
      committed: false,
      scheduleIssues: [],
      balances: [
        { accountId: 'roth-a', openingBalance: 1_000, closingBalance: 1_000 },
        { accountId: 'traditional-a', openingBalance: 8_000, closingBalance: 8_000 },
        { accountId: 'traditional-b', openingBalance: 5_000, closingBalance: 5_000 },
      ],
      evidence: [{
        actionId: 'conversion-a',
        outcome: 'unsupported',
        readiness: 'nonActionable',
        requestedAmount: 10_000,
        executedAmount: 0,
        unexecutedAmount: 10_000,
        destinationCreditAmount: 0,
        taxableConvertedAmount: 0,
        nontaxableConvertedAmount: 0,
        taxFunding: { status: 'unsupported', evidenceId: null },
      }],
    })
    expect(result.evidence[0]?.reasons.map((reason) => reason.code)).toEqual(
      expect.arrayContaining([
        'conversion-basis-evidence-missing',
        'conversion-rmd-reserve-unavailable',
        'conversion-tax-funding-evidence-unsupported',
      ]),
    )
    expect(Object.isFrozen(result)).toBe(true)
    expect(Object.isFrozen(result.evidence[0])).toBe(true)
  })

  it('is stable under request, account, and allocation permutations', () => {
    const first = request('conversion-a', 1)
    const second = request('conversion-b', 2, [{
      allocationId: 'allocation-c',
      sourceAccountId: 'traditional-a',
      requestedAmount: 1_000,
    }])
    const baseline = input([first, second])
    const permuted = structuredClone(baseline)
    permuted.openingBalances = [...permuted.openingBalances].reverse()
    permuted.requests = [...permuted.requests].reverse().map((value) => ({
      ...value,
      allocations: [...value.allocations].reverse(),
    }))
    permuted.runtimeEvidence = {
      personAliveEvidence: [
        ...(permuted.runtimeEvidence?.personAliveEvidence ?? []),
      ].reverse(),
    }

    expect(executeRothConversions(permuted)).toEqual(executeRothConversions(baseline))
  })

  it('keeps every peer in an owner-year group non-actionable and unchanged', () => {
    const result = executeRothConversions(input([
      request('conversion-a', 1),
      request('conversion-b', 2, [{
        allocationId: 'allocation-c',
        sourceAccountId: 'traditional-a',
        requestedAmount: 1_000,
      }]),
    ]))

    expect(result.evidence).toHaveLength(2)
    expect(result.evidence.every(
      (entry) => entry.readiness === 'nonActionable' && entry.executedAmount === 0,
    )).toBe(true)
    expect(result.balances.every(
      (balance) => balance.openingBalance === balance.closingBalance,
    )).toBe(true)
  })

  it('adds source and destination refusal reasons without weakening fail-closed status', () => {
    const value = input()
    const valuePlan = value.plan as Plan
    valuePlan.accounts.find((account) => account.id === 'roth-a')!.ownerPersonId = 'p2'
    const source = valuePlan.accounts.find((account) => account.id === 'traditional-a')
    if (source?.type !== 'traditional') throw new Error('fixture drift')
    source.kind = 'employer'
    const result = executeRothConversions(value)

    expect(result.evidence[0]).toMatchObject({
      outcome: 'unsupported',
      readiness: 'nonActionable',
      executedAmount: 0,
    })
    expect(result.evidence[0]?.reasons.map((reason) => reason.code)).toEqual(
      expect.arrayContaining([
        'conversion-destination-incompatible',
        'conversion-source-not-convertible',
      ]),
    )
  })

  it('rejects duplicate schedule identities before publishing evidence', () => {
    const first = request('conversion-a', 1)
    const duplicatePosition = request('conversion-b', 1)
    const forward = executeRothConversions(input([first, duplicatePosition]))
    const reverse = executeRothConversions(input([duplicatePosition, first]))

    expect(reverse).toEqual(forward)
    expect(forward).toMatchObject({
      committed: false,
      evidence: [],
      scheduleIssues: [{
        kind: 'duplicateSchedulePosition',
        actionId: 'conversion-b',
      }],
    })
  })

  it('rejects duplicate account and balance identities with unchanged snapshots', () => {
    const duplicatePlan = input()
    ;(duplicatePlan.plan as Plan).accounts.push({ ...(duplicatePlan.plan as Plan).accounts[0]! })
    const planResult = executeRothConversions(duplicatePlan)
    expect(planResult).toMatchObject({ committed: false, evidence: [] })
    expect(planResult.balances.every(
      (balance) => balance.openingBalance === balance.closingBalance,
    )).toBe(true)

    const duplicateBalance = input()
    const conflictingSnapshot = {
      ...duplicateBalance.openingBalances[0]!,
      openingBalance: asUsdCents(9_000),
    }
    duplicateBalance.openingBalances = [
      ...duplicateBalance.openingBalances,
      conflictingSnapshot,
    ]
    const forward = executeRothConversions(duplicateBalance)
    const reversed = executeRothConversions({
      ...duplicateBalance,
      openingBalances: [...duplicateBalance.openingBalances].reverse(),
    })
    expect(reversed).toEqual(forward)
    expect(forward).toMatchObject({
      committed: false,
      evidence: [],
      scheduleIssues: [{ kind: 'invalidInput' }],
    })
  })

  it('does not overflow or alter a maximum-safe destination snapshot', () => {
    const value = input()
    value.openingBalances = value.openingBalances.map((balance) =>
      balance.accountId === 'roth-a'
        ? { ...balance, openingBalance: asUsdCents(Number.MAX_SAFE_INTEGER) }
        : balance,
    )
    const result = executeRothConversions(value)

    expect(result.balances.find((balance) => balance.accountId === 'roth-a')).toEqual({
      accountId: 'roth-a',
      openingBalance: Number.MAX_SAFE_INTEGER,
      closingBalance: Number.MAX_SAFE_INTEGER,
    })
  })

  it('fails closed without invoking hostile getters', () => {
    const value = input()
    Object.defineProperty(value, 'year', {
      enumerable: true,
      get: () => { throw new Error('hostile getter') },
    })

    expect(executeRothConversions(value)).toMatchObject({
      committed: false,
      balances: [],
      evidence: [],
      scheduleIssues: [{ kind: 'invalidInput' }],
    })
  })
})
