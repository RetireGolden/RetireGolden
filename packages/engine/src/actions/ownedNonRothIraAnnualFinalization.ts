import type {
  AnnualIraBasisAllocationEntryInput,
} from './annualIraBasisAllocation.js'
import type {
  AccountId,
  ActionId,
  AllocationId,
  PersonId,
} from './identity.js'
import {
  classifyOwnedNonRothIraAnnualWithdrawals,
  type ClassifyOwnedNonRothIraAnnualWithdrawalsInput,
  type ClassifyOwnedNonRothIraAnnualWithdrawalsResult,
} from './ownedNonRothIraWithdrawalCharacter.js'
import {
  evaluateOwnedNonRothIraPenaltyPrerequisites,
  type Age59HalfReachedPenaltyEvaluation,
  type DisabilityQualifiedPenaltyEvaluation,
  type EvaluateOwnedNonRothIraPenaltyPrerequisitesResult,
  type ExceptionEvaluationRequiredPenaltyPrerequisite,
  type NoOtherStatutoryExceptionClaimedAttestation,
  type OwnedNonRothIraNoSeppStatusEvidence,
  type OwnedNonRothIraOwnerAliveEvidence,
  type OwnedNonRothIraPenaltyOwnerEvidence,
  type OwnedNonRothIraPenaltySourceEvidence,
  type PenaltyAppliesEvaluation,
  type QualifiedDisabilityEventEvidence,
  type RejectedDisabilityStatusEvidence,
  type SimpleIraParticipationEvidence,
} from './ownedNonRothIraPenaltyPrerequisite.js'
import {
  createActionReason,
  type ActionReason,
} from './reasons.js'

export interface ResolveOwnedNonRothIraAnnualWithdrawalEvidenceInput {
  annualInput: Readonly<
    Omit<ClassifyOwnedNonRothIraAnnualWithdrawalsInput, 'line7Distributions'>
  >
  stagedExecutedWithdrawals:
    readonly Readonly<AnnualIraBasisAllocationEntryInput>[]
  ownerEvidence: Readonly<OwnedNonRothIraPenaltyOwnerEvidence>
  sourceEvidence: readonly Readonly<OwnedNonRothIraPenaltySourceEvidence>[]
  qualifiedDisabilityEvidence?:
    readonly Readonly<QualifiedDisabilityEventEvidence>[]
  rejectedDisabilityEvidence?:
    readonly Readonly<RejectedDisabilityStatusEvidence>[]
  ownerAliveEvidence?:
    readonly Readonly<OwnedNonRothIraOwnerAliveEvidence>[]
  iraSeppStatusEvidence?:
    readonly Readonly<OwnedNonRothIraNoSeppStatusEvidence>[]
  noOtherExceptionAttestations?:
    readonly Readonly<NoOtherStatutoryExceptionClaimedAttestation>[]
  simpleParticipationEvidence:
    readonly Readonly<SimpleIraParticipationEvidence>[]
}

export type FinalOwnedNonRothIraPenaltyPrerequisiteEvaluation =
  | Age59HalfReachedPenaltyEvaluation
  | DisabilityQualifiedPenaltyEvaluation
  | PenaltyAppliesEvaluation

export interface ResolvedOwnedNonRothIraPenaltyPrerequisites
  extends Omit<
    EvaluateOwnedNonRothIraPenaltyPrerequisitesResult,
    'evaluations'
  > {
  evaluations:
    readonly Readonly<FinalOwnedNonRothIraPenaltyPrerequisiteEvaluation>[]
}

export interface CompleteOwnedNonRothIraAnnualWithdrawalFinalizationEvidence {
  predicate:
    'completeOwnedNonRothIraAnnualWithdrawalFinalizationForOwnerAndTaxYear'
  ownerPersonId: PersonId
  ownerWideNonRothIraPoolId: string
  taxYear: number
  characterization:
    Readonly<ClassifyOwnedNonRothIraAnnualWithdrawalsResult>
  penaltyPrerequisites:
    Readonly<ResolvedOwnedNonRothIraPenaltyPrerequisites>
  finalizationEvidenceId: string
}

export interface OwnedNonRothIraPenaltyEvidenceMissingIssue {
  actionId: ActionId
  allocationId: AllocationId
  sourceAccountId: AccountId
  prerequisite:
    Readonly<ExceptionEvaluationRequiredPenaltyPrerequisite>
  reason:
    Readonly<ActionReason<'withdrawal-penalty-evidence-missing'>>
}

export interface OwnedNonRothIraAnnualEvidenceResolvedResult {
  status: 'annualEvidenceResolved'
  movement: 'notCommitted'
  annualEvidence:
    Readonly<CompleteOwnedNonRothIraAnnualWithdrawalFinalizationEvidence>
  issues: readonly []
}

export interface OwnedNonRothIraPenaltyEvidenceMissingResult {
  status: 'penaltyEvidenceMissing'
  movement: 'notCommitted'
  annualEvidence: null
  issues: readonly [
    Readonly<OwnedNonRothIraPenaltyEvidenceMissingIssue>,
    ...Readonly<OwnedNonRothIraPenaltyEvidenceMissingIssue>[],
  ]
}

export type ResolveOwnedNonRothIraAnnualWithdrawalEvidenceResult =
  | OwnedNonRothIraAnnualEvidenceResolvedResult
  | OwnedNonRothIraPenaltyEvidenceMissingResult

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

/**
 * Resolves one complete owner/year owned non-Roth IRA evidence bundle.
 *
 * This is an atomic, pure publication gate. It characterizes staged executed
 * gross withdrawals and evaluates their penalty prerequisites, but it neither
 * commits movement nor establishes action readiness. Every positive
 * ordinary-income allocation must have a final age, disability, or fully
 * evidenced penalty-applicable outcome before publication.
 */
export function resolveOwnedNonRothIraAnnualWithdrawalEvidence(
  input: Readonly<ResolveOwnedNonRothIraAnnualWithdrawalEvidenceInput>,
): Readonly<ResolveOwnedNonRothIraAnnualWithdrawalEvidenceResult> {
  if (input.stagedExecutedWithdrawals.length === 0) {
    throw new RangeError(
      'Owned non-Roth IRA annual resolution requires at least one staged executed withdrawal',
    )
  }
  if (
    input.stagedExecutedWithdrawals.some(
      (withdrawal) => withdrawal.grossAmount <= 0,
    )
  ) {
    throw new RangeError(
      'Every staged owned non-Roth IRA withdrawal must have positive executed gross',
    )
  }
  const characterization = classifyOwnedNonRothIraAnnualWithdrawals({
    ...input.annualInput,
    line7Distributions: input.stagedExecutedWithdrawals,
  })
  const penaltyPrerequisites =
    evaluateOwnedNonRothIraPenaltyPrerequisites({
      characterization,
      ownerEvidence: input.ownerEvidence,
      sourceEvidence: input.sourceEvidence,
      qualifiedDisabilityEvidence: input.qualifiedDisabilityEvidence,
      rejectedDisabilityEvidence: input.rejectedDisabilityEvidence,
      ownerAliveEvidence: input.ownerAliveEvidence,
      iraSeppStatusEvidence: input.iraSeppStatusEvidence,
      noOtherExceptionAttestations:
        input.noOtherExceptionAttestations,
      simpleParticipationEvidence: input.simpleParticipationEvidence,
    })
  const unresolved = penaltyPrerequisites.evaluations.filter(
    (
      evaluation,
    ): evaluation is ExceptionEvaluationRequiredPenaltyPrerequisite =>
      evaluation.outcome === 'exceptionEvaluationRequired',
  )
  if (unresolved.length > 0) {
    const issues = unresolved.map(
      (prerequisite): OwnedNonRothIraPenaltyEvidenceMissingIssue => ({
        actionId: prerequisite.actionId,
        allocationId: prerequisite.allocationId,
        sourceAccountId: prerequisite.sourceAccountId,
        prerequisite,
        reason: createActionReason('withdrawal-penalty-evidence-missing', {
          personId: prerequisite.ownerPersonId,
          accountId: prerequisite.sourceAccountId,
          allocationId: prerequisite.allocationId,
        }),
      }),
    ) as [
      OwnedNonRothIraPenaltyEvidenceMissingIssue,
      ...OwnedNonRothIraPenaltyEvidenceMissingIssue[],
    ]
    return deepFreeze({
      status: 'penaltyEvidenceMissing',
      movement: 'notCommitted',
      annualEvidence: null,
      issues,
    })
  }

  // This boundary intentionally cannot submit annual SEPP schedule routes.
  // Fail closed if that input contract changes before the finalizer's own
  // accepted-outcome union is deliberately extended.
  if (penaltyPrerequisites.evaluations.some(
    (evaluation) => evaluation.outcome === 'iraSeppQualified',
  )) {
    throw new Error(
      'Annual IRA finalization does not yet consume SEPP-qualified prerequisite outcomes',
    )
  }

  const finalEvaluations =
    penaltyPrerequisites.evaluations as
      readonly FinalOwnedNonRothIraPenaltyPrerequisiteEvaluation[]
  const resolvedPenaltyPrerequisites:
    ResolvedOwnedNonRothIraPenaltyPrerequisites = {
      ...penaltyPrerequisites,
      evaluations: finalEvaluations,
    }
  const annualBasisEvidence = characterization.annualBasisEvidence
  const finalizationEvidenceId = stableId(
    'owned-non-roth-ira-annual-withdrawal-finalization',
    [
      annualBasisEvidence.ownerPersonId,
      annualBasisEvidence.ownerWideNonRothIraPoolId,
      annualBasisEvidence.taxYear,
      annualBasisEvidence.basisEvidenceId,
      characterization.line7AllocationEvidence.allocationEvidenceId,
      characterization.line8AllocationEvidence.allocationEvidenceId,
      penaltyPrerequisites.coverage
        .map((item) => item.evidenceId)
        .sort(),
      finalEvaluations.map((item) => item.finalEvidenceId).sort(),
    ],
  )
  const annualEvidence:
    CompleteOwnedNonRothIraAnnualWithdrawalFinalizationEvidence = {
      predicate:
        'completeOwnedNonRothIraAnnualWithdrawalFinalizationForOwnerAndTaxYear',
      ownerPersonId: annualBasisEvidence.ownerPersonId,
      ownerWideNonRothIraPoolId:
        annualBasisEvidence.ownerWideNonRothIraPoolId,
      taxYear: annualBasisEvidence.taxYear,
      characterization,
      penaltyPrerequisites: resolvedPenaltyPrerequisites,
      finalizationEvidenceId,
    }
  return deepFreeze({
    status: 'annualEvidenceResolved',
    movement: 'notCommitted',
    annualEvidence,
    issues: [],
  })
}
