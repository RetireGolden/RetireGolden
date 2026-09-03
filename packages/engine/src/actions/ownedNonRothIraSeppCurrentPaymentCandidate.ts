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
import { deriveActionStructuralId } from './structuralId.js'
import type {
  OwnedNonRothIraPenaltyCharacterCoverageEvidence,
} from './ownedNonRothIraPenaltyPrerequisite.js'
import type {
  OwnedNonRothIraSubtype,
} from './ownedNonRothIraWithdrawalCharacter.js'
import { deepFreeze } from './freeze.js'

export type OwnedNonRothIraSeppMethod =
  | 'requiredMinimumDistribution'
  | 'fixedAmortization'
  | 'fixedAnnuitization'

export interface OwnedNonRothIraSeppSourceEvidence {
  predicate: 'ownedNonRothIraSeppSource'
  sourceAccountId: AccountId
  ownerPersonId: PersonId
  accountType: 'traditional'
  accountKind: 'ira'
  inheritanceStatus: 'owned'
  subtype: OwnedNonRothIraSubtype
  accountOwnershipEvidenceId: string
  iraClassificationEvidenceId: string
  sourceEvidenceId: string
}

export interface OwnedNonRothIraSeppElectionEvidence {
  predicate: 'ownedNonRothIraSeppElection'
  electionId: string
  scheduleId: string
  participantPersonId: PersonId
  sourceAccountId: AccountId
  subtype: OwnedNonRothIraSubtype
  electionStartDate: string
  method: OwnedNonRothIraSeppMethod
  electionEvidenceId: string
}

export interface OwnedNonRothIraSeppAnnualScheduleEvidence {
  predicate: 'ownedNonRothIraSeppAnnualSchedule'
  electionId: string
  scheduleId: string
  participantPersonId: PersonId
  sourceAccountId: AccountId
  taxYear: number
  annualScheduledGrossAmount: UsdCents
  annualScheduleEvidenceId: string
}

export interface OwnedNonRothIraSeppNoModificationEvidence {
  predicate: 'noDisqualifyingOwnedNonRothIraSeppModificationThroughDate'
  electionId: string
  scheduleId: string
  participantPersonId: PersonId
  sourceAccountId: AccountId
  throughDate: string
  disqualifyingModification: 'none'
  noModificationEvidenceId: string
}

export interface OwnedNonRothIraSeppAnnualOpeningStateEvidence {
  predicate: 'ownedNonRothIraSeppAnnualOpeningState'
  electionId: string
  scheduleId: string
  participantPersonId: PersonId
  sourceAccountId: AccountId
  taxYear: number
  priorHistoryTerminalStateId: string
  nextScheduledSequence: 1
  scheduledGrossAmount: 0
  actualQualifyingGrossAmount: 0
  openingStateEvidenceId: string
}

export interface OwnedNonRothIraSeppPriorPaymentHistoryEvidence {
  predicate: 'ownedNonRothIraSeppPriorPaymentHistory'
  electionId: string
  scheduleId: string
  participantPersonId: PersonId
  sourceAccountId: AccountId
  taxYear: number
  openingStateEvidenceId: string
  completedPaymentCount: number
  usedCurrentDistributionEvidenceIds: readonly string[]
  lastCompletedSequence: number
  lastPaymentDate: string | null
  terminalStateEvidenceId?: string
  scheduledGrossAmountThroughPriorPayments: UsdCents
  actualQualifyingGrossAmountThroughPriorPayments: UsdCents
  nextScheduledSequence: number
  priorHistoryEvidenceId: string
}

export type OwnedNonRothIraSeppPriorPaymentHistoryWithoutId = Omit<
  OwnedNonRothIraSeppPriorPaymentHistoryEvidence,
  'priorHistoryEvidenceId' | 'terminalStateEvidenceId'
> & { terminalStateEvidenceId: string }

export interface OwnedNonRothIraSeppCurrentPaymentEvidence {
  predicate: 'ownedNonRothIraSeppCurrentScheduledPayment'
  electionId: string
  scheduleId: string
  actionId: ActionId
  allocationId: AllocationId
  sourceAccountId: AccountId
  distributionDate: string
  currentDistributionEvidenceId: string
  paymentSequence: number
  previousScheduleStateId: string
  currentScheduledGrossAmount: UsdCents
  paymentScheduleEvidenceId: string
}

export interface ValidateOwnedNonRothIraSeppCurrentPaymentCandidateInput {
  ownerPersonId: PersonId
  taxYear: number
  actionId: ActionId
  allocationId: AllocationId
  characterCoverage?:
    Readonly<OwnedNonRothIraPenaltyCharacterCoverageEvidence>
  sourceEvidence?: Readonly<OwnedNonRothIraSeppSourceEvidence>
  electionEvidence?: Readonly<OwnedNonRothIraSeppElectionEvidence>
  annualScheduleEvidence?:
    Readonly<OwnedNonRothIraSeppAnnualScheduleEvidence>
  noModificationEvidence?:
    Readonly<OwnedNonRothIraSeppNoModificationEvidence>
  openingStateEvidence?:
    Readonly<OwnedNonRothIraSeppAnnualOpeningStateEvidence>
  priorHistoryEvidence?:
    Readonly<OwnedNonRothIraSeppPriorPaymentHistoryEvidence>
  currentPaymentEvidence?:
    Readonly<OwnedNonRothIraSeppCurrentPaymentEvidence>
}

export type OwnedNonRothIraSeppMissingEvidenceName =
  | 'characterCoverage'
  | 'sourceEvidence'
  | 'electionEvidence'
  | 'annualScheduleEvidence'
  | 'noModificationEvidence'
  | 'openingStateEvidence'
  | 'priorHistoryEvidence'
  | 'currentPaymentEvidence'

export interface OwnedNonRothIraSeppEvidenceMissingIssue {
  kind: 'evidenceMissing'
  evidence: OwnedNonRothIraSeppMissingEvidenceName
}

export type OwnedNonRothIraSeppNonconformanceKind =
  | 'canonicalBindingMismatch'
  | 'sourceNotOwnedNonRothIra'
  | 'electionBindingMismatch'
  | 'unsupportedMethod'
  | 'electionStartsAfterDistribution'
  | 'annualScheduleBindingMismatch'
  | 'modificationEvidenceInsufficient'
  | 'openingStateBindingMismatch'
  | 'priorHistoryBindingMismatch'
  | 'paymentSequenceNotContiguous'
  | 'paymentDateBreaksContinuity'
  | 'previousStateMismatch'
  | 'currentDistributionReplay'
  | 'currentGrossMismatch'
  | 'grossChainInvalid'
  | 'annualScheduledAmountExceeded'
  | 'safeIntegerOverflow'

export interface OwnedNonRothIraSeppNonconformanceIssue {
  kind: OwnedNonRothIraSeppNonconformanceKind
}

interface OwnedNonRothIraSeppCurrentPaymentResultBase {
  qualification: 'pendingAnnualReconciliation'
  movement: 'notCommitted'
  actionability: 'notEstablished'
  penaltyTreatment: 'notEstablished'
}

export interface OwnedNonRothIraSeppEvidenceMissingResult
  extends OwnedNonRothIraSeppCurrentPaymentResultBase {
  status: 'evidenceMissing'
  issues:
    readonly [
      Readonly<OwnedNonRothIraSeppEvidenceMissingIssue>,
      ...Readonly<OwnedNonRothIraSeppEvidenceMissingIssue>[],
    ]
  candidate: null
}

export interface OwnedNonRothIraSeppNotLocallyConformingResult
  extends OwnedNonRothIraSeppCurrentPaymentResultBase {
  status: 'notLocallyConforming'
  issues:
    readonly [
      Readonly<OwnedNonRothIraSeppNonconformanceIssue>,
      ...Readonly<OwnedNonRothIraSeppNonconformanceIssue>[],
    ]
  candidate: null
}

export interface OwnedNonRothIraSeppCurrentPaymentStateEvidence {
  predicate: 'ownedNonRothIraSeppCurrentPaymentState'
  electionId: string
  scheduleId: string
  participantPersonId: PersonId
  sourceAccountId: AccountId
  taxYear: number
  completedPaymentCount: number
  lastCompletedSequence: number
  lastPaymentDate: string | null
  nextScheduledSequence: number
  scheduledGrossAmount: UsdCents
  actualQualifyingGrossAmount: UsdCents
  stateEvidenceId: string
}

export interface OwnedNonRothIraSeppCurrentPaymentCandidateEvidence {
  predicate: 'ownedNonRothIraSeppCurrentPaymentCandidate'
  ownerPersonId: PersonId
  taxYear: number
  actionId: ActionId
  allocationId: AllocationId
  sourceAccountId: AccountId
  subtype: OwnedNonRothIraSubtype
  distributionDate: string
  paymentSequence: number
  scheduledGrossAmount: UsdCents
  actualGrossAmount: UsdCents
  basisReturnExcludedAmount: UsdCents
  prospectiveOrdinaryIncomeAmount: UsdCents
  characterCoverageEvidenceId: string
  currentDistributionEvidenceId: string
  sourceEvidenceId: string
  electionEvidenceId: string
  annualScheduleEvidenceId: string
  noModificationEvidenceId: string
  priorHistoryTerminalStateId: string
  openingStateEvidenceId: string
  priorHistoryEvidenceId: string
  paymentScheduleEvidenceId: string
  beforeState: Readonly<OwnedNonRothIraSeppCurrentPaymentStateEvidence>
  afterState: Readonly<OwnedNonRothIraSeppCurrentPaymentStateEvidence>
  candidateId: string
}

export interface OwnedNonRothIraSeppProvisionalCandidateResult
  extends OwnedNonRothIraSeppCurrentPaymentResultBase {
  status: 'provisionalCandidate'
  candidate:
    Readonly<OwnedNonRothIraSeppCurrentPaymentCandidateEvidence>
}

export type ValidateOwnedNonRothIraSeppCurrentPaymentCandidateResult =
  | OwnedNonRothIraSeppEvidenceMissingResult
  | OwnedNonRothIraSeppNotLocallyConformingResult
  | OwnedNonRothIraSeppProvisionalCandidateResult

const resultFlags: OwnedNonRothIraSeppCurrentPaymentResultBase = {
  qualification: 'pendingAnnualReconciliation',
  movement: 'notCommitted',
  actionability: 'notEstablished',
  penaltyTreatment: 'notEstablished',
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

function taxYear(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < 1 || value > 9999) {
    throw new RangeError(`${label} must be a four-digit year`)
  }
  return value
}

function nonnegativeInteger(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${label} must be a nonnegative safe integer`)
  }
  return value
}

function positiveInteger(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new RangeError(`${label} must be a positive safe integer`)
  }
  return value
}

function subtype(value: unknown): OwnedNonRothIraSubtype {
  if (value !== 'traditional' && value !== 'sep' && value !== 'simple') {
    throw new RangeError('SEPP source subtype must be traditional, SEP, or SIMPLE')
  }
  return value
}

function canonicalPriorPaymentHistoryWithoutId(
  input: Readonly<Omit<
    OwnedNonRothIraSeppPriorPaymentHistoryEvidence,
    'priorHistoryEvidenceId'
  >>,
  terminalStateEvidenceId: string,
): OwnedNonRothIraSeppPriorPaymentHistoryWithoutId {
  const usedCurrentDistributionEvidenceIds =
    input.usedCurrentDistributionEvidenceIds.map(
      (evidenceId) => nonblankId(
        evidenceId,
        'Prior SEPP used distribution evidence ID',
      ),
    ).sort()
  if (
    new Set(usedCurrentDistributionEvidenceIds).size !==
      usedCurrentDistributionEvidenceIds.length
  ) {
    throw new RangeError(
      'Prior SEPP used distribution evidence IDs must be unique',
    )
  }
  return {
    predicate: input.predicate,
    electionId: nonblankId(input.electionId, 'Prior SEPP election ID'),
    scheduleId: nonblankId(input.scheduleId, 'Prior SEPP schedule ID'),
    participantPersonId: personIdSchema.parse(input.participantPersonId),
    sourceAccountId: accountIdSchema.parse(input.sourceAccountId),
    taxYear: taxYear(input.taxYear, 'Prior SEPP history tax year'),
    openingStateEvidenceId: nonblankId(
      input.openingStateEvidenceId,
      'Prior SEPP opening-state evidence ID',
    ),
    completedPaymentCount: nonnegativeInteger(
      input.completedPaymentCount,
      'Prior SEPP completed-payment count',
    ),
    usedCurrentDistributionEvidenceIds,
    lastCompletedSequence: nonnegativeInteger(
      input.lastCompletedSequence,
      'Prior SEPP last-completed sequence',
    ),
    lastPaymentDate: input.lastPaymentDate === null
      ? null
      : civilDate(input.lastPaymentDate, 'Prior SEPP payment date'),
    terminalStateEvidenceId: nonblankId(
      terminalStateEvidenceId,
      'Prior SEPP terminal-state evidence ID',
    ),
    scheduledGrossAmountThroughPriorPayments: usdCentsSchema.parse(
      input.scheduledGrossAmountThroughPriorPayments,
    ),
    actualQualifyingGrossAmountThroughPriorPayments: usdCentsSchema.parse(
      input.actualQualifyingGrossAmountThroughPriorPayments,
    ),
    nextScheduledSequence: positiveInteger(
      input.nextScheduledSequence,
      'Prior SEPP next sequence',
    ),
  }
}

/** Build canonical populated current-year SEPP payment-history evidence. */
export function buildOwnedNonRothIraSeppPriorPaymentHistoryEvidence(
  input: Readonly<OwnedNonRothIraSeppPriorPaymentHistoryWithoutId>,
): Readonly<OwnedNonRothIraSeppPriorPaymentHistoryEvidence> {
  if (input.predicate !== 'ownedNonRothIraSeppPriorPaymentHistory') {
    throw new RangeError('Prior SEPP history predicate is not canonical')
  }
  const canonicalHistoryWithoutId = canonicalPriorPaymentHistoryWithoutId(
    input,
    input.terminalStateEvidenceId,
  )
  return deepFreeze({
    ...canonicalHistoryWithoutId,
    priorHistoryEvidenceId: deriveActionStructuralId(
      'owned-ira-sepp-prior-payment-history',
      [
        canonicalHistoryWithoutId.openingStateEvidenceId,
        canonicalHistoryWithoutId,
      ],
    ),
  })
}

function addIssue(
  issues: OwnedNonRothIraSeppNonconformanceIssue[],
  kind: OwnedNonRothIraSeppNonconformanceKind,
  condition: boolean,
): void {
  if (condition && !issues.some((issue) => issue.kind === kind)) {
    issues.push({ kind })
  }
}

/**
 * Validates one locally coherent current SEPP payment transition.
 *
 * The result is intentionally provisional. It cannot establish SEPP
 * qualification or penalty treatment, and no penalty/finalization/coordinator
 * API consumes it. Complete annual reconciliation must revalidate raw payment
 * facts and reject forks, replays, omissions, duplicates, and extra members.
 */
export function validateOwnedNonRothIraSeppCurrentPaymentCandidate(
  input: Readonly<ValidateOwnedNonRothIraSeppCurrentPaymentCandidateInput>,
): Readonly<ValidateOwnedNonRothIraSeppCurrentPaymentCandidateResult> {
  const missingNames: OwnedNonRothIraSeppMissingEvidenceName[] = []
  const required = [
    ['characterCoverage', input.characterCoverage],
    ['sourceEvidence', input.sourceEvidence],
    ['electionEvidence', input.electionEvidence],
    ['annualScheduleEvidence', input.annualScheduleEvidence],
    ['noModificationEvidence', input.noModificationEvidence],
    ['openingStateEvidence', input.openingStateEvidence],
    ['priorHistoryEvidence', input.priorHistoryEvidence],
    ['currentPaymentEvidence', input.currentPaymentEvidence],
  ] as const
  for (const [name, evidence] of required) {
    if (evidence === undefined) missingNames.push(name)
  }
  if (missingNames.length > 0) {
    return deepFreeze({
      ...resultFlags,
      status: 'evidenceMissing',
      issues: missingNames.map((evidence) => ({
        kind: 'evidenceMissing' as const,
        evidence,
      })) as [
        OwnedNonRothIraSeppEvidenceMissingIssue,
        ...OwnedNonRothIraSeppEvidenceMissingIssue[],
      ],
      candidate: null,
    })
  }

  const ownerPersonId = personIdSchema.parse(input.ownerPersonId)
  const expectedTaxYear = taxYear(input.taxYear, 'SEPP candidate tax year')
  const actionId = actionIdSchema.parse(input.actionId)
  const allocationId = allocationIdSchema.parse(input.allocationId)
  const coverageInput = input.characterCoverage!
  const sourceInput = input.sourceEvidence!
  const electionInput = input.electionEvidence!
  const annualInput = input.annualScheduleEvidence!
  const modificationInput = input.noModificationEvidence!
  const openingInput = input.openingStateEvidence!
  const historyInput = input.priorHistoryEvidence!
  const paymentInput = input.currentPaymentEvidence!

  const source: OwnedNonRothIraSeppSourceEvidence = {
    predicate: sourceInput.predicate,
    sourceAccountId: accountIdSchema.parse(sourceInput.sourceAccountId),
    ownerPersonId: personIdSchema.parse(sourceInput.ownerPersonId),
    accountType: sourceInput.accountType,
    accountKind: sourceInput.accountKind,
    inheritanceStatus: sourceInput.inheritanceStatus,
    subtype: subtype(sourceInput.subtype),
    accountOwnershipEvidenceId: nonblankId(
      sourceInput.accountOwnershipEvidenceId,
      'SEPP source ownership evidence ID',
    ),
    iraClassificationEvidenceId: nonblankId(
      sourceInput.iraClassificationEvidenceId,
      'SEPP source classification evidence ID',
    ),
    sourceEvidenceId: nonblankId(
      sourceInput.sourceEvidenceId,
      'SEPP source evidence ID',
    ),
  }
  const election: OwnedNonRothIraSeppElectionEvidence = {
    predicate: electionInput.predicate,
    electionId: nonblankId(electionInput.electionId, 'SEPP election ID'),
    scheduleId: nonblankId(electionInput.scheduleId, 'SEPP schedule ID'),
    participantPersonId: personIdSchema.parse(
      electionInput.participantPersonId,
    ),
    sourceAccountId: accountIdSchema.parse(electionInput.sourceAccountId),
    subtype: subtype(electionInput.subtype),
    electionStartDate: civilDate(
      electionInput.electionStartDate,
      'SEPP election start date',
    ),
    method: electionInput.method,
    electionEvidenceId: nonblankId(
      electionInput.electionEvidenceId,
      'SEPP election evidence ID',
    ),
  }
  const annualSchedule: OwnedNonRothIraSeppAnnualScheduleEvidence = {
    predicate: annualInput.predicate,
    electionId: nonblankId(annualInput.electionId, 'Annual SEPP election ID'),
    scheduleId: nonblankId(annualInput.scheduleId, 'Annual SEPP schedule ID'),
    participantPersonId: personIdSchema.parse(
      annualInput.participantPersonId,
    ),
    sourceAccountId: accountIdSchema.parse(annualInput.sourceAccountId),
    taxYear: taxYear(annualInput.taxYear, 'Annual SEPP schedule tax year'),
    annualScheduledGrossAmount: positiveUsdCentsSchema.parse(
      annualInput.annualScheduledGrossAmount,
    ),
    annualScheduleEvidenceId: nonblankId(
      annualInput.annualScheduleEvidenceId,
      'Annual SEPP schedule evidence ID',
    ),
  }
  const noModification: OwnedNonRothIraSeppNoModificationEvidence = {
    predicate: modificationInput.predicate,
    electionId: nonblankId(
      modificationInput.electionId,
      'SEPP no-modification election ID',
    ),
    scheduleId: nonblankId(
      modificationInput.scheduleId,
      'SEPP no-modification schedule ID',
    ),
    participantPersonId: personIdSchema.parse(
      modificationInput.participantPersonId,
    ),
    sourceAccountId: accountIdSchema.parse(
      modificationInput.sourceAccountId,
    ),
    throughDate: civilDate(
      modificationInput.throughDate,
      'SEPP no-modification through date',
    ),
    disqualifyingModification:
      modificationInput.disqualifyingModification,
    noModificationEvidenceId: nonblankId(
      modificationInput.noModificationEvidenceId,
      'SEPP no-modification evidence ID',
    ),
  }
  const opening: OwnedNonRothIraSeppAnnualOpeningStateEvidence = {
    predicate: openingInput.predicate,
    electionId: nonblankId(openingInput.electionId, 'Opening SEPP election ID'),
    scheduleId: nonblankId(openingInput.scheduleId, 'Opening SEPP schedule ID'),
    participantPersonId: personIdSchema.parse(
      openingInput.participantPersonId,
    ),
    sourceAccountId: accountIdSchema.parse(openingInput.sourceAccountId),
    taxYear: taxYear(openingInput.taxYear, 'Opening SEPP state tax year'),
    priorHistoryTerminalStateId: nonblankId(
      openingInput.priorHistoryTerminalStateId,
      'Opening SEPP prior-history terminal-state ID',
    ),
    nextScheduledSequence: openingInput.nextScheduledSequence,
    scheduledGrossAmount: openingInput.scheduledGrossAmount,
    actualQualifyingGrossAmount:
      openingInput.actualQualifyingGrossAmount,
    openingStateEvidenceId: nonblankId(
      openingInput.openingStateEvidenceId,
      'Opening SEPP state evidence ID',
    ),
  }
  const hasExplicitTerminalState =
    historyInput.terminalStateEvidenceId !== undefined
  const canonicalHistoryWithoutId = canonicalPriorPaymentHistoryWithoutId(
    historyInput,
    hasExplicitTerminalState
      ? historyInput.terminalStateEvidenceId!
      : opening.openingStateEvidenceId,
  )
  const history: OwnedNonRothIraSeppPriorPaymentHistoryEvidence & {
    terminalStateEvidenceId: string
  } = {
    ...canonicalHistoryWithoutId,
    priorHistoryEvidenceId: nonblankId(
      historyInput.priorHistoryEvidenceId,
      'Prior SEPP history evidence ID',
    ),
  }
  const payment: OwnedNonRothIraSeppCurrentPaymentEvidence = {
    predicate: paymentInput.predicate,
    electionId: nonblankId(paymentInput.electionId, 'Current SEPP election ID'),
    scheduleId: nonblankId(paymentInput.scheduleId, 'Current SEPP schedule ID'),
    actionId: actionIdSchema.parse(paymentInput.actionId),
    allocationId: allocationIdSchema.parse(paymentInput.allocationId),
    sourceAccountId: accountIdSchema.parse(paymentInput.sourceAccountId),
    distributionDate: civilDate(
      paymentInput.distributionDate,
      'Current SEPP distribution date',
    ),
    currentDistributionEvidenceId: nonblankId(
      paymentInput.currentDistributionEvidenceId,
      'Current SEPP distribution-date evidence ID',
    ),
    paymentSequence: positiveInteger(
      paymentInput.paymentSequence,
      'Current SEPP payment sequence',
    ),
    previousScheduleStateId: nonblankId(
      paymentInput.previousScheduleStateId,
      'Current SEPP previous schedule-state ID',
    ),
    currentScheduledGrossAmount: positiveUsdCentsSchema.parse(
      paymentInput.currentScheduledGrossAmount,
    ),
    paymentScheduleEvidenceId: nonblankId(
      paymentInput.paymentScheduleEvidenceId,
      'Current SEPP payment-schedule evidence ID',
    ),
  }
  const characterEvidenceIds = coverageInput.characterEvidenceIds.map(
    (evidenceId) => nonblankId(
      evidenceId,
      'SEPP character-segment evidence ID',
    ),
  )
  if (
    characterEvidenceIds.length === 0 ||
    new Set(characterEvidenceIds).size !== characterEvidenceIds.length
  ) {
    throw new RangeError(
      'SEPP character coverage requires unique character evidence',
    )
  }
  const coverage: OwnedNonRothIraPenaltyCharacterCoverageEvidence = {
    predicate: coverageInput.predicate,
    actionId: actionIdSchema.parse(coverageInput.actionId),
    allocationId: allocationIdSchema.parse(coverageInput.allocationId),
    sourceAccountId: accountIdSchema.parse(
      coverageInput.sourceAccountId,
    ),
    ownerPersonId: personIdSchema.parse(coverageInput.ownerPersonId),
    subtype: subtype(coverageInput.subtype),
    evaluationDate: civilDate(
      coverageInput.evaluationDate,
      'SEPP character-coverage evaluation date',
    ),
    executedAmount: positiveUsdCentsSchema.parse(
      coverageInput.executedAmount,
    ),
    basisReturnExcludedAmount: usdCentsSchema.parse(
      coverageInput.basisReturnExcludedAmount,
    ),
    ordinaryIncomeExposureAmount: usdCentsSchema.parse(
      coverageInput.ordinaryIncomeExposureAmount,
    ),
    basisEvidenceId: nonblankId(
      coverageInput.basisEvidenceId,
      'SEPP character-coverage basis evidence ID',
    ),
    line7AllocationEvidenceId: nonblankId(
      coverageInput.line7AllocationEvidenceId,
      'SEPP line-7 allocation evidence ID',
    ),
    characterEvidenceIds,
    sourceEvidenceIds: {
      distributionDateEvidenceId: nonblankId(
        coverageInput.sourceEvidenceIds.distributionDateEvidenceId,
        'SEPP coverage distribution-date evidence ID',
      ),
      accountOwnershipEvidenceId: nonblankId(
        coverageInput.sourceEvidenceIds.accountOwnershipEvidenceId,
        'SEPP coverage ownership evidence ID',
      ),
      iraClassificationEvidenceId: nonblankId(
        coverageInput.sourceEvidenceIds.iraClassificationEvidenceId,
        'SEPP coverage classification evidence ID',
      ),
    },
    ageThresholdEvidenceId: nonblankId(
      coverageInput.ageThresholdEvidenceId,
      'SEPP coverage age-threshold evidence ID',
    ),
    evidenceId: nonblankId(
      coverageInput.evidenceId,
      'SEPP character-coverage evidence ID',
    ),
  }

  const evidenceIds = [
    coverage.evidenceId,
    payment.currentDistributionEvidenceId,
    source.sourceEvidenceId,
    election.electionEvidenceId,
    annualSchedule.annualScheduleEvidenceId,
    noModification.noModificationEvidenceId,
    opening.priorHistoryTerminalStateId,
    opening.openingStateEvidenceId,
    history.priorHistoryEvidenceId,
    payment.paymentScheduleEvidenceId,
    ...history.terminalStateEvidenceId === opening.openingStateEvidenceId
      ? []
      : [history.terminalStateEvidenceId],
    ...history.usedCurrentDistributionEvidenceIds.filter(
      (evidenceId) =>
        evidenceId !== payment.currentDistributionEvidenceId,
    ),
  ]
  if (new Set(evidenceIds).size !== evidenceIds.length) {
    throw new RangeError('SEPP evidence IDs must not be reused across evidence kinds')
  }

  const issues: OwnedNonRothIraSeppNonconformanceIssue[] = []
  const coverageYear = Number(coverage.evaluationDate.slice(0, 4))
  const canonicalCoverageSourceEvidence = {
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
  const expectedCharacterCoverageEvidenceId = legacyJsonId(
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
      canonicalCoverageSourceEvidence,
      coverage.ageThresholdEvidenceId,
    ],
  )
  addIssue(issues, 'canonicalBindingMismatch',
    coverage.predicate !==
      'completeOwnedNonRothIraPenaltyCharacterCoverageForAllocation' ||
    coverage.ownerPersonId !== ownerPersonId ||
    coverage.actionId !== actionId ||
    coverage.allocationId !== allocationId ||
    coverageYear !== expectedTaxYear ||
    coverage.evidenceId !== expectedCharacterCoverageEvidenceId ||
    BigInt(coverage.basisReturnExcludedAmount) +
      BigInt(coverage.ordinaryIncomeExposureAmount) !==
      BigInt(coverage.executedAmount))
  addIssue(issues, 'sourceNotOwnedNonRothIra',
    source.predicate !== 'ownedNonRothIraSeppSource' ||
    source.ownerPersonId !== ownerPersonId ||
    source.accountType !== 'traditional' ||
    source.accountKind !== 'ira' ||
    source.inheritanceStatus !== 'owned' ||
    source.sourceAccountId !== coverage.sourceAccountId ||
    source.subtype !== coverage.subtype ||
    source.accountOwnershipEvidenceId !==
      coverage.sourceEvidenceIds.accountOwnershipEvidenceId ||
    source.iraClassificationEvidenceId !==
      coverage.sourceEvidenceIds.iraClassificationEvidenceId)
  const supportedMethod =
    election.method === 'requiredMinimumDistribution' ||
    election.method === 'fixedAmortization' ||
    election.method === 'fixedAnnuitization'
  addIssue(issues, 'unsupportedMethod', !supportedMethod)
  addIssue(issues, 'electionBindingMismatch',
    election.predicate !== 'ownedNonRothIraSeppElection' ||
    election.participantPersonId !== ownerPersonId ||
    election.sourceAccountId !== source.sourceAccountId ||
    election.subtype !== source.subtype)
  addIssue(issues, 'electionStartsAfterDistribution',
    election.electionStartDate > payment.distributionDate)
  const sharedBindingMismatch = (
    evidence: Readonly<{
      electionId: string
      scheduleId: string
      participantPersonId: PersonId
      sourceAccountId: AccountId
    }>,
  ): boolean =>
    evidence.electionId !== election.electionId ||
    evidence.scheduleId !== election.scheduleId ||
    evidence.participantPersonId !== ownerPersonId ||
    evidence.sourceAccountId !== source.sourceAccountId
  addIssue(issues, 'annualScheduleBindingMismatch',
    annualSchedule.predicate !== 'ownedNonRothIraSeppAnnualSchedule' ||
    sharedBindingMismatch(annualSchedule) ||
    annualSchedule.taxYear !== expectedTaxYear)
  addIssue(issues, 'modificationEvidenceInsufficient',
    noModification.predicate !==
      'noDisqualifyingOwnedNonRothIraSeppModificationThroughDate' ||
    sharedBindingMismatch(noModification) ||
    noModification.disqualifyingModification !== 'none' ||
    noModification.throughDate < payment.distributionDate)
  const openingStateLineage = {
    predicate: opening.predicate,
    electionId: opening.electionId,
    scheduleId: opening.scheduleId,
    participantPersonId: opening.participantPersonId,
    sourceAccountId: opening.sourceAccountId,
    taxYear: opening.taxYear,
    priorHistoryTerminalStateId:
      opening.priorHistoryTerminalStateId,
    nextScheduledSequence: opening.nextScheduledSequence,
    scheduledGrossAmount: opening.scheduledGrossAmount,
    actualQualifyingGrossAmount:
      opening.actualQualifyingGrossAmount,
  }
  const expectedOpeningStateEvidenceId = legacyJsonId(
    'owned-ira-sepp-annual-opening-state',
    [openingStateLineage],
  )
  addIssue(issues, 'openingStateBindingMismatch',
    opening.predicate !== 'ownedNonRothIraSeppAnnualOpeningState' ||
    sharedBindingMismatch(opening) ||
    opening.taxYear !== expectedTaxYear ||
    opening.nextScheduledSequence !== 1 ||
    opening.scheduledGrossAmount !== 0 ||
    opening.actualQualifyingGrossAmount !== 0 ||
    opening.openingStateEvidenceId !== expectedOpeningStateEvidenceId)
  const emptyHistoryMismatch = history.completedPaymentCount === 0 && (
    history.lastCompletedSequence !== 0 ||
    history.lastPaymentDate !== null ||
    history.scheduledGrossAmountThroughPriorPayments !== 0 ||
    history.actualQualifyingGrossAmountThroughPriorPayments !== 0 ||
    history.terminalStateEvidenceId !== opening.openingStateEvidenceId ||
    history.nextScheduledSequence !== 1)
  const populatedHistoryMismatch = history.completedPaymentCount > 0 && (
    !hasExplicitTerminalState ||
    history.lastCompletedSequence !== history.completedPaymentCount ||
    history.lastPaymentDate === null ||
    (history.lastPaymentDate !== null &&
      Number(history.lastPaymentDate.slice(0, 4)) !== expectedTaxYear) ||
    (history.lastPaymentDate !== null &&
      history.lastPaymentDate < election.electionStartDate) ||
    history.nextScheduledSequence !== history.lastCompletedSequence + 1)
  const historyWithoutId = {
    predicate: history.predicate,
    electionId: history.electionId,
    scheduleId: history.scheduleId,
    participantPersonId: history.participantPersonId,
    sourceAccountId: history.sourceAccountId,
    taxYear: history.taxYear,
    openingStateEvidenceId: history.openingStateEvidenceId,
    completedPaymentCount: history.completedPaymentCount,
    usedCurrentDistributionEvidenceIds:
      history.usedCurrentDistributionEvidenceIds,
    lastCompletedSequence: history.lastCompletedSequence,
    lastPaymentDate: history.lastPaymentDate,
    terminalStateEvidenceId: history.terminalStateEvidenceId,
    scheduledGrossAmountThroughPriorPayments:
      history.scheduledGrossAmountThroughPriorPayments,
    actualQualifyingGrossAmountThroughPriorPayments:
      history.actualQualifyingGrossAmountThroughPriorPayments,
    nextScheduledSequence: history.nextScheduledSequence,
  }
  const expectedPriorHistoryEvidenceId = deriveActionStructuralId(
    'owned-ira-sepp-prior-payment-history',
    [opening.openingStateEvidenceId, historyWithoutId],
  )
  addIssue(issues, 'priorHistoryBindingMismatch',
    history.predicate !== 'ownedNonRothIraSeppPriorPaymentHistory' ||
    sharedBindingMismatch(history) ||
    history.taxYear !== expectedTaxYear ||
    history.openingStateEvidenceId !== opening.openingStateEvidenceId ||
    (hasExplicitTerminalState &&
      history.priorHistoryEvidenceId !== expectedPriorHistoryEvidenceId) ||
    history.usedCurrentDistributionEvidenceIds.length !==
      history.completedPaymentCount ||
    emptyHistoryMismatch ||
    populatedHistoryMismatch)
  const beforeStateWithoutId = {
    predicate: 'ownedNonRothIraSeppCurrentPaymentState' as const,
    electionId: election.electionId,
    scheduleId: election.scheduleId,
    participantPersonId: ownerPersonId,
    sourceAccountId: source.sourceAccountId,
    taxYear: expectedTaxYear,
    completedPaymentCount: history.completedPaymentCount,
    lastCompletedSequence: history.lastCompletedSequence,
    lastPaymentDate: history.lastPaymentDate,
    nextScheduledSequence: history.nextScheduledSequence,
    scheduledGrossAmount:
      history.scheduledGrossAmountThroughPriorPayments,
    actualQualifyingGrossAmount:
      history.actualQualifyingGrossAmountThroughPriorPayments,
  }
  const beforeState: OwnedNonRothIraSeppCurrentPaymentStateEvidence = {
    ...beforeStateWithoutId,
    stateEvidenceId: history.terminalStateEvidenceId,
  }
  addIssue(issues, 'paymentSequenceNotContiguous',
    payment.paymentSequence !== history.nextScheduledSequence)
  addIssue(issues, 'paymentDateBreaksContinuity',
    history.lastPaymentDate !== null &&
      history.lastPaymentDate > payment.distributionDate)
  addIssue(issues, 'previousStateMismatch',
    payment.previousScheduleStateId !== beforeState.stateEvidenceId)
  addIssue(issues, 'currentDistributionReplay',
    history.usedCurrentDistributionEvidenceIds.includes(
      payment.currentDistributionEvidenceId,
    ))
  addIssue(issues, 'canonicalBindingMismatch',
    payment.predicate !== 'ownedNonRothIraSeppCurrentScheduledPayment' ||
    payment.electionId !== election.electionId ||
    payment.scheduleId !== election.scheduleId ||
    payment.sourceAccountId !== source.sourceAccountId ||
    payment.actionId !== actionId ||
    payment.allocationId !== allocationId ||
    Number(payment.distributionDate.slice(0, 4)) !== expectedTaxYear ||
    payment.distributionDate !== coverage.evaluationDate ||
    payment.currentDistributionEvidenceId !==
      coverage.sourceEvidenceIds.distributionDateEvidenceId)
  addIssue(issues, 'currentGrossMismatch',
    payment.currentScheduledGrossAmount !== coverage.executedAmount)
  addIssue(issues, 'grossChainInvalid',
    history.actualQualifyingGrossAmountThroughPriorPayments !==
      history.scheduledGrossAmountThroughPriorPayments)

  const scheduledAfterBigInt =
    BigInt(history.scheduledGrossAmountThroughPriorPayments) +
    BigInt(payment.currentScheduledGrossAmount)
  const actualAfterBigInt =
    BigInt(history.actualQualifyingGrossAmountThroughPriorPayments) +
    BigInt(coverage.executedAmount)
  const maximum = BigInt(Number.MAX_SAFE_INTEGER)
  const overflow =
    scheduledAfterBigInt > maximum ||
    actualAfterBigInt > maximum ||
    history.completedPaymentCount === Number.MAX_SAFE_INTEGER ||
    payment.paymentSequence === Number.MAX_SAFE_INTEGER
  addIssue(issues, 'safeIntegerOverflow', overflow)
  addIssue(issues, 'grossChainInvalid',
    !overflow && actualAfterBigInt !== scheduledAfterBigInt)
  addIssue(issues, 'annualScheduledAmountExceeded',
    !overflow &&
      scheduledAfterBigInt >
        BigInt(annualSchedule.annualScheduledGrossAmount))

  if (issues.length > 0) {
    return deepFreeze({
      ...resultFlags,
      status: 'notLocallyConforming',
      issues: issues as [
        OwnedNonRothIraSeppNonconformanceIssue,
        ...OwnedNonRothIraSeppNonconformanceIssue[],
      ],
      candidate: null,
    })
  }

  const scheduledGrossAmount = asUsdCents(Number(scheduledAfterBigInt))
  const actualQualifyingGrossAmount =
    asUsdCents(Number(actualAfterBigInt))
  const afterStateWithoutId = {
    predicate: 'ownedNonRothIraSeppCurrentPaymentState' as const,
    electionId: election.electionId,
    scheduleId: election.scheduleId,
    participantPersonId: ownerPersonId,
    sourceAccountId: source.sourceAccountId,
    taxYear: expectedTaxYear,
    completedPaymentCount: history.completedPaymentCount + 1,
    lastCompletedSequence: payment.paymentSequence,
    lastPaymentDate: payment.distributionDate,
    nextScheduledSequence: payment.paymentSequence + 1,
    scheduledGrossAmount,
    actualQualifyingGrossAmount,
  }
  const paymentAfterPredecessorBinding = {
    predicate: payment.predicate,
    electionId: payment.electionId,
    scheduleId: payment.scheduleId,
    actionId: payment.actionId,
    allocationId: payment.allocationId,
    sourceAccountId: payment.sourceAccountId,
    distributionDate: payment.distributionDate,
    currentDistributionEvidenceId:
      payment.currentDistributionEvidenceId,
    paymentSequence: payment.paymentSequence,
    currentScheduledGrossAmount: payment.currentScheduledGrossAmount,
    paymentScheduleEvidenceId: payment.paymentScheduleEvidenceId,
  }
  const afterState: OwnedNonRothIraSeppCurrentPaymentStateEvidence = {
    ...afterStateWithoutId,
    stateEvidenceId: deriveActionStructuralId(
      'owned-ira-sepp-current-payment-after', [
      beforeState.stateEvidenceId,
      paymentAfterPredecessorBinding,
      afterStateWithoutId,
      ],
    ),
  }
  const candidateWithoutId = {
    predicate: 'ownedNonRothIraSeppCurrentPaymentCandidate' as const,
    ownerPersonId,
    taxYear: expectedTaxYear,
    actionId,
    allocationId,
    sourceAccountId: source.sourceAccountId,
    subtype: source.subtype,
    distributionDate: payment.distributionDate,
    paymentSequence: payment.paymentSequence,
    scheduledGrossAmount: payment.currentScheduledGrossAmount,
    actualGrossAmount: coverage.executedAmount,
    basisReturnExcludedAmount: coverage.basisReturnExcludedAmount,
    prospectiveOrdinaryIncomeAmount:
      coverage.ordinaryIncomeExposureAmount,
    characterCoverageEvidenceId: coverage.evidenceId,
    currentDistributionEvidenceId:
      payment.currentDistributionEvidenceId,
    sourceEvidenceId: source.sourceEvidenceId,
    electionEvidenceId: election.electionEvidenceId,
    annualScheduleEvidenceId: annualSchedule.annualScheduleEvidenceId,
    noModificationEvidenceId: noModification.noModificationEvidenceId,
    priorHistoryTerminalStateId:
      opening.priorHistoryTerminalStateId,
    openingStateEvidenceId: opening.openingStateEvidenceId,
    priorHistoryEvidenceId: history.priorHistoryEvidenceId,
    paymentScheduleEvidenceId: payment.paymentScheduleEvidenceId,
    beforeState,
    afterState,
  }
  const candidate: OwnedNonRothIraSeppCurrentPaymentCandidateEvidence = {
    ...candidateWithoutId,
    candidateId: deriveActionStructuralId(
      'owned-ira-sepp-current-payment-candidate', [
      coverage,
      source,
      election,
      annualSchedule,
      noModification,
      opening,
      history,
      payment,
      candidateWithoutId,
      ],
    ),
  }
  return deepFreeze({
    ...resultFlags,
    status: 'provisionalCandidate',
    candidate,
  })
}
