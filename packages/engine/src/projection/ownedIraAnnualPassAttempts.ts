import type { PersonId, PlanId } from '../actions/identity.js'
import {
  canonicalPlanOwnedNonRothIraAnnualPassEffects,
  probePlanOwnedNonRothIraAnnualPass,
  type PlanOwnedNonRothIraAnnualPassAssumedEffect,
  type PlanOwnedNonRothIraAnnualPassCommitResult,
  type ProbePlanOwnedNonRothIraAnnualPassInput,
} from '../actions/ownedNonRothIraAnnualPassProbe.js'
import { compareUtf16CodeUnits } from '../actions/structuralId.js'
import { runAnnualPassAttemptsWithAdapter } from
  '../internal/annualPassAttemptDriver.js'
import type { SimulatorAnnualPassStateBindings } from
  './annualPassTransaction.js'

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
  | 'probeCommitEffectsMismatch'
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

function nonblank<T>(value: T): value is T & string {
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
    stable.taxYear >= 1 && stable.taxYear <= 9999 &&
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
  const suppliedAssumptions =
    canonicalPlanOwnedNonRothIraAnnualPassEffects(pass.assumedEffects)
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

type OwnedIraAnnualPassProbeResult = ReturnType<
  typeof probePlanOwnedNonRothIraAnnualPass
>

const ownedIraAnnualPassAttemptAdapter = Object.freeze({
  snapshotStable<DeferredEffect>(
    input: Readonly<RunOwnedIraAnnualPassAttemptsInput<DeferredEffect>>,
  ): OwnedIraAnnualPassStableContext {
    return {
      planId: input.stable.planId,
      ownerPersonId: input.stable.ownerPersonId,
      taxYear: input.stable.taxYear,
      ledgerRunId: input.stable.ledgerRunId,
      movementCandidateId: input.stable.movementCandidateId,
      inventoryEvidenceId: input.stable.inventoryEvidenceId,
      transactionEvidenceId: input.stable.transactionEvidenceId,
    }
  },
  validStableContext,
  canonicalizeEffects: canonicalPlanOwnedNonRothIraAnnualPassEffects,
  effectIdentity: assumptionIdentity,
  inputMatchesAttempt,
  probe: probePlanOwnedNonRothIraAnnualPass,
  resultBindingMatches(
    result: OwnedIraAnnualPassProbeResult,
    input: Readonly<ProbePlanOwnedNonRothIraAnnualPassInput>,
    stable: Readonly<OwnedIraAnnualPassStableContext>,
  ): boolean {
    return result.status !== 'rollback' &&
      resultBindingMatches(result, input, stable)
  },
  observedEffects(
    result: OwnedIraAnnualPassProbeResult,
  ): readonly Readonly<PlanOwnedNonRothIraAnnualPassAssumedEffect>[] {
    return result.observedEffects
  },
  isCommitResult(
    result: OwnedIraAnnualPassProbeResult,
  ): result is PlanOwnedNonRothIraAnnualPassCommitResult {
    return result.status === 'commit'
  },
})

/**
 * Runs bounded annual-pass attempts. Every attempt owns a fresh checkpoint;
 * reprobes first restore that checkpoint, then retry from the exact baseline.
 * Commit settles only the simulator pass and its deferred values; it does not
 * strengthen the canonical probe's action-movement or filing authority.
 */
export function runOwnedIraAnnualPassAttempts<DeferredEffect = never>(
  input: Readonly<RunOwnedIraAnnualPassAttemptsInput<DeferredEffect>>,
): Readonly<OwnedIraAnnualPassAttemptsResult<DeferredEffect>> {
  return runAnnualPassAttemptsWithAdapter<
    OwnedIraAnnualPassStableContext,
    PlanOwnedNonRothIraAnnualPassAssumedEffect,
    ProbePlanOwnedNonRothIraAnnualPassInput,
    OwnedIraAnnualPassProbeResult,
    PlanOwnedNonRothIraAnnualPassCommitResult,
    DeferredEffect
  >(
    input,
    ownedIraAnnualPassAttemptAdapter,
  )
}
