import { describe, expect, it } from 'vitest'

import {
  asAccountId,
  asActionId,
  asAllocationId,
  asPersonId,
  asPositiveUsdCents,
  asUsdCents,
  assessConversionLinkedWithdrawalGroups,
  rothConversionRequestSchema,
  type ConversionLinkedWithdrawalGroupAssessment,
  type OrdinaryWithdrawalRequest,
  type RetirementActionRequest,
  type RothConversionRequest,
} from '../../actions/index.js'
import type { Plan } from '../../model/plan.js'
import {
  singlePersonPlan,
  traditionalAccount,
} from '../../testing/planFixtures.js'
import {
  annualRothConversionExecutionInput,
  type AnnualRothConversionExecutionInput,
} from './annualRothConversionExecutionInput.js'

const YEAR = 2030
const PERSON_ID = asPersonId('p1')
const SOURCE_A_ID = asAccountId('traditional-a')
const SOURCE_B_ID = asAccountId('traditional-b')
const ROTH_ID = asAccountId('roth-a')

function conversion(
  taxFunding: RothConversionRequest['taxFunding'] = { kind: 'noneExpected' },
): RothConversionRequest {
  return rothConversionRequestSchema.parse({
    actionId: 'conversion-a',
    kind: 'rothConversion',
    personId: PERSON_ID,
    year: YEAR,
    executionDate: `${YEAR}-12-15`,
    executionSequence: 2,
    requestedAmount: 10_000,
    allocations: [
      {
        allocationId: 'allocation-b',
        sourceAccountId: SOURCE_B_ID,
        requestedAmount: 4_000,
      },
      {
        allocationId: 'allocation-a',
        sourceAccountId: SOURCE_A_ID,
        requestedAmount: 6_000,
      },
    ],
    destinationRothAccountId: ROTH_ID,
    taxFunding,
    provenance: { source: 'manual' },
  })
}

function plan(
  requests: readonly RetirementActionRequest[] = [conversion()],
): Plan {
  const value = singlePersonPlan({ dob: '1960-01-01', planningAge: 100 })
  value.id = 'annual-roth-conversion-execution-input'
  value.accounts = [
    traditionalAccount(SOURCE_A_ID, 100, PERSON_ID),
    traditionalAccount(SOURCE_B_ID, 100, PERSON_ID),
    {
      id: ROTH_ID,
      name: 'Roth A',
      type: 'roth',
      kind: 'ira',
      ownerPersonId: PERSON_ID,
      balance: 0,
      annualContribution: 0,
      annualReturnPct: 0,
    },
  ]
  value.strategies.retirementActions = [...requests]
  return value
}

const emptyGroups: Readonly<ConversionLinkedWithdrawalGroupAssessment> =
  Object.freeze({ groups: Object.freeze([]) })

function input(
  overrides: Partial<AnnualRothConversionExecutionInput> = {},
): AnnualRothConversionExecutionInput {
  const requests = [conversion()]
  return {
    taxYear: YEAR,
    plan: plan(requests),
    requests,
    mixedKindScheduleBlocked: false,
    people: [{ personId: PERSON_ID, alive: true }],
    balances: [
      { accountId: SOURCE_B_ID, balancePlanDollars: 50.009 },
      { accountId: ROTH_ID, balancePlanDollars: 10.006 },
      { accountId: SOURCE_A_ID, balancePlanDollars: 80.009 },
      { accountId: 'unrelated', balancePlanDollars: 999 },
    ],
    ownerRmd: [{
      ownerPersonId: PERSON_ID,
      requiredPlanDollars: 100,
      unsatisfiedPlanDollars: 25,
    }],
    ownerBasis: [{ ownerPersonId: PERSON_ID, basisPlanDollars: 30 }],
    observedLinkedWithdrawalGroups: emptyGroups,
    linkedWithdrawalGroups: emptyGroups,
    ordinaryWithdrawalEvidence: [],
    ...overrides,
  }
}

function linkedPair(): Readonly<{
  conversion: RothConversionRequest
  withdrawal: OrdinaryWithdrawalRequest
}> {
  const withdrawalActionId = asActionId('withdrawal-a')
  const linkedConversion = conversion({
    kind: 'linkedWithdrawal',
    withdrawalActionId,
  })
  const amount = asPositiveUsdCents(2_500)
  const withdrawal: OrdinaryWithdrawalRequest = {
    actionId: withdrawalActionId,
    kind: 'ordinaryWithdrawal',
    personId: PERSON_ID,
    year: YEAR,
    executionDate: `${YEAR}-12-14`,
    executionSequence: 1,
    requestedAmount: amount,
    allocations: [{
      allocationId: asAllocationId('withdrawal-allocation'),
      sourceAccountId: asAccountId('cash-a'),
      requestedAmount: amount,
    }],
    purpose: { kind: 'taxPayment', referenceId: linkedConversion.actionId },
    provenance: { source: 'manual' },
  }
  return { conversion: linkedConversion, withdrawal }
}

describe('annualRothConversionExecutionInput', () => {
  it('builds exact snapshots and request-keyed eligibility evidence', () => {
    const result = annualRothConversionExecutionInput(input())

    expect(result.status).toBe('ready')
    if (result.status !== 'ready') throw new Error('expected ready input')
    // Source capacity is floored (80.009 -> 8,000 cents), while the Roth
    // destination is only measured and retains half-up rounding
    // (10.006 -> 1,001 cents). The RMD row independently supplies
    // required 100 - unsatisfied 25 = distributed 75 plan dollars.
    expect(result.executorInput.openingBalances).toEqual([
      { accountId: ROTH_ID, openingBalance: asUsdCents(1_001) },
      { accountId: SOURCE_A_ID, openingBalance: asUsdCents(8_000) },
      { accountId: SOURCE_B_ID, openingBalance: asUsdCents(5_000) },
    ])
    expect(result.executorInput.runtimeEvidence).toMatchObject({
      personAliveEvidence: [expect.objectContaining({
        actionId: 'conversion-a',
        alive: true,
      })],
      ownerIraRmdSatisfactionEvidence: [expect.objectContaining({
        requiredAmount: 10_000,
        distributedAmount: 7_500,
      })],
      ownerAggregatedIraBasisEvidence: [expect.objectContaining({
        basisAmount: 3_000,
      })],
    })
  })

  it('fails closed on missing life evidence and preserves proven zero owner facts', () => {
    const result = annualRothConversionExecutionInput(input({
      people: [],
      ownerRmd: [],
      ownerBasis: [],
    }))

    expect(result.status).toBe('ready')
    if (result.status !== 'ready') throw new Error('expected ready input')
    expect(result.executorInput.runtimeEvidence).toMatchObject({
      personAliveEvidence: [expect.objectContaining({ alive: false })],
      ownerIraRmdSatisfactionEvidence: [expect.objectContaining({
        requiredAmount: 0,
        distributedAmount: 0,
      })],
      ownerAggregatedIraBasisEvidence: [expect.objectContaining({
        basisAmount: 0,
      })],
    })
  })

  it('omits facts that cannot cross the exact-cent boundary', () => {
    const result = annualRothConversionExecutionInput(input({
      balances: [
        { accountId: SOURCE_A_ID, balancePlanDollars: Number.NaN },
        { accountId: ROTH_ID, balancePlanDollars: 10 },
      ],
      ownerRmd: [{
        ownerPersonId: PERSON_ID,
        requiredPlanDollars: Number.POSITIVE_INFINITY,
        unsatisfiedPlanDollars: 0,
      }],
      ownerBasis: [{
        ownerPersonId: PERSON_ID,
        basisPlanDollars: Number.NaN,
      }],
    }))

    expect(result.status).toBe('ready')
    if (result.status !== 'ready') throw new Error('expected ready input')
    expect(result.executorInput.openingBalances).toEqual([
      { accountId: ROTH_ID, openingBalance: 1_000 },
    ])
    expect(
      result.executorInput.runtimeEvidence?.ownerIraRmdSatisfactionEvidence,
    ).toEqual([])
    expect(
      result.executorInput.runtimeEvidence?.ownerAggregatedIraBasisEvidence,
    ).toEqual([])
  })

  it('does not prepare a call without a request or across a blocked schedule', () => {
    const noRequest = annualRothConversionExecutionInput(input({
      plan: plan([]),
      requests: [],
    }))
    const blocked = annualRothConversionExecutionInput(input({
      mixedKindScheduleBlocked: true,
    }))

    expect(noRequest).toEqual({
      status: 'notRequested',
      executorInput: null,
      effectiveLinkedWithdrawalGroups: emptyGroups,
    })
    expect(blocked).toEqual({
      status: 'blockedBySchedule',
      executorInput: null,
      effectiveLinkedWithdrawalGroups: emptyGroups,
    })
  })

  it('keeps an all-or-nothing release only when every withdrawal moved whole', () => {
    const pair = linkedPair()
    const requests = [pair.withdrawal, pair.conversion]
    const observed = assessConversionLinkedWithdrawalGroups(requests, {
      annualLiabilityBaseline: 'read',
    })
    const released = assessConversionLinkedWithdrawalGroups(requests, {
      annualLiabilityBaseline: 'read',
      authorizedGroups: [{
        conversionActionId: pair.conversion.actionId,
        withdrawalActionId: pair.withdrawal.actionId,
        funding: {
          requiredFundingAmount: asUsdCents(2_500),
          fundedAmount: asUsdCents(2_500),
        },
      }],
    })
    const shared = {
      plan: plan([pair.withdrawal, pair.conversion]),
      requests: [pair.conversion],
      observedLinkedWithdrawalGroups: observed,
      linkedWithdrawalGroups: released,
    }

    const movedWhole = annualRothConversionExecutionInput(input({
      ...shared,
      ordinaryWithdrawalEvidence: [{
        actionId: pair.withdrawal.actionId,
        requestedAmount: 2_500,
        readiness: 'actionable',
        outcome: 'executed',
        executedAmount: 2_500,
      }],
    }))
    const short = annualRothConversionExecutionInput(input({
      ...shared,
      ordinaryWithdrawalEvidence: [{
        actionId: pair.withdrawal.actionId,
        requestedAmount: 2_500,
        readiness: 'actionable',
        outcome: 'partial',
        executedAmount: 2_499,
      }],
    }))
    const refused = annualRothConversionExecutionInput(input({
      ...shared,
      ordinaryWithdrawalEvidence: [{
        actionId: pair.withdrawal.actionId,
        requestedAmount: 2_500,
        readiness: 'actionable',
        outcome: 'refused',
        executedAmount: 0,
      }],
    }))
    const missing = annualRothConversionExecutionInput(input({
      ...shared,
      ordinaryWithdrawalEvidence: [],
    }))

    expect(movedWhole.effectiveLinkedWithdrawalGroups).toBe(released)
    expect(short.effectiveLinkedWithdrawalGroups).toBe(observed)
    expect(refused.effectiveLinkedWithdrawalGroups).toBe(observed)
    expect(missing.effectiveLinkedWithdrawalGroups).toBe(observed)
    expect(short.status).toBe('ready')
    if (short.status !== 'ready') throw new Error('expected ready input')
    expect(
      short.executorInput.runtimeEvidence?.conversionLinkedWithdrawalGroups,
    ).toBe(observed)
  })

  it('publishes frozen result, executor, runtime, and row envelopes', () => {
    const result = annualRothConversionExecutionInput(input())

    expect(Object.isFrozen(result)).toBe(true)
    if (result.status !== 'ready') throw new Error('expected ready input')
    expect(Object.isFrozen(result.executorInput)).toBe(true)
    expect(Object.isFrozen(result.executorInput.openingBalances)).toBe(true)
    expect(Object.isFrozen(result.executorInput.openingBalances[0])).toBe(true)
    expect(Object.isFrozen(result.executorInput.runtimeEvidence)).toBe(true)
    expect(Object.isFrozen(
      result.executorInput.runtimeEvidence?.personAliveEvidence,
    )).toBe(true)
    expect(Object.isFrozen(
      result.executorInput.runtimeEvidence?.personAliveEvidence?.[0],
    )).toBe(true)
    expect(Object.isFrozen(
      result.executorInput.runtimeEvidence?.ownerIraRmdSatisfactionEvidence,
    )).toBe(true)
    expect(Object.isFrozen(
      result.executorInput.runtimeEvidence?.ownerAggregatedIraBasisEvidence,
    )).toBe(true)
  })
})
