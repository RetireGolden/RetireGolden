import type { PersonId, PlanId } from '../actions/identity.js'
import { usdCentsSchema } from '../actions/money.js'
import {
  probePlanOwnedNonRothIraAnnualPass,
  type PlanOwnedNonRothIraAnnualPassAssumedEffect,
  type PlanOwnedNonRothIraAnnualPassCommitResult,
  type ProbePlanOwnedNonRothIraAnnualPassInput,
} from '../actions/ownedNonRothIraAnnualPassProbe.js'
import { compareUtf16CodeUnits } from '../actions/structuralId.js'
import {
  beginSimulatorAnnualPassTransaction,
  type SimulatorAnnualPassStateBindings,
} from './annualPassTransaction.js'

const MAX_ANNUAL_PASS_ATTEMPTS = 8

export interface OwnedIraAnnualPassStableContext {
  readonly planId: PlanId
  readonly ownerPersonId: PersonId
  readonly taxYear: number
  readonly ledgerRunId: string
  readonly movementCandidateId: string
  readonly inventoryEvidenceId: string
  readonly transactionEvidenceId: string
}

export interface OwnedIraAnnualPassAttemptContext {
  readonly attemptNumber: number
  readonly stable: Readonly<OwnedIraAnnualPassStableContext>
  readonly assumedEffects:
    readonly Readonly<PlanOwnedNonRothIraAnnualPassAssumedEffect>[]
}

/** The only transaction capability available to speculative pass code. */
export interface OwnedIraAnnualPassAttemptCapability<DeferredEffect> {
  defer(effect: DeferredEffect): void
}

export type RunOwnedIraAnnualPassAttempt<DeferredEffect> = (
  context: Readonly<OwnedIraAnnualPassAttemptContext>,
  capability: Readonly<OwnedIraAnnualPassAttemptCapability<DeferredEffect>>,
) => Readonly<ProbePlanOwnedNonRothIraAnnualPassInput>

export interface RunOwnedIraAnnualPassAttemptsInput<DeferredEffect> {
  state: SimulatorAnnualPassStateBindings
  stable: Readonly<OwnedIraAnnualPassStableContext>
  initialAssumedEffects:
    readonly Readonly<PlanOwnedNonRothIraAnnualPassAssumedEffect>[]
  runAttempt: RunOwnedIraAnnualPassAttempt<DeferredEffect>
}

export type OwnedIraAnnualPassRollbackReason =
  | 'stableContextInvalid'
  | 'assumptionVectorInvalid'
  | 'attemptCallbackThrew'
  | 'attemptBindingMismatch'
  | 'probeThrew'
  | 'probeRollback'
  | 'probeControlBindingMismatch'
  | 'assumptionCycle'
  | 'attemptLimitExceeded'

export interface OwnedIraAnnualPassAttemptsCommitted<DeferredEffect> {
  /** The simulator pass committed; domain movement remains exactly as stated by probeResult. */
  readonly status: 'committed'
  readonly reason: 'exactProbeCommit'
  readonly attemptCount: number
  readonly probeResult: Readonly<PlanOwnedNonRothIraAnnualPassCommitResult>
  readonly deferredEffects: readonly DeferredEffect[]
}

export interface OwnedIraAnnualPassAttemptsRolledBack {
  readonly status: 'rolledBack'
  readonly reason: OwnedIraAnnualPassRollbackReason
  readonly attemptCount: number
  readonly deferredEffects: readonly []
}

export type OwnedIraAnnualPassAttemptsResult<DeferredEffect> =
  | OwnedIraAnnualPassAttemptsCommitted<DeferredEffect>
  | OwnedIraAnnualPassAttemptsRolledBack

function deepFreeze<T>(value: T): Readonly<T> {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) {
      deepFreeze(child)
    }
    Object.freeze(value)
  }
  return value as Readonly<T>
}

function nonblank(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function same(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true
  if (left === null || right === null ||
      typeof left !== 'object' || typeof right !== 'object') return false
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left) && Array.isArray(right) &&
      left.length === right.length &&
      left.every((value, index) => same(value, right[index]))
  }
  const leftRecord = left as Record<string, unknown>
  const rightRecord = right as Record<string, unknown>
  const leftKeys = Object.keys(leftRecord).sort(compareUtf16CodeUnits)
  const rightKeys = Object.keys(rightRecord).sort(compareUtf16CodeUnits)
  return leftKeys.length === rightKeys.length && leftKeys.every((key, index) =>
    key === rightKeys[index] && same(leftRecord[key], rightRecord[key]))
}

function effectOrder(
  left: Readonly<PlanOwnedNonRothIraAnnualPassAssumedEffect>,
  right: Readonly<PlanOwnedNonRothIraAnnualPassAssumedEffect>,
): number {
  return compareUtf16CodeUnits(left.actionId, right.actionId) ||
    compareUtf16CodeUnits(left.allocationId, right.allocationId) ||
    compareUtf16CodeUnits(left.sourceAccountId, right.sourceAccountId)
}

function canonicalEffects(
  effects: readonly Readonly<PlanOwnedNonRothIraAnnualPassAssumedEffect>[],
): PlanOwnedNonRothIraAnnualPassAssumedEffect[] | null {
  if (!Array.isArray(effects)) return null
  const result: PlanOwnedNonRothIraAnnualPassAssumedEffect[] = []
  const identities = new Set<string>()
  for (const effect of effects) {
    if (effect === null || typeof effect !== 'object' ||
        !nonblank(effect.actionId) || !nonblank(effect.allocationId) ||
        !nonblank(effect.sourceAccountId)) return null
    const executedAmount = usdCentsSchema.safeParse(effect.executedAmount)
    const basisReturnAmount = usdCentsSchema.safeParse(effect.basisReturnAmount)
    const ordinaryIncomeAmount = usdCentsSchema.safeParse(
      effect.ordinaryIncomeAmount,
    )
    const allocatedPenaltyAmount = usdCentsSchema.safeParse(
      effect.allocatedPenaltyAmount,
    )
    if (!executedAmount.success || !basisReturnAmount.success ||
        !ordinaryIncomeAmount.success || !allocatedPenaltyAmount.success) {
      return null
    }
    const identity = JSON.stringify([
      effect.actionId,
      effect.allocationId,
      effect.sourceAccountId,
    ])
    if (identities.has(identity)) return null
    identities.add(identity)
    result.push({
      actionId: effect.actionId,
      allocationId: effect.allocationId,
      sourceAccountId: effect.sourceAccountId,
      executedAmount: executedAmount.data,
      basisReturnAmount: basisReturnAmount.data,
      ordinaryIncomeAmount: ordinaryIncomeAmount.data,
      allocatedPenaltyAmount: allocatedPenaltyAmount.data,
    })
  }
  return result.sort(effectOrder)
}

function assumptionIdentity(
  effects: readonly Readonly<PlanOwnedNonRothIraAnnualPassAssumedEffect>[],
): string {
  return JSON.stringify(effects.map((effect) => [
    effect.actionId,
    effect.allocationId,
    effect.sourceAccountId,
    effect.executedAmount,
    effect.basisReturnAmount,
    effect.ordinaryIncomeAmount,
    effect.allocatedPenaltyAmount,
  ]))
}

function validStableContext(
  stable: Readonly<OwnedIraAnnualPassStableContext>,
): boolean {
  return nonblank(stable.planId) && nonblank(stable.ownerPersonId) &&
    Number.isInteger(stable.taxYear) &&
    nonblank(stable.ledgerRunId) && nonblank(stable.movementCandidateId) &&
    nonblank(stable.inventoryEvidenceId) &&
    nonblank(stable.transactionEvidenceId)
}

function inputMatchesAttempt(
  input: Readonly<ProbePlanOwnedNonRothIraAnnualPassInput>,
  stable: Readonly<OwnedIraAnnualPassStableContext>,
  assumptions:
    readonly Readonly<PlanOwnedNonRothIraAnnualPassAssumedEffect>[],
): boolean {
  const pass = input.annualPassEvidence
  const completed = input.completedCandidateInput
  const inventory = completed.runtimeInventoryAttestation
  const completedPlan = completed.plan
  const suppliedAssumptions = canonicalEffects(pass.assumedEffects)
  return pass.planId === stable.planId &&
    pass.ownerPersonId === stable.ownerPersonId &&
    pass.taxYear === stable.taxYear &&
    pass.ledgerRunId === stable.ledgerRunId &&
    pass.movementCandidateId === stable.movementCandidateId &&
    pass.inventoryEvidenceId === stable.inventoryEvidenceId &&
    pass.transactionEvidenceId === stable.transactionEvidenceId &&
    nonblank(pass.evidenceId) &&
    completedPlan !== null && typeof completedPlan === 'object' &&
    (completedPlan as { readonly id?: unknown }).id === stable.planId &&
    completed.taxYear === stable.taxYear &&
    completed.ledgerRunId === stable.ledgerRunId &&
    inventory.planId === stable.planId &&
    inventory.taxYear === stable.taxYear &&
    inventory.ledgerRunId === stable.ledgerRunId &&
    inventory.evidenceId === stable.inventoryEvidenceId &&
    suppliedAssumptions !== null && same(suppliedAssumptions, assumptions)
}

function resultBindingMatches(
  result: Exclude<
    ReturnType<typeof probePlanOwnedNonRothIraAnnualPass>,
    { readonly status: 'rollback' }
  >,
  input: Readonly<ProbePlanOwnedNonRothIraAnnualPassInput>,
  stable: Readonly<OwnedIraAnnualPassStableContext>,
): boolean {
  const binding = result.controlBinding
  return nonblank(result.probeEvidenceId) &&
    binding.transactionEvidenceId === stable.transactionEvidenceId &&
    binding.inventoryEvidenceId === stable.inventoryEvidenceId &&
    binding.annualPassEvidenceId === input.annualPassEvidence.evidenceId &&
    binding.probeEvidenceId === result.probeEvidenceId
}

function rolledBack(
  reason: OwnedIraAnnualPassRollbackReason,
  attemptCount: number,
): Readonly<OwnedIraAnnualPassAttemptsRolledBack> {
  return Object.freeze({
    status: 'rolledBack',
    reason,
    attemptCount,
    deferredEffects: Object.freeze([] as const),
  })
}

/**
 * Runs bounded annual-pass attempts. Every attempt owns a fresh checkpoint;
 * reprobes first restore that checkpoint, then retry from the exact baseline.
 * Commit settles only the simulator pass and its deferred values; it does not
 * strengthen the canonical probe's action-movement or filing authority.
 */
export function runOwnedIraAnnualPassAttempts<DeferredEffect = never>(
  input: Readonly<RunOwnedIraAnnualPassAttemptsInput<DeferredEffect>>,
): Readonly<OwnedIraAnnualPassAttemptsResult<DeferredEffect>> {
  let assumptions = canonicalEffects(input.initialAssumedEffects)
  if (!validStableContext(input.stable)) {
    return rolledBack('stableContextInvalid', 0)
  }
  if (assumptions === null) return rolledBack('assumptionVectorInvalid', 0)

  const stable = deepFreeze({ ...input.stable })
  assumptions = deepFreeze(assumptions) as PlanOwnedNonRothIraAnnualPassAssumedEffect[]
  const seen = new Set([assumptionIdentity(assumptions)])

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
    const capability = Object.freeze({
      defer: (effect: DeferredEffect): void => transaction.defer(effect),
    })

    let probeInput: Readonly<ProbePlanOwnedNonRothIraAnnualPassInput>
    try {
      probeInput = input.runAttempt(context, capability)
    } catch {
      transaction.rollback()
      return rolledBack('attemptCallbackThrew', attemptNumber)
    }

    try {
      if (!inputMatchesAttempt(probeInput, stable, assumptions)) {
        transaction.rollback()
        return rolledBack('attemptBindingMismatch', attemptNumber)
      }
    } catch {
      transaction.rollback()
      return rolledBack('attemptBindingMismatch', attemptNumber)
    }

    let probeResult: ReturnType<typeof probePlanOwnedNonRothIraAnnualPass>
    try {
      probeResult = probePlanOwnedNonRothIraAnnualPass(probeInput)
    } catch {
      transaction.rollback()
      return rolledBack('probeThrew', attemptNumber)
    }

    if (probeResult.status === 'rollback') {
      transaction.rollback()
      return rolledBack('probeRollback', attemptNumber)
    }
    try {
      if (!resultBindingMatches(probeResult, probeInput, stable)) {
        transaction.rollback()
        return rolledBack('probeControlBindingMismatch', attemptNumber)
      }
    } catch {
      transaction.rollback()
      return rolledBack('probeControlBindingMismatch', attemptNumber)
    }

    const observed = canonicalEffects(probeResult.observedEffects)
    if (observed === null) {
      transaction.rollback()
      return rolledBack('assumptionVectorInvalid', attemptNumber)
    }
    if (probeResult.status === 'commit') {
      if (!same(observed, assumptions)) {
        transaction.rollback()
        return rolledBack('probeControlBindingMismatch', attemptNumber)
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
    const nextIdentity = assumptionIdentity(observed)
    if (seen.has(nextIdentity)) {
      return rolledBack('assumptionCycle', attemptNumber)
    }
    if (attemptNumber === MAX_ANNUAL_PASS_ATTEMPTS) {
      return rolledBack('attemptLimitExceeded', attemptNumber)
    }
    seen.add(nextIdentity)
    assumptions = deepFreeze(observed) as PlanOwnedNonRothIraAnnualPassAssumedEffect[]
  }

  return rolledBack('attemptLimitExceeded', MAX_ANNUAL_PASS_ATTEMPTS)
}
