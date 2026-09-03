import {
  annualRetirementResolvedRuntimeEventKinds,
  annualRetirementRuntimeEventUsesPhysicalBalanceIndex,
  annualRetirementRuntimeEventKinds,
  type AnnualRetirementResolvedRuntimeEventKind,
  type AnnualRetirementRuntimeEventKind,
  type AnnualRetirementRuntimeEventOrigin,
  type AnnualRetirementRuntimeInventoryRecord,
  type CompleteAnnualRetirementRuntimeInventoryAttestation,
  type ResolvedAnnualRetirementPhysicalEventRecord,
  type UnresolvedAnnualRetirementPhysicalActivityRecord,
} from '../actions/annualRetirementPhysicalEventInventory.js'
import { formatCivilDate, parseCivilIsoDate } from '../actions/civilDate.js'
import {
  accountIdSchema,
  personIdSchema,
  planIdSchema,
  type PlanId,
} from '../actions/identity.js'
import { positiveUsdCentsSchema } from '../actions/money.js'
import { planDollarsToLedgerCents } from '../actions/planBalanceAdapter.js'
import {
  compareUtf16CodeUnits,
  deriveActionStructuralId,
} from '../actions/structuralId.js'
import { deepFreeze } from '../actions/freeze.js'
import { nonblank } from '../actions/plainData.js'

export interface SimulatorAnnualRetirementRuntimeJournalContext {
  planId: PlanId
  taxYear: number
  ledgerRunId: string
}

/**
 * One physical occurrence observed at its simulator mutation site.
 *
 * Missing facts are explicit nulls. In particular, the annual simulator's
 * loop position is not an execution sequence and its year is not December 31.
 */
export interface SimulatorAnnualRetirementRuntimeOccurrence {
  producerOccurrenceKey: string
  kind: AnnualRetirementRuntimeEventKind
  grossAmountPlanDollars: number
  ownerPersonId: string | null
  sourceAccountId: string | null
  executionDate: string | null
  executionSequence: number | null
  movementAuthorityId: string | null
}

export type SimulatorAnnualRetirementRuntimeJournalIssueKind =
  | 'occurrenceInvalid'
  | 'occurrenceAmountUnrepresentable'
  | 'duplicateOccurrence'
  | 'identifierCollision'
  | 'identifierDerivationFailed'

export interface SimulatorAnnualRetirementRuntimeJournalIssue {
  kind: SimulatorAnnualRetirementRuntimeJournalIssueKind
  detail: string
  producerOccurrenceKey?: string
}

export interface SimulatorAnnualRetirementRuntimeJournalEntry {
  producerOccurrenceKey: string
  record: AnnualRetirementRuntimeInventoryRecord
}

export interface SimulatorAnnualRetirementRuntimeJournal {
  readonly context: Readonly<SimulatorAnnualRetirementRuntimeJournalContext>
  readonly entries:
    readonly Readonly<SimulatorAnnualRetirementRuntimeJournalEntry>[]
  readonly issues: readonly Readonly<SimulatorAnnualRetirementRuntimeJournalIssue>[]
}

export interface SimulatorAnnualRetirementRuntimeJournalSealed {
  readonly status: 'runtimeJournalSealed'
  readonly runtimeRecords:
    readonly Readonly<AnnualRetirementRuntimeInventoryRecord>[]
  readonly runtimeInventoryAttestation:
    Readonly<CompleteAnnualRetirementRuntimeInventoryAttestation>
  readonly issues: readonly []
}

export interface SimulatorAnnualRetirementRuntimeJournalBlocked {
  readonly status: 'runtimeJournalBlocked'
  readonly runtimeRecords: null
  readonly runtimeInventoryAttestation: null
  readonly issues: readonly [
    Readonly<SimulatorAnnualRetirementRuntimeJournalIssue>,
    ...Readonly<SimulatorAnnualRetirementRuntimeJournalIssue>[],
  ]
}

export type SealSimulatorAnnualRetirementRuntimeJournalResult =
  | SimulatorAnnualRetirementRuntimeJournalSealed
  | SimulatorAnnualRetirementRuntimeJournalBlocked

const resolvedKinds = new Set<AnnualRetirementRuntimeEventKind>(
  annualRetirementResolvedRuntimeEventKinds,
)
const runtimeKinds = new Set<AnnualRetirementRuntimeEventKind>(
  annualRetirementRuntimeEventKinds,
)

/**
 * The journal's own copy of the inventory's origin classifier. The two are
 * checked against each other -- `buildAnnualRetirementPhysicalEventInventory`
 * rejects any record whose origin is not the one it expects for the kind -- so
 * this switch is exhaustive for the same reason that one is: a kind left to a
 * fallthrough would be published as a household-internal transfer and only the
 * far side would notice.
 */
function originFor(
  kind: AnnualRetirementRuntimeEventKind,
): AnnualRetirementRuntimeEventOrigin {
  switch (kind) {
    case 'ownedIraRmd':
    case 'employerPlanRmd':
    case 'inheritedIraRmd': return 'rmdEngine'
    case 'automaticSeppDistribution': return 'seppEngine'
    case 'legacyNeedBasedWithdrawal':
    case 'legacyRothConversion':
    case 'annuityContractDistribution':
    case 'legacyQcd': return 'legacyProjection'
    // A gift is paid directly by the custodian to the donee organization, so
    // unlike every kind on the transfer line below it has no household
    // account on the receiving end. Deliberately not `legacyProjection`
    // either: the aggregate strategy chose neither its amount nor its donor.
    case 'namedQcd': return 'charitableDistributionLedger'
    case 'ownedIraContribution':
    case 'ownedIraEmployerContribution':
    case 'employerPlanEmployeeContribution':
    case 'employerPlanEmployerMatch': return 'contributionLedger'
    // A named conversion moves between two of the household's own accounts, so
    // it belongs with the other transfers, and deliberately not with
    // `legacyProjection`: the aggregate strategy chose neither its amount nor
    // its destination.
    case 'namedRothConversion':
    case 'annuityFundingTransfer':
    case 'rolloverInflow':
    case 'otherTraditionalTransfer': return 'transferLedger'
  }
}

function issue(
  kind: SimulatorAnnualRetirementRuntimeJournalIssueKind,
  detail: string,
  producerOccurrenceKey?: string,
): SimulatorAnnualRetirementRuntimeJournalIssue {
  return {
    kind,
    detail,
    ...(producerOccurrenceKey === undefined ? {} : { producerOccurrenceKey }),
  }
}

function positionalSourceBalanceIndex(
  occurrence: Readonly<SimulatorAnnualRetirementRuntimeOccurrence>,
  sourceAccountId: string | null,
): number | undefined {
  if (
    occurrence.kind !== 'ownedIraContribution' &&
    occurrence.kind !== 'ownedIraEmployerContribution' &&
    occurrence.kind !== 'employerPlanEmployeeContribution' &&
    occurrence.kind !== 'employerPlanEmployerMatch'
  ) return undefined
  try {
    const parsed: unknown = JSON.parse(occurrence.producerOccurrenceKey)
    if (!Array.isArray(parsed) || parsed.length !== 3 ||
        parsed[0] !== occurrence.kind || parsed[1] !== sourceAccountId ||
        !Number.isSafeInteger(parsed[2]) || (parsed[2] as number) < 0) return undefined
    return parsed[2] as number
  } catch {
    return undefined
  }
}

function journalWithIssue(
  journal: Readonly<SimulatorAnnualRetirementRuntimeJournal>,
  nextIssue: SimulatorAnnualRetirementRuntimeJournalIssue,
): Readonly<SimulatorAnnualRetirementRuntimeJournal> {
  return deepFreeze({
    context: { ...journal.context },
    entries: [...journal.entries],
    issues: [...journal.issues, nextIssue],
  })
}

function recordIdentifiers(record: AnnualRetirementRuntimeInventoryRecord): string[] {
  return record.recordStatus === 'resolved'
    ? [record.eventId, record.upstreamEvidenceId]
    : [record.activityId, record.upstreamEvidenceId]
}

function unresolvedReason(
  kind: AnnualRetirementRuntimeEventKind,
  ownerPersonId: string | null,
  sourceAccountId: string | null,
  executionDate: string | null,
  executionSequence: number | null,
  movementAuthorityId: string | null,
  sourceBalanceIndex: number | undefined,
): UnresolvedAnnualRetirementPhysicalActivityRecord['incompatibility'] {
  if (ownerPersonId === null) return 'legacyAggregateIdentityUnavailable'
  if (sourceAccountId === null) return 'sourceAllocationUnavailable'
  if (executionDate === null || executionSequence === null) {
    return 'executionChronologyUnavailable'
  }
  if (
    annualRetirementRuntimeEventUsesPhysicalBalanceIndex(kind) &&
    sourceBalanceIndex === undefined
  ) return 'sourceBalanceIndexUnavailable'
  if (movementAuthorityId === null || !resolvedKinds.has(kind)) {
    return 'movementAuthorityUnavailable'
  }
  throw new Error('A fully resolved runtime occurrence has no incompatibility')
}

function canonicalEntryOrder(
  left: Readonly<SimulatorAnnualRetirementRuntimeJournalEntry>,
  right: Readonly<SimulatorAnnualRetirementRuntimeJournalEntry>,
): number {
  const leftId = left.record.recordStatus === 'resolved'
    ? left.record.eventId
    : left.record.activityId
  const rightId = right.record.recordStatus === 'resolved'
    ? right.record.eventId
    : right.record.activityId
  return compareUtf16CodeUnits(leftId, rightId) ||
    compareUtf16CodeUnits(left.producerOccurrenceKey, right.producerOccurrenceKey)
}

/** Begin a new immutable journal for one Plan/year/ledger run. */
export function beginSimulatorAnnualRetirementRuntimeJournal(
  context: Readonly<SimulatorAnnualRetirementRuntimeJournalContext>,
): Readonly<SimulatorAnnualRetirementRuntimeJournal> {
  const planId = planIdSchema.safeParse(context.planId)
  if (!planId.success || !Number.isInteger(context.taxYear) ||
      context.taxYear < 1 || context.taxYear > 9999 ||
      !nonblank(context.ledgerRunId)) {
    throw new TypeError('Runtime journal context must bind a Plan, tax year, and nonblank ledger run')
  }
  return deepFreeze({
    context: {
      planId: planId.data,
      taxYear: context.taxYear,
      ledgerRunId: context.ledgerRunId,
    },
    entries: [],
    issues: [],
  })
}

/**
 * Create a detached retry journal containing the immutable pre-pass prefix.
 * Appending to the fork cannot change either the prefix or a sibling attempt.
 */
export function forkSimulatorAnnualRetirementRuntimeJournal(
  prefix: Readonly<SimulatorAnnualRetirementRuntimeJournal>,
): Readonly<SimulatorAnnualRetirementRuntimeJournal> {
  return deepFreeze({
    context: { ...prefix.context },
    entries: [...prefix.entries],
    issues: [...prefix.issues],
  })
}

/** Append one occurrence without mutating the supplied journal. */
export function recordSimulatorAnnualRetirementRuntimeOccurrence(
  journal: Readonly<SimulatorAnnualRetirementRuntimeJournal>,
  occurrence: Readonly<SimulatorAnnualRetirementRuntimeOccurrence>,
): Readonly<SimulatorAnnualRetirementRuntimeJournal> {
  const key = occurrence.producerOccurrenceKey
  if (!nonblank(key) || !runtimeKinds.has(occurrence.kind)) {
    return journalWithIssue(journal, issue(
      'occurrenceInvalid',
      'Runtime occurrence needs a nonblank stable producer key and supported kind',
      nonblank(key) ? key : undefined,
    ))
  }
  if (journal.entries.some((entry) => entry.producerOccurrenceKey === key)) {
    return journalWithIssue(journal, issue(
      'duplicateOccurrence',
      'A producer occurrence key can be recorded only once in a journal attempt',
      key,
    ))
  }

  let grossAmount
  try {
    grossAmount = planDollarsToLedgerCents(occurrence.grossAmountPlanDollars)
    if (grossAmount <= 0) throw new RangeError('Physical occurrence rounded to zero cents')
  } catch (error) {
    return journalWithIssue(journal, issue(
      'occurrenceAmountUnrepresentable',
      `Runtime occurrence amount cannot enter the exact-cent ledger: ${error instanceof Error ? error.message : String(error)}`,
      key,
    ))
  }

  const owner = occurrence.ownerPersonId === null
    ? null
    : personIdSchema.safeParse(occurrence.ownerPersonId)
  const source = occurrence.sourceAccountId === null
    ? null
    : accountIdSchema.safeParse(occurrence.sourceAccountId)
  const parsedDate = occurrence.executionDate === null
    ? null
    : parseCivilIsoDate(occurrence.executionDate)
  const dateValid = occurrence.executionDate === null ||
    (parsedDate !== null && formatCivilDate(parsedDate) === occurrence.executionDate &&
      parsedDate.year === journal.context.taxYear)
  const sequenceValid = occurrence.executionSequence === null ||
    (Number.isSafeInteger(occurrence.executionSequence) &&
      occurrence.executionSequence > 0)
  const authorityValid = occurrence.movementAuthorityId === null ||
    nonblank(occurrence.movementAuthorityId)
  if ((owner !== null && !owner.success) || (source !== null && !source.success) ||
      !dateValid || !sequenceValid || !authorityValid) {
    return journalWithIssue(journal, issue(
      'occurrenceInvalid',
      'Supplied runtime identity, chronology, or movement authority is malformed',
      key,
    ))
  }

  const ownerPersonId = owner === null ? null : owner.data
  const sourceAccountId = source === null ? null : source.data
  const sourceBalanceIndex = positionalSourceBalanceIndex(occurrence, sourceAccountId)
  const origin = originFor(occurrence.kind)
  const requiresPositionalSource =
    annualRetirementRuntimeEventUsesPhysicalBalanceIndex(occurrence.kind)
  const canResolve = resolvedKinds.has(occurrence.kind) &&
    ownerPersonId !== null && sourceAccountId !== null &&
    occurrence.executionDate !== null &&
    occurrence.executionSequence !== null &&
    occurrence.movementAuthorityId !== null &&
    (!requiresPositionalSource || sourceBalanceIndex !== undefined)
  const binding = [
    journal.context.planId,
    journal.context.taxYear,
    journal.context.ledgerRunId,
    key,
    occurrence.kind,
    origin,
    grossAmount,
    ownerPersonId,
    sourceAccountId,
    sourceBalanceIndex ?? null,
    occurrence.executionDate,
    occurrence.executionSequence,
    occurrence.movementAuthorityId,
  ] as const

  let upstreamEvidenceId: string
  let recordId: string
  try {
    upstreamEvidenceId = deriveActionStructuralId(
      'projection-annual-retirement-runtime-occurrence-upstream',
      [binding],
    )
    recordId = deriveActionStructuralId(
      canResolve
        ? 'projection-annual-retirement-runtime-event'
        : 'projection-annual-retirement-runtime-unresolved-activity',
      [binding, upstreamEvidenceId],
    )
  } catch (error) {
    return journalWithIssue(journal, issue(
      'identifierDerivationFailed',
      `Runtime occurrence identity could not be derived: ${error instanceof Error ? error.message : String(error)}`,
      key,
    ))
  }

  const priorRecordIdentifiers = journal.entries.flatMap((entry) =>
    recordIdentifiers(entry.record))
  const priorMovementAuthorityIds = journal.entries.flatMap((entry) =>
    entry.record.recordStatus === 'resolved'
      ? [entry.record.movementAuthorityId]
      : [])
  const alreadyClaimed = new Set([
    journal.context.planId,
    journal.context.ledgerRunId,
    ...priorRecordIdentifiers,
    ...priorMovementAuthorityIds,
  ])
  if (recordId === upstreamEvidenceId || alreadyClaimed.has(recordId) ||
      alreadyClaimed.has(upstreamEvidenceId) ||
      occurrence.movementAuthorityId === recordId ||
      occurrence.movementAuthorityId === upstreamEvidenceId ||
      (occurrence.movementAuthorityId !== null &&
        (occurrence.movementAuthorityId === journal.context.planId ||
          occurrence.movementAuthorityId === journal.context.ledgerRunId ||
          priorRecordIdentifiers.includes(occurrence.movementAuthorityId)))) {
    return journalWithIssue(journal, issue(
      'identifierCollision',
      'Derived runtime occurrence identifiers collide with existing journal bindings',
      key,
    ))
  }

  let record: AnnualRetirementRuntimeInventoryRecord
  if (canResolve) {
    record = {
      recordStatus: 'resolved',
      planId: journal.context.planId,
      taxYear: journal.context.taxYear,
      ledgerRunId: journal.context.ledgerRunId,
      eventId: recordId,
      movementAuthorityId: occurrence.movementAuthorityId!,
      kind: occurrence.kind as AnnualRetirementResolvedRuntimeEventKind,
      origin,
      ownerPersonId: ownerPersonId!,
      sourceAccountId: sourceAccountId!,
      ...(sourceBalanceIndex === undefined ? {} : { sourceBalanceIndex }),
      grossAmount: positiveUsdCentsSchema.parse(grossAmount),
      executionDate: occurrence.executionDate!,
      executionSequence: occurrence.executionSequence!,
      upstreamEvidenceId,
    } satisfies ResolvedAnnualRetirementPhysicalEventRecord
  } else {
    record = {
      recordStatus: 'unresolved',
      planId: journal.context.planId,
      taxYear: journal.context.taxYear,
      ledgerRunId: journal.context.ledgerRunId,
      activityId: recordId,
      kind: occurrence.kind,
      origin,
      knownGrossAmount: grossAmount,
      ownerPersonId: null,
      sourceAccountId: null,
      executionDate: null,
      executionSequence: null,
      incompatibility: unresolvedReason(
        occurrence.kind,
        ownerPersonId,
        sourceAccountId,
        occurrence.executionDate,
        occurrence.executionSequence,
        occurrence.movementAuthorityId,
        sourceBalanceIndex,
      ),
      upstreamEvidenceId,
    } satisfies UnresolvedAnnualRetirementPhysicalActivityRecord
  }

  return deepFreeze({
    context: { ...journal.context },
    entries: [...journal.entries, { producerOccurrenceKey: key, record }],
    issues: [...journal.issues],
  })
}

/** Seal the exact journal, including an explicit-empty run. */
export function sealSimulatorAnnualRetirementRuntimeJournal(
  journal: Readonly<SimulatorAnnualRetirementRuntimeJournal>,
): Readonly<SealSimulatorAnnualRetirementRuntimeJournalResult> {
  if (journal.issues.length > 0) {
    return deepFreeze({
      status: 'runtimeJournalBlocked',
      runtimeRecords: null,
      runtimeInventoryAttestation: null,
      issues: [...journal.issues] as [
        SimulatorAnnualRetirementRuntimeJournalIssue,
        ...SimulatorAnnualRetirementRuntimeJournalIssue[],
      ],
    })
  }
  const entries = [...journal.entries].sort(canonicalEntryOrder)
  const runtimeRecords = entries.map((entry) => entry.record)
  const resolvedEventIds = runtimeRecords.flatMap((record) =>
    record.recordStatus === 'resolved' ? [record.eventId] : [],
  ).sort(compareUtf16CodeUnits)
  const unresolvedActivityIds = runtimeRecords.flatMap((record) =>
    record.recordStatus === 'unresolved' ? [record.activityId] : [],
  ).sort(compareUtf16CodeUnits)

  let upstreamEvidenceId: string
  let evidenceId: string
  try {
    upstreamEvidenceId = deriveActionStructuralId(
      'projection-annual-retirement-runtime-journal-upstream',
      [journal.context, runtimeRecords],
    )
    evidenceId = deriveActionStructuralId(
      'projection-annual-retirement-runtime-journal',
      [journal.context, resolvedEventIds, unresolvedActivityIds,
        upstreamEvidenceId],
    )
  } catch (error) {
    return deepFreeze({
      status: 'runtimeJournalBlocked',
      runtimeRecords: null,
      runtimeInventoryAttestation: null,
      issues: [issue(
        'identifierDerivationFailed',
        `Runtime journal identity could not be derived: ${error instanceof Error ? error.message : String(error)}`,
      )],
    })
  }
  const claimed = new Set([
    journal.context.planId,
    journal.context.ledgerRunId,
    ...runtimeRecords.flatMap(recordIdentifiers),
    ...runtimeRecords.flatMap((record) =>
      record.recordStatus === 'resolved' ? [record.movementAuthorityId] : [],
    ),
  ])
  if (evidenceId === upstreamEvidenceId || claimed.has(evidenceId) ||
      claimed.has(upstreamEvidenceId)) {
    return deepFreeze({
      status: 'runtimeJournalBlocked',
      runtimeRecords: null,
      runtimeInventoryAttestation: null,
      issues: [issue(
        'identifierCollision',
        'Derived journal identifiers collide with runtime occurrence bindings',
      )],
    })
  }

  const runtimeInventoryAttestation:
    CompleteAnnualRetirementRuntimeInventoryAttestation = {
      predicate: 'completeAnnualRetirementPhysicalEventInventory',
      planId: journal.context.planId,
      taxYear: journal.context.taxYear,
      ledgerRunId: journal.context.ledgerRunId,
      inventoryStatus: 'completeIncludingExplicitEmpty',
      resolvedEventIds,
      unresolvedActivityIds,
      evidenceId,
      upstreamEvidenceId,
    }
  return deepFreeze({
    status: 'runtimeJournalSealed',
    runtimeRecords,
    runtimeInventoryAttestation,
    issues: [],
  })
}
