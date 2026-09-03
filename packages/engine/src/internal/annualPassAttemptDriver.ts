import { compareUtf16CodeUnits } from '../actions/structuralId.js'
import {
  beginSimulatorAnnualPassTransaction,
  type SimulatorAnnualPassStateBindings,
} from '../projection/annualPassTransaction.js'
import { deepFreeze } from '../actions/freeze.js'

const MAX_ANNUAL_PASS_ATTEMPTS = 8

export type AnnualPassAttemptRollbackReason =
  | 'stableContextInvalid'
  | 'assumptionVectorInvalid'
  | 'attemptCallbackThrew'
  | 'attemptBindingMismatch'
  | 'probeThrew'
  | 'probeRollback'
  | 'probeControlBindingMismatch'
  | 'probeCommitEffectsMismatch'
  | 'assumptionCycle'
  | 'attemptLimitExceeded'

export interface AnnualPassAttemptCapability<DeferredEffect> {
  defer(effect: DeferredEffect): void
}

export interface AnnualPassAttemptDriverContext<StableContext, AssumedEffect> {
  readonly attemptNumber: number
  readonly stable: Readonly<StableContext>
  readonly assumedEffects: readonly Readonly<AssumedEffect>[]
}

export interface AnnualPassAttemptDriverInput<
  StableContext,
  AssumedEffect,
  ProbeInput,
  DeferredEffect,
> {
  state: SimulatorAnnualPassStateBindings
  stable: Readonly<StableContext>
  initialAssumedEffects: readonly Readonly<AssumedEffect>[]
  runAttempt(
    context: Readonly<
      AnnualPassAttemptDriverContext<StableContext, AssumedEffect>
    >,
    capability: Readonly<AnnualPassAttemptCapability<DeferredEffect>>,
  ): Readonly<ProbeInput>
}

export interface AnnualPassAttemptDriverProbeResult<AssumedEffect> {
  readonly status: 'rollback' | 'reprobe' | 'commit'
  readonly observedEffects: readonly Readonly<AssumedEffect>[]
}

export interface AnnualPassAttemptDriverAdapter<
  StableContext,
  AssumedEffect,
  ProbeInput,
  ProbeResult extends AnnualPassAttemptDriverProbeResult<AssumedEffect>,
  CommitProbeResult extends ProbeResult,
  DeferredEffect,
> {
  snapshotStable(
    input: Readonly<AnnualPassAttemptDriverInput<
      StableContext,
      AssumedEffect,
      ProbeInput,
      DeferredEffect
    >>,
  ): Readonly<StableContext>
  validStableContext(stable: Readonly<StableContext>): boolean
  canonicalizeEffects(
    effects: readonly Readonly<AssumedEffect>[],
  ): AssumedEffect[] | null
  effectIdentity(effects: readonly Readonly<AssumedEffect>[]): string
  inputMatchesAttempt(
    input: Readonly<ProbeInput>,
    stable: Readonly<StableContext>,
    assumptions: readonly Readonly<AssumedEffect>[],
  ): boolean
  probe(input: Readonly<ProbeInput>): ProbeResult
  resultBindingMatches(
    result: ProbeResult,
    input: Readonly<ProbeInput>,
    stable: Readonly<StableContext>,
  ): boolean
  observedEffects(result: ProbeResult): readonly Readonly<AssumedEffect>[]
  isCommitResult(result: ProbeResult): result is CommitProbeResult
}

export interface AnnualPassAttemptDriverCommitted<
  CommitProbeResult,
  DeferredEffect,
> {
  readonly status: 'committed'
  readonly reason: 'exactProbeCommit'
  readonly attemptCount: number
  readonly probeResult: Readonly<CommitProbeResult>
  readonly deferredEffects: readonly DeferredEffect[]
}

export interface AnnualPassAttemptDriverRolledBack {
  readonly status: 'rolledBack'
  readonly reason: AnnualPassAttemptRollbackReason
  readonly attemptCount: number
  readonly deferredEffects: readonly []
}

export type AnnualPassAttemptDriverResult<
  CommitProbeResult,
  DeferredEffect,
> =
  | AnnualPassAttemptDriverCommitted<CommitProbeResult, DeferredEffect>
  | AnnualPassAttemptDriverRolledBack

function same(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true
  if (left === null || right === null ||
      typeof left !== 'object' || typeof right !== 'object') return false
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left) && Array.isArray(right) &&
      left.length === right.length &&
      left.every((value, index) => same(value, right[index]))
  }
  const leftPrototype = Object.getPrototypeOf(left)
  const rightPrototype = Object.getPrototypeOf(right)
  if ((leftPrototype !== Object.prototype && leftPrototype !== null) ||
      (rightPrototype !== Object.prototype && rightPrototype !== null)) {
    return false
  }
  const leftRecord = left as Record<string, unknown>
  const rightRecord = right as Record<string, unknown>
  const leftKeys = Object.keys(leftRecord).sort(compareUtf16CodeUnits)
  const rightKeys = Object.keys(rightRecord).sort(compareUtf16CodeUnits)
  return leftKeys.length === rightKeys.length && leftKeys.every((key, index) =>
    key === rightKeys[index] && same(leftRecord[key], rightRecord[key]))
}

function rolledBack(
  reason: AnnualPassAttemptRollbackReason,
  attemptCount: number,
): Readonly<AnnualPassAttemptDriverRolledBack> {
  return Object.freeze({
    status: 'rolledBack',
    reason,
    attemptCount,
    deferredEffects: Object.freeze([] as const),
  })
}

/** Private generic retry driver shared by fixed simulator-owned adapters. */
export function runAnnualPassAttemptsWithAdapter<
  StableContext,
  AssumedEffect,
  ProbeInput,
  ProbeResult extends AnnualPassAttemptDriverProbeResult<AssumedEffect>,
  CommitProbeResult extends ProbeResult,
  DeferredEffect,
>(
  input: Readonly<AnnualPassAttemptDriverInput<
    StableContext,
    AssumedEffect,
    ProbeInput,
    DeferredEffect
  >>,
  adapter: Readonly<AnnualPassAttemptDriverAdapter<
    StableContext,
    AssumedEffect,
    ProbeInput,
    ProbeResult,
    CommitProbeResult,
    DeferredEffect
  >>,
): Readonly<AnnualPassAttemptDriverResult<CommitProbeResult, DeferredEffect>> {
  let stable: Readonly<StableContext>
  try {
    const stableSnapshot = adapter.snapshotStable(input)
    if (!adapter.validStableContext(stableSnapshot)) {
      return rolledBack('stableContextInvalid', 0)
    }
    stable = deepFreeze(stableSnapshot)
  } catch {
    return rolledBack('stableContextInvalid', 0)
  }

  let initialAssumptions: AssumedEffect[] | null
  try {
    initialAssumptions = adapter.canonicalizeEffects(
      input.initialAssumedEffects,
    )
  } catch {
    return rolledBack('assumptionVectorInvalid', 0)
  }
  if (initialAssumptions === null) {
    return rolledBack('assumptionVectorInvalid', 0)
  }

  let assumptions: readonly Readonly<AssumedEffect>[] =
    deepFreeze(initialAssumptions)
  const seen = new Set([adapter.effectIdentity(assumptions)])

  for (let attemptNumber = 1;
    attemptNumber <= MAX_ANNUAL_PASS_ATTEMPTS;
    attemptNumber += 1) {
    const transaction = beginSimulatorAnnualPassTransaction<DeferredEffect>(
      input.state,
    )
    const context = deepFreeze({
      attemptNumber,
      stable,
      assumedEffects: assumptions,
    })
    let callbackOpen = true
    const capability = Object.freeze({
      defer: (effect: DeferredEffect): void => {
        if (!callbackOpen) throw new TypeError('Attempt capability is closed')
        transaction.defer(effect)
      },
    })

    let probeInput: Readonly<ProbeInput>
    try {
      probeInput = input.runAttempt(context, capability)
    } catch {
      callbackOpen = false
      transaction.rollback()
      return rolledBack('attemptCallbackThrew', attemptNumber)
    }
    callbackOpen = false

    try {
      if (!adapter.inputMatchesAttempt(probeInput, stable, assumptions)) {
        transaction.rollback()
        return rolledBack('attemptBindingMismatch', attemptNumber)
      }
    } catch {
      transaction.rollback()
      return rolledBack('attemptBindingMismatch', attemptNumber)
    }

    let probeResult: ProbeResult
    try {
      probeResult = adapter.probe(probeInput)
    } catch {
      transaction.rollback()
      return rolledBack('probeThrew', attemptNumber)
    }
    if (probeResult.status === 'rollback') {
      transaction.rollback()
      return rolledBack('probeRollback', attemptNumber)
    }
    try {
      if (!adapter.resultBindingMatches(probeResult, probeInput, stable)) {
        transaction.rollback()
        return rolledBack('probeControlBindingMismatch', attemptNumber)
      }
    } catch {
      transaction.rollback()
      return rolledBack('probeControlBindingMismatch', attemptNumber)
    }

    let observed: AssumedEffect[] | null
    try {
      observed = adapter.canonicalizeEffects(
        adapter.observedEffects(probeResult),
      )
    } catch {
      transaction.rollback()
      return rolledBack('assumptionVectorInvalid', attemptNumber)
    }
    if (observed === null) {
      transaction.rollback()
      return rolledBack('assumptionVectorInvalid', attemptNumber)
    }
    if (adapter.isCommitResult(probeResult)) {
      let exactCommitEffects = false
      try {
        exactCommitEffects = same(observed, assumptions)
      } catch {
        // Preserve the same fail-closed disposition as unequal commit effects.
      }
      if (!exactCommitEffects) {
        transaction.rollback()
        return rolledBack('probeCommitEffectsMismatch', attemptNumber)
      }
      const settlement = transaction.commit()
      return Object.freeze({
        status: 'committed',
        reason: 'exactProbeCommit',
        attemptCount: attemptNumber,
        probeResult,
        deferredEffects: settlement.deferredEffects,
      })
    }

    transaction.rollback()
    const nextIdentity = adapter.effectIdentity(observed)
    if (seen.has(nextIdentity)) {
      return rolledBack('assumptionCycle', attemptNumber)
    }
    if (attemptNumber === MAX_ANNUAL_PASS_ATTEMPTS) {
      return rolledBack('attemptLimitExceeded', attemptNumber)
    }
    seen.add(nextIdentity)
    assumptions = deepFreeze(observed)
  }

  return rolledBack('attemptLimitExceeded', MAX_ANNUAL_PASS_ATTEMPTS)
}
