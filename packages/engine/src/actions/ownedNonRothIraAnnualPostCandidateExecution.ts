import type {
  CompleteOwnedNonRothIraAnnualWithdrawalFinalizationEvidence,
} from './ownedNonRothIraAnnualFinalization.js'
import {
  coordinateOwnedNonRothIraAnnualWithdrawalCandidate,
  type CoordinateOwnedNonRothIraAnnualWithdrawalCandidateInput,
  type CoordinateOwnedNonRothIraAnnualWithdrawalCandidateResult,
} from './ownedNonRothIraAnnualCandidateCoordinator.js'
import {
  type PlanOwnedNonRothIraAnnualExecutionAction,
  type PlanOwnedNonRothIraAnnualExecutionBalance,
} from './ownedNonRothIraAnnualExecution.js'
import {
  publishPlanOwnedNonRothIraAnnualExecutionEvidence,
} from './ownedNonRothIraAnnualExecutionEvidence.js'
import {
  buildPlanOwnedNonRothIraAnnualPostCandidateClassificationInput,
  type BuildPlanOwnedNonRothIraAnnualPostCandidateClassificationInput,
  type BuildPlanOwnedNonRothIraAnnualPostCandidateClassificationInputResult,
  type PlanOwnedNonRothIraPostCandidateEvidenceBuiltResult,
} from './ownedNonRothIraAnnualPostCandidateEvidence.js'
import {
  compareUtf16CodeUnits,
  deriveActionStructuralId,
} from './structuralId.js'

type PenaltyFacts = Omit<
  CoordinateOwnedNonRothIraAnnualWithdrawalCandidateInput,
  'movementInput' | 'annualInput'
>

export interface ExecutePlanOwnedNonRothIraAnnualPostCandidateInput
  extends PenaltyFacts {
  postCandidateInput:
    Readonly<BuildPlanOwnedNonRothIraAnnualPostCandidateClassificationInput>
  postCandidateEvidence:
    Readonly<PlanOwnedNonRothIraPostCandidateEvidenceBuiltResult>
  annualFinalization:
    Readonly<CompleteOwnedNonRothIraAnnualWithdrawalFinalizationEvidence> | null
}

export type PlanOwnedNonRothIraAnnualPostCandidatePassThroughResult =
  BuildPlanOwnedNonRothIraAnnualPostCandidateClassificationInputResult extends infer Result
    ? Result extends { status: 'postCandidateClassificationInputBuilt' }
      ? never
      : Result
    : never

export type PlanOwnedNonRothIraAnnualPostCandidateCoordinatorBlockedResult =
  CoordinateOwnedNonRothIraAnnualWithdrawalCandidateResult extends infer Result
    ? Result extends {
        status: 'annualEvidenceBound' | 'noPositiveMovementStaged'
      }
      ? never
      : Result
    : never

export interface PlanOwnedNonRothIraAnnualPostCandidateExecutionIssue {
  kind:
    | 'postCandidateEvidenceMismatch'
    | 'annualFinalizationMismatch'
    | 'identifierCollision'
    | 'executionEvidenceIdCollision'
  detail: string
}

interface FinalResultBase {
  movement: 'notCommitted'
  actionability: 'notEstablished'
  executionEvidenceId: null
  balances: readonly []
  actions: readonly []
  issues: readonly [
    Readonly<PlanOwnedNonRothIraAnnualPostCandidateExecutionIssue>,
  ]
}

export interface PlanOwnedNonRothIraAnnualPostCandidateEvidenceMismatchResult
  extends FinalResultBase {
  status: 'postCandidateEvidenceMismatch'
}

export interface PlanOwnedNonRothIraAnnualPostCandidateFinalizationMismatchResult
  extends FinalResultBase {
  status: 'annualFinalizationMismatch'
}

export interface PlanOwnedNonRothIraAnnualPostCandidateExecutionIdCollisionResult
  extends FinalResultBase {
  status: 'executionEvidenceIdCollision'
}

export interface PlanOwnedNonRothIraAnnualPostCandidateIdentifierCollisionResult
  extends FinalResultBase {
  status: 'identifierCollision'
}

export interface PlanOwnedNonRothIraAnnualPostCandidateRefusedResult {
  status: 'postCandidateMovementRefused'
  movement: 'noMovement'
  actionability: 'established'
  executionEvidenceId: null
  postCandidateEvidence:
    Readonly<PlanOwnedNonRothIraPostCandidateEvidenceBuiltResult>
  annualFinalization: null
  balances:
    readonly Readonly<PlanOwnedNonRothIraAnnualExecutionBalance>[]
  actions:
    readonly Readonly<PlanOwnedNonRothIraAnnualExecutionAction>[]
  issues: readonly []
}

export interface PlanOwnedNonRothIraAnnualPostCandidateCommittedResult {
  status: 'postCandidateAnnualWithdrawalCommitted'
  movement: 'committed'
  actionability: 'established'
  executionEvidenceId: string
  postCandidateEvidence:
    Readonly<PlanOwnedNonRothIraPostCandidateEvidenceBuiltResult>
  annualFinalization:
    Readonly<CompleteOwnedNonRothIraAnnualWithdrawalFinalizationEvidence>
  balances:
    readonly Readonly<PlanOwnedNonRothIraAnnualExecutionBalance>[]
  actions:
    readonly Readonly<PlanOwnedNonRothIraAnnualExecutionAction>[]
  issues: readonly []
}

export type ExecutePlanOwnedNonRothIraAnnualPostCandidateResult =
  | PlanOwnedNonRothIraAnnualPostCandidatePassThroughResult
  | PlanOwnedNonRothIraAnnualPostCandidateCoordinatorBlockedResult
  | PlanOwnedNonRothIraAnnualPostCandidateEvidenceMismatchResult
  | PlanOwnedNonRothIraAnnualPostCandidateFinalizationMismatchResult
  | PlanOwnedNonRothIraAnnualPostCandidateIdentifierCollisionResult
  | PlanOwnedNonRothIraAnnualPostCandidateExecutionIdCollisionResult
  | PlanOwnedNonRothIraAnnualPostCandidateRefusedResult
  | PlanOwnedNonRothIraAnnualPostCandidateCommittedResult

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
  if (
    left === null || right === null ||
    typeof left !== 'object' || typeof right !== 'object'
  ) return false
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left) && Array.isArray(right) &&
      left.length === right.length &&
      left.every((value, index) => same(value, right[index]))
  }
  const leftPrototype = Object.getPrototypeOf(left)
  const rightPrototype = Object.getPrototypeOf(right)
  if (
    (leftPrototype !== Object.prototype && leftPrototype !== null) ||
    (rightPrototype !== Object.prototype && rightPrototype !== null)
  ) return false
  const leftRecord = left as Record<string, unknown>
  const rightRecord = right as Record<string, unknown>
  const leftKeys = Object.keys(leftRecord).sort(compareUtf16CodeUnits)
  const rightKeys = Object.keys(rightRecord).sort(compareUtf16CodeUnits)
  return leftKeys.length === rightKeys.length &&
    leftKeys.every((key, index) =>
      key === rightKeys[index] && same(leftRecord[key], rightRecord[key]))
}

function mismatch(
  status:
    | 'postCandidateEvidenceMismatch'
    | 'annualFinalizationMismatch',
  detail: string,
): Readonly<
  | PlanOwnedNonRothIraAnnualPostCandidateEvidenceMismatchResult
  | PlanOwnedNonRothIraAnnualPostCandidateFinalizationMismatchResult
> {
  return deepFreeze({
    status,
    movement: 'notCommitted',
    actionability: 'notEstablished',
    executionEvidenceId: null,
    balances: [],
    actions: [],
    issues: [{ kind: status, detail }],
  })
}

function identifierCollisionResult(
  detail: string,
): Readonly<PlanOwnedNonRothIraAnnualPostCandidateIdentifierCollisionResult> {
  return deepFreeze({
    status: 'identifierCollision',
    movement: 'notCommitted',
    actionability: 'notEstablished',
    executionEvidenceId: null,
    balances: [],
    actions: [],
    issues: [{ kind: 'identifierCollision', detail }],
  })
}

function containsExactString(
  value: unknown,
  expected: string,
  seen = new WeakSet<object>(),
): boolean {
  if (typeof value === 'string') return value === expected
  if (value === null || typeof value !== 'object') return false
  if (seen.has(value)) return false
  seen.add(value)
  return Object.values(value as Record<string, unknown>).some((child) =>
    containsExactString(child, expected, seen))
}

type IdentifierRole =
  | 'postCandidateIdentifier'
  | 'ownerBirthDateEvidence'
  | 'qualifiedDisabilityEvidence'
  | 'rejectedDisabilityEvidence'
  | 'ownerAliveEvidence'
  | 'noSeppStatusEvidence'
  | 'noOtherExceptionAttestationEvidence'
  | 'simpleParticipationStartEvidence'
  | 'seppElectionIdentity'
  | 'seppScheduleIdentity'
  | 'seppSourceEvidence'
  | 'seppElectionEvidence'
  | 'seppAnnualScheduleEvidence'
  | 'seppNoModificationEvidence'
  | 'seppStateEvidence'
  | 'seppPriorElectionHistoryEvidence'
  | 'seppDistributionEvidence'
  | 'seppPaymentScheduleEvidence'
  | 'derivedAnnualBasisEvidence'
  | 'derivedLine7AllocationEvidence'
  | 'derivedLine8AllocationEvidence'
  | 'derivedAgeThresholdEvidence'
  | 'derivedPenaltyCoverageEvidence'
  | `derivedPenaltyEvaluation:${string}`
  | 'derivedAnnualFinalizationEvidence'
  | 'derivedCandidateFinalizationBindingEvidence'
  | 'derivedCharacterSegmentEvidence'
  | 'derivedPenaltyRateEvidence'
  | `derivedRejectedPenaltyException:${string}`
  | 'derivedPenaltyRateBucketEvidence'
  | 'derivedPenaltyApplicabilityEvidence'
  | 'derivedSeppDistributionInventoryEvidence'
  | 'derivedSeppCurrentHistoryEvidence'
  | 'derivedSeppCurrentPaymentCandidate'
  | 'derivedSeppAnnualReconciliationEvidence'

interface IdentifierClaim {
  role: IdentifierRole
  binding: string
  label: string
}

interface IdentifierDeclaration {
  value: string
  role: IdentifierRole
  binding: unknown
  label: string
}

function allIdentifierValues(
  value: unknown,
  key = '',
  result = new Set<string>(),
  seen = new WeakSet<object>(),
): Set<string> {
  if (typeof value === 'string') {
    if (key === 'id' || key.endsWith('Id')) result.add(value)
    return result
  }
  if (value === null || typeof value !== 'object' || seen.has(value)) {
    return result
  }
  seen.add(value)
  if (Array.isArray(value)) {
    for (const item of value) allIdentifierValues(item, key, result, seen)
  } else {
    for (const [childKey, child] of Object.entries(
      value as Record<string, unknown>,
    )) {
      if (Array.isArray(child) && childKey.endsWith('Ids')) {
        for (const item of child) {
          if (typeof item === 'string') result.add(item)
        }
      }
      allIdentifierValues(child, childKey, result, seen)
    }
  }
  return result
}

function identifierBinding(value: unknown): string {
  return deriveActionStructuralId(
    'owned-ira-post-candidate-execution-identifier-binding',
    [value],
  )
}

function postCandidateClaims(
  input: Readonly<ExecutePlanOwnedNonRothIraAnnualPostCandidateInput>,
  rebuilt: Readonly<PlanOwnedNonRothIraPostCandidateEvidenceBuiltResult>,
): Map<string, IdentifierClaim> {
  return new Map([...allIdentifierValues([
    input.postCandidateInput,
    rebuilt,
  ])].map((value) => [value, {
    role: 'postCandidateIdentifier' as const,
    binding: identifierBinding(value),
    label: 'post-candidate prerequisite identifier',
  }]))
}

function declareIdentifier(
  claims: Map<string, IdentifierClaim>,
  declaration: Readonly<IdentifierDeclaration>,
  exactDerivedRepeat: boolean,
): string | null {
  const binding = identifierBinding(declaration.binding)
  const existing = claims.get(declaration.value)
  if (existing === undefined) {
    claims.set(declaration.value, {
      role: declaration.role,
      binding,
      label: declaration.label,
    })
    return null
  }
  if (
    exactDerivedRepeat &&
    existing.role === declaration.role &&
    existing.binding === binding
  ) {
    return null
  }
  return `${declaration.label} reuses identifier "${declaration.value}" already bound as ${existing.label}`
}

function callerPenaltyDeclarations(
  input: Readonly<ExecutePlanOwnedNonRothIraAnnualPostCandidateInput>,
): IdentifierDeclaration[] {
  const result: IdentifierDeclaration[] = []
  const add = (
    value: string,
    role: IdentifierRole,
    binding: unknown,
    label: string,
  ): void => {
    result.push({ value, role, binding, label })
  }
  add(input.ownerEvidence.evidenceId, 'ownerBirthDateEvidence',
    input.ownerEvidence, 'owner birth-date evidence')
  for (const item of input.qualifiedDisabilityEvidence ?? []) {
    add(item.disabilityEvidenceId, 'qualifiedDisabilityEvidence', item,
      'qualified-disability evidence')
  }
  for (const item of input.rejectedDisabilityEvidence ?? []) {
    add(item.disabilityEvidenceId, 'rejectedDisabilityEvidence', item,
      'rejected-disability evidence')
  }
  for (const item of input.ownerAliveEvidence ?? []) {
    add(item.ownerAliveEvidenceId, 'ownerAliveEvidence', item,
      'owner-alive evidence')
  }
  for (const item of input.iraSeppStatusEvidence ?? []) {
    add(item.seppStatusEvidenceId, 'noSeppStatusEvidence', item,
      'no-SEPP status evidence')
  }
  for (const item of input.noOtherExceptionAttestations ?? []) {
    add(item.attestationEvidenceId, 'noOtherExceptionAttestationEvidence',
      item, 'no-other-exception attestation evidence')
  }
  for (const item of input.simpleParticipationEvidence) {
    add(item.participationStartEvidenceId,
      'simpleParticipationStartEvidence', item,
      'SIMPLE participation-start evidence')
  }
  for (const route of input.iraSeppScheduleRoutes ?? []) {
    const routeKey = [
      input.ownerEvidence.ownerPersonId,
      route.sourceAccountId,
      route.electionId,
      route.scheduleId,
    ] as const
    add(route.electionId, 'seppElectionIdentity', routeKey.slice(0, 3),
      'SEPP election ID')
    add(route.scheduleId, 'seppScheduleIdentity', routeKey,
      'SEPP schedule ID')
    const annual = route.annualReconciliationInput
    if (annual.sourceEvidence !== undefined) {
      add(annual.sourceEvidence.sourceEvidenceId, 'seppSourceEvidence',
        annual.sourceEvidence, 'SEPP source evidence')
    }
    if (annual.electionEvidence !== undefined) {
      add(annual.electionEvidence.electionEvidenceId, 'seppElectionEvidence',
        annual.electionEvidence, 'SEPP election evidence')
    }
    if (annual.annualScheduleEvidence !== undefined) {
      add(annual.annualScheduleEvidence.annualScheduleEvidenceId,
        'seppAnnualScheduleEvidence', annual.annualScheduleEvidence,
        'SEPP annual-schedule evidence')
    }
    if (annual.noModificationEvidence !== undefined) {
      add(annual.noModificationEvidence.noModificationEvidenceId,
        'seppNoModificationEvidence', annual.noModificationEvidence,
        'SEPP no-modification evidence')
    }
    if (annual.openingStateEvidence !== undefined) {
      add(annual.openingStateEvidence.openingStateEvidenceId,
        'seppStateEvidence', annual.openingStateEvidence,
        'SEPP annual opening-state evidence')
    }
    const history = annual.priorElectionHistoryEvidence
    if (history !== undefined) {
      add(history.priorElectionHistoryEvidenceId,
        'seppPriorElectionHistoryEvidence', history,
        'SEPP prior-election history evidence')
      add(history.terminalStateEvidenceId, 'seppStateEvidence',
        [routeKey, 'priorElectionTerminal', history],
        'SEPP prior-election terminal-state evidence')
      for (const value of history.usedDistributionEvidenceIds) {
        add(value, 'seppDistributionEvidence', [routeKey, value],
          'SEPP prior-election used-distribution evidence')
      }
    }
    for (const payment of annual.payments ?? []) {
      add(payment.currentPaymentEvidence.paymentScheduleEvidenceId,
        'seppPaymentScheduleEvidence', payment.currentPaymentEvidence,
        'SEPP payment-schedule evidence')
    }
  }
  return result
}

function claimCallerPenaltyDeclarations(
  input: Readonly<ExecutePlanOwnedNonRothIraAnnualPostCandidateInput>,
  claims: Map<string, IdentifierClaim>,
): string | null {
  for (const declaration of callerPenaltyDeclarations(input)) {
    const issue = declareIdentifier(claims, declaration, false)
    if (issue !== null) return issue
  }
  return null
}

function annualDerivedDeclarations(
  coordinated: Extract<
    CoordinateOwnedNonRothIraAnnualWithdrawalCandidateResult,
    { status: 'annualEvidenceBound' }
  >,
): IdentifierDeclaration[] {
  const annual = coordinated.annualEvidence
  const characterization = annual.characterization
  const result: IdentifierDeclaration[] = []
  const add = (
    value: string,
    role: IdentifierRole,
    binding: unknown,
    label: string,
  ): void => {
    result.push({ value, role, binding, label })
  }
  add(characterization.annualBasisEvidence.basisEvidenceId,
    'derivedAnnualBasisEvidence', characterization.annualBasisEvidence,
    'derived annual-basis evidence')
  add(characterization.line7AllocationEvidence.allocationEvidenceId,
    'derivedLine7AllocationEvidence',
    characterization.line7AllocationEvidence,
    'derived line-7 allocation evidence')
  add(characterization.line8AllocationEvidence.allocationEvidenceId,
    'derivedLine8AllocationEvidence',
    characterization.line8AllocationEvidence,
    'derived line-8 allocation evidence')
  add(annual.penaltyPrerequisites.ageThresholdEvidence.evidenceId,
    'derivedAgeThresholdEvidence',
    annual.penaltyPrerequisites.ageThresholdEvidence,
    'derived age-threshold evidence')
  add(annual.finalizationEvidenceId, 'derivedAnnualFinalizationEvidence',
    annual, 'derived annual-finalization evidence')
  add(coordinated.bindingEvidence.bindingEvidenceId,
    'derivedCandidateFinalizationBindingEvidence',
    coordinated.bindingEvidence,
    'derived candidate/finalization binding evidence')
  for (const coverage of annual.penaltyPrerequisites.coverage) {
    add(coverage.evidenceId, 'derivedPenaltyCoverageEvidence', coverage,
      'derived penalty-coverage evidence')
    add(coverage.sourceEvidenceIds.distributionDateEvidenceId,
      'seppDistributionEvidence',
      [coverage.actionId, coverage.allocationId, coverage.sourceAccountId,
        coverage.evaluationDate],
      'derived staged distribution-date evidence')
    for (const value of coverage.characterEvidenceIds) {
      add(value, 'derivedCharacterSegmentEvidence',
        [coverage.actionId, coverage.allocationId, value],
        'derived character-segment evidence')
    }
  }
  for (const evaluation of annual.penaltyPrerequisites.evaluations) {
    add(evaluation.finalEvidenceId,
      `derivedPenaltyEvaluation:${evaluation.outcome}`, evaluation,
      'derived final penalty-evaluation evidence')
    if (evaluation.outcome === 'penaltyApplies') {
      add(evaluation.rateEvidence.evidenceId, 'derivedPenaltyRateEvidence',
        evaluation.rateEvidence, 'derived penalty-rate evidence')
      add(evaluation.rateBucketEvidence.evidenceId,
        'derivedPenaltyRateBucketEvidence', evaluation.rateBucketEvidence,
        'derived penalty rate-bucket evidence')
      for (const rejection of evaluation.rejectedExceptions) {
        add(rejection.evidenceId,
          `derivedRejectedPenaltyException:${rejection.exception}`,
          rejection, 'derived rejected penalty-exception evidence')
      }
      for (const member of evaluation.rateBucketEvidence.members) {
        add(member.penaltyApplicabilityEvidenceId,
          'derivedPenaltyApplicabilityEvidence', member,
          'derived penalty-applicability evidence')
      }
    }
  }
  for (const route of
    annual.penaltyPrerequisites.iraSeppScheduleReconciliations) {
    if (route.reconciliation.status !== 'reconciled') continue
    const reconciliation = route.reconciliation.evidence
    const routeKey = [
      reconciliation.participantPersonId,
      reconciliation.sourceAccountId,
      reconciliation.electionId,
      reconciliation.scheduleId,
    ] as const
    add(reconciliation.distributionInventory.inventoryEvidenceId,
      'derivedSeppDistributionInventoryEvidence',
      reconciliation.distributionInventory,
      'derived SEPP distribution-inventory evidence')
    add(reconciliation.annualReconciliationId,
      'derivedSeppAnnualReconciliationEvidence', reconciliation,
      'derived SEPP annual-reconciliation evidence')
    for (const payment of reconciliation.payments) {
      add(payment.priorHistoryEvidenceId,
        'derivedSeppCurrentHistoryEvidence',
        [routeKey, payment.actionId, payment.allocationId,
          payment.paymentSequence, 'history'],
        'derived SEPP current-year history evidence')
      add(payment.afterStateEvidenceId, 'seppStateEvidence',
        [routeKey, payment.actionId, payment.allocationId,
          payment.paymentSequence, 'after'],
        'derived SEPP after-state evidence')
      add(payment.currentPaymentCandidateId,
        'derivedSeppCurrentPaymentCandidate', payment,
        'derived SEPP current-payment candidate')
    }
  }
  return result
}

function claimAnnualDerivedIdentifiers(
  coordinated: Extract<
    CoordinateOwnedNonRothIraAnnualWithdrawalCandidateResult,
    { status: 'annualEvidenceBound' }
  >,
  claims: Map<string, IdentifierClaim>,
): string | null {
  for (const declaration of annualDerivedDeclarations(coordinated)) {
    const issue = declareIdentifier(claims, declaration, true)
    if (issue !== null) return issue
  }
  return null
}

/**
 * Finalizes the PR105 post-candidate evidence chain and publishes action and
 * balance evidence from its already-applied movement candidate. This boundary
 * is pure: it reruns evidence construction, but never applies a second delta.
 */
export function executePlanOwnedNonRothIraAnnualPostCandidate(
  input: Readonly<ExecutePlanOwnedNonRothIraAnnualPostCandidateInput>,
): Readonly<ExecutePlanOwnedNonRothIraAnnualPostCandidateResult> {
  const rebuilt =
    buildPlanOwnedNonRothIraAnnualPostCandidateClassificationInput(
      input.postCandidateInput,
    )
  if (rebuilt.status !== 'postCandidateClassificationInputBuilt') {
    return rebuilt
  }
  if (!same(rebuilt, input.postCandidateEvidence)) {
    return mismatch(
      'postCandidateEvidenceMismatch',
      'Supplied post-candidate classification and reconciliation evidence does not exactly match the canonical rebuild',
    )
  }

  const identifierClaims = postCandidateClaims(input, rebuilt)
  const callerCollision =
    claimCallerPenaltyDeclarations(input, identifierClaims)
  if (callerCollision !== null) {
    return identifierCollisionResult(callerCollision)
  }

  const {
    line7Distributions,
    ...annualInput
  } = rebuilt.classificationInput
  void line7Distributions
  const coordinated = coordinateOwnedNonRothIraAnnualWithdrawalCandidate({
    movementInput: input.postCandidateInput.movementInput,
    annualInput,
    ownerEvidence: input.ownerEvidence,
    qualifiedDisabilityEvidence: input.qualifiedDisabilityEvidence,
    rejectedDisabilityEvidence: input.rejectedDisabilityEvidence,
    ownerAliveEvidence: input.ownerAliveEvidence,
    iraSeppStatusEvidence: input.iraSeppStatusEvidence,
    iraSeppScheduleRoutes: input.iraSeppScheduleRoutes,
    noOtherExceptionAttestations: input.noOtherExceptionAttestations,
    simpleParticipationEvidence: input.simpleParticipationEvidence,
  })
  if (
    !same(
      coordinated.movementCandidate,
      input.postCandidateInput.movementCandidate,
    ) ||
    !same(
      coordinated.movementCandidate.line7Distributions,
      rebuilt.classificationInput.line7Distributions,
    )
  ) {
    return mismatch(
      'postCandidateEvidenceMismatch',
      'Annual finalization did not exactly rejoin the canonical candidate and classifier line-7 evidence',
    )
  }
  if (
    coordinated.status !== 'annualEvidenceBound' &&
    coordinated.status !== 'noPositiveMovementStaged'
  ) {
    return coordinated
  }

  const annualFinalization =
    coordinated.status === 'annualEvidenceBound'
      ? coordinated.annualEvidence
      : null
  if (!same(annualFinalization, input.annualFinalization)) {
    return mismatch(
      'annualFinalizationMismatch',
      'Supplied annual characterization and penalty finalization does not exactly match the canonical coordinator result',
    )
  }

  const identifierCollision = coordinated.status === 'annualEvidenceBound'
    ? claimAnnualDerivedIdentifiers(coordinated, identifierClaims)
    : null
  if (identifierCollision !== null) {
    return identifierCollisionResult(identifierCollision)
  }

  const published =
    publishPlanOwnedNonRothIraAnnualExecutionEvidence(coordinated)
  const balances = [...published.balances].sort((left, right) =>
    compareUtf16CodeUnits(left.sourceAccountId, right.sourceAccountId))
  if (coordinated.status === 'noPositiveMovementStaged') {
    return deepFreeze({
      status: 'postCandidateMovementRefused',
      movement: 'noMovement',
      actionability: 'established',
      executionEvidenceId: null,
      postCandidateEvidence: rebuilt,
      annualFinalization: null,
      balances,
      actions: published.actions,
      issues: [],
    })
  }

  const snapshot = input.postCandidateInput.postCandidateSnapshot
  const executionEvidenceId = deriveActionStructuralId(
    'owned-ira-plan-post-candidate-annual-execution',
    [
      rebuilt.reconciliationEvidence.evidenceId,
      coordinated.annualEvidence.finalizationEvidenceId,
      coordinated.bindingEvidence.bindingEvidenceId,
      snapshot.evidenceId,
      balances,
      published.actions,
    ],
  )
  if ([input, rebuilt, coordinated, balances, published.actions].some(
    (value) => containsExactString(value, executionEvidenceId),
  )) {
    return deepFreeze({
      status: 'executionEvidenceIdCollision',
      movement: 'notCommitted',
      actionability: 'notEstablished',
      executionEvidenceId: null,
      balances: [],
      actions: [],
      issues: [{
        kind: 'executionEvidenceIdCollision',
        detail:
          'Derived post-candidate execution evidence ID collides with supplied prerequisite evidence',
      }],
    })
  }
  return deepFreeze({
    status: 'postCandidateAnnualWithdrawalCommitted',
    movement: 'committed',
    actionability: 'established',
    executionEvidenceId,
    postCandidateEvidence: rebuilt,
    annualFinalization: coordinated.annualEvidence,
    balances,
    actions: published.actions,
    issues: [],
  })
}
