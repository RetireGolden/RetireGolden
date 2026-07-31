import {
  accountIdSchema,
  actionIdSchema,
  allocationIdSchema,
  personIdSchema,
  type AccountId,
  type ActionId,
  type AllocationId,
  type PersonId,
} from './identity.js'
import {
  asUsdCents,
  positiveUsdCentsSchema,
  usdCentsSchema,
  type UsdCents,
} from './money.js'
import { parseCivilIsoDate } from './civilDate.js'
import {
  compareUtf16CodeUnits,
  deriveActionStructuralId,
} from './structuralId.js'
import type {
  OwnedNonRothIraPenaltyCharacterCoverageEvidence,
} from './ownedNonRothIraPenaltyPrerequisite.js'
import {
  validateOwnedNonRothIraSeppCurrentPaymentCandidate,
  type OwnedNonRothIraSeppAnnualOpeningStateEvidence,
  type OwnedNonRothIraSeppAnnualScheduleEvidence,
  type OwnedNonRothIraSeppCurrentPaymentEvidence,
  type OwnedNonRothIraSeppCurrentPaymentStateEvidence,
  type OwnedNonRothIraSeppElectionEvidence,
  type OwnedNonRothIraSeppNoModificationEvidence,
  type OwnedNonRothIraSeppNonconformanceKind,
  type OwnedNonRothIraSeppPriorPaymentHistoryEvidence,
  type OwnedNonRothIraSeppSourceEvidence,
} from './ownedNonRothIraSeppCurrentPaymentCandidate.js'
import type {
  OwnedNonRothIraSubtype,
} from './ownedNonRothIraWithdrawalCharacter.js'

export interface OwnedNonRothIraSeppAnnualDistributionInventoryEvidence {
  predicate: 'completeOwnedNonRothIraSeppAnnualDistributionInventory'
  electionId: string
  scheduleId: string
  participantPersonId: PersonId
  sourceAccountId: AccountId
  taxYear: number
  characterCoverages:
    readonly Readonly<OwnedNonRothIraPenaltyCharacterCoverageEvidence>[]
  inventoryEvidenceId: string
}

export interface OwnedNonRothIraSeppCompletePriorElectionHistoryEvidence {
  predicate: 'completeOwnedNonRothIraSeppPriorElectionHistory'
  electionId: string
  scheduleId: string
  participantPersonId: PersonId
  sourceAccountId: AccountId
  historyThroughDate: string
  terminalStateEvidenceId: string
  usedDistributionEvidenceIds: readonly string[]
  priorElectionHistoryEvidenceId: string
}

export interface OwnedNonRothIraSeppAnnualRawPaymentEvidence {
  currentPaymentEvidence:
    Readonly<OwnedNonRothIraSeppCurrentPaymentEvidence>
}

export interface ReconcileOwnedNonRothIraSeppAnnualScheduleInput {
  ownerPersonId: PersonId
  taxYear: number
  sourceEvidence?: Readonly<OwnedNonRothIraSeppSourceEvidence>
  electionEvidence?: Readonly<OwnedNonRothIraSeppElectionEvidence>
  annualScheduleEvidence?:
    Readonly<OwnedNonRothIraSeppAnnualScheduleEvidence>
  noModificationEvidence?:
    Readonly<OwnedNonRothIraSeppNoModificationEvidence>
  openingStateEvidence?:
    Readonly<OwnedNonRothIraSeppAnnualOpeningStateEvidence>
  priorElectionHistoryEvidence?:
    Readonly<OwnedNonRothIraSeppCompletePriorElectionHistoryEvidence>
  distributionInventory?:
    Readonly<OwnedNonRothIraSeppAnnualDistributionInventoryEvidence>
  payments?: readonly Readonly<OwnedNonRothIraSeppAnnualRawPaymentEvidence>[]
}

export type OwnedNonRothIraSeppAnnualMissingEvidenceName =
  | 'sourceEvidence'
  | 'electionEvidence'
  | 'annualScheduleEvidence'
  | 'noModificationEvidence'
  | 'openingStateEvidence'
  | 'priorElectionHistoryEvidence'
  | 'distributionInventory'
  | 'payments'

export interface OwnedNonRothIraSeppAnnualEvidenceMissingIssue {
  kind: 'evidenceMissing'
  evidence: OwnedNonRothIraSeppAnnualMissingEvidenceName
}

export type OwnedNonRothIraSeppAnnualReconciliationIssueKind =
  | 'paymentTupleEmpty'
  | 'distributionInventoryEmpty'
  | 'distributionInventoryBindingMismatch'
  | 'distributionInventoryEvidenceIdMismatch'
  | 'priorElectionHistoryBindingMismatch'
  | 'priorElectionHistoryEvidenceIdMismatch'
  | 'inventoryCoverageCanonicalMismatch'
  | 'foreignInventoryMember'
  | 'foreignPaymentMember'
  | 'duplicateInventoryMember'
  | 'duplicatePaymentMember'
  | 'duplicateDistributionEvidenceId'
  | 'duplicatePaymentEvidenceId'
  | 'duplicateStateEvidenceId'
  | 'lifetimeDistributionReplay'
  | 'lifetimeEvidenceIdCollision'
  | 'inventoryMemberWithoutPayment'
  | 'paymentOutsideCompleteInventory'
  | 'paymentNotLocallyConforming'
  | 'safeIntegerOverflow'
  | 'terminalScheduledGrossIncomplete'
  | 'terminalActualGrossIncomplete'
  | 'terminalScheduledGrossExceeded'
  | 'terminalActualGrossExceeded'
  | 'terminalGrossMismatch'

export interface OwnedNonRothIraSeppAnnualReconciliationIssue {
  kind: OwnedNonRothIraSeppAnnualReconciliationIssueKind
  memberKey?: string
  paymentIssue?: OwnedNonRothIraSeppNonconformanceKind
}

interface OwnedNonRothIraSeppAnnualResultBase {
  qualification: 'notEstablished'
  movement: 'notCommitted'
  actionability: 'notEstablished'
  penaltyTreatment: 'notEstablished'
}

export interface OwnedNonRothIraSeppAnnualEvidenceMissingResult
  extends OwnedNonRothIraSeppAnnualResultBase {
  status: 'evidenceMissing'
  reconciliation: 'notEstablished'
  issues:
    readonly [
      Readonly<OwnedNonRothIraSeppAnnualEvidenceMissingIssue>,
      ...Readonly<OwnedNonRothIraSeppAnnualEvidenceMissingIssue>[],
    ]
  evidence: null
}

export interface OwnedNonRothIraSeppAnnualReconciliationIncompleteResult
  extends OwnedNonRothIraSeppAnnualResultBase {
  status: 'reconciliationIncomplete'
  reconciliation: 'incomplete'
  issues:
    readonly [
      Readonly<OwnedNonRothIraSeppAnnualReconciliationIssue>,
      ...Readonly<OwnedNonRothIraSeppAnnualReconciliationIssue>[],
    ]
  evidence: null
}

export interface OwnedNonRothIraSeppAnnualNotReconciledResult
  extends OwnedNonRothIraSeppAnnualResultBase {
  status: 'notReconciled'
  reconciliation: 'notEstablished'
  issues:
    readonly [
      Readonly<OwnedNonRothIraSeppAnnualReconciliationIssue>,
      ...Readonly<OwnedNonRothIraSeppAnnualReconciliationIssue>[],
    ]
  evidence: null
}

export interface OwnedNonRothIraSeppAnnualReconciledPaymentEvidence {
  predicate: 'ownedNonRothIraSeppAnnualReconciledPayment'
  actionId: ActionId
  allocationId: AllocationId
  distributionDate: string
  paymentSequence: number
  scheduledGrossAmount: UsdCents
  actualGrossAmount: UsdCents
  basisReturnExcludedAmount: UsdCents
  prospectiveOrdinaryIncomeAmount: UsdCents
  characterCoverageEvidenceId: string
  currentDistributionEvidenceId: string
  paymentScheduleEvidenceId: string
  priorHistoryEvidenceId: string
  beforeStateEvidenceId: string
  afterStateEvidenceId: string
  currentPaymentCandidateId: string
}

export interface CompleteOwnedNonRothIraSeppAnnualReconciliationEvidence {
  predicate: 'completeOwnedNonRothIraSeppAnnualReconciliation'
  electionId: string
  scheduleId: string
  participantPersonId: PersonId
  sourceAccountId: AccountId
  subtype: OwnedNonRothIraSubtype
  taxYear: number
  annualScheduledGrossAmount: UsdCents
  reconciledScheduledGrossAmount: UsdCents
  reconciledActualGrossAmount: UsdCents
  basisReturnExcludedAmount: UsdCents
  prospectiveOrdinaryIncomeAmount: UsdCents
  paymentCount: number
  sourceEvidenceId: string
  electionEvidenceId: string
  annualScheduleEvidenceId: string
  noModificationEvidenceId: string
  priorElectionHistoryEvidenceId: string
  priorHistoryTerminalStateId: string
  openingStateEvidenceId: string
  distributionInventory:
    Readonly<OwnedNonRothIraSeppAnnualDistributionInventoryEvidence>
  payments:
    readonly Readonly<OwnedNonRothIraSeppAnnualReconciledPaymentEvidence>[]
  terminalState: Readonly<OwnedNonRothIraSeppCurrentPaymentStateEvidence>
  annualReconciliationId: string
}

export interface OwnedNonRothIraSeppAnnualReconciledResult
  extends OwnedNonRothIraSeppAnnualResultBase {
  status: 'reconciled'
  reconciliation: 'complete'
  issues: readonly []
  evidence:
    Readonly<CompleteOwnedNonRothIraSeppAnnualReconciliationEvidence>
}

export type ReconcileOwnedNonRothIraSeppAnnualScheduleResult =
  | OwnedNonRothIraSeppAnnualEvidenceMissingResult
  | OwnedNonRothIraSeppAnnualReconciliationIncompleteResult
  | OwnedNonRothIraSeppAnnualNotReconciledResult
  | OwnedNonRothIraSeppAnnualReconciledResult

const resultFlags: OwnedNonRothIraSeppAnnualResultBase = {
  qualification: 'notEstablished',
  movement: 'notCommitted',
  actionability: 'notEstablished',
  penaltyTreatment: 'notEstablished',
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

function legacyJsonId(prefix: string, parts: readonly unknown[]): string {
  return `${prefix}:${JSON.stringify(parts)}`
}

function nonblankId(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new TypeError(`${label} must be a nonblank stable identifier`)
  }
  return value
}

function civilDate(value: string, label: string): string {
  if (parseCivilIsoDate(value) === null) {
    throw new RangeError(`${label} must be a canonical civil ISO date`)
  }
  return value
}

function parseTaxYear(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < 1 || value > 9999) {
    throw new RangeError(`${label} must be a four-digit year`)
  }
  return value
}

function positiveInteger(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new RangeError(`${label} must be a positive safe integer`)
  }
  return value
}

function parseSubtype(value: unknown): OwnedNonRothIraSubtype {
  if (value !== 'traditional' && value !== 'sep' && value !== 'simple') {
    throw new RangeError('SEPP inventory subtype must be traditional, SEP, or SIMPLE')
  }
  return value
}

function canonicalCoverage(
  input: Readonly<OwnedNonRothIraPenaltyCharacterCoverageEvidence>,
): {
  coverage: OwnedNonRothIraPenaltyCharacterCoverageEvidence
  producerConforming: boolean
} {
  const characterEvidenceIds = input.characterEvidenceIds.map(
    (evidenceId) => nonblankId(
      evidenceId,
      'SEPP annual character-segment evidence ID',
    ),
  )
  if (
    characterEvidenceIds.length === 0 ||
    new Set(characterEvidenceIds).size !== characterEvidenceIds.length
  ) {
    throw new RangeError(
      'SEPP annual character coverage requires unique character evidence',
    )
  }
  const coverage: OwnedNonRothIraPenaltyCharacterCoverageEvidence = {
    predicate: input.predicate,
    actionId: actionIdSchema.parse(input.actionId),
    allocationId: allocationIdSchema.parse(input.allocationId),
    sourceAccountId: accountIdSchema.parse(input.sourceAccountId),
    ownerPersonId: personIdSchema.parse(input.ownerPersonId),
    subtype: parseSubtype(input.subtype),
    evaluationDate: civilDate(
      input.evaluationDate,
      'SEPP annual character-coverage evaluation date',
    ),
    executedAmount: positiveUsdCentsSchema.parse(input.executedAmount),
    basisReturnExcludedAmount: usdCentsSchema.parse(
      input.basisReturnExcludedAmount,
    ),
    ordinaryIncomeExposureAmount: usdCentsSchema.parse(
      input.ordinaryIncomeExposureAmount,
    ),
    basisEvidenceId: nonblankId(
      input.basisEvidenceId,
      'SEPP annual basis evidence ID',
    ),
    line7AllocationEvidenceId: nonblankId(
      input.line7AllocationEvidenceId,
      'SEPP annual line-7 allocation evidence ID',
    ),
    characterEvidenceIds,
    sourceEvidenceIds: {
      distributionDateEvidenceId: nonblankId(
        input.sourceEvidenceIds.distributionDateEvidenceId,
        'SEPP annual coverage distribution-date evidence ID',
      ),
      accountOwnershipEvidenceId: nonblankId(
        input.sourceEvidenceIds.accountOwnershipEvidenceId,
        'SEPP annual coverage ownership evidence ID',
      ),
      iraClassificationEvidenceId: nonblankId(
        input.sourceEvidenceIds.iraClassificationEvidenceId,
        'SEPP annual coverage classification evidence ID',
      ),
    },
    ageThresholdEvidenceId: nonblankId(
      input.ageThresholdEvidenceId,
      'SEPP annual coverage age-threshold evidence ID',
    ),
    evidenceId: nonblankId(
      input.evidenceId,
      'SEPP annual character-coverage evidence ID',
    ),
  }
  const canonicalSourceEvidence = {
    predicate: 'ownedNonRothIraPenaltySourceForWithdrawal' as const,
    actionId: coverage.actionId,
    allocationId: coverage.allocationId,
    sourceAccountId: coverage.sourceAccountId,
    ownerPersonId: coverage.ownerPersonId,
    subtype: coverage.subtype,
    evaluationDate: coverage.evaluationDate,
    distributionDateEvidenceId:
      coverage.sourceEvidenceIds.distributionDateEvidenceId,
    accountOwnershipEvidenceId:
      coverage.sourceEvidenceIds.accountOwnershipEvidenceId,
    iraClassificationEvidenceId:
      coverage.sourceEvidenceIds.iraClassificationEvidenceId,
  }
  const expectedEvidenceId = legacyJsonId(
    'owned-ira-penalty-character-coverage',
    [
      coverage.actionId,
      coverage.allocationId,
      coverage.sourceAccountId,
      coverage.ownerPersonId,
      coverage.subtype,
      coverage.evaluationDate,
      coverage.executedAmount,
      coverage.basisReturnExcludedAmount,
      coverage.ordinaryIncomeExposureAmount,
      coverage.basisEvidenceId,
      coverage.line7AllocationEvidenceId,
      coverage.characterEvidenceIds,
      canonicalSourceEvidence,
      coverage.ageThresholdEvidenceId,
    ],
  )
  return {
    coverage,
    producerConforming:
      coverage.predicate ===
        'completeOwnedNonRothIraPenaltyCharacterCoverageForAllocation' &&
      coverage.evidenceId === expectedEvidenceId &&
      BigInt(coverage.basisReturnExcludedAmount) +
        BigInt(coverage.ordinaryIncomeExposureAmount) ===
        BigInt(coverage.executedAmount),
  }
}

function coverageMemberKey(
  coverage: Readonly<OwnedNonRothIraPenaltyCharacterCoverageEvidence>,
): string {
  return deriveActionStructuralId('owned-ira-sepp-annual-distribution-member', [
    coverage.evaluationDate,
    coverage.actionId,
    coverage.allocationId,
    coverage.sourceAccountId,
  ])
}

function compareCoverage(
  left: Readonly<OwnedNonRothIraPenaltyCharacterCoverageEvidence>,
  right: Readonly<OwnedNonRothIraPenaltyCharacterCoverageEvidence>,
): number {
  return compareUtf16CodeUnits(left.evaluationDate, right.evaluationDate) ||
    compareUtf16CodeUnits(left.actionId, right.actionId) ||
    compareUtf16CodeUnits(left.allocationId, right.allocationId) ||
    compareUtf16CodeUnits(left.sourceAccountId, right.sourceAccountId) ||
    compareUtf16CodeUnits(left.evidenceId, right.evidenceId)
}

function paymentMemberKey(
  payment: Readonly<OwnedNonRothIraSeppCurrentPaymentEvidence>,
): string {
  return deriveActionStructuralId('owned-ira-sepp-annual-distribution-member', [
    payment.distributionDate,
    payment.actionId,
    payment.allocationId,
    payment.sourceAccountId,
  ])
}

function comparePayment(
  left: Readonly<OwnedNonRothIraSeppCurrentPaymentEvidence>,
  right: Readonly<OwnedNonRothIraSeppCurrentPaymentEvidence>,
): number {
  return compareUtf16CodeUnits(left.distributionDate, right.distributionDate) ||
    compareUtf16CodeUnits(left.actionId, right.actionId) ||
    compareUtf16CodeUnits(left.allocationId, right.allocationId) ||
    compareUtf16CodeUnits(left.sourceAccountId, right.sourceAccountId) ||
    compareUtf16CodeUnits(
      left.paymentScheduleEvidenceId,
      right.paymentScheduleEvidenceId,
    )
}

function normalizedPriorElectionHistory(
  input: Readonly<OwnedNonRothIraSeppCompletePriorElectionHistoryEvidence>,
): OwnedNonRothIraSeppCompletePriorElectionHistoryEvidence {
  const usedIds = input.usedDistributionEvidenceIds.map(
    (evidenceId) => nonblankId(
      evidenceId,
      'SEPP lifetime used distribution evidence ID',
    ),
  ).sort()
  if (new Set(usedIds).size !== usedIds.length) {
    throw new RangeError(
      'SEPP lifetime used distribution evidence IDs must be unique',
    )
  }
  return {
    predicate: input.predicate,
    electionId: nonblankId(input.electionId, 'SEPP prior-history election ID'),
    scheduleId: nonblankId(input.scheduleId, 'SEPP prior-history schedule ID'),
    participantPersonId: personIdSchema.parse(input.participantPersonId),
    sourceAccountId: accountIdSchema.parse(input.sourceAccountId),
    historyThroughDate: civilDate(
      input.historyThroughDate,
      'SEPP prior-election history through date',
    ),
    terminalStateEvidenceId: nonblankId(
      input.terminalStateEvidenceId,
      'SEPP prior-election terminal-state evidence ID',
    ),
    usedDistributionEvidenceIds: usedIds,
    priorElectionHistoryEvidenceId: nonblankId(
      input.priorElectionHistoryEvidenceId,
      'SEPP complete prior-election history evidence ID',
    ),
  }
}

function normalizedPayment(
  input: Readonly<OwnedNonRothIraSeppCurrentPaymentEvidence>,
): OwnedNonRothIraSeppCurrentPaymentEvidence {
  return {
    predicate: input.predicate,
    electionId: nonblankId(input.electionId, 'SEPP annual payment election ID'),
    scheduleId: nonblankId(input.scheduleId, 'SEPP annual payment schedule ID'),
    actionId: actionIdSchema.parse(input.actionId),
    allocationId: allocationIdSchema.parse(input.allocationId),
    sourceAccountId: accountIdSchema.parse(input.sourceAccountId),
    distributionDate: civilDate(
      input.distributionDate,
      'SEPP annual payment distribution date',
    ),
    currentDistributionEvidenceId: nonblankId(
      input.currentDistributionEvidenceId,
      'SEPP annual current-distribution evidence ID',
    ),
    paymentSequence: positiveInteger(
      input.paymentSequence,
      'SEPP annual payment sequence',
    ),
    previousScheduleStateId: nonblankId(
      input.previousScheduleStateId,
      'SEPP annual previous-state evidence ID',
    ),
    currentScheduledGrossAmount: positiveUsdCentsSchema.parse(
      input.currentScheduledGrossAmount,
    ),
    paymentScheduleEvidenceId: nonblankId(
      input.paymentScheduleEvidenceId,
      'SEPP annual payment-schedule evidence ID',
    ),
  }
}

function addIssue(
  issues: OwnedNonRothIraSeppAnnualReconciliationIssue[],
  issue: OwnedNonRothIraSeppAnnualReconciliationIssue,
): void {
  if (!issues.some((existing) =>
    existing.kind === issue.kind &&
    existing.memberKey === issue.memberKey &&
    existing.paymentIssue === issue.paymentIssue
  )) {
    issues.push(issue)
  }
}

function addLifetimeEvidenceCollisions(
  issues: OwnedNonRothIraSeppAnnualReconciliationIssue[],
  lifetimeDistributionIds: ReadonlySet<string>,
  evidenceIds: readonly string[],
  memberKey?: string,
): void {
  if (evidenceIds.some((evidenceId) => lifetimeDistributionIds.has(evidenceId))) {
    addIssue(issues, { kind: 'lifetimeEvidenceIdCollision', memberKey })
  }
}

function failedResult(
  issues: [
    OwnedNonRothIraSeppAnnualReconciliationIssue,
    ...OwnedNonRothIraSeppAnnualReconciliationIssue[],
  ],
): Readonly<
  | OwnedNonRothIraSeppAnnualReconciliationIncompleteResult
  | OwnedNonRothIraSeppAnnualNotReconciledResult
> {
  const incompleteKinds = new Set<OwnedNonRothIraSeppAnnualReconciliationIssueKind>([
    'paymentTupleEmpty',
    'distributionInventoryEmpty',
    'inventoryMemberWithoutPayment',
    'terminalScheduledGrossIncomplete',
    'terminalActualGrossIncomplete',
  ])
  const incomplete = issues.every((issue) => incompleteKinds.has(issue.kind))
  return deepFreeze(incomplete
    ? {
        ...resultFlags,
        status: 'reconciliationIncomplete' as const,
        reconciliation: 'incomplete' as const,
        issues,
        evidence: null,
      }
    : {
        ...resultFlags,
        status: 'notReconciled' as const,
        reconciliation: 'notEstablished' as const,
        issues,
        evidence: null,
      })
}

/**
 * Reconciles one complete owned non-Roth IRA SEPP election/source/tax year.
 *
 * Every raw payment is revalidated against an internally reconstructed history;
 * caller-supplied candidates, totals, and after states are neither accepted nor
 * trusted. Completeness is proven only relative to the explicit distribution
 * inventory supplied here. A later penalty boundary must rederive and rejoin
 * that inventory from the complete canonical annual characterization before it
 * may establish any exception, rate, penalty, readiness, or execution outcome.
 */
export function reconcileOwnedNonRothIraSeppAnnualSchedule(
  input: Readonly<ReconcileOwnedNonRothIraSeppAnnualScheduleInput>,
): Readonly<ReconcileOwnedNonRothIraSeppAnnualScheduleResult> {
  const missingNames: OwnedNonRothIraSeppAnnualMissingEvidenceName[] = []
  const required = [
    ['sourceEvidence', input.sourceEvidence],
    ['electionEvidence', input.electionEvidence],
    ['annualScheduleEvidence', input.annualScheduleEvidence],
    ['noModificationEvidence', input.noModificationEvidence],
    ['openingStateEvidence', input.openingStateEvidence],
    ['priorElectionHistoryEvidence', input.priorElectionHistoryEvidence],
    ['distributionInventory', input.distributionInventory],
    ['payments', input.payments],
  ] as const
  for (const [name, evidence] of required) {
    if (evidence === undefined) missingNames.push(name)
  }
  if (missingNames.length > 0) {
    return deepFreeze({
      ...resultFlags,
      status: 'evidenceMissing',
      reconciliation: 'notEstablished',
      issues: missingNames.map((evidence) => ({
        kind: 'evidenceMissing' as const,
        evidence,
      })) as [
        OwnedNonRothIraSeppAnnualEvidenceMissingIssue,
        ...OwnedNonRothIraSeppAnnualEvidenceMissingIssue[],
      ],
      evidence: null,
    })
  }

  const ownerPersonId = personIdSchema.parse(input.ownerPersonId)
  const expectedTaxYear = parseTaxYear(input.taxYear, 'SEPP annual tax year')
  const source = input.sourceEvidence!
  const election = input.electionEvidence!
  const annualSchedule = input.annualScheduleEvidence!
  const noModification = input.noModificationEvidence!
  const opening = input.openingStateEvidence!
  const priorHistory = normalizedPriorElectionHistory(
    input.priorElectionHistoryEvidence!,
  )
  const inventoryInput = input.distributionInventory!
  const rawPayments = input.payments!
  const issues: OwnedNonRothIraSeppAnnualReconciliationIssue[] = []

  if (rawPayments.length === 0) addIssue(issues, { kind: 'paymentTupleEmpty' })
  if (inventoryInput.characterCoverages.length === 0) {
    addIssue(issues, { kind: 'distributionInventoryEmpty' })
  }

  const priorHistoryWithoutId = {
    predicate: priorHistory.predicate,
    electionId: priorHistory.electionId,
    scheduleId: priorHistory.scheduleId,
    participantPersonId: priorHistory.participantPersonId,
    sourceAccountId: priorHistory.sourceAccountId,
    historyThroughDate: priorHistory.historyThroughDate,
    terminalStateEvidenceId: priorHistory.terminalStateEvidenceId,
    usedDistributionEvidenceIds: priorHistory.usedDistributionEvidenceIds,
  }
  const expectedPriorHistoryEvidenceId = deriveActionStructuralId(
    'owned-ira-sepp-complete-prior-election-history',
    [priorHistoryWithoutId],
  )
  const expectedHistoryThroughDate =
    `${String(expectedTaxYear - 1).padStart(4, '0')}-12-31`
  if (
    priorHistory.predicate !==
      'completeOwnedNonRothIraSeppPriorElectionHistory' ||
    priorHistory.electionId !== election.electionId ||
    priorHistory.scheduleId !== election.scheduleId ||
    priorHistory.participantPersonId !== ownerPersonId ||
    priorHistory.sourceAccountId !== source.sourceAccountId ||
    priorHistory.historyThroughDate !== expectedHistoryThroughDate ||
    priorHistory.terminalStateEvidenceId !==
      opening.priorHistoryTerminalStateId
  ) {
    addIssue(issues, { kind: 'priorElectionHistoryBindingMismatch' })
  }
  if (
    priorHistory.priorElectionHistoryEvidenceId !==
      expectedPriorHistoryEvidenceId
  ) {
    addIssue(issues, { kind: 'priorElectionHistoryEvidenceIdMismatch' })
  }

  const inventoryCoverages = inventoryInput.characterCoverages.map(
    (record) => canonicalCoverage(record),
  )
  for (const item of inventoryCoverages) {
    const memberKey = coverageMemberKey(item.coverage)
    if (!item.producerConforming) {
      addIssue(issues, { kind: 'inventoryCoverageCanonicalMismatch', memberKey })
    }
    if (
      item.coverage.ownerPersonId !== ownerPersonId ||
      item.coverage.sourceAccountId !== source.sourceAccountId ||
      Number(item.coverage.evaluationDate.slice(0, 4)) !== expectedTaxYear
    ) {
      addIssue(issues, { kind: 'foreignInventoryMember', memberKey })
    }
  }
  const canonicalInventoryCoverages = inventoryCoverages
    .map((item) => item.coverage)
    .sort(compareCoverage)
  const inventoryWithoutId = {
    predicate: inventoryInput.predicate,
    electionId: nonblankId(
      inventoryInput.electionId,
      'SEPP annual inventory election ID',
    ),
    scheduleId: nonblankId(
      inventoryInput.scheduleId,
      'SEPP annual inventory schedule ID',
    ),
    participantPersonId: personIdSchema.parse(
      inventoryInput.participantPersonId,
    ),
    sourceAccountId: accountIdSchema.parse(inventoryInput.sourceAccountId),
    taxYear: parseTaxYear(
      inventoryInput.taxYear,
      'SEPP annual inventory tax year',
    ),
    characterCoverages: canonicalInventoryCoverages,
  }
  const inventoryEvidenceId = nonblankId(
    inventoryInput.inventoryEvidenceId,
    'SEPP annual distribution-inventory evidence ID',
  )
  const expectedInventoryEvidenceId = deriveActionStructuralId(
    'owned-ira-sepp-annual-distribution-inventory',
    [inventoryWithoutId],
  )
  if (
    inventoryWithoutId.predicate !==
      'completeOwnedNonRothIraSeppAnnualDistributionInventory' ||
    inventoryWithoutId.electionId !== election.electionId ||
    inventoryWithoutId.scheduleId !== election.scheduleId ||
    inventoryWithoutId.participantPersonId !== ownerPersonId ||
    inventoryWithoutId.sourceAccountId !== source.sourceAccountId ||
    inventoryWithoutId.taxYear !== expectedTaxYear
  ) {
    addIssue(issues, { kind: 'distributionInventoryBindingMismatch' })
  }
  if (inventoryEvidenceId !== expectedInventoryEvidenceId) {
    addIssue(issues, { kind: 'distributionInventoryEvidenceIdMismatch' })
  }
  const inventory: OwnedNonRothIraSeppAnnualDistributionInventoryEvidence = {
    ...inventoryWithoutId,
    inventoryEvidenceId,
  }

  const normalizedPayments = rawPayments.map((raw) => {
    const payment = normalizedPayment(raw.currentPaymentEvidence)
    return {
      payment,
      memberKey: paymentMemberKey(payment),
    }
  }).sort((left, right) => comparePayment(left.payment, right.payment))
  const lifetimeDistributionIds = new Set(
    priorHistory.usedDistributionEvidenceIds,
  )
  addLifetimeEvidenceCollisions(issues, lifetimeDistributionIds, [
    source.accountOwnershipEvidenceId,
    source.iraClassificationEvidenceId,
    source.sourceEvidenceId,
    election.electionEvidenceId,
    annualSchedule.annualScheduleEvidenceId,
    noModification.noModificationEvidenceId,
    opening.priorHistoryTerminalStateId,
    opening.openingStateEvidenceId,
    priorHistory.terminalStateEvidenceId,
    priorHistory.priorElectionHistoryEvidenceId,
    inventory.inventoryEvidenceId,
  ])

  const inventoryByKey = new Map<string, OwnedNonRothIraPenaltyCharacterCoverageEvidence>()
  const inventoryDistributionIds = new Set<string>()
  const inventoryCoverageIds = new Set<string>()
  for (const coverage of canonicalInventoryCoverages) {
    const memberKey = coverageMemberKey(coverage)
    addLifetimeEvidenceCollisions(issues, lifetimeDistributionIds, [
      coverage.evidenceId,
      coverage.basisEvidenceId,
      coverage.line7AllocationEvidenceId,
      ...coverage.characterEvidenceIds,
      coverage.sourceEvidenceIds.accountOwnershipEvidenceId,
      coverage.sourceEvidenceIds.iraClassificationEvidenceId,
      coverage.ageThresholdEvidenceId,
    ], memberKey)
    if (inventoryByKey.has(memberKey)) {
      addIssue(issues, { kind: 'duplicateInventoryMember', memberKey })
    } else {
      inventoryByKey.set(memberKey, coverage)
    }
    const distributionId = coverage.sourceEvidenceIds.distributionDateEvidenceId
    if (inventoryDistributionIds.has(distributionId)) {
      addIssue(issues, { kind: 'duplicateDistributionEvidenceId', memberKey })
    }
    inventoryDistributionIds.add(distributionId)
    if (inventoryCoverageIds.has(coverage.evidenceId)) {
      addIssue(issues, { kind: 'duplicateInventoryMember', memberKey })
    }
    inventoryCoverageIds.add(coverage.evidenceId)
    if (priorHistory.usedDistributionEvidenceIds.includes(distributionId)) {
      addIssue(issues, { kind: 'lifetimeDistributionReplay', memberKey })
    }
  }

  const paymentByKey = new Map<string, typeof normalizedPayments[number]>()
  const paymentDistributionIds = new Set<string>()
  const paymentEvidenceIds = new Set<string>()
  for (const item of normalizedPayments) {
    addLifetimeEvidenceCollisions(issues, lifetimeDistributionIds, [
      item.payment.previousScheduleStateId,
      item.payment.paymentScheduleEvidenceId,
    ], item.memberKey)
    if (
      lifetimeDistributionIds.has(
        item.payment.currentDistributionEvidenceId,
      )
    ) {
      addIssue(issues, {
        kind: 'lifetimeDistributionReplay',
        memberKey: item.memberKey,
      })
    }
    if (
      item.payment.sourceAccountId !== source.sourceAccountId ||
      Number(item.payment.distributionDate.slice(0, 4)) !== expectedTaxYear
    ) {
      addIssue(issues, { kind: 'foreignPaymentMember', memberKey: item.memberKey })
    }
    if (paymentByKey.has(item.memberKey)) {
      addIssue(issues, { kind: 'duplicatePaymentMember', memberKey: item.memberKey })
    } else {
      paymentByKey.set(item.memberKey, item)
    }
    if (paymentDistributionIds.has(item.payment.currentDistributionEvidenceId)) {
      addIssue(issues, {
        kind: 'duplicateDistributionEvidenceId',
        memberKey: item.memberKey,
      })
    }
    paymentDistributionIds.add(item.payment.currentDistributionEvidenceId)
    if (paymentEvidenceIds.has(item.payment.paymentScheduleEvidenceId)) {
      addIssue(issues, {
        kind: 'duplicatePaymentEvidenceId',
        memberKey: item.memberKey,
      })
    }
    paymentEvidenceIds.add(item.payment.paymentScheduleEvidenceId)
  }

  for (const memberKey of inventoryByKey.keys()) {
    const payment = paymentByKey.get(memberKey)
    if (payment === undefined) {
      addIssue(issues, { kind: 'inventoryMemberWithoutPayment', memberKey })
    }
  }
  for (const memberKey of paymentByKey.keys()) {
    if (!inventoryByKey.has(memberKey)) {
      addIssue(issues, { kind: 'paymentOutsideCompleteInventory', memberKey })
    }
  }

  const reconciledPayments: OwnedNonRothIraSeppAnnualReconciledPaymentEvidence[] = []
  let scheduledTotal = 0n
  let actualTotal = 0n
  let basisTotal = 0n
  let ordinaryTotal = 0n
  let previousTerminalStateId = opening.openingStateEvidenceId
  let terminalState: Readonly<OwnedNonRothIraSeppCurrentPaymentStateEvidence> | null = null
  const usedDistributionIds: string[] = []
  const consumedPreviousStateIds = new Set<string>()
  const derivedAfterStateIds = new Set<string>()

  for (let index = 0; index < normalizedPayments.length; index += 1) {
    const item = normalizedPayments[index]!
    const coverage = inventoryByKey.get(item.memberKey)
    if (coverage === undefined) continue
    const priorHistoryWithoutId = {
      predicate: 'ownedNonRothIraSeppPriorPaymentHistory' as const,
      electionId: election.electionId,
      scheduleId: election.scheduleId,
      participantPersonId: ownerPersonId,
      sourceAccountId: source.sourceAccountId,
      taxYear: expectedTaxYear,
      openingStateEvidenceId: opening.openingStateEvidenceId,
      completedPaymentCount: index,
      usedCurrentDistributionEvidenceIds: [...usedDistributionIds].sort(),
      lastCompletedSequence: index,
      lastPaymentDate: index === 0
        ? null
        : normalizedPayments[index - 1]!.payment.distributionDate,
      terminalStateEvidenceId: previousTerminalStateId,
      scheduledGrossAmountThroughPriorPayments: asUsdCents(Number(scheduledTotal)),
      actualQualifyingGrossAmountThroughPriorPayments: asUsdCents(Number(actualTotal)),
      nextScheduledSequence: index + 1,
    }
    const expectedHistory: OwnedNonRothIraSeppPriorPaymentHistoryEvidence = {
      ...priorHistoryWithoutId,
      priorHistoryEvidenceId: deriveActionStructuralId(
        'owned-ira-sepp-prior-payment-history',
        [opening.openingStateEvidenceId, priorHistoryWithoutId],
      ),
    }
    addLifetimeEvidenceCollisions(issues, lifetimeDistributionIds, [
      expectedHistory.priorHistoryEvidenceId,
      previousTerminalStateId,
    ], item.memberKey)
    const currentResult = validateOwnedNonRothIraSeppCurrentPaymentCandidate({
      ownerPersonId,
      taxYear: expectedTaxYear,
      actionId: item.payment.actionId,
      allocationId: item.payment.allocationId,
      characterCoverage: coverage,
      sourceEvidence: source,
      electionEvidence: election,
      annualScheduleEvidence: annualSchedule,
      noModificationEvidence: noModification,
      openingStateEvidence: opening,
      priorHistoryEvidence: expectedHistory,
      currentPaymentEvidence: item.payment,
    })
    if (currentResult.status !== 'provisionalCandidate') {
      for (const paymentIssue of currentResult.issues) {
        if (paymentIssue.kind !== 'evidenceMissing') {
          addIssue(issues, {
            kind: 'paymentNotLocallyConforming',
            memberKey: item.memberKey,
            paymentIssue: paymentIssue.kind,
          })
        }
      }
      break
    }

    const candidate = currentResult.candidate
    addLifetimeEvidenceCollisions(issues, lifetimeDistributionIds, [
      candidate.beforeState.stateEvidenceId,
      candidate.afterState.stateEvidenceId,
      candidate.candidateId,
    ], item.memberKey)
    const reconciledPayment: OwnedNonRothIraSeppAnnualReconciledPaymentEvidence = {
      predicate: 'ownedNonRothIraSeppAnnualReconciledPayment',
      actionId: candidate.actionId,
      allocationId: candidate.allocationId,
      distributionDate: candidate.distributionDate,
      paymentSequence: candidate.paymentSequence,
      scheduledGrossAmount: candidate.scheduledGrossAmount,
      actualGrossAmount: candidate.actualGrossAmount,
      basisReturnExcludedAmount: candidate.basisReturnExcludedAmount,
      prospectiveOrdinaryIncomeAmount: candidate.prospectiveOrdinaryIncomeAmount,
      characterCoverageEvidenceId: candidate.characterCoverageEvidenceId,
      currentDistributionEvidenceId: candidate.currentDistributionEvidenceId,
      paymentScheduleEvidenceId: candidate.paymentScheduleEvidenceId,
      priorHistoryEvidenceId: expectedHistory.priorHistoryEvidenceId,
      beforeStateEvidenceId: candidate.beforeState.stateEvidenceId,
      afterStateEvidenceId: candidate.afterState.stateEvidenceId,
      currentPaymentCandidateId: candidate.candidateId,
    }
    if (
      consumedPreviousStateIds.has(reconciledPayment.beforeStateEvidenceId) ||
      derivedAfterStateIds.has(reconciledPayment.afterStateEvidenceId) ||
      reconciledPayment.beforeStateEvidenceId === reconciledPayment.afterStateEvidenceId
    ) {
      addIssue(issues, {
        kind: 'duplicateStateEvidenceId',
        memberKey: item.memberKey,
      })
    }
    consumedPreviousStateIds.add(reconciledPayment.beforeStateEvidenceId)
    derivedAfterStateIds.add(reconciledPayment.afterStateEvidenceId)
    reconciledPayments.push(reconciledPayment)
    scheduledTotal += BigInt(candidate.scheduledGrossAmount)
    actualTotal += BigInt(candidate.actualGrossAmount)
    basisTotal += BigInt(candidate.basisReturnExcludedAmount)
    ordinaryTotal += BigInt(candidate.prospectiveOrdinaryIncomeAmount)
    usedDistributionIds.push(candidate.currentDistributionEvidenceId)
    previousTerminalStateId = candidate.afterState.stateEvidenceId
    terminalState = candidate.afterState
  }

  const maximum = BigInt(Number.MAX_SAFE_INTEGER)
  if (
    scheduledTotal > maximum ||
    actualTotal > maximum ||
    basisTotal > maximum ||
    ordinaryTotal > maximum ||
    normalizedPayments.length > Number.MAX_SAFE_INTEGER
  ) {
    addIssue(issues, { kind: 'safeIntegerOverflow' })
  }
  const annualAmount = BigInt(annualSchedule.annualScheduledGrossAmount)
  if (scheduledTotal < annualAmount) {
    addIssue(issues, { kind: 'terminalScheduledGrossIncomplete' })
  } else if (scheduledTotal > annualAmount) {
    addIssue(issues, { kind: 'terminalScheduledGrossExceeded' })
  }
  if (actualTotal < annualAmount) {
    addIssue(issues, { kind: 'terminalActualGrossIncomplete' })
  } else if (actualTotal > annualAmount) {
    addIssue(issues, { kind: 'terminalActualGrossExceeded' })
  }
  if (scheduledTotal !== actualTotal) {
    addIssue(issues, { kind: 'terminalGrossMismatch' })
  }

  if (issues.length > 0) {
    return failedResult(issues as [
      OwnedNonRothIraSeppAnnualReconciliationIssue,
      ...OwnedNonRothIraSeppAnnualReconciliationIssue[],
    ])
  }
  if (terminalState === null) {
    throw new Error('A complete SEPP annual reconciliation lost its terminal state')
  }

  const reconciledScheduledGrossAmount = asUsdCents(Number(scheduledTotal))
  const reconciledActualGrossAmount = asUsdCents(Number(actualTotal))
  const basisReturnExcludedAmount = asUsdCents(Number(basisTotal))
  const prospectiveOrdinaryIncomeAmount = asUsdCents(Number(ordinaryTotal))
  const evidenceWithoutId = {
    predicate: 'completeOwnedNonRothIraSeppAnnualReconciliation' as const,
    electionId: election.electionId,
    scheduleId: election.scheduleId,
    participantPersonId: ownerPersonId,
    sourceAccountId: source.sourceAccountId,
    subtype: source.subtype,
    taxYear: expectedTaxYear,
    annualScheduledGrossAmount: annualSchedule.annualScheduledGrossAmount,
    reconciledScheduledGrossAmount,
    reconciledActualGrossAmount,
    basisReturnExcludedAmount,
    prospectiveOrdinaryIncomeAmount,
    paymentCount: reconciledPayments.length,
    sourceEvidenceId: source.sourceEvidenceId,
    electionEvidenceId: election.electionEvidenceId,
    annualScheduleEvidenceId: annualSchedule.annualScheduleEvidenceId,
    noModificationEvidenceId: noModification.noModificationEvidenceId,
    priorElectionHistoryEvidenceId:
      priorHistory.priorElectionHistoryEvidenceId,
    priorHistoryTerminalStateId: opening.priorHistoryTerminalStateId,
    openingStateEvidenceId: opening.openingStateEvidenceId,
    distributionInventory: inventory,
    payments: reconciledPayments,
    terminalState,
  }
  // Rebuild caller-owned lineage into exact plain shapes before hashing. The
  // fields have already passed the current-payment validator for every member;
  // copying them here excludes extra keys, custom serialization hooks, and
  // caller property order from the structural identity.
  const commonLineage = {
    sourceEvidence: {
      predicate: source.predicate,
      sourceAccountId: source.sourceAccountId,
      ownerPersonId: source.ownerPersonId,
      accountType: source.accountType,
      accountKind: source.accountKind,
      inheritanceStatus: source.inheritanceStatus,
      subtype: source.subtype,
      accountOwnershipEvidenceId: source.accountOwnershipEvidenceId,
      iraClassificationEvidenceId: source.iraClassificationEvidenceId,
      sourceEvidenceId: source.sourceEvidenceId,
    },
    electionEvidence: {
      predicate: election.predicate,
      electionId: election.electionId,
      scheduleId: election.scheduleId,
      participantPersonId: election.participantPersonId,
      sourceAccountId: election.sourceAccountId,
      subtype: election.subtype,
      electionStartDate: election.electionStartDate,
      method: election.method,
      electionEvidenceId: election.electionEvidenceId,
    },
    annualScheduleEvidence: {
      predicate: annualSchedule.predicate,
      electionId: annualSchedule.electionId,
      scheduleId: annualSchedule.scheduleId,
      participantPersonId: annualSchedule.participantPersonId,
      sourceAccountId: annualSchedule.sourceAccountId,
      taxYear: annualSchedule.taxYear,
      annualScheduledGrossAmount:
        annualSchedule.annualScheduledGrossAmount,
      annualScheduleEvidenceId: annualSchedule.annualScheduleEvidenceId,
    },
    noModificationEvidence: {
      predicate: noModification.predicate,
      electionId: noModification.electionId,
      scheduleId: noModification.scheduleId,
      participantPersonId: noModification.participantPersonId,
      sourceAccountId: noModification.sourceAccountId,
      throughDate: noModification.throughDate,
      disqualifyingModification:
        noModification.disqualifyingModification,
      noModificationEvidenceId: noModification.noModificationEvidenceId,
    },
    openingStateEvidence: {
      predicate: opening.predicate,
      electionId: opening.electionId,
      scheduleId: opening.scheduleId,
      participantPersonId: opening.participantPersonId,
      sourceAccountId: opening.sourceAccountId,
      taxYear: opening.taxYear,
      priorHistoryTerminalStateId: opening.priorHistoryTerminalStateId,
      nextScheduledSequence: opening.nextScheduledSequence,
      scheduledGrossAmount: opening.scheduledGrossAmount,
      actualQualifyingGrossAmount: opening.actualQualifyingGrossAmount,
      openingStateEvidenceId: opening.openingStateEvidenceId,
    },
    priorElectionHistoryEvidence: priorHistory,
  }
  const annualReconciliationId = deriveActionStructuralId(
    'owned-ira-sepp-annual-reconciliation',
    [commonLineage, inventory, normalizedPayments, evidenceWithoutId],
  )
  if (lifetimeDistributionIds.has(annualReconciliationId)) {
    return failedResult([{ kind: 'lifetimeEvidenceIdCollision' }])
  }
  const evidence: CompleteOwnedNonRothIraSeppAnnualReconciliationEvidence = {
    ...evidenceWithoutId,
    annualReconciliationId,
  }
  return deepFreeze({
    ...resultFlags,
    status: 'reconciled',
    reconciliation: 'complete',
    issues: [],
    evidence,
  })
}
