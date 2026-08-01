import type { AnnualIraBasisAllocationScope } from
  '../actions/annualIraBasisAllocation.js'
import {
  accountIdSchema,
  actionIdSchema,
  allocationIdSchema,
  personIdSchema,
  planIdSchema,
  type AccountId,
  type ActionId,
  type AllocationId,
  type PersonId,
  type PlanId,
} from '../actions/identity.js'
import { usdCentsSchema, type UsdCents } from '../actions/money.js'
import { compareUtf16CodeUnits } from '../actions/structuralId.js'
import { planSchema, type Plan } from '../model/plan.js'
import type { SimulatorAnnualPassStateBindings } from
  '../projection/annualPassTransaction.js'
import type { SimulatorAnnualRetirementRuntimeOccurrence } from
  '../projection/annualRetirementRuntimeJournal.js'
import {
  runAnnualPassAttemptsWithAdapter,
  type AnnualPassAttemptDriverAdapter,
  type AnnualPassAttemptDriverContext,
  type AnnualPassAttemptRollbackReason,
} from './annualPassAttemptDriver.js'
import type {
  SimulatorRetirementRuntimeApplication,
  YearResult,
} from '../projection/types.js'
import {
  replayOwnedNonRothIraContiguousYears,
  type OwnedNonRothIraContiguousReplayComplete,
  type OwnedNonRothIraContiguousReplayIssue,
  type OwnedNonRothIraContiguousReplayResult,
} from './ownedNonRothIraContiguousReplay.js'

export interface OwnedNonRothIraAnnualSettlementEffect {
  readonly taxYear: number
  readonly ownerPersonId: PersonId
  readonly calculationScope: AnnualIraBasisAllocationScope
  readonly actionId: ActionId
  readonly allocationId: AllocationId
  readonly sourceAccountId: AccountId
  readonly grossAmount: UsdCents
  readonly basisReturnAmount: UsdCents
  readonly ordinaryIncomeAmount: UsdCents
}

export interface OwnedNonRothIraAnnualSettlementStableContext {
  readonly planId: PlanId
  readonly projectionStartTaxYear: number
}

export interface OwnedNonRothIraAnnualSettlementAttemptContext {
  readonly attemptNumber: number
  readonly stable: Readonly<OwnedNonRothIraAnnualSettlementStableContext>
  readonly assumedEffects:
    readonly Readonly<OwnedNonRothIraAnnualSettlementEffect>[]
}

export type RunOwnedNonRothIraAnnualSettlementAttempt = (
  context: Readonly<OwnedNonRothIraAnnualSettlementAttemptContext>,
) => readonly Readonly<YearResult>[]

export interface RunOwnedNonRothIraAnnualSettlementInput {
  readonly state: SimulatorAnnualPassStateBindings
  readonly plan: Plan
  readonly projectionStartTaxYear: number
  readonly initialAssumedEffects:
    readonly Readonly<OwnedNonRothIraAnnualSettlementEffect>[]
  readonly runAttempt: RunOwnedNonRothIraAnnualSettlementAttempt
}

export interface OwnedNonRothIraCommittedPlanningCarryforward {
  readonly ownerPersonId: PersonId
  readonly fromTaxYear: number
  readonly toTaxYear: number
  readonly openingBasisAmount: UsdCents
  readonly sourceReplayEvidenceId: string
}

export interface PendingOwnedNonRothIraAnnualSettlement {
  readonly status: 'pendingOwnedNonRothIraAnnualSettlement'
  readonly settlement: 'exactEffectsMatched'
  readonly planId: PlanId
  readonly projectionStartTaxYear: number
  readonly endTaxYear: number
  readonly replay: Readonly<OwnedNonRothIraContiguousReplayComplete>
  readonly observedEffects:
    readonly Readonly<OwnedNonRothIraAnnualSettlementEffect>[]
  readonly committedCarryforwards:
    readonly Readonly<OwnedNonRothIraCommittedPlanningCarryforward>[]
}

export interface OwnedNonRothIraAnnualSettlementProbeBlocked {
  readonly status: 'rollback'
  readonly observedEffects: readonly []
  readonly replay: Readonly<OwnedNonRothIraContiguousReplayResult>
  readonly issue: OwnedNonRothIraContiguousReplayIssue
}

export interface OwnedNonRothIraAnnualSettlementProbeReprobe {
  readonly status: 'reprobe'
  readonly observedEffects:
    readonly Readonly<OwnedNonRothIraAnnualSettlementEffect>[]
  readonly replay: Readonly<OwnedNonRothIraContiguousReplayComplete>
  readonly issue: null
}

export interface OwnedNonRothIraAnnualSettlementProbeCommit {
  readonly status: 'commit'
  readonly observedEffects:
    readonly Readonly<OwnedNonRothIraAnnualSettlementEffect>[]
  readonly replay: Readonly<OwnedNonRothIraContiguousReplayComplete>
  readonly issue: null
}

export type OwnedNonRothIraAnnualSettlementProbeResult =
  | OwnedNonRothIraAnnualSettlementProbeBlocked
  | OwnedNonRothIraAnnualSettlementProbeReprobe
  | OwnedNonRothIraAnnualSettlementProbeCommit

export type OwnedNonRothIraAnnualSettlementRollbackReason =
  | AnnualPassAttemptRollbackReason
  | 'contiguousReplayBlocked'
  | 'aggregateOwnerBindingIncomplete'
  | 'replayEffectsInvalid'
  | 'carryforwardYearUnsupported'

export interface OwnedNonRothIraAnnualSettlementCommitted {
  readonly status: 'committed'
  readonly reason: 'exactReplayEffectsMatched'
  readonly attemptCount: number
  readonly probeResult:
    Readonly<OwnedNonRothIraAnnualSettlementProbeCommit>
  readonly pendingSettlement:
    Readonly<PendingOwnedNonRothIraAnnualSettlement>
  readonly committedCarryforwards:
    readonly Readonly<OwnedNonRothIraCommittedPlanningCarryforward>[]
}

export interface OwnedNonRothIraAnnualSettlementRolledBack {
  readonly status: 'rolledBack'
  readonly reason: OwnedNonRothIraAnnualSettlementRollbackReason
  readonly attemptCount: number
  readonly pendingSettlement: null
  readonly committedCarryforwards: null
  readonly issue: OwnedNonRothIraContiguousReplayIssue | null
}

export type OwnedNonRothIraAnnualSettlementResult =
  | OwnedNonRothIraAnnualSettlementCommitted
  | OwnedNonRothIraAnnualSettlementRolledBack

interface SettlementProbeInput {
  readonly invocationToken: object
  readonly attemptStateBound: boolean
  readonly assumptions:
    readonly Readonly<OwnedNonRothIraAnnualSettlementEffect>[]
  readonly replay: Readonly<OwnedNonRothIraContiguousReplayResult>
  readonly observedEffects:
    readonly Readonly<OwnedNonRothIraAnnualSettlementEffect>[]
  readonly issue: OwnedNonRothIraContiguousReplayIssue | null
}

interface AttemptStateCheckpoint {
  readonly runtimeOccurrences:
    readonly Readonly<SimulatorAnnualRetirementRuntimeOccurrence>[]
  readonly runtimeApplications:
    readonly Readonly<SimulatorRetirementRuntimeApplication>[]
  readonly nextMutationOrdinal: number
}

function deepFreeze<T>(value: T): Readonly<T> {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) {
      deepFreeze(child)
    }
    Object.freeze(value)
  }
  return value as Readonly<T>
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

function cloneRuntimeApplication(
  value: Readonly<SimulatorRetirementRuntimeApplication>,
): SimulatorRetirementRuntimeApplication {
  return value.applicationKind === 'aggregateRothDestinationCredit'
    ? {
        ...value,
        producerOccurrenceKeys: [...value.producerOccurrenceKeys],
        sourceOwnerPersonIds: [...value.sourceOwnerPersonIds],
      }
    : { ...value }
}

function captureAttemptState(
  state: Readonly<SimulatorAnnualPassStateBindings>,
): AttemptStateCheckpoint {
  return {
    runtimeOccurrences: state.retirementRuntimeOccurrences.map((value) => ({
      ...value,
    })),
    runtimeApplications:
      state.retirementRuntimeApplications.map(cloneRuntimeApplication),
    nextMutationOrdinal: state.nextRetirementRuntimeMutationOrdinal.read(),
  }
}

function attemptStateMatchesYear(
  checkpoint: Readonly<AttemptStateCheckpoint>,
  state: Readonly<SimulatorAnnualPassStateBindings>,
  year: Readonly<YearResult>,
  stable: Readonly<OwnedNonRothIraAnnualSettlementStableContext>,
  plan: Readonly<Plan>,
): boolean {
  const occurrenceSource = year.retirementRuntimeSource
  const applicationSource = year.retirementRuntimeApplicationSource
  if (year.year !== stable.projectionStartTaxYear ||
      occurrenceSource?.planId !== stable.planId ||
      occurrenceSource.taxYear !== stable.projectionStartTaxYear ||
      applicationSource?.planId !== stable.planId ||
      applicationSource.taxYear !== stable.projectionStartTaxYear ||
      state.retirementRuntimeOccurrences.length <
        checkpoint.runtimeOccurrences.length ||
      state.retirementRuntimeApplications.length <
        checkpoint.runtimeApplications.length ||
      !same(
        state.retirementRuntimeOccurrences.slice(
          0,
          checkpoint.runtimeOccurrences.length,
        ),
        checkpoint.runtimeOccurrences,
      ) ||
      !same(
        state.retirementRuntimeApplications.slice(
          0,
          checkpoint.runtimeApplications.length,
        ),
        checkpoint.runtimeApplications,
      )) return false

  const stateOccurrences = [...state.retirementRuntimeOccurrences]
    .sort((left, right) => compareUtf16CodeUnits(
      left.producerOccurrenceKey,
      right.producerOccurrenceKey,
    ))
  const resultOccurrences = [...occurrenceSource.runtimeOccurrences]
    .sort((left, right) => compareUtf16CodeUnits(
      left.producerOccurrenceKey,
      right.producerOccurrenceKey,
    ))
  if (!same(stateOccurrences, resultOccurrences) ||
      !same(
        state.retirementRuntimeApplications,
        applicationSource.applications,
      )) return false

  const appendedApplications = state.retirementRuntimeApplications.slice(
    checkpoint.runtimeApplications.length,
  )
  if (!Number.isSafeInteger(checkpoint.nextMutationOrdinal) ||
      checkpoint.nextMutationOrdinal !==
        checkpoint.runtimeApplications.length + 1 ||
      checkpoint.runtimeApplications.some((application, index) =>
        application.mutationOrdinal !== index + 1) ||
      appendedApplications.some((application, index) =>
        application.mutationOrdinal !== checkpoint.nextMutationOrdinal + index) ||
      state.nextRetirementRuntimeMutationOrdinal.read() !==
        checkpoint.nextMutationOrdinal + appendedApplications.length) {
    return false
  }

  const expectedBalanceIds = new Set(plan.accounts.flatMap((account) =>
    account.type === 'cash' || account.type === 'taxable' ||
      account.type === 'equityComp' || account.type === 'traditional' ||
      account.type === 'roth' || account.type === 'hsa'
      ? [account.id]
      : []))
  if (state.balances.length !== expectedBalanceIds.size) return false
  const seenBalanceIds = new Set<string>()
  for (const record of state.balances) {
    const accountId = record.account.id
    if (!expectedBalanceIds.has(accountId) || seenBalanceIds.has(accountId) ||
        !Object.hasOwn(year.balances, accountId) ||
        !Object.is(record.balance, year.balances[accountId])) return false
    seenBalanceIds.add(accountId)
  }
  return true
}

function canonicalEffects(
  effects: readonly Readonly<OwnedNonRothIraAnnualSettlementEffect>[],
): OwnedNonRothIraAnnualSettlementEffect[] | null {
  if (!Array.isArray(effects)) return null
  const result: OwnedNonRothIraAnnualSettlementEffect[] = []
  const identities = new Set<string>()
  for (const effect of effects) {
    if (effect === null || typeof effect !== 'object' ||
        !Number.isInteger(effect.taxYear) || effect.taxYear < 1 ||
        effect.taxYear > 9999 ||
        (effect.calculationScope !== 'form8606Line7Distributions' &&
          effect.calculationScope !== 'form8606Line8NetConversions')) {
      return null
    }
    const ownerPersonId = personIdSchema.safeParse(effect.ownerPersonId)
    const actionId = actionIdSchema.safeParse(effect.actionId)
    const allocationId = allocationIdSchema.safeParse(effect.allocationId)
    const sourceAccountId = accountIdSchema.safeParse(effect.sourceAccountId)
    const grossAmount = usdCentsSchema.safeParse(effect.grossAmount)
    const basisReturnAmount = usdCentsSchema.safeParse(effect.basisReturnAmount)
    const ordinaryIncomeAmount =
      usdCentsSchema.safeParse(effect.ordinaryIncomeAmount)
    if (!ownerPersonId.success || !actionId.success ||
        !allocationId.success || !sourceAccountId.success ||
        !grossAmount.success || !basisReturnAmount.success ||
        !ordinaryIncomeAmount.success ||
        BigInt(basisReturnAmount.data) + BigInt(ordinaryIncomeAmount.data) !==
          BigInt(grossAmount.data)) return null
    const identity = JSON.stringify([
      effect.taxYear,
      ownerPersonId.data,
      effect.calculationScope,
      actionId.data,
      allocationId.data,
      sourceAccountId.data,
    ])
    if (identities.has(identity)) return null
    identities.add(identity)
    result.push({
      taxYear: effect.taxYear,
      ownerPersonId: ownerPersonId.data,
      calculationScope: effect.calculationScope,
      actionId: actionId.data,
      allocationId: allocationId.data,
      sourceAccountId: sourceAccountId.data,
      grossAmount: grossAmount.data,
      basisReturnAmount: basisReturnAmount.data,
      ordinaryIncomeAmount: ordinaryIncomeAmount.data,
    })
  }
  return result.sort((left, right) =>
    left.taxYear - right.taxYear ||
    compareUtf16CodeUnits(left.ownerPersonId, right.ownerPersonId) ||
    compareUtf16CodeUnits(left.calculationScope, right.calculationScope) ||
    compareUtf16CodeUnits(left.actionId, right.actionId) ||
    compareUtf16CodeUnits(left.allocationId, right.allocationId) ||
    compareUtf16CodeUnits(left.sourceAccountId, right.sourceAccountId))
}

function effectIdentity(
  effects: readonly Readonly<OwnedNonRothIraAnnualSettlementEffect>[],
): string {
  return JSON.stringify(effects.map((effect) => [
    effect.taxYear,
    effect.ownerPersonId,
    effect.calculationScope,
    effect.actionId,
    effect.allocationId,
    effect.sourceAccountId,
    effect.grossAmount,
    effect.basisReturnAmount,
    effect.ordinaryIncomeAmount,
  ]))
}

function replayEffects(
  replay: Readonly<OwnedNonRothIraContiguousReplayComplete>,
): OwnedNonRothIraAnnualSettlementEffect[] | null {
  const effects: OwnedNonRothIraAnnualSettlementEffect[] = []
  for (const annual of replay.annualReplays) {
    for (const owner of annual.ownerReplays) {
      const allocations = [
        owner.line7AllocationEvidence,
        owner.line8AllocationEvidence,
      ]
      for (const evidence of allocations) {
        for (const allocation of evidence.allocations) {
          effects.push({
            taxYear: annual.taxYear,
            ownerPersonId: owner.ownerPersonId,
            calculationScope: evidence.calculationScope,
            actionId: allocation.actionId,
            allocationId: allocation.allocationId,
            sourceAccountId: allocation.sourceAccountId,
            grossAmount: allocation.grossAmount,
            basisReturnAmount: allocation.allocatedBasisAmount,
            ordinaryIncomeAmount: allocation.taxableAmount,
          })
        }
      }
    }
  }
  return canonicalEffects(effects)
}

function aggregateIssue(
  replay: Readonly<OwnedNonRothIraContiguousReplayComplete>,
): OwnedNonRothIraContiguousReplayIssue | null {
  for (const annual of replay.annualReplays) {
    const aggregate = annual.aggregateRothDestinationCredit
    if (aggregate === null) continue
    const owners = new Set(aggregate.sourceOwnerPersonIds)
    if (owners.size !== 1 ||
        !owners.has(aggregate.destinationOwnerPersonId)) {
      return {
        kind: 'basisReplayInvalid',
        detail: 'Aggregate Roth conversion settlement requires one common source and destination owner',
        taxYear: annual.taxYear,
        ownerPersonId: aggregate.destinationOwnerPersonId,
      }
    }
  }
  return null
}

function carryforwards(
  replay: Readonly<OwnedNonRothIraContiguousReplayComplete>,
): OwnedNonRothIraCommittedPlanningCarryforward[] {
  const finalYear = replay.annualReplays.at(-1)!
  return finalYear.ownerReplays.map((owner) => ({
    ownerPersonId: owner.ownerPersonId,
    fromTaxYear: finalYear.taxYear,
    toTaxYear: finalYear.taxYear + 1,
    openingBasisAmount: owner.nextYearOpeningBasisAmount,
    sourceReplayEvidenceId: owner.replayEvidenceId,
  }))
}

function pendingSettlement(
  planId: PlanId,
  projectionStartTaxYear: number,
  replay: Readonly<OwnedNonRothIraContiguousReplayComplete>,
  observedEffects:
    readonly Readonly<OwnedNonRothIraAnnualSettlementEffect>[],
): Readonly<PendingOwnedNonRothIraAnnualSettlement> {
  return deepFreeze({
    status: 'pendingOwnedNonRothIraAnnualSettlement' as const,
    settlement: 'exactEffectsMatched' as const,
    planId,
    projectionStartTaxYear,
    endTaxYear: replay.endTaxYear,
    replay,
    observedEffects: [...observedEffects],
    committedCarryforwards: carryforwards(replay),
  })
}

function rolledBack(
  reason: OwnedNonRothIraAnnualSettlementRollbackReason,
  attemptCount: number,
  issue: OwnedNonRothIraContiguousReplayIssue | null,
): Readonly<OwnedNonRothIraAnnualSettlementRolledBack> {
  return deepFreeze({
    status: 'rolledBack' as const,
    reason,
    attemptCount,
    pendingSettlement: null,
    committedCarryforwards: null,
    issue,
  })
}

/**
 * Privately settles a complete contiguous replay against bounded simulator
 * attempts. The callback must return the one current-year result whose runtime
 * sources, mutation ordinal, and end balances exactly match the active
 * transaction; it receives no deferred-effect or commit capability. The module
 * queues its one inert settlement only after that binding and the fixed replay
 * exactly match assumptions.
 */
export function runOwnedNonRothIraAnnualSettlementAttempts(
  input: Readonly<RunOwnedNonRothIraAnnualSettlementInput>,
): Readonly<OwnedNonRothIraAnnualSettlementResult> {
  let plan: Plan
  try {
    plan = planSchema.parse(input.plan)
  } catch {
    return rolledBack('stableContextInvalid', 0, null)
  }
  const planId = planIdSchema.safeParse(plan.id)
  if (!planId.success || !Number.isInteger(input.projectionStartTaxYear) ||
      input.projectionStartTaxYear < 1 ||
      input.projectionStartTaxYear > 9999 ||
      typeof input.runAttempt !== 'function') {
    return rolledBack('stableContextInvalid', 0, null)
  }

  const stable: OwnedNonRothIraAnnualSettlementStableContext = {
    planId: planId.data,
    projectionStartTaxYear: input.projectionStartTaxYear,
  }
  const invocationToken = Object.freeze({})
  let lastIssue: OwnedNonRothIraContiguousReplayIssue | null = null
  let lastIssueReason: OwnedNonRothIraAnnualSettlementRollbackReason | null =
    null

  const adapter: AnnualPassAttemptDriverAdapter<
    OwnedNonRothIraAnnualSettlementStableContext,
    OwnedNonRothIraAnnualSettlementEffect,
    SettlementProbeInput,
    OwnedNonRothIraAnnualSettlementProbeResult,
    OwnedNonRothIraAnnualSettlementProbeCommit,
    PendingOwnedNonRothIraAnnualSettlement
  > = {
    snapshotStable: () => ({ ...stable }),
    validStableContext: (value) =>
      value.planId === stable.planId &&
      value.projectionStartTaxYear === stable.projectionStartTaxYear,
    canonicalizeEffects: canonicalEffects,
    effectIdentity,
    inputMatchesAttempt: (value, currentStable, assumptions) =>
      value.invocationToken === invocationToken &&
      value.attemptStateBound &&
      currentStable.planId === stable.planId &&
      currentStable.projectionStartTaxYear === stable.projectionStartTaxYear &&
      effectIdentity(value.assumptions) === effectIdentity(assumptions),
    probe: (value) => {
      if (value.issue !== null ||
          value.replay.status !== 'ownedNonRothIraContiguousReplayComplete') {
        return {
          status: 'rollback',
          observedEffects: [],
          replay: value.replay,
          issue: value.issue ?? value.replay.issues[0]!,
        }
      }
      const exact = effectIdentity(value.observedEffects) ===
        effectIdentity(value.assumptions)
      return {
        status: exact ? 'commit' : 'reprobe',
        observedEffects: value.observedEffects,
        replay: value.replay,
        issue: null,
      }
    },
    resultBindingMatches: (result, value, currentStable) =>
      result.status !== 'rollback' &&
      result.replay === value.replay &&
      result.replay.startTaxYear === currentStable.projectionStartTaxYear &&
      result.replay.annualReplays.every((annual) =>
        annual.ownerReplays.every((owner) =>
          owner.annualObservation.planId === currentStable.planId)),
    observedEffects: (result) => result.observedEffects,
    isCommitResult: (
      result,
    ): result is OwnedNonRothIraAnnualSettlementProbeCommit =>
      result.status === 'commit',
  }

  const result = runAnnualPassAttemptsWithAdapter({
    state: input.state,
    stable,
    initialAssumedEffects: input.initialAssumedEffects,
    runAttempt: (
      context: Readonly<AnnualPassAttemptDriverContext<
        OwnedNonRothIraAnnualSettlementStableContext,
        OwnedNonRothIraAnnualSettlementEffect
      >>,
      capability,
    ): Readonly<SettlementProbeInput> => {
      const checkpoint = captureAttemptState(input.state)
      const years = input.runAttempt(context)
      const attemptStateBound = Array.isArray(years) && years.length === 1 &&
        attemptStateMatchesYear(
          checkpoint,
          input.state,
          years[0]!,
          stable,
          plan,
        )
      const replay = replayOwnedNonRothIraContiguousYears(
        plan,
        stable.projectionStartTaxYear,
        years,
      )
      let observedEffects: OwnedNonRothIraAnnualSettlementEffect[] = []
      let issue: OwnedNonRothIraContiguousReplayIssue | null
      let issueReason: OwnedNonRothIraAnnualSettlementRollbackReason | null =
        null
      if (stable.projectionStartTaxYear >= 9999) {
        issue = {
          kind: 'yearSeriesInvalid',
          detail: 'A committed annual settlement requires a supported next tax year for its carryforward',
          taxYear: stable.projectionStartTaxYear,
        }
        issueReason = 'carryforwardYearUnsupported'
      } else if (replay.status === 'ownedNonRothIraContiguousReplayComplete') {
        issue = aggregateIssue(replay)
        if (issue !== null) {
          issueReason = 'aggregateOwnerBindingIncomplete'
        } else {
          const derived = replayEffects(replay)
          if (derived === null) {
            issue = {
              kind: 'basisReplayInvalid',
              detail: 'Contiguous replay effects could not be canonicalized',
            }
            issueReason = 'replayEffectsInvalid'
          } else {
            observedEffects = derived
          }
        }
      } else {
        issue = replay.issues[0]
        issueReason = 'contiguousReplayBlocked'
      }
      if (issue !== null) {
        lastIssue = issue
        lastIssueReason = issueReason
      } else if (effectIdentity(observedEffects) ===
          effectIdentity(context.assumedEffects)) {
        capability.defer(pendingSettlement(
          stable.planId,
          stable.projectionStartTaxYear,
          replay as OwnedNonRothIraContiguousReplayComplete,
          observedEffects,
        ))
      }
      return {
        invocationToken,
        attemptStateBound,
        assumptions: context.assumedEffects,
        replay,
        observedEffects,
        issue,
      }
    },
  }, adapter)

  if (result.status === 'rolledBack') {
    return rolledBack(
      result.reason === 'probeRollback' && lastIssueReason !== null
        ? lastIssueReason
        : result.reason,
      result.attemptCount,
      result.reason === 'probeRollback' ? lastIssue : null,
    )
  }
  if (result.deferredEffects.length !== 1) {
    // The callback has no capability, so this indicates an internal invariant
    // break. State is already committed; fail loudly rather than fabricate a
    // carryforward or publish a partial settlement.
    throw new Error('Exact replay commit must queue one pending settlement')
  }
  const pending = result.deferredEffects[0]!
  return deepFreeze({
    status: 'committed' as const,
    reason: 'exactReplayEffectsMatched' as const,
    attemptCount: result.attemptCount,
    probeResult: result.probeResult,
    pendingSettlement: pending,
    committedCarryforwards: pending.committedCarryforwards,
  })
}
