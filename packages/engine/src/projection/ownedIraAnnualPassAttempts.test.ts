import { beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest'

import {
  asAccountId,
  asActionId,
  asAllocationId,
  asPersonId,
  asPlanId,
  type PlanId,
} from '../actions/identity.js'
import { asUsdCents } from '../actions/money.js'
import type {
  PlanOwnedNonRothIraAnnualPassAssumedEffect,
  ProbePlanOwnedNonRothIraAnnualPassInput,
  ProbePlanOwnedNonRothIraAnnualPassResult,
} from '../actions/ownedNonRothIraAnnualPassProbe.js'
import type {
  SimulatorAnnualPassStateBindings,
  SimulatorAnnualPassValueBinding,
} from './annualPassTransaction.js'

const { probeMock } = vi.hoisted(() => ({ probeMock: vi.fn() }))

vi.mock('../actions/ownedNonRothIraAnnualPassProbe.js', async (importOriginal) => {
  const original = await importOriginal<
    typeof import('../actions/ownedNonRothIraAnnualPassProbe.js')
  >()
  return { ...original, probePlanOwnedNonRothIraAnnualPass: probeMock }
})

import {
  runOwnedIraAnnualPassAttempts,
  type OwnedIraAnnualPassAttemptCapability,
  type OwnedIraAnnualPassStableContext,
} from './ownedIraAnnualPassAttempts.js'

const stable: OwnedIraAnnualPassStableContext = {
  planId: asPlanId('plan'),
  ownerPersonId: asPersonId('owner'),
  taxYear: 2030,
  ledgerRunId: 'ledger',
  movementCandidateId: 'movement',
  inventoryEvidenceId: 'inventory',
  transactionEvidenceId: 'transaction',
}

function effect(
  amount: number,
  suffix = '',
): PlanOwnedNonRothIraAnnualPassAssumedEffect {
  return {
    actionId: asActionId(`action${suffix}`),
    allocationId: asAllocationId(`allocation${suffix}`),
    sourceAccountId: asAccountId(`account${suffix}`),
    executedAmount: asUsdCents(amount),
    basisReturnAmount: asUsdCents(0),
    ordinaryIncomeAmount: asUsdCents(amount),
    allocatedPenaltyAmount: asUsdCents(0),
  }
}

function valueBinding<T>(initial: T): SimulatorAnnualPassValueBinding<T> {
  let value = initial
  return { read: () => value, write: (next) => { value = next } }
}

function state(): SimulatorAnnualPassStateBindings {
  return {
    balances: [{ account: { id: 'balance' }, balance: 100, costBasis: 40 }],
    iraProRata: new Map(),
    iraBasisByOwner: new Map(),
    rothBasis: new Map(),
    propertyValues: new Map(),
    hecmStates: new Map(),
    insuranceCashValues: new Map(),
    allocationTrack: new Map(),
    seppAmortAmount: new Map(),
    magiHistory: new Map(),
    warnings: new Set(['baseline']),
    unassignedCash: valueBinding(10),
    priorYearPortfolioReturnPct: valueBinding(0.05),
    capitalLossPool: valueBinding(20),
    hsaReimbursablePool: valueBinding(30),
    depletionYear: valueBinding<number | null>(null),
    conversionNontaxable: valueBinding(0),
    healthcare: valueBinding(1),
    qualifiedMedicalThisYear: valueBinding(2),
    hsaQualifiedCap: valueBinding(3),
    requiredSpendingBase: valueBinding(4),
    targetSpendingBase: valueBinding(5),
    expenses: {
      baseSpending: 1,
      oneTimeGoals: 2,
      debtService: 3,
      propertyCosts: 4,
      healthcare: 5,
      insurancePremiums: 6,
      careCost: 7,
      ltcBenefit: 8,
      requiredSpending: 9,
      targetSpending: 10,
      idealSpending: 11,
      excessSpending: 12,
      intendedSpending: 13,
      guardrailFactor: 1,
      total: 14,
    },
  }
}

function stateBytes(value: SimulatorAnnualPassStateBindings): string {
  return JSON.stringify({
    balances: value.balances,
    warnings: [...value.warnings],
    unassignedCash: value.unassignedCash.read(),
    expenses: value.expenses,
  })
}

function probeInput(
  assumptions:
    readonly Readonly<PlanOwnedNonRothIraAnnualPassAssumedEffect>[],
  attemptNumber: number,
): ProbePlanOwnedNonRothIraAnnualPassInput {
  return {
    completedCandidateInput: {
      plan: { id: stable.planId },
      taxYear: stable.taxYear,
      ledgerRunId: stable.ledgerRunId,
      runtimeInventoryAttestation: {
        planId: stable.planId,
        taxYear: stable.taxYear,
        ledgerRunId: stable.ledgerRunId,
        evidenceId: stable.inventoryEvidenceId,
      },
    },
    annualPassEvidence: {
      planId: stable.planId,
      ownerPersonId: stable.ownerPersonId,
      taxYear: stable.taxYear,
      ledgerRunId: stable.ledgerRunId,
      movementCandidateId: stable.movementCandidateId,
      inventoryEvidenceId: stable.inventoryEvidenceId,
      transactionEvidenceId: stable.transactionEvidenceId,
      evidenceId: `pass-${attemptNumber}`,
      assumedEffects: assumptions,
    },
  } as unknown as ProbePlanOwnedNonRothIraAnnualPassInput
}

function probeResult(
  status: 'commit' | 'reprobe',
  input: ProbePlanOwnedNonRothIraAnnualPassInput,
  observed = input.annualPassEvidence.assumedEffects,
): ProbePlanOwnedNonRothIraAnnualPassResult {
  const probeEvidenceId = `probe-${input.annualPassEvidence.evidenceId}`
  const common = {
    status,
    movement: 'notCommitted',
    actionability: status === 'commit' ? 'established' : 'notEstablished',
    probeEvidenceId,
    observedEffects: observed,
    execution: status === 'commit'
      ? { status: 'postCandidateAnnualWithdrawalCommitted' }
      : null,
    controlBinding: {
      transactionEvidenceId: stable.transactionEvidenceId,
      inventoryEvidenceId: stable.inventoryEvidenceId,
      annualPassEvidenceId: input.annualPassEvidence.evidenceId,
      probeEvidenceId,
    },
    issues: [],
  }
  return (status === 'commit'
    ? { ...common, status, decision: 'commitReady' }
    : common) as unknown as ProbePlanOwnedNonRothIraAnnualPassResult
}

function mutate(value: SimulatorAnnualPassStateBindings, attempt: number): void {
  value.balances[0]!.balance += attempt
  value.warnings.add(`attempt-${attempt}`)
  value.unassignedCash.write(value.unassignedCash.read() + attempt)
  value.expenses.total += attempt
}

describe('owned IRA annual-pass attempt controller', () => {
  beforeEach(() => probeMock.mockReset())

  it('commits an exact first pass and exposes deferred values once in order', () => {
    const simulatorState = state()
    const expectedInput = probeInput([effect(10)], 1)
    probeMock.mockReturnValue(probeResult('commit', expectedInput))

    const result = runOwnedIraAnnualPassAttempts<string>({
      state: simulatorState,
      stable,
      initialAssumedEffects: [effect(10)],
      runAttempt: (context, capability) => {
        expect(context.attemptNumber).toBe(1)
        expect(Object.isFrozen(context)).toBe(true)
        expect(Object.keys(capability)).toEqual(['defer'])
        mutate(simulatorState, context.attemptNumber)
        capability.defer('first')
        capability.defer('second')
        return probeInput(context.assumedEffects, context.attemptNumber)
      },
    })

    expect(result).toMatchObject({
      status: 'committed',
      reason: 'exactProbeCommit',
      attemptCount: 1,
      deferredEffects: ['first', 'second'],
    })
    expect(simulatorState.balances[0]!.balance).toBe(101)
    expect(probeMock).toHaveBeenCalledTimes(1)
    expect(probeMock.mock.calls[0]?.[0]).toMatchObject({
      annualPassEvidence: { evidenceId: 'pass-1' },
    })
    expect(Object.isFrozen(result)).toBe(true)
    expect(Object.isFrozen(result.deferredEffects)).toBe(true)
  })

  it('restores a reprobe, passes its exact vector, then commits only once', () => {
    const simulatorState = state()
    const baseline = stateBytes(simulatorState)
    const observed = [effect(11)]
    probeMock
      .mockImplementationOnce((input: ProbePlanOwnedNonRothIraAnnualPassInput) =>
        probeResult('reprobe', input, observed))
      .mockImplementationOnce((input: ProbePlanOwnedNonRothIraAnnualPassInput) =>
        probeResult('commit', input))
    const starts: string[] = []

    const result = runOwnedIraAnnualPassAttempts<string>({
      state: simulatorState,
      stable,
      initialAssumedEffects: [effect(10)],
      runAttempt: (context, capability) => {
        starts.push(stateBytes(simulatorState))
        mutate(simulatorState, context.attemptNumber)
        capability.defer(`effect-${context.attemptNumber}`)
        if (context.attemptNumber === 2) {
          expect(context.assumedEffects).toEqual(observed)
        }
        return probeInput(context.assumedEffects, context.attemptNumber)
      },
    })

    expect(starts).toEqual([baseline, baseline])
    expect(result).toMatchObject({
      status: 'committed',
      attemptCount: 2,
      deferredEffects: ['effect-2'],
    })
    expect(simulatorState.balances[0]!.balance).toBe(102)
  })

  it('rolls back when the probe rolls back', () => {
    const simulatorState = state()
    const baseline = stateBytes(simulatorState)
    probeMock.mockReturnValue({
      status: 'rollback',
      movement: 'notCommitted',
      actionability: 'notEstablished',
      probeEvidenceId: null,
      observedEffects: [],
      execution: null,
      controlBinding: null,
      issues: [{ kind: 'orchestrationException', detail: 'blocked' }],
    })

    const result = runOwnedIraAnnualPassAttempts<string>({
      state: simulatorState,
      stable,
      initialAssumedEffects: [effect(10)],
      runAttempt: (context, capability) => {
        mutate(simulatorState, context.attemptNumber)
        capability.defer('discarded')
        return probeInput(context.assumedEffects, context.attemptNumber)
      },
    })

    expect(result).toEqual({
      status: 'rolledBack',
      reason: 'probeRollback',
      attemptCount: 1,
      deferredEffects: [],
    })
    expect(stateBytes(simulatorState)).toBe(baseline)
  })

  it('rolls back a commit whose observed effects differ from its assumptions', () => {
    const simulatorState = state()
    const baseline = stateBytes(simulatorState)
    const expectedInput = probeInput([effect(10)], 1)
    probeMock.mockReturnValue(
      probeResult('commit', expectedInput, [effect(11)]),
    )

    const result = runOwnedIraAnnualPassAttempts<string>({
      state: simulatorState,
      stable,
      initialAssumedEffects: [effect(10)],
      runAttempt: (context, capability) => {
        mutate(simulatorState, context.attemptNumber)
        capability.defer('discarded')
        return probeInput(context.assumedEffects, context.attemptNumber)
      },
    })

    expect(result).toEqual({
      status: 'rolledBack',
      reason: 'probeCommitEffectsMismatch',
      attemptCount: 1,
      deferredEffects: [],
    })
    expect(stateBytes(simulatorState)).toBe(baseline)
  })

  it('fails closed for hostile initial assumptions after validating stable context', () => {
    const hostile = effect(10) as unknown as Record<string, unknown>
    Object.defineProperty(hostile, 'actionId', {
      enumerable: true,
      get: () => { throw new Error('hostile initial assumption') },
    })
    const runAttempt = vi.fn()

    expect(runOwnedIraAnnualPassAttempts<string>({
      state: state(),
      stable: { ...stable, planId: '' as PlanId },
      initialAssumedEffects: [
        hostile as unknown as PlanOwnedNonRothIraAnnualPassAssumedEffect,
      ],
      runAttempt,
    })).toMatchObject({
      status: 'rolledBack',
      reason: 'stableContextInvalid',
      attemptCount: 0,
    })
    expect(runAttempt).not.toHaveBeenCalled()

    expect(runOwnedIraAnnualPassAttempts<string>({
      state: state(),
      stable,
      initialAssumedEffects: [
        hostile as unknown as PlanOwnedNonRothIraAnnualPassAssumedEffect,
      ],
      runAttempt,
    })).toMatchObject({
      status: 'rolledBack',
      reason: 'assumptionVectorInvalid',
      attemptCount: 0,
    })
    expect(runAttempt).not.toHaveBeenCalled()
  })

  it('snapshots stable and assumption getters exactly once before validation', () => {
    let stablePlanReads = 0
    const statefulStable = { ...stable }
    Object.defineProperty(statefulStable, 'planId', {
      enumerable: true,
      get: () => {
        stablePlanReads += 1
        return stablePlanReads === 1 ? stable.planId : '' as PlanId
      },
    })
    const statefulEffect = (
      value: PlanOwnedNonRothIraAnnualPassAssumedEffect,
      actionId: string,
    ): PlanOwnedNonRothIraAnnualPassAssumedEffect => {
      let reads = 0
      const result = { ...value }
      Object.defineProperty(result, 'actionId', {
        enumerable: true,
        get: () => {
          reads += 1
          return reads === 1 ? asActionId(actionId) : asActionId('')
        },
      })
      return result
    }
    const initial = statefulEffect(effect(10), 'action-initial')
    const observed = statefulEffect(effect(11), 'action-observed')
    probeMock
      .mockImplementationOnce((input: ProbePlanOwnedNonRothIraAnnualPassInput) =>
        probeResult('reprobe', input, [observed]))
      .mockImplementationOnce((input: ProbePlanOwnedNonRothIraAnnualPassInput) =>
        probeResult('commit', input))
    const seenActionIds: string[] = []

    const result = runOwnedIraAnnualPassAttempts<string>({
      state: state(),
      stable: statefulStable,
      initialAssumedEffects: [initial],
      runAttempt: (context) => {
        expect(context.stable.planId).toBe(stable.planId)
        seenActionIds.push(context.assumedEffects[0]!.actionId)
        return probeInput(context.assumedEffects, context.attemptNumber)
      },
    })

    expect(result).toMatchObject({ status: 'committed', attemptCount: 2 })
    expect(stablePlanReads).toBe(1)
    expect(seenActionIds).toEqual(['action-initial', 'action-observed'])
  })

  it('rolls back hostile observed assumptions without exposing state or effects', () => {
    const simulatorState = state()
    const baseline = stateBytes(simulatorState)
    const expectedInput = probeInput([effect(10)], 1)
    const hostile = effect(11) as unknown as Record<string, unknown>
    Object.defineProperty(hostile, 'executedAmount', {
      enumerable: true,
      get: () => { throw new Error('hostile observed assumption') },
    })
    probeMock.mockReturnValue(probeResult(
      'reprobe',
      expectedInput,
      [hostile as unknown as PlanOwnedNonRothIraAnnualPassAssumedEffect],
    ))

    const result = runOwnedIraAnnualPassAttempts<string>({
      state: simulatorState,
      stable,
      initialAssumedEffects: [effect(10)],
      runAttempt: (context, capability) => {
        mutate(simulatorState, context.attemptNumber)
        capability.defer('discarded')
        return probeInput(context.assumedEffects, context.attemptNumber)
      },
    })

    expect(result).toEqual({
      status: 'rolledBack',
      reason: 'assumptionVectorInvalid',
      attemptCount: 1,
      deferredEffects: [],
    })
    expect(stateBytes(simulatorState)).toBe(baseline)
  })

  it('closes the defer capability before validating the returned probe input', () => {
    const simulatorState = state()
    const baseline = stateBytes(simulatorState)

    const result = runOwnedIraAnnualPassAttempts<string>({
      state: simulatorState,
      stable,
      initialAssumedEffects: [effect(10)],
      runAttempt: (context, capability) => {
        mutate(simulatorState, context.attemptNumber)
        capability.defer('within-callback')
        const value = probeInput(
          context.assumedEffects,
          context.attemptNumber,
        )
        const annualPassEvidence = value.annualPassEvidence
        Object.defineProperty(value, 'annualPassEvidence', {
          enumerable: true,
          get: () => {
            capability.defer('after-callback')
            return annualPassEvidence
          },
        })
        return value
      },
    })

    expect(result).toEqual({
      status: 'rolledBack',
      reason: 'attemptBindingMismatch',
      attemptCount: 1,
      deferredEffects: [],
    })
    expect(stateBytes(simulatorState)).toBe(baseline)
  })

  it('rolls back callback and probe exceptions without exposing effects', () => {
    for (const target of ['callback', 'probe'] as const) {
      const simulatorState = state()
      const baseline = stateBytes(simulatorState)
      if (target === 'probe') probeMock.mockImplementationOnce(() => {
        throw new Error('probe')
      })
      const result = runOwnedIraAnnualPassAttempts<string>({
        state: simulatorState,
        stable,
        initialAssumedEffects: [effect(10)],
        runAttempt: (context, capability) => {
          mutate(simulatorState, context.attemptNumber)
          capability.defer('discarded')
          if (target === 'callback') throw new Error('callback')
          return probeInput(context.assumedEffects, context.attemptNumber)
        },
      })
      expect(result).toMatchObject({
        status: 'rolledBack',
        reason: target === 'callback' ? 'attemptCallbackThrew' : 'probeThrew',
        deferredEffects: [],
      })
      expect(stateBytes(simulatorState)).toBe(baseline)
      probeMock.mockReset()
    }
  })

  it.each(['staleInput', 'mismatchedControl', 'malformedControl'] as const)(
    'fails closed for a %s binding and restores state',
    (kind) => {
      const simulatorState = state()
      const baseline = stateBytes(simulatorState)
      const expectedInput = probeInput([effect(10)], 1)
      const probeOutcome = probeResult('commit', expectedInput)
      if (probeOutcome.status !== 'rollback') {
        if (kind === 'mismatchedControl') {
          ;(probeOutcome.controlBinding as { transactionEvidenceId: string })
            .transactionEvidenceId = 'stale-transaction'
        } else if (kind === 'malformedControl') {
          ;(probeOutcome as unknown as { controlBinding: null }).controlBinding = null
        }
      }
      probeMock.mockReturnValueOnce(probeOutcome)
      const result = runOwnedIraAnnualPassAttempts<string>({
        state: simulatorState,
        stable,
        initialAssumedEffects: [effect(10)],
        runAttempt: (context, capability) => {
          mutate(simulatorState, context.attemptNumber)
          capability.defer('discarded')
          const value = probeInput(context.assumedEffects, context.attemptNumber)
          if (kind === 'staleInput') {
            ;(value.annualPassEvidence as { ledgerRunId: string }).ledgerRunId =
              'stale-ledger'
          }
          return value
        },
      })
      expect(result).toMatchObject({
        status: 'rolledBack',
        reason: kind === 'staleInput'
          ? 'attemptBindingMismatch'
          : 'probeControlBindingMismatch',
        deferredEffects: [],
      })
      expect(stateBytes(simulatorState)).toBe(baseline)
    },
  )

  it('detects a repeated canonical assumption vector as a cycle', () => {
    const simulatorState = state()
    const baseline = stateBytes(simulatorState)
    const initial = [effect(10, '-b'), effect(20, '-a')]
    const expectedInput = probeInput(initial, 1)
    probeMock.mockReturnValueOnce(probeResult(
      'reprobe',
      expectedInput,
      [...expectedInput.annualPassEvidence.assumedEffects].reverse(),
    ))

    const result = runOwnedIraAnnualPassAttempts<string>({
      state: simulatorState,
      stable,
      initialAssumedEffects: initial,
      runAttempt: (context, capability) => {
        mutate(simulatorState, context.attemptNumber)
        capability.defer('discarded')
        return probeInput(context.assumedEffects, context.attemptNumber)
      },
    })

    expect(result).toMatchObject({
      status: 'rolledBack',
      reason: 'assumptionCycle',
      attemptCount: 1,
      deferredEffects: [],
    })
    expect(stateBytes(simulatorState)).toBe(baseline)
  })

  it('enforces the internal hard limit and restores every attempt', () => {
    const simulatorState = state()
    const baseline = stateBytes(simulatorState)
    const starts: string[] = []
    for (let attemptNumber = 1; attemptNumber <= 8; attemptNumber += 1) {
      const expectedInput = probeInput([effect(9 + attemptNumber)], attemptNumber)
      probeMock.mockReturnValueOnce(probeResult(
        'reprobe',
        expectedInput,
        [effect(10 + attemptNumber)],
      ))
    }

    const result = runOwnedIraAnnualPassAttempts<string>({
      state: simulatorState,
      stable,
      initialAssumedEffects: [effect(10)],
      runAttempt: (context, capability) => {
        starts.push(stateBytes(simulatorState))
        mutate(simulatorState, context.attemptNumber)
        capability.defer(`discarded-${context.attemptNumber}`)
        return probeInput(context.assumedEffects, context.attemptNumber)
      },
    })

    expect(result).toEqual({
      status: 'rolledBack',
      reason: 'attemptLimitExceeded',
      attemptCount: 8,
      deferredEffects: [],
    })
    expect(starts).toHaveLength(8)
    expect(starts.every((value) => value === baseline)).toBe(true)
    expect(stateBytes(simulatorState)).toBe(baseline)
    expect(probeMock).toHaveBeenCalledTimes(8)
  })

  it('does not expose transaction settlement authority to the callback', () => {
    expectTypeOf<keyof OwnedIraAnnualPassAttemptCapability<string>>()
      .toEqualTypeOf<'defer'>()
  })
})
