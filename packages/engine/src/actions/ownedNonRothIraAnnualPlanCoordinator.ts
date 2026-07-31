import {
  planSchema,
  type Plan,
  type RetirementActionIraClassification,
} from '../model/plan.js'
import {
  evaluateRetirementActionEligibilityFromPlan,
  type NonpersistedActionPersonAliveEvidence,
  type RetirementActionEligibilityDecision,
} from '../strategies/accountEligibility.js'
import type { AnnualIraBasisAllocationEntryInput } from './annualIraBasisAllocation.js'
import {
  ordinaryWithdrawalRequestSchema,
  type OrdinaryWithdrawalRequest,
} from './contract.js'
import type { AccountOpeningBalanceSnapshot } from './execution.js'
import {
  accountIdSchema,
  actionIdSchema,
  allocationIdSchema,
  personIdSchema,
  planIdSchema,
  type AccountId,
  type ActionId,
  type PersonId,
  type PlanId,
} from './identity.js'
import {
  asUsdCents,
  usdCentsSchema,
  type UsdCents,
} from './money.js'
import {
  coordinateOwnedNonRothIraAnnualWithdrawalCandidate,
  type CoordinateOwnedNonRothIraAnnualWithdrawalCandidateResult,
  type OwnedNonRothIraCandidateOwnerAliveEvidence,
} from './ownedNonRothIraAnnualCandidateCoordinator.js'
import type {
  CompleteOwnedNonRothIraAnnualWithdrawalFinalizationEvidence,
} from './ownedNonRothIraAnnualFinalization.js'
import {
  stageOwnedNonRothIraOrdinaryWithdrawalMovements,
  type OwnedNonRothIraMovementSourceEvidence,
  type StageOwnedNonRothIraOrdinaryWithdrawalMovementsInput,
} from './ownedNonRothIraMovementCandidate.js'
import {
  InvalidSimpleIraParticipationEvidenceError,
  MissingSimpleIraParticipationEvidenceError,
  type NoOtherStatutoryExceptionClaimedAttestation,
  type OwnedNonRothIraNoSeppStatusEvidence,
  type OwnedNonRothIraSeppPenaltyScheduleReconciliation,
  type OwnedNonRothIraSeppPenaltyScheduleRouteInput,
  type QualifiedDisabilityEventEvidence,
  type RejectedDisabilityStatusEvidence,
  type SimpleIraParticipationEvidence,
} from './ownedNonRothIraPenaltyPrerequisite.js'
import type {
  ClassifyOwnedNonRothIraAnnualWithdrawalsInput,
  CompleteOwnedNonRothIraPoolEvidence,
  OwnedNonRothIraPoolMemberEvidence,
} from './ownedNonRothIraWithdrawalCharacter.js'
import {
  compareUtf16CodeUnits,
  deriveActionStructuralId,
} from './structuralId.js'
import { parseCivilIsoDate } from './civilDate.js'

export interface PlanOwnedNonRothIraOpeningBalanceEvidence {
  predicate:
    'ownedNonRothIraOpeningBalanceBeforeCompleteAnnualPlanActionBatch'
  planId: PlanId
  ownerPersonId: PersonId
  sourceAccountId: AccountId
  taxYear: number
  ledgerPhase:
    'openingOfTaxYearBeforeCompleteAnnualOwnedIraActionBatch'
  asOfDate: string
  ledgerRunId: string
  openingBalanceAmount: UsdCents
  evidenceId: string
  upstreamEvidenceId: string
}

export interface PlanOwnedNonRothIraYearEndBalanceEvidence {
  predicate: 'ownedNonRothIraForm8606ApplicableTaxYearEndBalance'
  planId: PlanId
  ownerPersonId: PersonId
  sourceAccountId: AccountId
  taxYear: number
  ledgerPhase: 'form8606ApplicableTaxYearEnd'
  asOfDate: string
  ledgerRunId: string
  yearEndApplicableBalanceAmount: UsdCents
  evidenceId: string
  upstreamEvidenceId: string
}

export interface CompletePlanOwnedNonRothIraAnnualBasisEvidence {
  predicate: 'completePlanOwnedNonRothIraAnnualBasisFacts'
  planId: PlanId
  ownerPersonId: PersonId
  taxYear: number
  ledgerRunId: string
  line7InventoryStatus:
    'completePlanActionBatchWithNoOmittedOwnerIraLine7Activity'
  excludedLine7ActivityStatus:
    'noExternalRmdLegacyOrOtherNonQcdDistributions'
  includedPlanActionIds: readonly ActionId[]
  openingBasisAmount: UsdCents
  taxYearNondeductibleContributionAmount: UsdCents
  postYearNondeductibleContributionExcludedAmount: UsdCents
  outstandingRolloverAmount: UsdCents
  rolloverRepaymentAdjustmentAmount: UsdCents
  evidenceId: string
  upstreamEvidenceId: string
}

export interface CompletePlanOwnedNonRothIraLine8InventoryEvidence {
  predicate: 'completePlanOwnedNonRothIraLine8ConversionInventory'
  planId: PlanId
  ownerPersonId: PersonId
  taxYear: number
  ledgerRunId: string
  inventoryStatus: 'completeIncludingExplicitEmpty'
  entries: readonly Readonly<AnnualIraBasisAllocationEntryInput>[]
  evidenceId: string
  upstreamEvidenceId: string
}

export interface CoordinatePlanOwnedNonRothIraAnnualWithdrawalCandidateInput {
  plan: unknown
  ownerPersonId: PersonId
  taxYear: number
  openingBalanceEvidence:
    readonly Readonly<PlanOwnedNonRothIraOpeningBalanceEvidence>[]
  yearEndBalanceEvidence:
    readonly Readonly<PlanOwnedNonRothIraYearEndBalanceEvidence>[]
  annualBasisEvidence:
    Readonly<CompletePlanOwnedNonRothIraAnnualBasisEvidence>
  line8InventoryEvidence:
    Readonly<CompletePlanOwnedNonRothIraLine8InventoryEvidence>
  personAliveEvidence:
    readonly Readonly<NonpersistedActionPersonAliveEvidence>[]
  qualifiedDisabilityEvidence?:
    readonly Readonly<QualifiedDisabilityEventEvidence>[]
  rejectedDisabilityEvidence?:
    readonly Readonly<RejectedDisabilityStatusEvidence>[]
  iraSeppStatusEvidence?:
    readonly Readonly<OwnedNonRothIraNoSeppStatusEvidence>[]
  iraSeppScheduleRoutes?:
    readonly Readonly<OwnedNonRothIraSeppPenaltyScheduleRouteInput>[]
  noOtherExceptionAttestations?:
    readonly Readonly<NoOtherStatutoryExceptionClaimedAttestation>[]
}

export type PlanOwnedNonRothIraSourceInventoryIssueKind =
  | 'ownerNotFound'
  | 'ownedIraPoolEmpty'
  | 'planActionBatchEmpty'
  | 'mixedSourceAction'
  | 'iraClassificationMissing'
  | 'openingBalanceEvidenceMissing'
  | 'openingBalanceEvidenceDuplicate'
  | 'openingBalanceEvidenceForeign'
  | 'openingBalanceEvidenceBindingMismatch'
  | 'yearEndBalanceEvidenceMissing'
  | 'yearEndBalanceEvidenceDuplicate'
  | 'yearEndBalanceEvidenceForeign'
  | 'yearEndBalanceEvidenceBindingMismatch'
  | 'annualBasisEvidenceBindingMismatch'
  | 'line7ActionSetMismatch'
  | 'line8InventoryEvidenceBindingMismatch'
  | 'line8EntryForeign'
  | 'ledgerRunMismatch'
  | 'evidenceIdInvalid'
  | 'evidenceIdReused'
  | 'simpleParticipationEvidenceMissing'
  | 'simpleParticipationEvidenceInvalid'

export interface PlanOwnedNonRothIraSourceInventoryIssue {
  kind: PlanOwnedNonRothIraSourceInventoryIssueKind
  detail: string
  actionId?: ActionId
  sourceAccountId?: AccountId
}

export type PlanOwnedNonRothIraPhysicalEligibilityIssue =
  | Readonly<{
      kind: 'personAliveEvidenceMismatch'
      detail: string
      actionId?: ActionId
    }>
  | Readonly<{
      kind: 'eligibilityDecision'
      actionId: ActionId
      decision: Readonly<RetirementActionEligibilityDecision>
    }>

interface PlanOwnedNonRothIraResultBase {
  movement: 'notCommitted'
  actionability: 'notEstablished'
}

export interface PlanOwnedNonRothIraSourceInventoryIncompleteResult
  extends PlanOwnedNonRothIraResultBase {
  status: 'sourceInventoryIncomplete'
  movementCandidate: null
  annualEvidence: null
  bindingEvidence: null
  sourceInventoryEvidenceId: null
  physicalEligibilityEvidenceId: null
  planOwnedIraCandidateEvidenceId: null
  issues: readonly [
    Readonly<PlanOwnedNonRothIraSourceInventoryIssue>,
    ...Readonly<PlanOwnedNonRothIraSourceInventoryIssue>[],
  ]
}

export interface PlanOwnedNonRothIraPhysicalEligibilityBlockedResult
  extends PlanOwnedNonRothIraResultBase {
  status: 'physicalEligibilityBlocked'
  movementCandidate: null
  annualEvidence: null
  bindingEvidence: null
  sourceInventoryEvidenceId: null
  physicalEligibilityEvidenceId: null
  planOwnedIraCandidateEvidenceId: null
  issues: readonly [
    Readonly<PlanOwnedNonRothIraPhysicalEligibilityIssue>,
    ...Readonly<PlanOwnedNonRothIraPhysicalEligibilityIssue>[],
  ]
}

export type PlanOwnedNonRothIraCoordinatedResult =
  Readonly<CoordinateOwnedNonRothIraAnnualWithdrawalCandidateResult> & {
    readonly sourceInventoryEvidenceId: string
    readonly physicalEligibilityEvidenceId: string
    readonly planOwnedIraCandidateEvidenceId: string
  }

export type CoordinatePlanOwnedNonRothIraAnnualWithdrawalCandidateResult =
  | PlanOwnedNonRothIraSourceInventoryIncompleteResult
  | PlanOwnedNonRothIraPhysicalEligibilityBlockedResult
  | PlanOwnedNonRothIraCoordinatedResult

type OwnedIraPlanAccount = Extract<
  Plan['accounts'][number],
  { type: 'traditional' }
>

interface CanonicalInventory {
  plan: Plan
  planId: PlanId
  ownerPersonId: PersonId
  ownerBirthDate: string
  taxYear: number
  requests: OrdinaryWithdrawalRequest[]
  classifications: Map<AccountId, RetirementActionIraClassification>
  poolAccounts: OwnedIraPlanAccount[]
  openingEvidence: PlanOwnedNonRothIraOpeningBalanceEvidence[]
  yearEndEvidence: PlanOwnedNonRothIraYearEndBalanceEvidence[]
  annualBasisEvidence: CompletePlanOwnedNonRothIraAnnualBasisEvidence
  line8InventoryEvidence:
    CompletePlanOwnedNonRothIraLine8InventoryEvidence
  line8Entries: AnnualIraBasisAllocationEntryInput[]
  ledgerRunId: string
  claimedEvidenceIds: Set<string>
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

function nonblank(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function inventoryIssue(
  kind: PlanOwnedNonRothIraSourceInventoryIssueKind,
  detail: string,
  bindings: {
    actionId?: ActionId
    sourceAccountId?: AccountId
  } = {},
): PlanOwnedNonRothIraSourceInventoryIssue {
  return { kind, detail, ...bindings }
}

function inventoryBlocked(
  issues: readonly PlanOwnedNonRothIraSourceInventoryIssue[],
): Readonly<PlanOwnedNonRothIraSourceInventoryIncompleteResult> {
  if (issues.length === 0) {
    throw new Error('Source-inventory blocking requires at least one issue')
  }
  return deepFreeze({
    status: 'sourceInventoryIncomplete',
    movement: 'notCommitted',
    actionability: 'notEstablished',
    movementCandidate: null,
    annualEvidence: null,
    bindingEvidence: null,
    sourceInventoryEvidenceId: null,
    physicalEligibilityEvidenceId: null,
    planOwnedIraCandidateEvidenceId: null,
    issues: issues as [
      PlanOwnedNonRothIraSourceInventoryIssue,
      ...PlanOwnedNonRothIraSourceInventoryIssue[],
    ],
  })
}

function physicalBlocked(
  issues: readonly PlanOwnedNonRothIraPhysicalEligibilityIssue[],
): Readonly<PlanOwnedNonRothIraPhysicalEligibilityBlockedResult> {
  if (issues.length === 0) {
    throw new Error('Physical-eligibility blocking requires at least one issue')
  }
  return deepFreeze({
    status: 'physicalEligibilityBlocked',
    movement: 'notCommitted',
    actionability: 'notEstablished',
    movementCandidate: null,
    annualEvidence: null,
    bindingEvidence: null,
    sourceInventoryEvidenceId: null,
    physicalEligibilityEvidenceId: null,
    planOwnedIraCandidateEvidenceId: null,
    issues: issues as [
      PlanOwnedNonRothIraPhysicalEligibilityIssue,
      ...PlanOwnedNonRothIraPhysicalEligibilityIssue[],
    ],
  })
}

function safeCentsSum(values: readonly UsdCents[], label: string): UsdCents {
  const total = values.reduce((sum, value) => sum + BigInt(value), 0n)
  if (total > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new RangeError(`${label} exceeded the safe-integer cents range`)
  }
  return asUsdCents(Number(total))
}

function sameStrings(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  )
}

function canonicalIraClassification(
  classification: RetirementActionIraClassification,
): RetirementActionIraClassification {
  const provenance = {
    source: classification.provenance.source,
    ...(classification.provenance.sourceId === undefined
      ? {}
      : { sourceId: classification.provenance.sourceId }),
  }
  if (classification.subtype !== 'simple') {
    return {
      evidenceId: classification.evidenceId,
      provenance,
      sourceAccountId: classification.sourceAccountId,
      subtype: classification.subtype,
    }
  }
  return {
    evidenceId: classification.evidenceId,
    provenance,
    sourceAccountId: classification.sourceAccountId,
    subtype: 'simple',
    ...(classification.simpleParticipationStartDate === undefined
      ? {}
      : {
          simpleParticipationStartDate:
            classification.simpleParticipationStartDate,
        }),
  }
}

function canonicalOrdinaryWithdrawalRequest(
  request: OrdinaryWithdrawalRequest,
): OrdinaryWithdrawalRequest {
  return {
    actionId: request.actionId,
    kind: 'ordinaryWithdrawal',
    year: request.year,
    ...(request.executionDate === undefined
      ? {}
      : { executionDate: request.executionDate }),
    executionSequence: request.executionSequence,
    requestedAmount: request.requestedAmount,
    provenance: {
      source: request.provenance.source,
      ...(request.provenance.sourceId === undefined
        ? {}
        : { sourceId: request.provenance.sourceId }),
      ...(request.provenance.scenarioId === undefined
        ? {}
        : { scenarioId: request.provenance.scenarioId }),
    },
    personId: request.personId,
    allocations: [...request.allocations]
      .map((allocation) => ({
        allocationId: allocation.allocationId,
        sourceAccountId: allocation.sourceAccountId,
        requestedAmount: allocation.requestedAmount,
      }))
      .sort((left, right) =>
        compareUtf16CodeUnits(left.allocationId, right.allocationId) ||
        compareUtf16CodeUnits(
          left.sourceAccountId,
          right.sourceAccountId,
        ),
      ),
    purpose: {
      kind: request.purpose.kind,
      ...(request.purpose.referenceId === undefined
        ? {}
        : { referenceId: request.purpose.referenceId }),
    },
  }
}

function claimEvidenceId(
  value: unknown,
  label: string,
  claimed: Set<string>,
  issues: PlanOwnedNonRothIraSourceInventoryIssue[],
): string {
  if (!nonblank(value)) {
    issues.push(inventoryIssue(
      'evidenceIdInvalid',
      `${label} must be a nonblank stable identifier`,
    ))
    return ''
  }
  if (claimed.has(value)) {
    issues.push(inventoryIssue(
      'evidenceIdReused',
      `${label} reuses evidence ID "${value}"`,
    ))
  }
  claimed.add(value)
  return value
}

function claimCallerPenaltyEvidenceIds(
  input:
    Readonly<CoordinatePlanOwnedNonRothIraAnnualWithdrawalCandidateInput>,
  claimed: Set<string>,
  issues: PlanOwnedNonRothIraSourceInventoryIssue[],
): void {
  for (const evidence of [
    ...(input.qualifiedDisabilityEvidence ?? []),
    ...(input.rejectedDisabilityEvidence ?? []),
  ]) {
    claimEvidenceId(
      evidence.disabilityEvidenceId,
      'Disability evidence ID',
      claimed,
      issues,
    )
  }
  for (const evidence of input.iraSeppStatusEvidence ?? []) {
    claimEvidenceId(
      evidence.seppStatusEvidenceId,
      'No-SEPP status evidence ID',
      claimed,
      issues,
    )
  }
  for (const evidence of input.noOtherExceptionAttestations ?? []) {
    claimEvidenceId(
      evidence.attestationEvidenceId,
      'No-other-exception attestation evidence ID',
      claimed,
      issues,
    )
  }
  for (const route of input.iraSeppScheduleRoutes ?? []) {
    const annual = route.annualReconciliationInput
    const primaryIds: readonly [unknown, string][] = [
      [annual.sourceEvidence?.sourceEvidenceId, 'SEPP source evidence ID'],
      [annual.electionEvidence?.electionEvidenceId, 'SEPP election evidence ID'],
      [
        annual.annualScheduleEvidence?.annualScheduleEvidenceId,
        'SEPP annual-schedule evidence ID',
      ],
      [
        annual.noModificationEvidence?.noModificationEvidenceId,
        'SEPP no-modification evidence ID',
      ],
      [
        annual.openingStateEvidence?.openingStateEvidenceId,
        'SEPP opening-state evidence ID',
      ],
      [
        annual.priorElectionHistoryEvidence
          ?.priorElectionHistoryEvidenceId,
        'SEPP prior-election-history evidence ID',
      ],
      [
        annual.priorElectionHistoryEvidence?.terminalStateEvidenceId,
        'SEPP prior-election terminal-state evidence ID',
      ],
    ]
    for (const [evidenceId, label] of primaryIds) {
      if (evidenceId !== undefined) {
        claimEvidenceId(evidenceId, label, claimed, issues)
      }
    }
    for (const payment of annual.payments ?? []) {
      claimEvidenceId(
        payment.currentPaymentEvidence.paymentScheduleEvidenceId,
        'SEPP payment-schedule evidence ID',
        claimed,
        issues,
      )
    }
    for (
      const evidenceId of
        annual.priorElectionHistoryEvidence?.usedDistributionEvidenceIds ?? []
    ) {
      claimEvidenceId(
        evidenceId,
        'SEPP lifetime used-distribution evidence ID',
        claimed,
        issues,
      )
    }
  }
}

function invalidSimpleParticipationEvidence(
  error: unknown,
): Readonly<PlanOwnedNonRothIraSourceInventoryIncompleteResult> | null {
  if (!(error instanceof InvalidSimpleIraParticipationEvidenceError)) {
    return null
  }
  return inventoryBlocked([inventoryIssue(
    'simpleParticipationEvidenceInvalid',
    error.message,
    { sourceAccountId: error.sourceAccountId },
  )])
}

function canonicalLine8Entries(
  entries: readonly Readonly<AnnualIraBasisAllocationEntryInput>[],
  taxYear: number,
  poolAccountIds: ReadonlySet<AccountId>,
  issues: PlanOwnedNonRothIraSourceInventoryIssue[],
): AnnualIraBasisAllocationEntryInput[] {
  const identities = new Set<string>()
  return entries
    .map((entry): AnnualIraBasisAllocationEntryInput => {
      const actionId = actionIdSchema.parse(entry.actionId)
      const allocationId = allocationIdSchema.parse(entry.allocationId)
      const sourceAccountId = accountIdSchema.parse(entry.sourceAccountId)
      const scheduledDate = entry.scheduledDate
      if (
        scheduledDate !== null &&
        parseCivilIsoDate(scheduledDate)?.year !== taxYear
      ) {
        issues.push(inventoryIssue(
          'line8InventoryEvidenceBindingMismatch',
          'Line-8 entry date must be null or a canonical date in the tax year',
          { actionId, sourceAccountId },
        ))
      }
      if (!poolAccountIds.has(sourceAccountId)) {
        issues.push(inventoryIssue(
          'line8EntryForeign',
          'Line-8 entry source is outside the complete owned-IRA pool',
          { actionId, sourceAccountId },
        ))
      }
      if (
        !Number.isSafeInteger(entry.scheduledSequence) ||
        entry.scheduledSequence <= 0
      ) {
        throw new RangeError(
          'Line-8 entry sequence must be a positive safe integer',
        )
      }
      const identity = JSON.stringify([actionId, allocationId])
      if (identities.has(identity)) {
        issues.push(inventoryIssue(
          'line8InventoryEvidenceBindingMismatch',
          'Line-8 action/allocation identities must be unique',
          { actionId, sourceAccountId },
        ))
      }
      identities.add(identity)
      return {
        actionId,
        allocationId,
        sourceAccountId,
        scheduledDate,
        scheduledSequence: entry.scheduledSequence,
        grossAmount: usdCentsSchema.parse(entry.grossAmount),
      }
    })
    .sort((left, right) =>
      compareUtf16CodeUnits(left.actionId, right.actionId) ||
      compareUtf16CodeUnits(left.allocationId, right.allocationId) ||
      compareUtf16CodeUnits(left.sourceAccountId, right.sourceAccountId) ||
      left.scheduledSequence - right.scheduledSequence ||
      compareUtf16CodeUnits(
        left.scheduledDate ?? '',
        right.scheduledDate ?? '',
      ),
    )
}

function buildCanonicalInventory(
  input:
    Readonly<CoordinatePlanOwnedNonRothIraAnnualWithdrawalCandidateInput>,
): CanonicalInventory | Readonly<
  PlanOwnedNonRothIraSourceInventoryIncompleteResult
> {
  const plan = planSchema.parse(input.plan)
  const planId = planIdSchema.parse(plan.id)
  const ownerPersonId = personIdSchema.parse(input.ownerPersonId)
  if (
    !Number.isSafeInteger(input.taxYear) ||
    input.taxYear < 1 ||
    input.taxYear > 9999
  ) {
    throw new RangeError('Owned IRA tax year must be an integer from 1 to 9999')
  }
  const taxYear = input.taxYear
  const issues: PlanOwnedNonRothIraSourceInventoryIssue[] = []
  const owner = plan.household.people.find(
    (person) => person.id === ownerPersonId,
  )
  if (owner === undefined) {
    issues.push(inventoryIssue(
      'ownerNotFound',
      'Owned IRA annual owner must exist in the Plan',
    ))
  }

  const poolAccounts = plan.accounts
    .filter(
      (account): account is OwnedIraPlanAccount =>
        account.type === 'traditional' &&
        account.kind === 'ira' &&
        account.inherited === undefined &&
        account.ownerPersonId === ownerPersonId,
    )
    .sort((left, right) => compareUtf16CodeUnits(left.id, right.id))
  const poolAccountIds = new Set(
    poolAccounts.map((account) => accountIdSchema.parse(account.id)),
  )
  if (poolAccounts.length === 0) {
    issues.push(inventoryIssue(
      'ownedIraPoolEmpty',
      'Plan contains no owned non-Roth IRA pool for this owner',
    ))
  }

  const classificationBySource = new Map<
    AccountId,
    RetirementActionIraClassification
  >()
  for (const account of poolAccounts) {
    const sourceAccountId = accountIdSchema.parse(account.id)
    const matches =
      plan.retirementActionEligibilityFacts?.iraClassifications.filter(
        (classification) =>
          classification.sourceAccountId === sourceAccountId,
      ) ?? []
    if (matches.length !== 1) {
      issues.push(inventoryIssue(
        'iraClassificationMissing',
        'Every complete-pool account requires exactly one Plan IRA classification',
        { sourceAccountId },
      ))
    } else {
      classificationBySource.set(
        sourceAccountId,
        canonicalIraClassification(matches[0]!),
      )
    }
  }

  const requests: OrdinaryWithdrawalRequest[] = []
  for (const planAction of plan.strategies.retirementActions) {
    if (
      planAction.kind !== 'ordinaryWithdrawal' ||
      planAction.year !== taxYear
    ) {
      continue
    }
    const request = ordinaryWithdrawalRequestSchema.parse(planAction)
    const touchesPool = request.allocations.some((allocation) =>
      poolAccountIds.has(allocation.sourceAccountId),
    )
    if (!touchesPool) continue
    const foreignAllocation = request.allocations.find((allocation) =>
      !poolAccountIds.has(allocation.sourceAccountId),
    )
    if (foreignAllocation !== undefined) {
      issues.push(inventoryIssue(
        'mixedSourceAction',
        'An action touching the owned-IRA pool must not mix another source class',
        {
          actionId: request.actionId,
          sourceAccountId: foreignAllocation.sourceAccountId,
        },
      ))
      continue
    }
    requests.push(canonicalOrdinaryWithdrawalRequest(request))
  }
  requests.sort((left, right) =>
    compareUtf16CodeUnits(left.actionId, right.actionId),
  )
  if (requests.length === 0) {
    issues.push(inventoryIssue(
      'planActionBatchEmpty',
      'Plan contains no complete owned-IRA withdrawal action batch for this owner and year',
    ))
  }

  const expectedOpeningDate = `${String(taxYear).padStart(4, '0')}-01-01`
  const expectedYearEndDate = `${String(taxYear).padStart(4, '0')}-12-31`
  const openingBySource = new Map<
    AccountId,
    PlanOwnedNonRothIraOpeningBalanceEvidence
  >()
  const claimedEvidenceIds = new Set(
    [...classificationBySource.values()].map(
      (classification) => classification.evidenceId,
    ),
  )
  const openingEvidence =
    input.openingBalanceEvidence.map(
      (raw): PlanOwnedNonRothIraOpeningBalanceEvidence => {
        const sourceAccountId = accountIdSchema.parse(raw.sourceAccountId)
        const evidence: PlanOwnedNonRothIraOpeningBalanceEvidence = {
          predicate: raw.predicate,
          planId: planIdSchema.parse(raw.planId),
          ownerPersonId: personIdSchema.parse(raw.ownerPersonId),
          sourceAccountId,
          taxYear: raw.taxYear,
          ledgerPhase: raw.ledgerPhase,
          asOfDate: raw.asOfDate,
          ledgerRunId: raw.ledgerRunId,
          openingBalanceAmount:
            usdCentsSchema.parse(raw.openingBalanceAmount),
          evidenceId: raw.evidenceId,
          upstreamEvidenceId: raw.upstreamEvidenceId,
        }
        if (openingBySource.has(sourceAccountId)) {
          issues.push(inventoryIssue(
            'openingBalanceEvidenceDuplicate',
            'Opening balance evidence must be unique per complete-pool account',
            { sourceAccountId },
          ))
        }
        openingBySource.set(sourceAccountId, evidence)
        if (!poolAccountIds.has(sourceAccountId)) {
          issues.push(inventoryIssue(
            'openingBalanceEvidenceForeign',
            'Opening balance evidence is foreign to the complete owned-IRA pool',
            { sourceAccountId },
          ))
        }
        if (
          evidence.predicate !==
            'ownedNonRothIraOpeningBalanceBeforeCompleteAnnualPlanActionBatch' ||
          evidence.planId !== planId ||
          evidence.ownerPersonId !== ownerPersonId ||
          evidence.taxYear !== taxYear ||
          evidence.ledgerPhase !==
            'openingOfTaxYearBeforeCompleteAnnualOwnedIraActionBatch' ||
          evidence.asOfDate !== expectedOpeningDate ||
          !nonblank(evidence.ledgerRunId) ||
          !nonblank(evidence.upstreamEvidenceId)
        ) {
          issues.push(inventoryIssue(
            'openingBalanceEvidenceBindingMismatch',
            'Opening balance evidence must bind the Plan, owner, account, year, ledger phase, and January 1 batch opening',
            { sourceAccountId },
          ))
        }
        claimEvidenceId(
          evidence.evidenceId,
          'Opening balance evidence ID',
          claimedEvidenceIds,
          issues,
        )
        claimEvidenceId(
          evidence.upstreamEvidenceId,
          'Opening balance upstream evidence ID',
          claimedEvidenceIds,
          issues,
        )
        return evidence
      },
    )
  for (const sourceAccountId of poolAccountIds) {
    if (!openingBySource.has(sourceAccountId)) {
      issues.push(inventoryIssue(
        'openingBalanceEvidenceMissing',
        'Opening balance evidence must cover every complete-pool account',
        { sourceAccountId },
      ))
    }
  }
  openingEvidence.sort((left, right) =>
    compareUtf16CodeUnits(left.sourceAccountId, right.sourceAccountId),
  )

  const yearEndBySource = new Map<
    AccountId,
    PlanOwnedNonRothIraYearEndBalanceEvidence
  >()
  const yearEndEvidence =
    input.yearEndBalanceEvidence.map(
      (raw): PlanOwnedNonRothIraYearEndBalanceEvidence => {
        const sourceAccountId = accountIdSchema.parse(raw.sourceAccountId)
        const evidence: PlanOwnedNonRothIraYearEndBalanceEvidence = {
          predicate: raw.predicate,
          planId: planIdSchema.parse(raw.planId),
          ownerPersonId: personIdSchema.parse(raw.ownerPersonId),
          sourceAccountId,
          taxYear: raw.taxYear,
          ledgerPhase: raw.ledgerPhase,
          asOfDate: raw.asOfDate,
          ledgerRunId: raw.ledgerRunId,
          yearEndApplicableBalanceAmount:
            usdCentsSchema.parse(raw.yearEndApplicableBalanceAmount),
          evidenceId: raw.evidenceId,
          upstreamEvidenceId: raw.upstreamEvidenceId,
        }
        if (yearEndBySource.has(sourceAccountId)) {
          issues.push(inventoryIssue(
            'yearEndBalanceEvidenceDuplicate',
            'Year-end balance evidence must be unique per complete-pool account',
            { sourceAccountId },
          ))
        }
        yearEndBySource.set(sourceAccountId, evidence)
        if (!poolAccountIds.has(sourceAccountId)) {
          issues.push(inventoryIssue(
            'yearEndBalanceEvidenceForeign',
            'Year-end balance evidence is foreign to the complete owned-IRA pool',
            { sourceAccountId },
          ))
        }
        if (
          evidence.predicate !==
            'ownedNonRothIraForm8606ApplicableTaxYearEndBalance' ||
          evidence.planId !== planId ||
          evidence.ownerPersonId !== ownerPersonId ||
          evidence.taxYear !== taxYear ||
          evidence.ledgerPhase !== 'form8606ApplicableTaxYearEnd' ||
          evidence.asOfDate !== expectedYearEndDate ||
          !nonblank(evidence.ledgerRunId) ||
          !nonblank(evidence.upstreamEvidenceId)
        ) {
          issues.push(inventoryIssue(
            'yearEndBalanceEvidenceBindingMismatch',
            'Year-end balance evidence must bind the Plan, owner, account, year, Form-8606 phase, and December 31',
            { sourceAccountId },
          ))
        }
        claimEvidenceId(
          evidence.evidenceId,
          'Year-end balance evidence ID',
          claimedEvidenceIds,
          issues,
        )
        claimEvidenceId(
          evidence.upstreamEvidenceId,
          'Year-end balance upstream evidence ID',
          claimedEvidenceIds,
          issues,
        )
        return evidence
      },
    )
  for (const sourceAccountId of poolAccountIds) {
    if (!yearEndBySource.has(sourceAccountId)) {
      issues.push(inventoryIssue(
        'yearEndBalanceEvidenceMissing',
        'Year-end balance evidence must cover every complete-pool account',
        { sourceAccountId },
      ))
    }
  }
  yearEndEvidence.sort((left, right) =>
    compareUtf16CodeUnits(left.sourceAccountId, right.sourceAccountId),
  )

  const annualRaw = input.annualBasisEvidence
  const annualBasisEvidence: CompletePlanOwnedNonRothIraAnnualBasisEvidence = {
    predicate: annualRaw.predicate,
    planId: planIdSchema.parse(annualRaw.planId),
    ownerPersonId: personIdSchema.parse(annualRaw.ownerPersonId),
    taxYear: annualRaw.taxYear,
    ledgerRunId: annualRaw.ledgerRunId,
    line7InventoryStatus: annualRaw.line7InventoryStatus,
    excludedLine7ActivityStatus: annualRaw.excludedLine7ActivityStatus,
    includedPlanActionIds: [...annualRaw.includedPlanActionIds]
      .map((actionId) => actionIdSchema.parse(actionId))
      .sort(compareUtf16CodeUnits),
    openingBasisAmount:
      usdCentsSchema.parse(annualRaw.openingBasisAmount),
    taxYearNondeductibleContributionAmount:
      usdCentsSchema.parse(
        annualRaw.taxYearNondeductibleContributionAmount,
      ),
    postYearNondeductibleContributionExcludedAmount:
      usdCentsSchema.parse(
        annualRaw.postYearNondeductibleContributionExcludedAmount,
      ),
    outstandingRolloverAmount:
      usdCentsSchema.parse(annualRaw.outstandingRolloverAmount),
    rolloverRepaymentAdjustmentAmount:
      usdCentsSchema.parse(
        annualRaw.rolloverRepaymentAdjustmentAmount,
      ),
    evidenceId: annualRaw.evidenceId,
    upstreamEvidenceId: annualRaw.upstreamEvidenceId,
  }
  const expectedActionIds =
    requests.map((request) => request.actionId).sort(compareUtf16CodeUnits)
  if (
    annualBasisEvidence.predicate !==
      'completePlanOwnedNonRothIraAnnualBasisFacts' ||
    annualBasisEvidence.planId !== planId ||
    annualBasisEvidence.ownerPersonId !== ownerPersonId ||
    annualBasisEvidence.taxYear !== taxYear ||
    annualBasisEvidence.line7InventoryStatus !==
      'completePlanActionBatchWithNoOmittedOwnerIraLine7Activity' ||
    annualBasisEvidence.excludedLine7ActivityStatus !==
      'noExternalRmdLegacyOrOtherNonQcdDistributions' ||
    !nonblank(annualBasisEvidence.ledgerRunId) ||
    !nonblank(annualBasisEvidence.upstreamEvidenceId)
  ) {
    issues.push(inventoryIssue(
      'annualBasisEvidenceBindingMismatch',
      'Annual basis evidence must bind the complete Plan action batch and explicit line-7 completeness scope',
    ))
  }
  if (!sameStrings(
    annualBasisEvidence.includedPlanActionIds,
    expectedActionIds,
  )) {
    issues.push(inventoryIssue(
      'line7ActionSetMismatch',
      'Annual basis evidence action IDs must exactly equal the canonical Plan batch',
    ))
  }
  claimEvidenceId(
    annualBasisEvidence.evidenceId,
    'Annual basis evidence ID',
    claimedEvidenceIds,
    issues,
  )
  claimEvidenceId(
    annualBasisEvidence.upstreamEvidenceId,
    'Annual basis upstream evidence ID',
    claimedEvidenceIds,
    issues,
  )

  const line8Raw = input.line8InventoryEvidence
  const line8Entries = canonicalLine8Entries(
    line8Raw.entries,
    taxYear,
    poolAccountIds,
    issues,
  )
  const line8InventoryEvidence:
    CompletePlanOwnedNonRothIraLine8InventoryEvidence = {
      predicate: line8Raw.predicate,
      planId: planIdSchema.parse(line8Raw.planId),
      ownerPersonId: personIdSchema.parse(line8Raw.ownerPersonId),
      taxYear: line8Raw.taxYear,
      ledgerRunId: line8Raw.ledgerRunId,
      inventoryStatus: line8Raw.inventoryStatus,
      entries: line8Entries,
      evidenceId: line8Raw.evidenceId,
      upstreamEvidenceId: line8Raw.upstreamEvidenceId,
    }
  if (
    line8InventoryEvidence.predicate !==
      'completePlanOwnedNonRothIraLine8ConversionInventory' ||
    line8InventoryEvidence.planId !== planId ||
    line8InventoryEvidence.ownerPersonId !== ownerPersonId ||
    line8InventoryEvidence.taxYear !== taxYear ||
    line8InventoryEvidence.inventoryStatus !==
      'completeIncludingExplicitEmpty' ||
    !nonblank(line8InventoryEvidence.ledgerRunId) ||
    !nonblank(line8InventoryEvidence.upstreamEvidenceId)
  ) {
    issues.push(inventoryIssue(
      'line8InventoryEvidenceBindingMismatch',
      'Line-8 inventory evidence must bind the complete Plan owner/year conversion inventory',
    ))
  }
  claimEvidenceId(
    line8InventoryEvidence.evidenceId,
    'Line-8 inventory evidence ID',
    claimedEvidenceIds,
    issues,
  )
  claimEvidenceId(
    line8InventoryEvidence.upstreamEvidenceId,
    'Line-8 inventory upstream evidence ID',
    claimedEvidenceIds,
    issues,
  )
  claimCallerPenaltyEvidenceIds(
    input,
    claimedEvidenceIds,
    issues,
  )

  const ledgerRunIds = new Set([
    ...openingEvidence.map((evidence) => evidence.ledgerRunId),
    ...yearEndEvidence.map((evidence) => evidence.ledgerRunId),
    annualBasisEvidence.ledgerRunId,
    line8InventoryEvidence.ledgerRunId,
  ])
  if (ledgerRunIds.size !== 1 || !nonblank([...ledgerRunIds][0])) {
    issues.push(inventoryIssue(
      'ledgerRunMismatch',
      'Opening, year-end, annual-basis, and line-8 evidence must share one nonblank ledger run',
    ))
  }
  if (issues.length > 0 || owner === undefined) {
    return inventoryBlocked(issues)
  }
  return {
    plan,
    planId,
    ownerPersonId,
    ownerBirthDate: owner.dob,
    taxYear,
    requests,
    classifications: classificationBySource,
    poolAccounts,
    openingEvidence,
    yearEndEvidence,
    annualBasisEvidence,
    line8InventoryEvidence,
    line8Entries,
    ledgerRunId: [...ledgerRunIds][0]!,
    claimedEvidenceIds,
  }
}

function verifyPhysicalEligibility(
  inventory: CanonicalInventory,
  personAliveEvidence:
    readonly Readonly<NonpersistedActionPersonAliveEvidence>[],
): Readonly<PlanOwnedNonRothIraPhysicalEligibilityBlockedResult> | Map<
  ActionId,
  Readonly<NonpersistedActionPersonAliveEvidence>
> {
  const selectedActionIds = new Set(
    inventory.requests.map((request) => request.actionId),
  )
  const aliveByAction = new Map<
    ActionId,
    Readonly<NonpersistedActionPersonAliveEvidence>
  >()
  const issues: PlanOwnedNonRothIraPhysicalEligibilityIssue[] = []
  for (const evidence of personAliveEvidence) {
    if (!selectedActionIds.has(evidence.actionId)) {
      issues.push({
        kind: 'personAliveEvidenceMismatch',
        detail: 'Person-alive evidence is foreign to the complete Plan batch',
        actionId: evidence.actionId,
      })
      continue
    }
    if (aliveByAction.has(evidence.actionId)) {
      issues.push({
        kind: 'personAliveEvidenceMismatch',
        detail: 'Person-alive evidence must be unique per Plan action',
        actionId: evidence.actionId,
      })
      continue
    }
    if (
      !nonblank(evidence.evidenceId) ||
      inventory.claimedEvidenceIds.has(evidence.evidenceId)
    ) {
      issues.push({
        kind: 'personAliveEvidenceMismatch',
        detail: 'Person-alive evidence ID must be nonblank and unique across evidence kinds',
        actionId: evidence.actionId,
      })
    }
    inventory.claimedEvidenceIds.add(evidence.evidenceId)
    aliveByAction.set(evidence.actionId, evidence)
  }
  for (const request of inventory.requests) {
    const decision = evaluateRetirementActionEligibilityFromPlan(
      request,
      inventory.plan,
      { personAliveEvidence },
    )
    if (decision.status !== 'accepted') {
      issues.push({
        kind: 'eligibilityDecision',
        actionId: request.actionId,
        decision,
      })
    }
  }
  if (issues.length > 0) return physicalBlocked(issues)
  return aliveByAction
}

function buildCoordinatorInputs(
  inventory: CanonicalInventory,
): Readonly<{
    movementInput:
      Readonly<StageOwnedNonRothIraOrdinaryWithdrawalMovementsInput>
    annualInput: Readonly<
      Omit<ClassifyOwnedNonRothIraAnnualWithdrawalsInput, 'line7Distributions'>
    >
    sourceInventoryEvidenceId: string
  }> | Readonly<PlanOwnedNonRothIraSourceInventoryIncompleteResult> {
  const generatedIdIssues: PlanOwnedNonRothIraSourceInventoryIssue[] = []
  const yearEndBySource = new Map(
    inventory.yearEndEvidence.map((evidence) => [
      evidence.sourceAccountId,
      evidence,
    ]),
  )
  const requestedSourceIds = new Set(
    inventory.requests.flatMap((request) =>
      request.allocations.map((allocation) => allocation.sourceAccountId),
    ),
  )
  const openingBalances: AccountOpeningBalanceSnapshot[] =
    inventory.openingEvidence
      .filter((evidence) => requestedSourceIds.has(evidence.sourceAccountId))
      .map((evidence) => ({
        accountId: evidence.sourceAccountId,
        openingBalance: evidence.openingBalanceAmount,
      }))
  const poolMembers: OwnedNonRothIraPoolMemberEvidence[] =
    inventory.poolAccounts.map((account) => {
      const sourceAccountId = accountIdSchema.parse(account.id)
      const classification = inventory.classifications.get(sourceAccountId)
      const yearEnd = yearEndBySource.get(sourceAccountId)
      if (classification === undefined || yearEnd === undefined) {
        throw new Error('Canonical owned-IRA pool lost required evidence')
      }
      const accountOwnershipEvidenceId = deriveActionStructuralId(
        'owned-ira-plan-account-ownership',
        [
          inventory.planId,
          inventory.ownerPersonId,
          sourceAccountId,
          'traditional',
          'ira',
          'owned',
        ],
      )
      claimEvidenceId(
        accountOwnershipEvidenceId,
        'Plan-derived account-ownership evidence ID',
        inventory.claimedEvidenceIds,
        generatedIdIssues,
      )
      return {
        sourceAccountId,
        ownerPersonId: inventory.ownerPersonId,
        accountType: 'traditional',
        accountKind: 'ira',
        inheritanceStatus: 'owned',
        subtype: classification.subtype,
        yearEndApplicableBalanceAmount:
          yearEnd.yearEndApplicableBalanceAmount,
        iraClassificationEvidenceId: classification.evidenceId,
        accountOwnershipEvidenceId,
      }
    })
  const sourceEvidence: OwnedNonRothIraMovementSourceEvidence[] =
    poolMembers
      .filter((member) => requestedSourceIds.has(member.sourceAccountId))
      .map((member) => ({
      predicate: 'ownedNonRothIraOrdinaryWithdrawalMovementSource',
      sourceAccountId: member.sourceAccountId,
      ownerPersonId: member.ownerPersonId,
      accountType: member.accountType,
      accountKind: member.accountKind,
      inheritanceStatus: member.inheritanceStatus,
      subtype: member.subtype,
      accountOwnershipEvidenceId: member.accountOwnershipEvidenceId,
        iraClassificationEvidenceId:
          member.iraClassificationEvidenceId,
      }))
  const ownerWideNonRothIraPoolId = deriveActionStructuralId(
    'owned-non-roth-ira-plan-owner-pool',
    [
      inventory.planId,
      inventory.ownerPersonId,
      inventory.taxYear,
      poolMembers.map((member) => [
        member.sourceAccountId,
        member.subtype,
        member.accountOwnershipEvidenceId,
        member.iraClassificationEvidenceId,
      ]),
    ],
  )
  claimEvidenceId(
    ownerWideNonRothIraPoolId,
    'Plan-derived owner-wide pool ID',
    inventory.claimedEvidenceIds,
    generatedIdIssues,
  )
  const yearEndApplicablePoolBalanceAmount = safeCentsSum(
    poolMembers.map((member) => member.yearEndApplicableBalanceAmount),
    'Owned IRA year-end pool balance',
  )
  const completePoolEvidenceId = deriveActionStructuralId(
    'owned-ira-plan-complete-pool',
    [
      inventory.planId,
      inventory.ownerPersonId,
      inventory.taxYear,
      poolMembers,
    ],
  )
  claimEvidenceId(
    completePoolEvidenceId,
    'Plan-derived complete-pool evidence ID',
    inventory.claimedEvidenceIds,
    generatedIdIssues,
  )
  const completePoolEvidence: CompleteOwnedNonRothIraPoolEvidence = {
    predicate: 'completeOwnedNonRothIraPoolForOwnerAndTaxYear',
    ownerPersonId: inventory.ownerPersonId,
    ownerWideNonRothIraPoolId,
    taxYear: inventory.taxYear,
    accountIds: poolMembers.map((member) => member.sourceAccountId) as [
      AccountId,
      ...AccountId[],
    ],
    yearEndApplicablePoolBalanceAmount,
    evidenceId: completePoolEvidenceId,
  }
  const sourceInventoryEvidenceId = deriveActionStructuralId(
    'owned-ira-plan-source-inventory',
    [
      inventory.planId,
      inventory.ownerPersonId,
      inventory.ownerBirthDate,
      inventory.taxYear,
      inventory.ledgerRunId,
      inventory.requests,
      inventory.openingEvidence,
      inventory.yearEndEvidence,
      inventory.annualBasisEvidence,
      inventory.line8InventoryEvidence,
      [...inventory.classifications.values()]
        .map((classification) => ({ ...classification }))
        .sort((left, right) =>
          compareUtf16CodeUnits(
            left.sourceAccountId,
            right.sourceAccountId,
          ),
        ),
      poolMembers,
      completePoolEvidence,
    ],
  )
  claimEvidenceId(
    sourceInventoryEvidenceId,
    'Plan-derived source-inventory evidence ID',
    inventory.claimedEvidenceIds,
    generatedIdIssues,
  )
  if (generatedIdIssues.length > 0) {
    return inventoryBlocked(generatedIdIssues)
  }
  const movementInput: StageOwnedNonRothIraOrdinaryWithdrawalMovementsInput = {
    ownerPersonId: inventory.ownerPersonId,
    taxYear: inventory.taxYear,
    requests: inventory.requests,
    openingBalances,
    sourceEvidence,
  }
  const staged =
    stageOwnedNonRothIraOrdinaryWithdrawalMovements(movementInput)
  const line7Amount = safeCentsSum(
    staged.line7Distributions.map((entry) => entry.grossAmount),
    'Owned IRA line-7 amount',
  )
  const line8Amount = safeCentsSum(
    inventory.line8Entries.map((entry) => entry.grossAmount),
    'Owned IRA line-8 amount',
  )
  const annualInput: Omit<
    ClassifyOwnedNonRothIraAnnualWithdrawalsInput,
    'line7Distributions'
  > = {
    ownerPersonId: inventory.ownerPersonId,
    ownerWideNonRothIraPoolId,
    completePoolEvidence,
    annualBasisRecordEvidenceId:
      inventory.annualBasisEvidence.evidenceId,
    taxYear: inventory.taxYear,
    poolMembers,
    annualFacts: {
      openingBasisAmount:
        inventory.annualBasisEvidence.openingBasisAmount,
      taxYearNondeductibleContributionAmount:
        inventory.annualBasisEvidence
          .taxYearNondeductibleContributionAmount,
      postYearNondeductibleContributionExcludedAmount:
        inventory.annualBasisEvidence
          .postYearNondeductibleContributionExcludedAmount,
      yearEndApplicablePoolBalanceAmount,
      outstandingRolloverAmount:
        inventory.annualBasisEvidence.outstandingRolloverAmount,
      rolloverRepaymentAdjustmentAmount:
        inventory.annualBasisEvidence
          .rolloverRepaymentAdjustmentAmount,
      form8606Line7DistributionAmount: line7Amount,
      form8606Line8NetConversionAmount: line8Amount,
    },
    line8Conversions: inventory.line8Entries,
  }
  return { movementInput, annualInput, sourceInventoryEvidenceId }
}

function simpleParticipationEvidence(
  inventory: CanonicalInventory,
  sourceAccountIds: readonly AccountId[],
): SimpleIraParticipationEvidence[] | Readonly<
  PlanOwnedNonRothIraSourceInventoryIncompleteResult
> {
  const missing: PlanOwnedNonRothIraSourceInventoryIssue[] = []
  const evidence = sourceAccountIds.map((sourceAccountId) => {
    const classification = inventory.classifications.get(sourceAccountId)
    if (
      classification?.subtype !== 'simple' ||
      classification.simpleParticipationStartDate === undefined
    ) {
      missing.push(inventoryIssue(
        'simpleParticipationEvidenceMissing',
        'A genuinely required SIMPLE early-distribution rate needs a Plan participation start date',
        { sourceAccountId },
      ))
      return null
    }
    const participationStartEvidenceId = deriveActionStructuralId(
      'owned-ira-plan-simple-participation',
      [
        inventory.planId,
        inventory.ownerPersonId,
        sourceAccountId,
        classification.evidenceId,
        classification.simpleParticipationStartDate,
      ],
    )
    claimEvidenceId(
      participationStartEvidenceId,
      'Plan-derived SIMPLE participation evidence ID',
      inventory.claimedEvidenceIds,
      missing,
    )
    return {
      predicate: 'simpleIraParticipationStartForPenaltyRate' as const,
      sourceAccountId,
      ownerPersonId: inventory.ownerPersonId,
      participationStartDate:
        classification.simpleParticipationStartDate,
      participationStartEvidenceId,
    }
  })
  if (missing.length > 0) return inventoryBlocked(missing)
  return evidence.filter(
    (item): item is SimpleIraParticipationEvidence => item !== null,
  )
}

function candidateOwnerAliveEvidence(
  inventory: CanonicalInventory,
  aliveByAction: ReadonlyMap<
    ActionId,
    Readonly<NonpersistedActionPersonAliveEvidence>
  >,
  result: Readonly<CoordinateOwnedNonRothIraAnnualWithdrawalCandidateResult>,
): OwnedNonRothIraCandidateOwnerAliveEvidence[] {
  if (result.status !== 'annualEvidenceBlocked') return []
  return result.issues.map((issue) => {
    const alive = aliveByAction.get(issue.actionId)
    if (alive === undefined || alive.alive !== true) {
      throw new Error(
        'Accepted physical eligibility lost its owner-alive evidence',
      )
    }
    return {
      predicate: 'ownerAliveOnOwnedIraDistributionDate',
      actionId: issue.actionId,
      allocationId: issue.allocationId,
      sourceAccountId: issue.sourceAccountId,
      ownerPersonId: inventory.ownerPersonId,
      evaluationDate: issue.prerequisite.evaluationDate,
      aliveOnEvaluationDate: true,
      ownerAliveEvidenceId: deriveActionStructuralId(
        'owned-ira-plan-owner-alive-allocation',
        [
          alive.evidenceId,
          issue.actionId,
          issue.allocationId,
          issue.sourceAccountId,
          inventory.ownerPersonId,
          issue.prerequisite.evaluationDate,
        ],
      ),
    }
  })
}

function claimInnerCoordinatorPrimaryEvidenceIds(
  result: Readonly<
    CoordinateOwnedNonRothIraAnnualWithdrawalCandidateResult
  >,
  claimed: Set<string>,
  issues: PlanOwnedNonRothIraSourceInventoryIssue[],
): void {
  const generated = new Map<string, string>()
  const add = (evidenceId: string, label: string): void => {
    const priorLabel = generated.get(evidenceId)
    if (priorLabel !== undefined && priorLabel !== label) {
      issues.push(inventoryIssue(
        'evidenceIdReused',
        `${label} collides with ${priorLabel}`,
      ))
      return
    }
    generated.set(evidenceId, label)
  }
  const addSeppReconciliations = (
    reconciliations:
      readonly Readonly<OwnedNonRothIraSeppPenaltyScheduleReconciliation>[],
  ): void => {
    for (const route of reconciliations) {
      if (route.reconciliation.status !== 'reconciled') continue
      const evidence = route.reconciliation.evidence
      add(
        evidence.distributionInventory.inventoryEvidenceId,
        'Inner SEPP distribution-inventory evidence ID',
      )
      for (const payment of evidence.payments) {
        add(
          payment.currentPaymentCandidateId,
          'Inner SEPP current-payment candidate ID',
        )
        add(
          payment.afterStateEvidenceId,
          'Inner SEPP payment-state evidence ID',
        )
        add(
          payment.priorHistoryEvidenceId,
          'Inner SEPP payment-history evidence ID',
        )
      }
      add(
        evidence.annualReconciliationId,
        'Inner SEPP annual-reconciliation evidence ID',
      )
    }
  }
  const addCoverageEvidence = (
    coverage:
      Readonly<CompleteOwnedNonRothIraAnnualWithdrawalFinalizationEvidence>[
        'penaltyPrerequisites'
      ]['coverage'][number],
  ): void => {
    add(
      coverage.basisEvidenceId,
      'Inner annual-basis evidence ID',
    )
    add(
      coverage.line7AllocationEvidenceId,
      'Inner line-7 allocation evidence ID',
    )
    add(
      coverage.ageThresholdEvidenceId,
      'Inner penalty age-threshold evidence ID',
    )
    add(
      coverage.sourceEvidenceIds.distributionDateEvidenceId,
      'Inner staged distribution-date evidence ID',
    )
    add(
      coverage.evidenceId,
      'Inner penalty character-coverage evidence ID',
    )
    for (const characterEvidenceId of coverage.characterEvidenceIds) {
      add(
        characterEvidenceId,
        'Inner withdrawal-character evidence ID',
      )
    }
  }
  const addPenaltyEvidence = (
    penalty:
      Readonly<CompleteOwnedNonRothIraAnnualWithdrawalFinalizationEvidence>[
        'penaltyPrerequisites'
      ],
  ): void => {
    add(
      penalty.ageThresholdEvidence.evidenceId,
      'Inner penalty age-threshold evidence ID',
    )
    for (const coverage of penalty.coverage) {
      addCoverageEvidence(coverage)
    }
    for (const evaluation of penalty.evaluations) {
      if ('rateEvidence' in evaluation) {
        add(
          evaluation.rateEvidence.evidenceId,
          'Inner penalty-rate evidence ID',
        )
      }
      if ('rejectedExceptions' in evaluation) {
        for (const exception of evaluation.rejectedExceptions) {
          add(
            exception.evidenceId,
            'Inner rejected-exception evidence ID',
          )
        }
        add(
          evaluation.rateBucketEvidence.evidenceId,
          'Inner penalty-rate-bucket evidence ID',
        )
        for (const member of evaluation.rateBucketEvidence.members) {
          add(
            member.penaltyApplicabilityEvidenceId,
            'Inner penalty-applicability evidence ID',
          )
        }
      }
      if ('finalEvidenceId' in evaluation) {
        add(
          evaluation.finalEvidenceId,
          'Inner final penalty evidence ID',
        )
      }
      if (evaluation.outcome === 'iraSeppQualified') {
        add(
          evaluation.annualReconciliationEvidence
            .annualReconciliationId,
          'Inner SEPP annual-reconciliation evidence ID',
        )
      }
    }
    addSeppReconciliations(penalty.iraSeppScheduleReconciliations)
  }

  add(
    result.movementCandidate.movementCandidateId,
    'Inner movement-candidate evidence ID',
  )
  if (result.status === 'annualEvidenceBlocked') {
    for (const issue of result.issues) {
      const prerequisite = issue.prerequisite
      addCoverageEvidence(prerequisite.characterCoverage)
      add(
        prerequisite.rateEvidence.evidenceId,
        'Inner penalty-rate evidence ID',
      )
      add(
        prerequisite.prerequisiteEvidenceId,
        'Inner penalty-prerequisite evidence ID',
      )
    }
    addSeppReconciliations(result.iraSeppScheduleReconciliations)
  } else if (result.status === 'annualEvidenceBound') {
    const characterization = result.annualEvidence.characterization
    add(
      characterization.annualBasisEvidence.basisEvidenceId,
      'Inner annual-basis evidence ID',
    )
    add(
      characterization.line7AllocationEvidence.allocationEvidenceId,
      'Inner line-7 allocation evidence ID',
    )
    add(
      characterization.line8AllocationEvidence.allocationEvidenceId,
      'Inner line-8 allocation evidence ID',
    )
    addPenaltyEvidence(result.annualEvidence.penaltyPrerequisites)
    add(
      result.annualEvidence.finalizationEvidenceId,
      'Inner annual-finalization evidence ID',
    )
    add(
      result.bindingEvidence.bindingEvidenceId,
      'Inner annual-candidate binding evidence ID',
    )
  }

  for (const [evidenceId, label] of generated) {
    claimEvidenceId(evidenceId, label, claimed, issues)
  }
}

/**
 * Builds Plan-identity-authoritative, runtime-snapshot-bound planning evidence
 * for one complete owner/year owned non-Roth IRA action batch. It never treats
 * Plan balances as dated ledger facts, commits movement, or establishes
 * actionability.
 */
export function coordinatePlanOwnedNonRothIraAnnualWithdrawalCandidate(
  input:
    Readonly<CoordinatePlanOwnedNonRothIraAnnualWithdrawalCandidateInput>,
): Readonly<
  CoordinatePlanOwnedNonRothIraAnnualWithdrawalCandidateResult
> {
  const canonical = buildCanonicalInventory(input)
  if ('status' in canonical) return canonical
  const aliveByAction = verifyPhysicalEligibility(
    canonical,
    input.personAliveEvidence,
  )
  if (!(aliveByAction instanceof Map)) return aliveByAction

  const coordinatorInputs = buildCoordinatorInputs(canonical)
  if ('status' in coordinatorInputs) return coordinatorInputs
  const {
    movementInput,
    annualInput,
    sourceInventoryEvidenceId,
  } = coordinatorInputs
  const ownerEvidenceId = deriveActionStructuralId(
    'owned-ira-plan-owner-birth-date',
    [
      canonical.planId,
      canonical.ownerPersonId,
      canonical.ownerBirthDate,
    ],
  )
  const generatedIdIssues: PlanOwnedNonRothIraSourceInventoryIssue[] = []
  claimEvidenceId(
    ownerEvidenceId,
    'Plan-derived owner birth-date evidence ID',
    canonical.claimedEvidenceIds,
    generatedIdIssues,
  )
  if (generatedIdIssues.length > 0) {
    return inventoryBlocked(generatedIdIssues)
  }
  const ownerEvidence = {
    predicate: 'ownerBirthDateForIraPenaltyAgeThreshold' as const,
    ownerPersonId: canonical.ownerPersonId,
    birthDate: canonical.ownerBirthDate,
    evidenceId: ownerEvidenceId,
  }
  let participationEvidence: SimpleIraParticipationEvidence[] = []
  const run = (
    ownerAliveEvidence:
      readonly Readonly<OwnedNonRothIraCandidateOwnerAliveEvidence>[],
  ) => coordinateOwnedNonRothIraAnnualWithdrawalCandidate({
    movementInput,
    annualInput,
    ownerEvidence,
    qualifiedDisabilityEvidence:
      input.qualifiedDisabilityEvidence,
    rejectedDisabilityEvidence:
      input.rejectedDisabilityEvidence,
    ownerAliveEvidence,
    iraSeppStatusEvidence: input.iraSeppStatusEvidence,
    iraSeppScheduleRoutes: input.iraSeppScheduleRoutes,
    noOtherExceptionAttestations:
      input.noOtherExceptionAttestations,
    simpleParticipationEvidence: participationEvidence,
  })

  let result: Readonly<
    CoordinateOwnedNonRothIraAnnualWithdrawalCandidateResult
  >
  try {
    result = run([])
  } catch (error) {
    if (!(error instanceof MissingSimpleIraParticipationEvidenceError)) {
      throw error
    }
    const derived = simpleParticipationEvidence(
      canonical,
      error.sourceAccountIds,
    )
    if (!Array.isArray(derived)) return derived
    participationEvidence = derived
    try {
      result = run([])
    } catch (retryError) {
      const blocked = invalidSimpleParticipationEvidence(retryError)
      if (blocked !== null) return blocked
      throw retryError
    }
  }
  const ownerAliveEvidence = candidateOwnerAliveEvidence(
    canonical,
    aliveByAction,
    result,
  )
  for (const evidence of ownerAliveEvidence) {
    claimEvidenceId(
      evidence.ownerAliveEvidenceId,
      'Plan-derived allocation owner-alive evidence ID',
      canonical.claimedEvidenceIds,
      generatedIdIssues,
    )
  }
  if (generatedIdIssues.length > 0) {
    return inventoryBlocked(generatedIdIssues)
  }
  if (ownerAliveEvidence.length > 0) {
    try {
      result = run(ownerAliveEvidence)
    } catch (retryError) {
      const blocked = invalidSimpleParticipationEvidence(retryError)
      if (blocked !== null) return blocked
      throw retryError
    }
  }
  claimInnerCoordinatorPrimaryEvidenceIds(
    result,
    canonical.claimedEvidenceIds,
    generatedIdIssues,
  )
  if (generatedIdIssues.length > 0) {
    return inventoryBlocked(generatedIdIssues)
  }
  const canonicalAliveEvidence = [...aliveByAction.values()]
    .map((evidence) => ({
      evidenceId: evidence.evidenceId,
      actionId: evidence.actionId,
      personId: evidence.personId,
      actionYear: evidence.actionYear,
      actionDate: evidence.actionDate,
      alive: evidence.alive,
    }))
    .sort((left, right) =>
      compareUtf16CodeUnits(left.actionId, right.actionId),
    )
  const physicalEligibilityEvidenceId = deriveActionStructuralId(
    'owned-ira-plan-physical-eligibility',
    [
      canonical.planId,
      canonical.ownerPersonId,
      canonical.taxYear,
      canonicalAliveEvidence,
    ],
  )
  claimEvidenceId(
    physicalEligibilityEvidenceId,
    'Plan-derived physical-eligibility evidence ID',
    canonical.claimedEvidenceIds,
    generatedIdIssues,
  )
  const planOwnedIraCandidateEvidenceId = deriveActionStructuralId(
    'owned-ira-plan-annual-candidate',
    [sourceInventoryEvidenceId, physicalEligibilityEvidenceId, result],
  )
  claimEvidenceId(
    planOwnedIraCandidateEvidenceId,
    'Plan-derived annual-candidate evidence ID',
    canonical.claimedEvidenceIds,
    generatedIdIssues,
  )
  if (generatedIdIssues.length > 0) {
    return inventoryBlocked(generatedIdIssues)
  }
  return deepFreeze({
    ...result,
    sourceInventoryEvidenceId,
    physicalEligibilityEvidenceId,
    planOwnedIraCandidateEvidenceId,
  })
}
