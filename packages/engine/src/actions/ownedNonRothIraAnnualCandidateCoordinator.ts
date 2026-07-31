import type {
  AnnualIraBasisAllocationEntryInput,
} from './annualIraBasisAllocation.js'
import {
  accountIdSchema,
  actionIdSchema,
  allocationIdSchema,
  type AccountId,
  type ActionId,
  type AllocationId,
  type PersonId,
} from './identity.js'
import { parseCivilIsoDate } from './civilDate.js'
import {
  resolveOwnedNonRothIraAnnualWithdrawalEvidence,
  type CompleteOwnedNonRothIraAnnualWithdrawalFinalizationEvidence,
  type OwnedNonRothIraPenaltyEvidenceMissingIssue,
} from './ownedNonRothIraAnnualFinalization.js'
import {
  stageOwnedNonRothIraOrdinaryWithdrawalMovements,
  type OwnedNonRothIraMovementCandidateScheduleInvalidResult,
  type OwnedNonRothIraMovementCandidateStagedResult,
  type OwnedNonRothIraMovementSourceEvidence,
  type StageOwnedNonRothIraOrdinaryWithdrawalMovementsInput,
} from './ownedNonRothIraMovementCandidate.js'
import type {
  NoOtherStatutoryExceptionClaimedAttestation,
  OwnedNonRothIraNoSeppStatusEvidence,
  OwnedNonRothIraOwnerAliveEvidence,
  OwnedNonRothIraPenaltyOwnerEvidence,
  OwnedNonRothIraPenaltySourceEvidence,
  OwnedNonRothIraSeppPenaltyScheduleReconciliation,
  OwnedNonRothIraSeppPenaltyScheduleRouteInput,
  QualifiedDisabilityEventEvidence,
  RejectedDisabilityStatusEvidence,
  SimpleIraParticipationEvidence,
} from './ownedNonRothIraPenaltyPrerequisite.js'
import type {
  ClassifyOwnedNonRothIraAnnualWithdrawalsInput,
  OwnedNonRothIraPoolMemberEvidence,
} from './ownedNonRothIraWithdrawalCharacter.js'

export type OwnedNonRothIraCandidateOwnerAliveEvidence = Omit<
  OwnedNonRothIraOwnerAliveEvidence,
  'distributionDateEvidenceId'
>

export interface CoordinateOwnedNonRothIraAnnualWithdrawalCandidateInput {
  movementInput:
    Readonly<StageOwnedNonRothIraOrdinaryWithdrawalMovementsInput>
  annualInput: Readonly<
    Omit<ClassifyOwnedNonRothIraAnnualWithdrawalsInput, 'line7Distributions'>
  >
  ownerEvidence: Readonly<OwnedNonRothIraPenaltyOwnerEvidence>
  qualifiedDisabilityEvidence?:
    readonly Readonly<QualifiedDisabilityEventEvidence>[]
  rejectedDisabilityEvidence?:
    readonly Readonly<RejectedDisabilityStatusEvidence>[]
  ownerAliveEvidence?:
    readonly Readonly<OwnedNonRothIraCandidateOwnerAliveEvidence>[]
  iraSeppStatusEvidence?:
    readonly Readonly<OwnedNonRothIraNoSeppStatusEvidence>[]
  iraSeppScheduleRoutes?:
    readonly Readonly<OwnedNonRothIraSeppPenaltyScheduleRouteInput>[]
  noOtherExceptionAttestations?:
    readonly Readonly<NoOtherStatutoryExceptionClaimedAttestation>[]
  simpleParticipationEvidence:
    readonly Readonly<SimpleIraParticipationEvidence>[]
}

export interface OwnedNonRothIraAnnualCandidateBindingEvidence {
  predicate:
    'ownedNonRothIraMovementCandidateBoundToAnnualFinalization'
  ownerPersonId: PersonId
  ownerWideNonRothIraPoolId: string
  taxYear: number
  movementCandidateId: string
  finalizationEvidenceId: string
  line7AllocationEvidenceId: string
  bindingEvidenceId: string
}

interface OwnedNonRothIraAnnualCandidateResultBase {
  movement: 'notCommitted'
  actionability: 'notEstablished'
}

export interface OwnedNonRothIraAnnualCandidateScheduleInvalidResult
  extends OwnedNonRothIraAnnualCandidateResultBase {
  status: 'scheduleInvalid'
  movementCandidate:
    Readonly<OwnedNonRothIraMovementCandidateScheduleInvalidResult>
  annualEvidence: null
  bindingEvidence: null
  issues:
    Readonly<OwnedNonRothIraMovementCandidateScheduleInvalidResult>['scheduleIssues']
}

export interface OwnedNonRothIraAnnualCandidateNoPositiveMovementResult
  extends OwnedNonRothIraAnnualCandidateResultBase {
  status: 'noPositiveMovementStaged'
  movementCandidate:
    Readonly<OwnedNonRothIraMovementCandidateStagedResult>
  annualEvidence: null
  bindingEvidence: null
  issues: readonly []
}

export interface OwnedNonRothIraAnnualCandidateEvidenceBlockedResult
  extends OwnedNonRothIraAnnualCandidateResultBase {
  status: 'annualEvidenceBlocked'
  movementCandidate:
    Readonly<OwnedNonRothIraMovementCandidateStagedResult>
  annualEvidence: null
  bindingEvidence: null
  iraSeppScheduleReconciliations:
    readonly Readonly<OwnedNonRothIraSeppPenaltyScheduleReconciliation>[]
  issues: readonly [
    Readonly<OwnedNonRothIraPenaltyEvidenceMissingIssue>,
    ...Readonly<OwnedNonRothIraPenaltyEvidenceMissingIssue>[],
  ]
}

export interface OwnedNonRothIraAnnualCandidateEvidenceBoundResult
  extends OwnedNonRothIraAnnualCandidateResultBase {
  status: 'annualEvidenceBound'
  movementCandidate:
    Readonly<OwnedNonRothIraMovementCandidateStagedResult>
  annualEvidence:
    Readonly<CompleteOwnedNonRothIraAnnualWithdrawalFinalizationEvidence>
  bindingEvidence:
    Readonly<OwnedNonRothIraAnnualCandidateBindingEvidence>
  issues: readonly []
}

export type CoordinateOwnedNonRothIraAnnualWithdrawalCandidateResult =
  | OwnedNonRothIraAnnualCandidateScheduleInvalidResult
  | OwnedNonRothIraAnnualCandidateNoPositiveMovementResult
  | OwnedNonRothIraAnnualCandidateEvidenceBlockedResult
  | OwnedNonRothIraAnnualCandidateEvidenceBoundResult

function deepFreeze<T>(value: T): Readonly<T> {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) {
      deepFreeze(child)
    }
    Object.freeze(value)
  }
  return value as Readonly<T>
}

function stableId(prefix: string, parts: readonly unknown[]): string {
  return `${prefix}:${JSON.stringify(parts)}`
}

export interface BuildOwnedNonRothIraStagedDistributionDateEvidenceIdInput {
  movementCandidateId: string
  actionId: ActionId
  allocationId: AllocationId
  sourceAccountId: AccountId
  executionDate: string
}

/**
 * Reproduces the coordinator's candidate-bound scheduled-date evidence ID.
 * This identifies staged planning evidence, not custodian execution proof.
 */
export function buildOwnedNonRothIraStagedDistributionDateEvidenceId(
  input:
    Readonly<BuildOwnedNonRothIraStagedDistributionDateEvidenceIdInput>,
): string {
  const movementCandidateId = input.movementCandidateId
  if (
    typeof movementCandidateId !== 'string' ||
    movementCandidateId.trim().length === 0
  ) {
    throw new TypeError(
      'Owned IRA movement candidate ID must be a nonblank stable identifier',
    )
  }
  const actionId = actionIdSchema.parse(input.actionId)
  const allocationId = allocationIdSchema.parse(input.allocationId)
  const sourceAccountId = accountIdSchema.parse(input.sourceAccountId)
  if (parseCivilIsoDate(input.executionDate) === null) {
    throw new RangeError(
      'Owned IRA staged distribution date must be a valid civil date',
    )
  }
  return stableId('owned-non-roth-ira-staged-distribution-date', [
    movementCandidateId,
    actionId,
    allocationId,
    sourceAccountId,
    input.executionDate,
  ])
}

function sourceFactsMatchPoolMember(
  source: Readonly<OwnedNonRothIraMovementSourceEvidence>,
  member: Readonly<OwnedNonRothIraPoolMemberEvidence>,
): boolean {
  return (
    source.sourceAccountId === member.sourceAccountId &&
    source.ownerPersonId === member.ownerPersonId &&
    source.accountType === member.accountType &&
    source.accountKind === member.accountKind &&
    source.inheritanceStatus === member.inheritanceStatus &&
    source.subtype === member.subtype &&
    source.accountOwnershipEvidenceId ===
      member.accountOwnershipEvidenceId &&
    source.iraClassificationEvidenceId ===
      member.iraClassificationEvidenceId
  )
}

function verifyMovementSourcesRejoinAnnualPool(
  sourceEvidence:
    readonly Readonly<OwnedNonRothIraMovementSourceEvidence>[],
  annualInput: Readonly<
    Omit<ClassifyOwnedNonRothIraAnnualWithdrawalsInput, 'line7Distributions'>
  >,
): void {
  if (
    annualInput.ownerPersonId !== sourceEvidence[0]?.ownerPersonId &&
    sourceEvidence.length > 0
  ) {
    throw new RangeError(
      'Owned IRA movement sources must share the annual pool owner',
    )
  }
  const memberBySource = new Map<AccountId, OwnedNonRothIraPoolMemberEvidence>()
  for (const member of annualInput.poolMembers) {
    if (memberBySource.has(member.sourceAccountId)) {
      throw new RangeError(
        `Duplicate annual pool member for "${member.sourceAccountId}"`,
      )
    }
    memberBySource.set(member.sourceAccountId, member)
  }
  for (const source of sourceEvidence) {
    const member = memberBySource.get(source.sourceAccountId)
    if (member === undefined) {
      throw new RangeError(
        `Owned IRA movement source "${source.sourceAccountId}" is missing from the annual pool`,
      )
    }
    if (!sourceFactsMatchPoolMember(source, member)) {
      throw new RangeError(
        `Owned IRA movement source "${source.sourceAccountId}" does not exactly rejoin its annual pool member`,
      )
    }
  }
}

function derivePenaltySourceEvidence(
  movementCandidate:
    Readonly<OwnedNonRothIraMovementCandidateStagedResult>,
): OwnedNonRothIraPenaltySourceEvidence[] {
  const allocationByKey = new Map<
    string,
    Readonly<{
      actionId: ActionId
      allocationId: AllocationId
      sourceAccountId: AccountId
      executionDate: string
      sourceEvidence: Readonly<OwnedNonRothIraMovementSourceEvidence>
    }>
  >()
  for (const action of movementCandidate.actions) {
    for (const allocation of action.allocations) {
      const key = JSON.stringify([
        action.actionId,
        allocation.allocationId,
        allocation.sourceAccountId,
      ])
      if (allocationByKey.has(key)) {
        throw new RangeError(
          `Duplicate staged owned IRA allocation identity ${key}`,
        )
      }
      allocationByKey.set(key, {
        actionId: action.actionId,
        allocationId: allocation.allocationId,
        sourceAccountId: allocation.sourceAccountId,
        executionDate: action.executionDate,
        sourceEvidence: allocation.sourceEvidence,
      })
    }
  }

  return movementCandidate.line7Distributions.map(
    (line7): OwnedNonRothIraPenaltySourceEvidence => {
      const key = JSON.stringify([
        line7.actionId,
        line7.allocationId,
        line7.sourceAccountId,
      ])
      const allocation = allocationByKey.get(key)
      if (
        allocation === undefined ||
        allocation.executionDate !== line7.scheduledDate
      ) {
        throw new Error(
          'Staged owned IRA line-7 evidence lost its physical source/date binding',
        )
      }
      const source = allocation.sourceEvidence
      return {
        predicate: 'ownedNonRothIraPenaltySourceForWithdrawal',
        actionId: allocation.actionId,
        allocationId: allocation.allocationId,
        sourceAccountId: allocation.sourceAccountId,
        ownerPersonId: source.ownerPersonId,
        subtype: source.subtype,
        evaluationDate: allocation.executionDate,
        // This satisfies the downstream field as candidate-bound scheduled-date
        // evidence. It is not external custodian or actual-execution proof.
        distributionDateEvidenceId:
          buildOwnedNonRothIraStagedDistributionDateEvidenceId({
            movementCandidateId: movementCandidate.movementCandidateId,
            actionId: allocation.actionId,
            allocationId: allocation.allocationId,
            sourceAccountId: allocation.sourceAccountId,
            executionDate: allocation.executionDate,
          }),
        accountOwnershipEvidenceId:
          source.accountOwnershipEvidenceId,
        iraClassificationEvidenceId:
          source.iraClassificationEvidenceId,
      }
    },
  )
}

function positiveLine7(
  movementCandidate:
    Readonly<OwnedNonRothIraMovementCandidateStagedResult>,
): readonly Readonly<AnnualIraBasisAllocationEntryInput>[] {
  return movementCandidate.line7Distributions.filter(
    (distribution) => distribution.grossAmount > 0,
  )
}

function bindCandidateDistributionDateEvidence(
  inputs:
    readonly Readonly<OwnedNonRothIraCandidateOwnerAliveEvidence>[],
  sourceEvidence:
    readonly Readonly<OwnedNonRothIraPenaltySourceEvidence>[],
): OwnedNonRothIraOwnerAliveEvidence[] {
  const sourceByKey = new Map(
    sourceEvidence.map((source) => [
      JSON.stringify([source.actionId, source.allocationId]),
      source,
    ]),
  )
  return inputs.map((input): OwnedNonRothIraOwnerAliveEvidence => {
    const source = sourceByKey.get(
      JSON.stringify([input.actionId, input.allocationId]),
    )
    if (source === undefined) {
      throw new RangeError(
        'IRA owner-alive evidence is foreign to the staged candidate',
      )
    }
    return {
      ...input,
      distributionDateEvidenceId:
        source.distributionDateEvidenceId,
    }
  })
}

/**
 * Coordinates the two pure owned-IRA evidence calls for one owner/year.
 *
 * It stages physical movement candidates, proves that every requested source
 * exactly rejoins its complete annual pool member, derives penalty-source
 * evidence from the staged source/date facts, and atomically binds the two
 * resulting evidence IDs. It may bind a fully evidenced penalty-applicable
 * outcome, but never commits movement or establishes actionability.
 */
export function coordinateOwnedNonRothIraAnnualWithdrawalCandidate(
  input: Readonly<CoordinateOwnedNonRothIraAnnualWithdrawalCandidateInput>,
): Readonly<CoordinateOwnedNonRothIraAnnualWithdrawalCandidateResult> {
  if (
    input.movementInput.ownerPersonId !== input.annualInput.ownerPersonId ||
    input.movementInput.taxYear !== input.annualInput.taxYear
  ) {
    throw new RangeError(
      'Owned IRA movement and annual evidence must share owner and tax year',
    )
  }

  const movementCandidate =
    stageOwnedNonRothIraOrdinaryWithdrawalMovements(input.movementInput)
  verifyMovementSourcesRejoinAnnualPool(
    input.movementInput.sourceEvidence,
    input.annualInput,
  )

  if (movementCandidate.status === 'scheduleInvalid') {
    return deepFreeze({
      status: 'scheduleInvalid',
      movement: 'notCommitted',
      actionability: 'notEstablished',
      movementCandidate,
      annualEvidence: null,
      bindingEvidence: null,
      issues: movementCandidate.scheduleIssues,
    })
  }

  const stagedExecutedWithdrawals = positiveLine7(movementCandidate)
  if (stagedExecutedWithdrawals.length === 0) {
    return deepFreeze({
      status: 'noPositiveMovementStaged',
      movement: 'notCommitted',
      actionability: 'notEstablished',
      movementCandidate,
      annualEvidence: null,
      bindingEvidence: null,
      issues: [],
    })
  }

  const penaltySourceEvidence =
    derivePenaltySourceEvidence(movementCandidate)
  const annualResult = resolveOwnedNonRothIraAnnualWithdrawalEvidence({
    annualInput: input.annualInput,
    stagedExecutedWithdrawals,
    ownerEvidence: input.ownerEvidence,
    sourceEvidence: penaltySourceEvidence,
    qualifiedDisabilityEvidence: input.qualifiedDisabilityEvidence,
    rejectedDisabilityEvidence: input.rejectedDisabilityEvidence,
    ownerAliveEvidence: bindCandidateDistributionDateEvidence(
      input.ownerAliveEvidence ?? [],
      penaltySourceEvidence,
    ),
    iraSeppStatusEvidence: input.iraSeppStatusEvidence,
    iraSeppScheduleRoutes: input.iraSeppScheduleRoutes,
    noOtherExceptionAttestations:
      input.noOtherExceptionAttestations,
    simpleParticipationEvidence: input.simpleParticipationEvidence,
  })
  if (annualResult.status === 'penaltyEvidenceMissing') {
    return deepFreeze({
      status: 'annualEvidenceBlocked',
      movement: 'notCommitted',
      actionability: 'notEstablished',
      movementCandidate,
      annualEvidence: null,
      bindingEvidence: null,
      iraSeppScheduleReconciliations:
        annualResult.iraSeppScheduleReconciliations,
      issues: annualResult.issues,
    })
  }

  const annualEvidence = annualResult.annualEvidence
  const bindingEvidence: OwnedNonRothIraAnnualCandidateBindingEvidence = {
    predicate:
      'ownedNonRothIraMovementCandidateBoundToAnnualFinalization',
    ownerPersonId: annualEvidence.ownerPersonId,
    ownerWideNonRothIraPoolId:
      annualEvidence.ownerWideNonRothIraPoolId,
    taxYear: annualEvidence.taxYear,
    movementCandidateId: movementCandidate.movementCandidateId,
    finalizationEvidenceId: annualEvidence.finalizationEvidenceId,
    line7AllocationEvidenceId:
      annualEvidence.characterization.line7AllocationEvidence
        .allocationEvidenceId,
    bindingEvidenceId: stableId(
      'owned-non-roth-ira-annual-candidate-binding',
      [
        annualEvidence.ownerPersonId,
        annualEvidence.ownerWideNonRothIraPoolId,
        annualEvidence.taxYear,
        movementCandidate.movementCandidateId,
        annualEvidence.finalizationEvidenceId,
        annualEvidence.characterization.line7AllocationEvidence
          .allocationEvidenceId,
      ],
    ),
  }
  return deepFreeze({
    status: 'annualEvidenceBound',
    movement: 'notCommitted',
    actionability: 'notEstablished',
    movementCandidate,
    annualEvidence,
    bindingEvidence,
    issues: [],
  })
}
