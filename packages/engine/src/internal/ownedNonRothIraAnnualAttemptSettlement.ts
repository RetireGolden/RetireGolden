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
import { SIMULATOR_ANNUAL_PASS_VALUE_BINDING_KEYS } from
  './simulatorAnnualPassValueBindingKeys.js'

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

export interface OwnedNonRothIraAnnualAttemptStateEvidence {
  readonly status: 'ownedNonRothIraAnnualAttemptStateCaptured'
  readonly planId: PlanId
  readonly taxYear: number
  readonly attemptNumber: number
  readonly state: ReturnType<typeof snapshotInvariantState>
}

export type CaptureOwnedNonRothIraAnnualAttemptStateEvidence = (
  context: Readonly<OwnedNonRothIraAnnualSettlementAttemptContext>,
  year: Readonly<YearResult>,
) => Readonly<OwnedNonRothIraAnnualAttemptStateEvidence>

export interface RunOwnedNonRothIraAnnualSettlementInput {
  readonly state: SimulatorAnnualPassStateBindings
  readonly plan: Plan
  readonly projectionStartTaxYear: number
  readonly initialAssumedEffects:
    readonly Readonly<OwnedNonRothIraAnnualSettlementEffect>[]
  readonly runAttempt: RunOwnedNonRothIraAnnualSettlementAttempt
  /**
   * Optional integration binding for the explicitly named annual-tail state
   * that is not independently represented by YearResult balances/journals.
   * Without it every such field must remain checkpoint-equal.
   */
  readonly captureAttemptStateEvidence?:
    CaptureOwnedNonRothIraAnnualAttemptStateEvidence
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

/**
 * `aggregateOwnerBindingIncomplete` was retired here, not weakened.
 *
 * It named the settlement's own re-check that an aggregate conversion credit
 * drew only on its destination owner's dollars — the IRC 408(d)(3)(A)(i)
 * identity requirement. While the simulator credited every owner's conversion
 * to the first Roth in Plan order, that condition was true of any married
 * household holding its Roth and traditional balances in different names, so
 * the reason fired constantly and rolled the household back rather than
 * correcting anything.
 *
 * The simulator now slices the conversion by owner, and
 * `aggregateRothCredits` in the source-series stage refuses, per owner and
 * before this module ever sees a replay, any credit whose sources are not
 * exactly its destination owner's. Since the settlement builds its replay
 * through that stage and nowhere else, no input can now reach the old check in
 * a failing state: it would have been an unreachable branch with no fixture
 * able to produce it, which is the shape of guard this codebase treats as
 * rotted rather than defensive. Owner attribution survives — the source-series
 * issue carries `ownerPersonId`, and `contiguousReplayBlocked` forwards it.
 */
export type OwnedNonRothIraAnnualSettlementRollbackReason =
  | AnnualPassAttemptRollbackReason
  | 'contiguousReplayBlocked'
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
  readonly bindingReferences: {
    readonly [Key in keyof SimulatorAnnualPassStateBindings]:
      SimulatorAnnualPassStateBindings[Key]
  }
  readonly balanceBindings: readonly {
    readonly record: SimulatorAnnualPassStateBindings['balances'][number]
    readonly account:
      SimulatorAnnualPassStateBindings['balances'][number]['account']
  }[]
  readonly valueBindingMethods: readonly {
    readonly key:
      typeof SIMULATOR_ANNUAL_PASS_VALUE_BINDING_KEYS[number]
    readonly binding: object
    readonly read: unknown
    readonly write: unknown
  }[]
  readonly runtimeOccurrences:
    readonly Readonly<SimulatorAnnualRetirementRuntimeOccurrence>[]
  readonly runtimeApplications:
    readonly Readonly<SimulatorRetirementRuntimeApplication>[]
  readonly nextMutationOrdinal: number
  readonly invariantState: unknown
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
  // Both destination-credit kinds are plural now: a year holds one aggregate
  // credit per converting owner and one named credit per committed request, and
  // each carries its own source arrays. A shallow spread would leave every
  // clone sharing those arrays with the live journal, so a checkpoint taken
  // before an attempt would mutate along with it.
  return value.applicationKind === 'aggregateRothDestinationCredit' ||
      value.applicationKind === 'namedRothDestinationCredit'
    ? {
        ...value,
        producerOccurrenceKeys: [...value.producerOccurrenceKeys],
        sourceOwnerPersonIds: [...value.sourceOwnerPersonIds],
      }
    : { ...value }
}

function snapshotStringMap<Value>(
  value: ReadonlyMap<string, Value>,
): Array<[string, Value]> {
  return [...value]
    .map(([key, entry]) => [key, structuredClone(entry)] as [string, Value])
    .sort(([left], [right]) => compareUtf16CodeUnits(left, right))
}

function snapshotNumberMap<Value>(
  value: ReadonlyMap<number, Value>,
): Array<[number, Value]> {
  return [...value]
    .map(([key, entry]) => [key, structuredClone(entry)] as [number, Value])
    .sort(([left], [right]) => compareUtf16CodeUnits(String(left), String(right)))
}

type SimulatorAnnualPassEvidenceValueKey = Exclude<
  typeof SIMULATOR_ANNUAL_PASS_VALUE_BINDING_KEYS[number],
  'nextRetirementRuntimeMutationOrdinal'
>

type SimulatorAnnualPassValueSnapshot = Readonly<{
  [Key in SimulatorAnnualPassEvidenceValueKey]:
    ReturnType<SimulatorAnnualPassStateBindings[Key]['read']>
}>

function snapshotAnnualPassValues(
  state: Readonly<SimulatorAnnualPassStateBindings>,
): SimulatorAnnualPassValueSnapshot {
  return Object.fromEntries(
    SIMULATOR_ANNUAL_PASS_VALUE_BINDING_KEYS
      .filter((key): key is SimulatorAnnualPassEvidenceValueKey =>
        key !== 'nextRetirementRuntimeMutationOrdinal')
      .map((key) => [key, state[key].read()]),
  ) as SimulatorAnnualPassValueSnapshot
}

function snapshotInvariantState(
  state: Readonly<SimulatorAnnualPassStateBindings>,
): Readonly<{
  balanceCostBasis: readonly (readonly [string, number])[]
  iraProRata: readonly [string, unknown][]
  iraBasisByOwner: readonly [string, unknown][]
  rothBasis: readonly [string, unknown][]
  rothAssumedContributionRemaining: readonly [string, unknown][]
  rothCounterfactualFreeCoverConsumed: readonly [string, unknown][]
  propertyValues: readonly [string, unknown][]
  hecmStates: readonly [string, unknown][]
  insuranceCashValues: readonly [string, unknown][]
  allocationTrack: readonly [string, unknown][]
  seppAmortAmount: readonly [string, unknown][]
  magiHistory: readonly [number, unknown][]
  deferredFirstRmdByApplicablePlan: readonly [string, unknown][]
  namedQcdOffsetConsumedByDonor: readonly [string, unknown][]
  namedQcdOffsetHistoryUnprovable: readonly string[]
  warnings: readonly string[]
  valueBindings: SimulatorAnnualPassValueSnapshot
  expenses: unknown
}> {
  // Runtime journals, ordinal, and end balances have independent YearResult
  // bindings. Every other transaction-owned field is named here and must stay
  // checkpoint-equal unless the integration supplies a complete attempt-bound
  // snapshot that exactly matches this shape.
  return {
    balanceCostBasis: state.balances
      .map((record) => [record.account.id, record.costBasis] as const)
      .sort(([left], [right]) => compareUtf16CodeUnits(left, right)),
    iraProRata: snapshotStringMap(state.iraProRata),
    iraBasisByOwner: snapshotStringMap(state.iraBasisByOwner),
    rothBasis: snapshotStringMap(state.rothBasis),
    rothAssumedContributionRemaining:
      snapshotStringMap(state.rothAssumedContributionRemaining),
    rothCounterfactualFreeCoverConsumed:
      snapshotStringMap(state.rothCounterfactualFreeCoverConsumed),
    propertyValues: snapshotStringMap(state.propertyValues),
    hecmStates: snapshotStringMap(state.hecmStates),
    insuranceCashValues: snapshotStringMap(state.insuranceCashValues),
    allocationTrack: snapshotStringMap(state.allocationTrack),
    seppAmortAmount: snapshotStringMap(state.seppAmortAmount),
    magiHistory: snapshotNumberMap(state.magiHistory),
    deferredFirstRmdByApplicablePlan:
      snapshotStringMap(state.deferredFirstRmdByApplicablePlan),
    namedQcdOffsetConsumedByDonor:
      snapshotStringMap(state.namedQcdOffsetConsumedByDonor),
    namedQcdOffsetHistoryUnprovable:
      [...state.namedQcdOffsetHistoryUnprovable].sort(compareUtf16CodeUnits),
    warnings: [...state.warnings].sort(compareUtf16CodeUnits),
    valueBindings: snapshotAnnualPassValues(state),
    expenses: structuredClone(state.expenses),
  }
}

export function captureOwnedNonRothIraAnnualAttemptStateEvidence(input: {
  readonly state: Readonly<SimulatorAnnualPassStateBindings>
  readonly planId: PlanId
  readonly taxYear: number
  readonly attemptNumber: number
}): Readonly<OwnedNonRothIraAnnualAttemptStateEvidence> {
  return deepFreeze({
    status: 'ownedNonRothIraAnnualAttemptStateCaptured' as const,
    planId: input.planId,
    taxYear: input.taxYear,
    attemptNumber: input.attemptNumber,
    state: snapshotInvariantState(input.state),
  })
}

function captureAttemptState(
  state: Readonly<SimulatorAnnualPassStateBindings>,
): AttemptStateCheckpoint {
  return {
    bindingReferences: { ...state },
    balanceBindings: state.balances.map((record) => ({
      record,
      account: record.account,
    })),
    valueBindingMethods:
      SIMULATOR_ANNUAL_PASS_VALUE_BINDING_KEYS.map((key) => {
      const binding = state[key]
      return {
        key,
        binding,
        read: binding.read,
        write: binding.write,
      }
      }),
    runtimeOccurrences: state.retirementRuntimeOccurrences.map((value) => ({
      ...value,
    })),
    runtimeApplications:
      state.retirementRuntimeApplications.map(cloneRuntimeApplication),
    nextMutationOrdinal: state.nextRetirementRuntimeMutationOrdinal.read(),
    invariantState: snapshotInvariantState(state),
  }
}

function attemptBindingReferencesMatch(
  checkpoint: Readonly<AttemptStateCheckpoint>,
  state: Readonly<SimulatorAnnualPassStateBindings>,
): boolean {
  const bindingKeys = Object.keys(checkpoint.bindingReferences) as
    Array<keyof SimulatorAnnualPassStateBindings>
  return bindingKeys.every((key) =>
    state[key] === checkpoint.bindingReferences[key]) &&
    checkpoint.valueBindingMethods.every(({ key, binding, read, write }) => {
      const current = state[key]
      return current === binding &&
        current.read === read &&
        current.write === write
    }) &&
    state.balances.length === checkpoint.balanceBindings.length &&
    state.balances.every((record, index) =>
      record === checkpoint.balanceBindings[index]!.record &&
      record.account === checkpoint.balanceBindings[index]!.account)
}

function attemptStateMatchesYear(
  checkpoint: Readonly<AttemptStateCheckpoint>,
  state: Readonly<SimulatorAnnualPassStateBindings>,
  year: Readonly<YearResult>,
  stable: Readonly<OwnedNonRothIraAnnualSettlementStableContext>,
  plan: Readonly<Plan>,
  attemptNumber: number,
  stateEvidence:
    Readonly<OwnedNonRothIraAnnualAttemptStateEvidence> | null,
): boolean {
  const occurrenceSource = year.retirementRuntimeSource
  const applicationSource = year.retirementRuntimeApplicationSource
  const currentInvariantState = snapshotInvariantState(state)
  const invariantStateBound = stateEvidence === null
    ? same(checkpoint.invariantState, currentInvariantState)
    : stateEvidence.status ===
        'ownedNonRothIraAnnualAttemptStateCaptured' &&
      stateEvidence.planId === stable.planId &&
      stateEvidence.taxYear === stable.projectionStartTaxYear &&
      stateEvidence.attemptNumber === attemptNumber &&
      same(stateEvidence.state, currentInvariantState)
  if (!attemptBindingReferencesMatch(checkpoint, state) ||
      !invariantStateBound ||
      year.year !== stable.projectionStartTaxYear ||
      occurrenceSource === undefined ||
      applicationSource === undefined ||
      occurrenceSource.planId !== stable.planId ||
      occurrenceSource.taxYear !== stable.projectionStartTaxYear ||
      applicationSource.planId !== stable.planId ||
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

  const expectedBalanceAccounts = plan.accounts.flatMap((account) =>
    account.type === 'cash' || account.type === 'taxable' ||
      account.type === 'equityComp' || account.type === 'traditional' ||
      account.type === 'roth' || account.type === 'hsa'
      ? [account.id]
      : [])
  if (state.balances.length !== expectedBalanceAccounts.length) return false
  const aggregateBalances = new Map<string, number>()
  for (let index = 0; index < state.balances.length; index += 1) {
    const record = state.balances[index]!
    const accountId = record.account.id
    if (expectedBalanceAccounts[index] !== accountId) return false
    aggregateBalances.set(accountId, (aggregateBalances.get(accountId) ?? 0) + record.balance)
  }
  for (const [accountId, balance] of aggregateBalances) {
    if (!Object.hasOwn(year.balances, accountId) ||
        !Object.is(balance, year.balances[accountId])) return false
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
 * The one owner a rolled-back settlement is evidence about, or null when the
 * rollback says nothing about which owner failed.
 *
 * Only the three replay-derived reasons (`contiguousReplayBlocked`,
 * `replayEffectsInvalid`, `carryforwardYearUnsupported`) can carry an issue at
 * all: every other member
 * of the reason union is raised before or outside the replay and is reported
 * with `issue: null`. Even a replay-derived rollback is attributable only when
 * its issue actually names a known plan owner -- an absent or unrecognized
 * name is not evidence about any one owner, so it must stay household-wide
 * fail-closed.
 */
export function ownedNonRothIraAnnualSettlementRollbackOwner(
  result: Readonly<OwnedNonRothIraAnnualSettlementResult>,
  knownOwnerPersonIds: ReadonlySet<string>,
): string | null {
  if (result.status !== 'rolledBack' || result.issue === null) return null
  const ownerPersonId = result.issue.ownerPersonId
  return typeof ownerPersonId === 'string' &&
    knownOwnerPersonIds.has(ownerPersonId)
    ? ownerPersonId
    : null
}

/**
 * The three source-series refusals that say "this year contains an event no
 * stage characterizes yet", as opposed to "a basis figure is wrong".
 *
 * `annuityStageRequired` says a premium left the captured pool for a contract
 * the replay does not carry; `exactActionStageRequired` says an exact action
 * moved (or declared) owned-IRA dollars outside the characterizations the
 * replay knows; `qcdStageRequired` says the year's charitable gift is in a
 * shape the replay cannot attribute -- a characterization that was never
 * published, or an attribution naming a pool this replay does not hold. All
 * three are capability gaps in the engine, dated to one tax year's event
 * inventory, and none is evidence about any owner's opening basis.
 *
 * `qcdReconciliationInvalid` is deliberately NOT here, and it is the reason
 * that kind exists. The charitable arm also carries exact-cent invariants -- a
 * partition that does not sum to its overlay, a remainder outside its own
 * gross, a carve the owner's own required distributions cannot absorb -- and
 * those are the ledger and the replay contradicting each other, not a stage the
 * engine has yet to build. They used to share `qcdStageRequired`'s name and
 * would have inherited its year-scoped horizon with it.
 *
 * Every other rollback reason is evidence about the numerator too. A replay
 * whose arithmetic, balance chain, coverage, identity, or carryforward failed
 * IS evidence that the figure the projection is carrying for that owner cannot
 * be trusted, and a reason raised outside the replay entirely (an assumption
 * cycle, a throw, a binding mismatch) is evidence that the settlement machinery
 * could not be run at all. Those stay permanent, which is why this set is a
 * deliberate allow-list of three names rather than a test on where the issue
 * came from.
 *
 * THE LIMIT, STATED RATHER THAN IMPLIED. The source series reports its FIRST
 * failure and throws, and this function reads only that one issue's kind. So a
 * year that contains both a stage gap and a genuine integrity failure is
 * dispositioned by whichever check runs first, and where a stage check runs
 * first the permanent failure is masked and the year is scoped to itself.
 *
 * That masking is bounded three ways, and the bound is why the ordering was not
 * simply inverted. First, it is narrow: the annuity pool-exit refusal, the one
 * stage check that fires on every real annuity year, was moved to run after the
 * application chain rejoins its live observation, so a corrupt chain in an
 * annuity year now reports the corruption. What remains masked is the
 * Plan-purchase pre-check (the declared premium whose occurrence is absent) and
 * the two coverage helpers, which must precede the chain for their own stated
 * reasons. Second, the permanent kinds are self-consistency invariants between
 * the simulator's own journal and its own published year: no valid Plan reaches
 * one, and every fixture that does reaches it by hand-mutating a projected
 * year. Masking therefore presupposes a defect that already exists. Third,
 * inverting the remaining order would be worse, not better -- a declared
 * premium with no occurrence sourcing it would surface as a generic chain
 * failure instead of the diagnosis that names it, and under this very function
 * that phantom would latch PERMANENTLY. Trading an honest year-scoped refusal
 * for a misleading permanent one is not a fix.
 */
const YEAR_SCOPED_STAGE_REQUIRED_ISSUE_KINDS: ReadonlySet<string> = new Set([
  'annuityStageRequired',
  'exactActionStageRequired',
  'qcdStageRequired',
])

export interface OwnedNonRothIraAnnualSettlementRollbackDisqualification {
  /** The one owner the rollback is evidence about, or null for the household. */
  readonly ownerPersonId: string | null
  /**
   * `thisTaxYear` disqualifies only the year that rolled back: the year falls
   * back to the legacy ledger, the fallback pass commits its own coherent basis
   * for every owner, and the next year attempts settlement from that figure
   * exactly as it would from any other plan seed. `remainingProjection` is the
   * historical permanent fail-closed disposition.
   */
  readonly horizon: 'thisTaxYear' | 'remainingProjection'
}

/**
 * How far a rolled-back settlement disqualifies, and whom.
 *
 * The horizon is the question the owner alone could not answer. A permanent
 * latch is the right answer to "this owner's basis numerator is untrustworthy
 * from now on" and the wrong answer to "this year contains an annuity purchase"
 * -- the second is a fact about 2028, not about 2029, and under one shared
 * latch a single annuity year silently withheld every later year's settled
 * figures for the rest of the projection.
 *
 * The two axes are independent and both are read from the same issue: a
 * stage-required refusal that names an owner disqualifies that owner for that
 * year, and one that names nobody disqualifies the household for that year.
 */
export function ownedNonRothIraAnnualSettlementRollbackDisqualification(
  result: Readonly<OwnedNonRothIraAnnualSettlementResult>,
  knownOwnerPersonIds: ReadonlySet<string>,
): Readonly<OwnedNonRothIraAnnualSettlementRollbackDisqualification> {
  const ownerPersonId = ownedNonRothIraAnnualSettlementRollbackOwner(
    result,
    knownOwnerPersonIds,
  )
  const kind = result.status === 'rolledBack' ? result.issue?.kind : undefined
  return deepFreeze({
    ownerPersonId,
    horizon: typeof kind === 'string' &&
      YEAR_SCOPED_STAGE_REQUIRED_ISSUE_KINDS.has(kind)
      ? 'thisTaxYear' as const
      : 'remainingProjection' as const,
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
      const stateEvidence = Array.isArray(years) && years.length === 1 &&
          input.captureAttemptStateEvidence !== undefined
        ? input.captureAttemptStateEvidence(context, years[0]!)
        : null
      const attemptStateBound = Array.isArray(years) && years.length === 1 &&
        attemptStateMatchesYear(
          checkpoint,
          input.state,
          years[0]!,
          stable,
          plan,
          context.attemptNumber,
          stateEvidence,
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
        issue = null
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
