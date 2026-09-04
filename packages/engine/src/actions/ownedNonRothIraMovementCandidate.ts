import {
  ordinaryWithdrawalRequestSchema,
  type OrdinaryWithdrawalRequest,
} from './contract.js'
import { formatCivilDate, parseCivilIsoDate } from './civilDate.js'
import {
  accountIdSchema,
  personIdSchema,
  type AccountId,
  type ActionId,
  type AllocationId,
  type PersonId,
} from './identity.js'
import {
  asUsdCents,
  usdCentsSchema,
  type PositiveUsdCents,
  type UsdCents,
} from './money.js'
import type { AnnualIraBasisAllocationEntryInput } from './annualIraBasisAllocation.js'
import type { AccountOpeningBalanceSnapshot } from './execution.js'
import type { OwnedNonRothIraSubtype } from './ownedNonRothIraWithdrawalCharacter.js'
import {
  createActionReason,
  type ActionReason,
} from './reasons.js'
import { deepFreeze } from './freeze.js'
import {
  compareUtf16CodeUnits,
  deriveActionStructuralId,
} from './structuralId.js'
import { requireNonblankId } from './plainData.js'

export interface OwnedNonRothIraMovementSourceEvidence {
  predicate: 'ownedNonRothIraOrdinaryWithdrawalMovementSource'
  sourceAccountId: AccountId
  ownerPersonId: PersonId
  accountType: 'traditional'
  accountKind: 'ira'
  inheritanceStatus: 'owned'
  subtype: OwnedNonRothIraSubtype
  accountOwnershipEvidenceId: string
  iraClassificationEvidenceId: string
}

export interface StageOwnedNonRothIraOrdinaryWithdrawalMovementsInput {
  ownerPersonId: PersonId
  taxYear: number
  requests: readonly Readonly<OrdinaryWithdrawalRequest>[]
  openingBalances: readonly Readonly<AccountOpeningBalanceSnapshot>[]
  sourceEvidence:
    readonly Readonly<OwnedNonRothIraMovementSourceEvidence>[]
}

export type OwnedNonRothIraMovementScheduleIssue =
  | Readonly<{
      kind: 'actionYearMismatch'
      actionId: ActionId
      expectedYear: number
      actualYear: number
    }>
  | Readonly<{
      kind: 'executionDateRequired'
      actionId: ActionId
    }>
  | Readonly<{
      kind: 'executionDateInvalid'
      actionId: ActionId
      executionDate: string
    }>
  | Readonly<{
      kind: 'executionDateYearMismatch'
      actionId: ActionId
      executionDate: string
      expectedYear: number
      actualYear: number
    }>
  | Readonly<{
      kind: 'duplicateActionId'
      actionId: ActionId
    }>
  | Readonly<{
      kind: 'executionSequenceConflict'
      taxYear: number
      executionDate: string
      executionSequence: number
      collidingActionIds: readonly [ActionId, ActionId, ...ActionId[]]
    }>

export interface OwnedNonRothIraMovementAllocationEvidence {
  allocationId: AllocationId
  sourceAccountId: AccountId
  requestedAmount: PositiveUsdCents
  balanceBefore: UsdCents
  executedAmount: UsdCents
  unexecutedAmount: UsdCents
  candidateBalanceAfter: UsdCents
  sourceEvidence:
    Readonly<OwnedNonRothIraMovementSourceEvidence>
}

/**
 * Physical staging evidence only. This deliberately cannot satisfy the
 * normative ActionExecutionDisposition contract: eligibility, annual tax
 * character, penalty treatment, and committed movement are unresolved here.
 */
export interface OwnedNonRothIraMovementCandidateDisposition {
  candidateStatus: 'fullyStaged' | 'partiallyStaged' | 'notStaged'
  requestedAmount: PositiveUsdCents
  stagedAmount: UsdCents
  unstagedAmount: UsdCents
  reasons: readonly Readonly<ActionReason>[]
}

export interface OwnedNonRothIraMovementActionEvidence {
  request: Readonly<OrdinaryWithdrawalRequest>
  actionId: ActionId
  ownerPersonId: PersonId
  taxYear: number
  executionDate: string
  executionSequence: number
  requestedAmount: PositiveUsdCents
  executedAmount: UsdCents
  unexecutedAmount: UsdCents
  candidateDisposition:
    Readonly<OwnedNonRothIraMovementCandidateDisposition>
  allocations:
    readonly [
      Readonly<OwnedNonRothIraMovementAllocationEvidence>,
      ...Readonly<OwnedNonRothIraMovementAllocationEvidence>[],
    ]
}

export interface OwnedNonRothIraMovementCandidateBalance {
  sourceAccountId: AccountId
  ownerPersonId: PersonId
  openingBalance: UsdCents
  requestedAmount: UsdCents
  executedAmount: UsdCents
  unexecutedAmount: UsdCents
  candidateClosingBalance: UsdCents
}

interface OwnedNonRothIraMovementCandidateResultBase {
  movement: 'notCommitted'
  movementCandidateId: string
  ownerPersonId: PersonId
  taxYear: number
  candidateBalances:
    readonly Readonly<OwnedNonRothIraMovementCandidateBalance>[]
}

export interface OwnedNonRothIraMovementCandidateStagedResult
  extends OwnedNonRothIraMovementCandidateResultBase {
  status: 'movementCandidateStaged'
  scheduleIssues: readonly []
  actions:
    readonly Readonly<OwnedNonRothIraMovementActionEvidence>[]
  line7Distributions:
    readonly Readonly<AnnualIraBasisAllocationEntryInput>[]
}

export interface OwnedNonRothIraMovementCandidateScheduleInvalidResult
  extends OwnedNonRothIraMovementCandidateResultBase {
  status: 'scheduleInvalid'
  scheduleIssues:
    readonly [
      Readonly<OwnedNonRothIraMovementScheduleIssue>,
      ...Readonly<OwnedNonRothIraMovementScheduleIssue>[],
    ]
  actions: readonly []
  line7Distributions: readonly []
}

export type StageOwnedNonRothIraOrdinaryWithdrawalMovementsResult =
  | OwnedNonRothIraMovementCandidateStagedResult
  | OwnedNonRothIraMovementCandidateScheduleInvalidResult

interface ScheduledRequest {
  request: OrdinaryWithdrawalRequest
  executionDate: string | null
  chronologyKey: string
}

function centsFromBigInt(value: bigint, label: string): UsdCents {
  if (value < 0n || value > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new RangeError(`${label} exceeded the safe-integer cents range`)
  }
  return asUsdCents(Number(value))
}

function canonicalRequest(request: OrdinaryWithdrawalRequest): OrdinaryWithdrawalRequest {
  return {
    ...request,
    provenance: { ...request.provenance },
    purpose: { ...request.purpose },
    allocations: [...request.allocations]
      .map((allocation) => ({ ...allocation }))
      .sort(
        (left, right) =>
          compareUtf16CodeUnits(
            left.allocationId,
            right.allocationId,
          ) ||
          compareUtf16CodeUnits(
            left.sourceAccountId,
            right.sourceAccountId,
          ),
      ),
  }
}

function candidateDisposition(
  requestedAmount: PositiveUsdCents,
  executedAmount: UsdCents,
): OwnedNonRothIraMovementCandidateDisposition {
  const unexecutedAmount = asUsdCents(requestedAmount - executedAmount)
  if (executedAmount === requestedAmount) {
    return {
      candidateStatus: 'fullyStaged',
      requestedAmount,
      stagedAmount: executedAmount,
      unstagedAmount: unexecutedAmount,
      reasons: [],
    }
  }
  if (executedAmount === 0) {
    return {
      candidateStatus: 'notStaged',
      requestedAmount,
      stagedAmount: executedAmount,
      unstagedAmount: unexecutedAmount,
      reasons: [createActionReason('source-balance-unavailable')],
    }
  }
  return {
    candidateStatus: 'partiallyStaged',
    requestedAmount,
    stagedAmount: executedAmount,
    unstagedAmount: unexecutedAmount,
    reasons: [createActionReason('source-balance-trimmed')],
  }
}

function validateSourceEvidence(
  evidence: Readonly<OwnedNonRothIraMovementSourceEvidence>,
  ownerPersonId: PersonId,
): OwnedNonRothIraMovementSourceEvidence {
  const sourceAccountId = accountIdSchema.parse(evidence.sourceAccountId)
  const evidenceOwnerPersonId = personIdSchema.parse(evidence.ownerPersonId)
  if (evidenceOwnerPersonId !== ownerPersonId) {
    throw new RangeError(
      `Owned non-Roth IRA movement source "${sourceAccountId}" belongs to a foreign owner`,
    )
  }
  if (
    evidence.predicate !==
      'ownedNonRothIraOrdinaryWithdrawalMovementSource' ||
    evidence.accountType !== 'traditional' ||
    evidence.accountKind !== 'ira' ||
    evidence.inheritanceStatus !== 'owned' ||
    !['traditional', 'sep', 'simple'].includes(evidence.subtype)
  ) {
    throw new RangeError(
      `Source "${sourceAccountId}" is not a supported owned traditional, SEP, or SIMPLE IRA`,
    )
  }
  return {
    predicate: evidence.predicate,
    sourceAccountId,
    ownerPersonId: evidenceOwnerPersonId,
    accountType: evidence.accountType,
    accountKind: evidence.accountKind,
    inheritanceStatus: evidence.inheritanceStatus,
    subtype: evidence.subtype,
    accountOwnershipEvidenceId: requireNonblankId(
      evidence.accountOwnershipEvidenceId,
      'Account ownership evidence ID',
    ),
    iraClassificationEvidenceId: requireNonblankId(
      evidence.iraClassificationEvidenceId,
      'IRA classification evidence ID',
    ),
  }
}

function scheduleIssues(
  taxYear: number,
  scheduled: readonly ScheduledRequest[],
): readonly OwnedNonRothIraMovementScheduleIssue[] {
  const issues: OwnedNonRothIraMovementScheduleIssue[] = []
  const occurrencesByAction = new Map<ActionId, number>()
  const actionsBySlot = new Map<string, ActionId[]>()

  for (const item of scheduled) {
    const request = item.request
    occurrencesByAction.set(
      request.actionId,
      (occurrencesByAction.get(request.actionId) ?? 0) + 1,
    )

    if (request.year !== taxYear) {
      issues.push({
        kind: 'actionYearMismatch',
        actionId: request.actionId,
        expectedYear: taxYear,
        actualYear: request.year,
      })
    }
    if (request.executionDate === undefined) {
      issues.push({
        kind: 'executionDateRequired',
        actionId: request.actionId,
      })
      continue
    }
    const parsed = parseCivilIsoDate(request.executionDate)
    if (
      parsed === null ||
      formatCivilDate(parsed) !== request.executionDate
    ) {
      issues.push({
        kind: 'executionDateInvalid',
        actionId: request.actionId,
        executionDate: request.executionDate,
      })
      continue
    }
    if (parsed.year !== taxYear) {
      issues.push({
        kind: 'executionDateYearMismatch',
        actionId: request.actionId,
        executionDate: request.executionDate,
        expectedYear: taxYear,
        actualYear: parsed.year,
      })
    }
    const slot = JSON.stringify([
      request.executionDate,
      request.executionSequence,
    ])
    const slotActions = actionsBySlot.get(slot) ?? []
    slotActions.push(request.actionId)
    actionsBySlot.set(slot, slotActions)
  }

  for (const [actionId, occurrences] of occurrencesByAction) {
    if (occurrences > 1) {
      issues.push({
        kind: 'duplicateActionId',
        actionId,
      })
    }
  }
  for (const [slot, actionIds] of actionsBySlot) {
    const distinct = [...new Set(actionIds)].sort(compareUtf16CodeUnits)
    if (distinct.length > 1) {
      const [executionDate, executionSequence] = JSON.parse(slot) as [
        string,
        number,
      ]
      issues.push({
        kind: 'executionSequenceConflict',
        taxYear,
        executionDate,
        executionSequence,
        collidingActionIds: distinct as [
          ActionId,
          ActionId,
          ...ActionId[],
        ],
      })
    }
  }

  return issues.sort((left, right) =>
    compareUtf16CodeUnits(JSON.stringify(left), JSON.stringify(right)),
  )
}

/**
 * Stages the physical exact-cent movement candidate for one owner/tax-year
 * batch of dated, IRA-only ordinary withdrawals.
 *
 * This function never commits balances and never characterizes annual Form
 * 8606 basis or penalty treatment. Its positive line-7 entries are intended
 * for the separate annual finalization boundary; a later coordinator must
 * atomically bind this movementCandidateId to that boundary's
 * finalizationEvidenceId before any movement can be committed.
 */
export function stageOwnedNonRothIraOrdinaryWithdrawalMovements(
  input: Readonly<StageOwnedNonRothIraOrdinaryWithdrawalMovementsInput>,
): Readonly<StageOwnedNonRothIraOrdinaryWithdrawalMovementsResult> {
  const ownerPersonId = personIdSchema.parse(input.ownerPersonId)
  if (
    !Number.isSafeInteger(input.taxYear) ||
    input.taxYear < 1 ||
    input.taxYear > 9999
  ) {
    throw new RangeError(
      'Owned non-Roth IRA movement tax year must be a four-digit year',
    )
  }
  if (input.requests.length === 0) {
    throw new RangeError(
      'Owned non-Roth IRA movement staging requires at least one request',
    )
  }

  const requests = input.requests.map((request) =>
    canonicalRequest(ordinaryWithdrawalRequestSchema.parse(request)),
  )
  const requestedSourceIds = new Set<AccountId>()
  for (const request of requests) {
    if (request.personId !== ownerPersonId) {
      throw new RangeError(
        `Ordinary withdrawal "${request.actionId}" belongs to a foreign owner`,
      )
    }
    for (const allocation of request.allocations) {
      requestedSourceIds.add(allocation.sourceAccountId)
    }
  }

  const sourceEvidence = input.sourceEvidence
    .map((evidence) => validateSourceEvidence(evidence, ownerPersonId))
    .sort((left, right) =>
      compareUtf16CodeUnits(left.sourceAccountId, right.sourceAccountId),
    )
  const evidenceBySource = new Map<AccountId, OwnedNonRothIraMovementSourceEvidence>()
  const ownershipEvidenceIds = new Set<string>()
  const classificationEvidenceIds = new Set<string>()
  for (const evidence of sourceEvidence) {
    if (evidenceBySource.has(evidence.sourceAccountId)) {
      throw new RangeError(
        `Duplicate source evidence for "${evidence.sourceAccountId}"`,
      )
    }
    if (ownershipEvidenceIds.has(evidence.accountOwnershipEvidenceId)) {
      throw new RangeError(
        `Duplicate account ownership evidence ID "${evidence.accountOwnershipEvidenceId}"`,
      )
    }
    if (
      classificationEvidenceIds.has(
        evidence.iraClassificationEvidenceId,
      )
    ) {
      throw new RangeError(
        `Duplicate IRA classification evidence ID "${evidence.iraClassificationEvidenceId}"`,
      )
    }
    evidenceBySource.set(evidence.sourceAccountId, evidence)
    ownershipEvidenceIds.add(evidence.accountOwnershipEvidenceId)
    classificationEvidenceIds.add(evidence.iraClassificationEvidenceId)
  }

  const openingBalances = input.openingBalances
    .map((snapshot): AccountOpeningBalanceSnapshot => ({
      accountId: accountIdSchema.parse(snapshot.accountId),
      openingBalance: usdCentsSchema.parse(snapshot.openingBalance),
    }))
    .sort((left, right) =>
      compareUtf16CodeUnits(left.accountId, right.accountId),
    )
  const openingBySource = new Map<AccountId, AccountOpeningBalanceSnapshot>()
  for (const snapshot of openingBalances) {
    if (openingBySource.has(snapshot.accountId)) {
      throw new RangeError(
        `Duplicate opening snapshot for "${snapshot.accountId}"`,
      )
    }
    openingBySource.set(snapshot.accountId, snapshot)
  }

  for (const sourceAccountId of requestedSourceIds) {
    if (!evidenceBySource.has(sourceAccountId)) {
      throw new RangeError(
        `Missing owned IRA source evidence for "${sourceAccountId}"`,
      )
    }
    if (!openingBySource.has(sourceAccountId)) {
      throw new RangeError(
        `Missing exact-cent opening snapshot for "${sourceAccountId}"`,
      )
    }
  }
  for (const sourceAccountId of evidenceBySource.keys()) {
    if (!requestedSourceIds.has(sourceAccountId)) {
      throw new RangeError(
        `Source evidence for "${sourceAccountId}" is outside the IRA-only batch`,
      )
    }
  }
  for (const sourceAccountId of openingBySource.keys()) {
    if (!requestedSourceIds.has(sourceAccountId)) {
      throw new RangeError(
        `Opening snapshot for "${sourceAccountId}" is outside the IRA-only batch`,
      )
    }
  }

  const scheduled: ScheduledRequest[] = requests
    .map((request) => ({
      request,
      executionDate: request.executionDate ?? null,
      chronologyKey: request.executionDate ?? '',
    }))
    .sort(
      (left, right) =>
        compareUtf16CodeUnits(left.chronologyKey, right.chronologyKey) ||
        left.request.executionSequence -
          right.request.executionSequence ||
        compareUtf16CodeUnits(
          left.request.actionId,
          right.request.actionId,
        ) ||
        compareUtf16CodeUnits(
          JSON.stringify(left.request),
          JSON.stringify(right.request),
        ),
    )
  const detectedScheduleIssues = scheduleIssues(input.taxYear, scheduled)

  const requestedBySource = new Map<AccountId, bigint>()
  for (const item of scheduled) {
    for (const allocation of item.request.allocations) {
      const requested =
        (requestedBySource.get(allocation.sourceAccountId) ?? 0n) +
        BigInt(allocation.requestedAmount)
      centsFromBigInt(requested, 'Owned IRA requested source total')
      requestedBySource.set(allocation.sourceAccountId, requested)
    }
  }

  if (detectedScheduleIssues.length > 0) {
    const candidateBalances = openingBalances.map(
      (snapshot): OwnedNonRothIraMovementCandidateBalance => {
        const requestedAmount = centsFromBigInt(
          requestedBySource.get(snapshot.accountId) ?? 0n,
          'Owned IRA requested source total',
        )
        return {
          sourceAccountId: snapshot.accountId,
          ownerPersonId,
          openingBalance: snapshot.openingBalance,
          requestedAmount,
          executedAmount: asUsdCents(0),
          unexecutedAmount: requestedAmount,
          candidateClosingBalance: snapshot.openingBalance,
        }
      },
    )
    const movementCandidateId = deriveActionStructuralId(
      'owned-non-roth-ira-movement-candidate',
      [
        ownerPersonId,
        input.taxYear,
        scheduled.map((item) => item.request),
        sourceEvidence,
        openingBalances,
        candidateBalances,
        detectedScheduleIssues,
        [],
        [],
      ],
    )
    return deepFreeze({
      status: 'scheduleInvalid',
      movement: 'notCommitted',
      movementCandidateId,
      ownerPersonId,
      taxYear: input.taxYear,
      scheduleIssues: detectedScheduleIssues as [
        OwnedNonRothIraMovementScheduleIssue,
        ...OwnedNonRothIraMovementScheduleIssue[],
      ],
      candidateBalances,
      actions: [],
      line7Distributions: [],
    })
  }

  const workingBalances = new Map<AccountId, UsdCents>(
    openingBalances.map((snapshot) => [
      snapshot.accountId,
      snapshot.openingBalance,
    ]),
  )
  const executedBySource = new Map<AccountId, bigint>()
  const actions: OwnedNonRothIraMovementActionEvidence[] = []
  const line7Distributions: AnnualIraBasisAllocationEntryInput[] = []

  for (const item of scheduled) {
    const request = item.request
    const executionDate = item.executionDate
    if (executionDate === null) {
      throw new Error('Validated IRA movement schedule unexpectedly lacks a date')
    }
    const allocations: OwnedNonRothIraMovementAllocationEvidence[] = []
    let actionExecuted = 0n
    for (const allocation of request.allocations) {
      const balanceBefore = workingBalances.get(allocation.sourceAccountId)
      const evidence = evidenceBySource.get(allocation.sourceAccountId)
      if (balanceBefore === undefined || evidence === undefined) {
        throw new Error('Validated IRA source facts unexpectedly disappeared')
      }
      const executed = BigInt(allocation.requestedAmount) < BigInt(balanceBefore)
        ? BigInt(allocation.requestedAmount)
        : BigInt(balanceBefore)
      const unexecuted =
        BigInt(allocation.requestedAmount) - executed
      const balanceAfter = BigInt(balanceBefore) - executed
      const executedAmount = centsFromBigInt(
        executed,
        'Owned IRA allocation execution',
      )
      const unexecutedAmount = centsFromBigInt(
        unexecuted,
        'Owned IRA allocation unexecuted amount',
      )
      const candidateBalanceAfter = centsFromBigInt(
        balanceAfter,
        'Owned IRA candidate closing balance',
      )
      workingBalances.set(allocation.sourceAccountId, candidateBalanceAfter)
      executedBySource.set(
        allocation.sourceAccountId,
        (executedBySource.get(allocation.sourceAccountId) ?? 0n) +
          executed,
      )
      actionExecuted += executed
      allocations.push({
        allocationId: allocation.allocationId,
        sourceAccountId: allocation.sourceAccountId,
        requestedAmount: allocation.requestedAmount,
        balanceBefore,
        executedAmount,
        unexecutedAmount,
        candidateBalanceAfter,
        sourceEvidence: { ...evidence },
      })
      if (executedAmount > 0) {
        line7Distributions.push({
          actionId: request.actionId,
          allocationId: allocation.allocationId,
          sourceAccountId: allocation.sourceAccountId,
          scheduledDate: executionDate,
          scheduledSequence: request.executionSequence,
          grossAmount: executedAmount,
        })
      }
    }
    const executedAmount = centsFromBigInt(
      actionExecuted,
      'Owned IRA action execution',
    )
    actions.push({
      request,
      actionId: request.actionId,
      ownerPersonId,
      taxYear: input.taxYear,
      executionDate,
      executionSequence: request.executionSequence,
      requestedAmount: request.requestedAmount,
      executedAmount,
      unexecutedAmount: asUsdCents(
        request.requestedAmount - executedAmount,
      ),
      candidateDisposition: candidateDisposition(
        request.requestedAmount,
        executedAmount,
      ),
      allocations: allocations as [
        OwnedNonRothIraMovementAllocationEvidence,
        ...OwnedNonRothIraMovementAllocationEvidence[],
      ],
    })
  }

  const candidateBalances = openingBalances.map(
    (snapshot): OwnedNonRothIraMovementCandidateBalance => {
      const requestedAmount = centsFromBigInt(
        requestedBySource.get(snapshot.accountId) ?? 0n,
        'Owned IRA requested source total',
      )
      const executedAmount = centsFromBigInt(
        executedBySource.get(snapshot.accountId) ?? 0n,
        'Owned IRA executed source total',
      )
      return {
        sourceAccountId: snapshot.accountId,
        ownerPersonId,
        openingBalance: snapshot.openingBalance,
        requestedAmount,
        executedAmount,
        unexecutedAmount: asUsdCents(
          requestedAmount - executedAmount,
        ),
        candidateClosingBalance:
          workingBalances.get(snapshot.accountId) ??
          snapshot.openingBalance,
      }
    },
  )
  const movementCandidateId = deriveActionStructuralId(
    'owned-non-roth-ira-movement-candidate',
    [
      ownerPersonId,
      input.taxYear,
      scheduled.map((item) => item.request),
      sourceEvidence,
      openingBalances,
      actions,
      candidateBalances,
      line7Distributions,
      [],
    ],
  )
  return deepFreeze({
    status: 'movementCandidateStaged',
    movement: 'notCommitted',
    movementCandidateId,
    ownerPersonId,
    taxYear: input.taxYear,
    scheduleIssues: [],
    candidateBalances,
    actions,
    line7Distributions,
  })
}
