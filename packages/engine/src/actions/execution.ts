import type { Plan } from '../model/plan.js'
import {
  evaluateRetirementActionEligibilityFromPlan,
  type RetirementActionEligibilityRuntimeEvidence,
} from '../strategies/accountEligibility.js'
import {
  actionExecutionDispositionSchema,
  retirementActionRequestSchema,
  type ActionExecutionDisposition,
  type ActionProvenance,
  type ExecutedActionDisposition,
  type OrdinaryWithdrawalRequest,
  type PartialActionDisposition,
  type RetirementActionRequest,
  type SourceAllocationRequest,
  type WithdrawalPurpose,
} from './contract.js'
import {
  accountIdSchema,
  asPersonId,
  type AccountId,
  type ActionId,
  type AllocationId,
  type PersonId,
} from './identity.js'
import {
  asPositiveUsdCents,
  asUsdCents,
  usdCentsSchema,
  type PositiveUsdCents,
  type UsdCents,
} from './money.js'
import { createActionReason, type ActionReason } from './reasons.js'
import { formatCivilDate, parseCivilIsoDate } from './civilDate.js'

export interface AccountOpeningBalanceSnapshot {
  accountId: AccountId
  openingBalance: UsdCents
}

export interface AccountBalanceExecutionEvidence extends AccountOpeningBalanceSnapshot {
  closingBalance: UsdCents
}

interface SourceAllocationExecutionEvidenceBase {
  allocationId: AllocationId
  sourceAccountId: AccountId
  requestedAmount: PositiveUsdCents
  balanceBefore: UsdCents | null
  executedAmount: UsdCents
  unexecutedAmount: UsdCents
  balanceAfter: UsdCents | null
}

export type SourceAllocationExecutionEvidence =
  | Readonly<
      SourceAllocationExecutionEvidenceBase & {
        resolution: 'resolved'
        ownerPersonIds: readonly PersonId[]
        actingPersonId: PersonId | null
      }
    >
  | Readonly<
      SourceAllocationExecutionEvidenceBase & {
        resolution: 'unresolved'
        ownerPersonIds: null
        actingPersonId: null
      }
    >

export type ResolvedCashSourceAllocationExecutionEvidence = Readonly<
  SourceAllocationExecutionEvidenceBase & {
    resolution: 'resolved'
    ownerPersonIds: readonly [PersonId]
    actingPersonId: PersonId
  }
>

export interface AcceptedCashSourceEligibilityEvidence {
  predicate: 'isSpendableInYear'
  allocationId: AllocationId
  sourceAccountId: AccountId
  evaluationDate: string
  sourceClass: 'cash'
  availabilityEvidence: Readonly<{ kind: 'intrinsicallySpendable' }>
}

export interface CashPrincipalTaxCharacter {
  actionId: ActionId
  allocationId: AllocationId
  sourceAccountId: AccountId
  sourceClass: 'cash'
  kind: 'cashPrincipal'
  amount: PositiveUsdCents
  characterEvidence: Readonly<{
    rule: 'intrinsicCashPrincipal'
    allocationId: AllocationId
    segmentAmount: PositiveUsdCents
  }>
}

export interface CashSourcePenaltyCoverageEvidence {
  coverageEvidenceId: string
  actionId: ActionId
  allocationId: AllocationId
  sourceAccountId: AccountId
  applicability: 'notApplicable'
  sourceClass: 'cash'
  reason: 'nonRetirementSource'
  executedAmount: UsdCents
  penaltyRelevantCharacterAmount: 0
  nonPenaltyRelevantCharacterAmount: UsdCents
  coveredPenaltyExposureAmount: 0
  coverageDifferenceAmount: 0
  segments: readonly []
}

interface CashOrdinaryWithdrawalExecutionEvidenceBase {
  request: Readonly<RetirementActionRequest>
  actionId: ActionId
  kind: RetirementActionRequest['kind']
  personId: PersonId | null
  year: number
  scheduledDate: string | null
  scheduledSequence: number | null
  requestedAmount: PositiveUsdCents
  provenance: Readonly<ActionProvenance>
  purpose: Readonly<WithdrawalPurpose> | null
  allocations: readonly SourceAllocationExecutionEvidence[]
  disposition: ActionExecutionDisposition
}

export type CashExecutedActionDisposition = Readonly<
  Omit<ExecutedActionDisposition, 'executedAmount' | 'reasons'> & {
    executedAmount: PositiveUsdCents
    reasons: readonly []
  }
>

export type CashPartialActionDisposition = Readonly<
  Omit<PartialActionDisposition, 'executedAmount' | 'reasons'> & {
    executedAmount: PositiveUsdCents
    reasons: readonly [ActionReason<'source-balance-trimmed'>]
  }
>

export type CashActionableExecutionDisposition =
  | CashExecutedActionDisposition
  | CashPartialActionDisposition

export type CashOrdinaryWithdrawalExecutionEvidence =
  | Readonly<
      Omit<
        CashOrdinaryWithdrawalExecutionEvidenceBase,
        'request' | 'kind' | 'personId' | 'purpose' | 'allocations' | 'disposition'
      > & {
        readiness: 'actionable'
        request: Readonly<OrdinaryWithdrawalRequest>
        kind: 'ordinaryWithdrawal'
        personId: PersonId
        purpose: Readonly<WithdrawalPurpose>
        allocations: readonly [
          ResolvedCashSourceAllocationExecutionEvidence,
          ...ResolvedCashSourceAllocationExecutionEvidence[],
        ]
        disposition: CashActionableExecutionDisposition
        executedDate: string
        executedSequence: number
        acceptedSourceEligibility: readonly [
          AcceptedCashSourceEligibilityEvidence,
          ...AcceptedCashSourceEligibilityEvidence[],
        ]
        taxCharacter: readonly [
          CashPrincipalTaxCharacter,
          ...CashPrincipalTaxCharacter[],
        ]
        penalty: readonly []
        penaltyCoverage: readonly [
          CashSourcePenaltyCoverageEvidence,
          ...CashSourcePenaltyCoverageEvidence[],
        ]
      }
    >
  | Readonly<
      CashOrdinaryWithdrawalExecutionEvidenceBase & {
        readiness: 'nonActionable'
        executedDate: null
        executedSequence: null
        taxCharacter: readonly []
        penalty: readonly []
      }
    >

export interface ExecuteCashOrdinaryWithdrawalsInput {
  year: number
  plan: Plan
  requests: readonly RetirementActionRequest[]
  openingBalances: readonly AccountOpeningBalanceSnapshot[]
  runtimeEvidence?: RetirementActionEligibilityRuntimeEvidence
}

export interface ExecuteCashOrdinaryWithdrawalsResult {
  committed: boolean
  scheduleIssues: readonly CashExecutionScheduleIssue[]
  balances: readonly AccountBalanceExecutionEvidence[]
  evidence: readonly CashOrdinaryWithdrawalExecutionEvidence[]
}

export type CashExecutionScheduleIssue =
  | Readonly<{
      kind: 'actionYearMismatch'
      actionId: ActionId
      expectedYear: number
      actualYear: number
    }>
  | Readonly<{
      kind: 'duplicateActionId'
      actionId: ActionId
      inputIndexes: readonly [number, number, ...number[]]
    }>
  | Readonly<{
      kind: 'executionSequenceConflict'
      year: number
      scheduledDate: string | null
      executionSequence: number
      collidingActionIds: readonly [ActionId, ActionId, ...ActionId[]]
      reason: ActionReason<'action-sequence-conflict'>
    }>

interface ScheduledRequest {
  inputIndex: number
  request: RetirementActionRequest
  scheduledDate: string | null
  executionDate: string | null
  sequence: number | null
  chronologyKey: string
  scheduleGroupKey: string
  scheduleInvalid: boolean
}

function compareUtf16CodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

function centsFromBigInt(value: bigint): UsdCents {
  if (value < 0n || value > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new RangeError('Exact-cent arithmetic exceeded the safe-integer range')
  }
  return asUsdCents(Number(value))
}

function canonicalAllocations(
  request: RetirementActionRequest,
): readonly SourceAllocationRequest[] {
  const allocations =
    request.kind === 'ordinaryWithdrawal' || request.kind === 'rothConversion'
      ? request.allocations
      : request.kind === 'qcd'
        ? [request.allocation]
        : []
  return [...allocations].sort(
    (left, right) =>
      compareUtf16CodeUnits(left.allocationId, right.allocationId) ||
      compareUtf16CodeUnits(left.sourceAccountId, right.sourceAccountId),
  )
}

function indexUnique<T>(
  values: readonly T[],
  keyOf: (value: T) => string,
): ReadonlyMap<string, T | null> {
  const result = new Map<string, T | null>()
  for (const value of values) {
    const key = keyOf(value)
    result.set(key, result.has(key) ? null : value)
  }
  return result
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

function reasonKey(reason: ActionReason): string {
  return JSON.stringify([
    reason.code,
    reason.personId ?? null,
    reason.accountId ?? null,
    reason.allocationId ?? null,
  ])
}

function canonicalReasons(reasons: readonly ActionReason[]): readonly ActionReason[] {
  const unique = [...new Map(reasons.map((reason) => [reasonKey(reason), reason])).values()]
  const unsupported = unique.filter((reason) => reason.outcome === 'unsupported')
  const refused = unique.filter((reason) => reason.outcome === 'refused')
  return unsupported.length > 0 ? [...unsupported, ...refused] : refused
}

function nonActionableDisposition(
  requestedAmount: PositiveUsdCents,
  reasons: readonly ActionReason[],
): ActionExecutionDisposition {
  const canonical = canonicalReasons(reasons)
  if (canonical.length === 0) {
    throw new Error('Non-actionable execution evidence requires a blocking reason')
  }
  const unsupported = canonical[0]?.outcome === 'unsupported'
  return actionExecutionDispositionSchema.parse({
    outcome: unsupported ? 'unsupported' : 'refused',
    readiness: 'nonActionable',
    requestedAmount,
    executedAmount: asUsdCents(0),
    unexecutedAmount: asUsdCents(requestedAmount),
    reasons: canonical,
  })
}

function actionableDisposition(
  requestedAmount: PositiveUsdCents,
  executedAmount: UsdCents,
): ActionExecutionDisposition {
  const unexecutedAmount = centsFromBigInt(
    BigInt(requestedAmount) - BigInt(executedAmount),
  )
  if (executedAmount === requestedAmount) {
    return actionExecutionDispositionSchema.parse({
      outcome: 'executed',
      readiness: 'actionable',
      requestedAmount,
      executedAmount,
      unexecutedAmount,
      reasons: [],
    })
  }
  if (executedAmount === 0) {
    return nonActionableDisposition(requestedAmount, [
      createActionReason('source-balance-unavailable'),
    ])
  }
  return actionExecutionDispositionSchema.parse({
    outcome: 'partial',
    readiness: 'actionable',
    requestedAmount,
    executedAmount,
    unexecutedAmount,
    reasons: [createActionReason('source-balance-trimmed')],
  })
}

function normalizeSchedule(
  request: RetirementActionRequest,
  inputIndex: number,
): ScheduledRequest {
  if (
    request.kind === 'legacyAggregateWithdrawal' ||
    request.kind === 'legacyAggregateRothConversion' ||
    request.kind === 'legacyAggregateQcd'
  ) {
    return {
      inputIndex,
      request,
      scheduledDate: null,
      executionDate: null,
      sequence: null,
      chronologyKey: '9999-12-31',
      scheduleGroupKey: 'legacy',
      scheduleInvalid: true,
    }
  }

  const scheduledDate = request.executionDate ?? null
  if (scheduledDate === null && request.kind === 'ordinaryWithdrawal') {
    const executionDate = `${String(request.year).padStart(4, '0')}-12-31`
    return {
      inputIndex,
      request,
      scheduledDate,
      executionDate,
      sequence: request.executionSequence,
      chronologyKey: `${executionDate}|1`,
      scheduleGroupKey: `undated:${request.year}`,
      scheduleInvalid: false,
    }
  }
  const parsed = scheduledDate === null ? null : parseCivilIsoDate(scheduledDate)
  const valid = parsed !== null && parsed.year === request.year
  return {
    inputIndex,
    request,
    scheduledDate,
    executionDate: valid ? formatCivilDate(parsed) : null,
    sequence: request.executionSequence,
    chronologyKey: valid
      ? `${formatCivilDate(parsed)}|0`
      : `${String(request.year).padStart(4, '0')}-99-99|0`,
    scheduleGroupKey: valid ? `dated:${formatCivilDate(parsed)}` : 'invalid',
    scheduleInvalid: !valid,
  }
}

function requestPersonId(request: RetirementActionRequest): PersonId | null {
  if (request.kind === 'ordinaryWithdrawal' || request.kind === 'rothConversion') {
    return request.personId
  }
  return request.kind === 'qcd' ? request.donorPersonId : null
}

function requestPurpose(request: RetirementActionRequest): WithdrawalPurpose | null {
  return request.kind === 'ordinaryWithdrawal' ? request.purpose : null
}

function scheduleIssues(
  year: number,
  scheduled: readonly ScheduledRequest[],
): readonly CashExecutionScheduleIssue[] {
  const issues: CashExecutionScheduleIssue[] = []
  const ids = new Map<ActionId, number[]>()
  for (const item of scheduled) {
    if (item.request.year !== year) {
      issues.push({
        kind: 'actionYearMismatch',
        actionId: item.request.actionId,
        expectedYear: year,
        actualYear: item.request.year,
      })
    }
    const matches = ids.get(item.request.actionId)
    if (matches === undefined) ids.set(item.request.actionId, [item.inputIndex])
    else matches.push(item.inputIndex)
  }
  for (const [actionId, matches] of ids) {
    if (matches.length > 1) {
      issues.push({
        kind: 'duplicateActionId',
        actionId,
        inputIndexes: [...matches].sort((left, right) => left - right) as [
          number,
          number,
          ...number[],
        ],
      })
    }
  }

  const slots = new Map<string, ScheduledRequest[]>()
  for (const item of scheduled) {
    if (
      item.request.kind === 'legacyAggregateWithdrawal' ||
      item.request.kind === 'legacyAggregateRothConversion' ||
      item.request.kind === 'legacyAggregateQcd' ||
      item.scheduleInvalid ||
      item.sequence === null ||
      item.request.year !== year
    ) {
      continue
    }
    const key = JSON.stringify([item.scheduleGroupKey, item.sequence])
    const peers = slots.get(key)
    if (peers === undefined) slots.set(key, [item])
    else peers.push(item)
  }
  for (const peers of slots.values()) {
    if (peers.length > 1) {
      const first = peers[0]!
      const collidingActionIds = peers
        .map((item) => item.request.actionId)
        .sort(compareUtf16CodeUnits) as [ActionId, ActionId, ...ActionId[]]
      issues.push({
        kind: 'executionSequenceConflict',
        year,
        scheduledDate: first.scheduledDate,
        executionSequence: first.sequence!,
        collidingActionIds,
        reason: createActionReason('action-sequence-conflict'),
      })
    }
  }
  return issues.sort((left, right) => {
    const leftKey = JSON.stringify(left)
    const rightKey = JSON.stringify(right)
    return compareUtf16CodeUnits(leftKey, rightKey)
  })
}

function unsupportedScopeReason(request: RetirementActionRequest): ActionReason {
  if (request.kind === 'legacyAggregateWithdrawal') {
    return createActionReason('withdrawal-aggregate-unallocated')
  }
  if (request.kind === 'legacyAggregateRothConversion') {
    return createActionReason('conversion-aggregate-unallocated')
  }
  if (request.kind === 'legacyAggregateQcd') {
    return createActionReason('qcd-aggregate-unallocated')
  }
  return createActionReason('required-facts-missing', {
    personId: requestPersonId(request) ?? undefined,
  })
}

function unresolvedAllocationEvidence(
  allocations: readonly SourceAllocationRequest[],
  accounts: ReadonlyMap<string, Plan['accounts'][number] | null>,
  balances: ReadonlyMap<string, AccountOpeningBalanceSnapshot | null>,
  workingBalances: ReadonlyMap<string, UsdCents>,
  actingPersonId: PersonId | null,
): readonly SourceAllocationExecutionEvidence[] {
  return allocations.map((allocation) => {
    const account = accounts.get(allocation.sourceAccountId)
    const snapshot = balances.get(allocation.sourceAccountId)
    const before =
      snapshot == null ? null : (workingBalances.get(allocation.sourceAccountId) ?? null)
    if (account == null) {
      return {
        ...allocation,
        resolution: 'unresolved',
        ownerPersonIds: null,
        actingPersonId: null,
        balanceBefore: before,
        executedAmount: asUsdCents(0),
        unexecutedAmount: asUsdCents(allocation.requestedAmount),
        balanceAfter: before,
      }
    }
    return {
      ...allocation,
      resolution: 'resolved',
      ownerPersonIds:
        account.ownerPersonId === null ? [] : [asPersonId(account.ownerPersonId)],
      actingPersonId,
      balanceBefore: before,
      executedAmount: asUsdCents(0),
      unexecutedAmount: asUsdCents(allocation.requestedAmount),
      balanceAfter: before,
    }
  })
}

function cashCoverageEvidenceId(
  actionId: ActionId,
  allocationId: AllocationId,
): string {
  return `cash-penalty-coverage:${JSON.stringify([actionId, allocationId])}`
}

function assertCashExecutionEvidence(
  evidence: CashOrdinaryWithdrawalExecutionEvidence,
): void {
  const fail = (message: string): never => {
    throw new Error(`Invalid cash execution evidence: ${message}`)
  }
  if (evidence.penalty.length !== 0) fail('cash penalty evidence must be empty')
  if (evidence.readiness === 'nonActionable') {
    if (evidence.disposition.readiness !== 'nonActionable') {
      fail('wrapper and disposition readiness differ')
    }
    if (evidence.taxCharacter.length !== 0) {
      fail('non-actionable tax character must be empty')
    }
    if ('penaltyCoverage' in evidence) {
      fail('non-actionable evidence cannot carry penalty coverage')
    }
    return
  }

  if (
    evidence.kind !== 'ordinaryWithdrawal' ||
    evidence.disposition.readiness !== 'actionable'
  ) {
    fail('only ordinary withdrawals may be actionable')
  }
  if (
    evidence.disposition.outcome === 'executed' &&
    evidence.disposition.reasons.length !== 0
  ) {
    fail('executed cash withdrawal reasons must be empty')
  }
  if (
    evidence.disposition.outcome === 'partial' &&
    (evidence.disposition.reasons.length !== 1 ||
      evidence.disposition.reasons[0]?.code !== 'source-balance-trimmed')
  ) {
    fail('partial cash withdrawal requires exactly source-balance-trimmed')
  }
  if (
    evidence.acceptedSourceEligibility.length !== evidence.allocations.length ||
    evidence.penaltyCoverage.length !== evidence.allocations.length
  ) {
    fail('each resolved allocation requires eligibility and penalty coverage')
  }

  const characterByAllocation = indexUnique(
    evidence.taxCharacter,
    (character) => character.allocationId,
  )
  const eligibilityByAllocation = indexUnique(
    evidence.acceptedSourceEligibility,
    (accepted) => accepted.allocationId,
  )
  const coverageByAllocation = indexUnique(
    evidence.penaltyCoverage,
    (coverage) => coverage.allocationId,
  )
  let executedTotal = 0n
  for (const allocation of evidence.allocations) {
    if (
      allocation.resolution !== 'resolved' ||
      allocation.actingPersonId !== evidence.personId ||
      allocation.ownerPersonIds.length !== 1 ||
      allocation.ownerPersonIds[0] !== evidence.personId
    ) {
      fail('actionable allocation owner and actor must be the request person')
    }
    if (
      BigInt(allocation.executedAmount) + BigInt(allocation.unexecutedAmount) !==
        BigInt(allocation.requestedAmount) ||
      allocation.balanceBefore === null ||
      allocation.balanceAfter === null ||
      BigInt(allocation.balanceAfter) + BigInt(allocation.executedAmount) !==
        BigInt(allocation.balanceBefore)
    ) {
      fail('allocation cents do not conserve')
    }
    executedTotal += BigInt(allocation.executedAmount)
    const accepted = eligibilityByAllocation.get(allocation.allocationId)
    if (
      accepted == null ||
      accepted.sourceAccountId !== allocation.sourceAccountId ||
      accepted.evaluationDate !== evidence.executedDate ||
      accepted.predicate !== 'isSpendableInYear' ||
      accepted.sourceClass !== 'cash' ||
      accepted.availabilityEvidence.kind !== 'intrinsicallySpendable'
    ) {
      fail('accepted cash eligibility is missing or mismatched')
    }
    const coverage = coverageByAllocation.get(allocation.allocationId)
    if (
      coverage == null ||
      coverage.coverageEvidenceId !==
        cashCoverageEvidenceId(evidence.actionId, allocation.allocationId) ||
      coverage.actionId !== evidence.actionId ||
      coverage.sourceAccountId !== allocation.sourceAccountId ||
      coverage.applicability !== 'notApplicable' ||
      coverage.sourceClass !== 'cash' ||
      coverage.reason !== 'nonRetirementSource' ||
      coverage.executedAmount !== allocation.executedAmount ||
      coverage.nonPenaltyRelevantCharacterAmount !== allocation.executedAmount ||
      coverage.penaltyRelevantCharacterAmount !== 0 ||
      coverage.coveredPenaltyExposureAmount !== 0 ||
      coverage.coverageDifferenceAmount !== 0 ||
      coverage.segments.length !== 0
    ) {
      fail('cash penalty coverage is missing or mismatched')
    }
    const character = characterByAllocation.get(allocation.allocationId)
    if (allocation.executedAmount === 0) {
      if (character !== undefined) fail('zero execution cannot emit tax character')
    } else if (
      character == null ||
      character.actionId !== evidence.actionId ||
      character.sourceAccountId !== allocation.sourceAccountId ||
      character.sourceClass !== 'cash' ||
      character.kind !== 'cashPrincipal' ||
      character.amount !== allocation.executedAmount ||
      character.characterEvidence.rule !== 'intrinsicCashPrincipal' ||
      character.characterEvidence.allocationId !== allocation.allocationId ||
      character.characterEvidence.segmentAmount !== allocation.executedAmount
    ) {
      fail('cash principal character is missing or mismatched')
    }
  }
  if (executedTotal !== BigInt(evidence.disposition.executedAmount)) {
    fail('action execution does not equal allocation execution')
  }
  if (
    evidence.taxCharacter.length !==
    evidence.allocations.filter((allocation) => allocation.executedAmount > 0).length
  ) {
    fail('cash character must be bijective with positive allocations')
  }
}

function executionEvidence(
  item: ScheduledRequest,
  disposition: ActionExecutionDisposition,
  allocations: readonly SourceAllocationExecutionEvidence[],
  taxCharacter: readonly CashPrincipalTaxCharacter[] = [],
  penaltyCoverage: readonly CashSourcePenaltyCoverageEvidence[] = [],
  acceptedSourceEligibility: readonly AcceptedCashSourceEligibilityEvidence[] = [],
): CashOrdinaryWithdrawalExecutionEvidence {
  const requestCopy = structuredClone(item.request)
  if (
    requestCopy.kind === 'ordinaryWithdrawal' ||
    requestCopy.kind === 'rothConversion'
  ) {
    requestCopy.allocations = [...canonicalAllocations(requestCopy)]
  }
  const request = deepFreeze(requestCopy)
  const base: CashOrdinaryWithdrawalExecutionEvidenceBase = {
    request,
    actionId: item.request.actionId,
    kind: item.request.kind,
    personId: requestPersonId(item.request),
    year: item.request.year,
    scheduledDate: item.scheduledDate,
    scheduledSequence: item.sequence,
    requestedAmount: item.request.requestedAmount,
    provenance: request.provenance,
    purpose: requestPurpose(request),
    allocations,
    disposition,
  }
  if (disposition.readiness === 'nonActionable') {
    const evidence: CashOrdinaryWithdrawalExecutionEvidence = {
      ...base,
      readiness: 'nonActionable',
      executedDate: null,
      executedSequence: null,
      taxCharacter: [],
      penalty: [],
    }
    assertCashExecutionEvidence(evidence)
    return deepFreeze(evidence)
  }
  if (item.executionDate === null || item.sequence === null) {
    throw new Error('Actionable evidence requires a resolved schedule')
  }
  if (
    request.kind !== 'ordinaryWithdrawal' ||
    allocations.length === 0 ||
    allocations.some((allocation) => allocation.resolution !== 'resolved') ||
    acceptedSourceEligibility.length === 0 ||
    taxCharacter.length === 0 ||
    penaltyCoverage.length === 0 ||
    disposition.executedAmount === 0
  ) {
    throw new Error('Actionable cash evidence is incomplete')
  }
  const evidence: CashOrdinaryWithdrawalExecutionEvidence = {
    ...base,
    readiness: 'actionable',
    request,
    kind: 'ordinaryWithdrawal',
    personId: request.personId,
    purpose: request.purpose,
    allocations: allocations as [
      ResolvedCashSourceAllocationExecutionEvidence,
      ...ResolvedCashSourceAllocationExecutionEvidence[],
    ],
    disposition: disposition as CashActionableExecutionDisposition,
    executedDate: item.executionDate,
    executedSequence: item.sequence,
    acceptedSourceEligibility: acceptedSourceEligibility as [
      AcceptedCashSourceEligibilityEvidence,
      ...AcceptedCashSourceEligibilityEvidence[],
    ],
    taxCharacter: taxCharacter as [
      CashPrincipalTaxCharacter,
      ...CashPrincipalTaxCharacter[],
    ],
    penalty: [],
    penaltyCoverage: penaltyCoverage as [
      CashSourcePenaltyCoverageEvidence,
      ...CashSourcePenaltyCoverageEvidence[],
    ],
  }
  assertCashExecutionEvidence(evidence)
  return deepFreeze(evidence)
}

/**
 * Pure WS3.1 exact-cent execution for individually owned cash withdrawals.
 * Plan dollar balances are identity metadata only; all movement uses snapshots.
 */
export function executeCashOrdinaryWithdrawals(
  input: ExecuteCashOrdinaryWithdrawalsInput,
): ExecuteCashOrdinaryWithdrawalsResult {
  const requests = input.requests.map((request) =>
    retirementActionRequestSchema.parse(request),
  )
  const conversionLinkedWithdrawalIds = new Set(
    [...input.plan.strategies.retirementActions, ...requests].flatMap((request) =>
      request.kind === 'rothConversion' &&
      request.taxFunding.kind === 'linkedWithdrawal'
        ? [request.taxFunding.withdrawalActionId]
        : [],
    ),
  )
  const openingBalances = input.openingBalances.map((snapshot) => ({
    accountId: accountIdSchema.parse(snapshot.accountId),
    openingBalance: usdCentsSchema.parse(snapshot.openingBalance),
  }))
  const scheduled = requests.map(normalizeSchedule).sort(
    (left, right) =>
      compareUtf16CodeUnits(left.chronologyKey, right.chronologyKey) ||
      (left.sequence ?? Number.MAX_SAFE_INTEGER) -
        (right.sequence ?? Number.MAX_SAFE_INTEGER) ||
      compareUtf16CodeUnits(left.request.actionId, right.request.actionId),
  )
  if (!Number.isSafeInteger(input.year) || input.year < 1 || input.year > 9999) {
    throw new RangeError('Execution year must be a four-digit positive calendar year')
  }
  const detectedScheduleIssues = scheduleIssues(input.year, scheduled)
  const snapshotCounts = new Map<string, number>()
  for (const snapshot of openingBalances) {
    snapshotCounts.set(snapshot.accountId, (snapshotCounts.get(snapshot.accountId) ?? 0) + 1)
  }
  const unchangedBalances = openingBalances
    .map((snapshot): AccountBalanceExecutionEvidence => ({
      ...snapshot,
      closingBalance: snapshot.openingBalance,
    }))
    .sort(
      (left, right) =>
        compareUtf16CodeUnits(left.accountId, right.accountId) ||
        left.openingBalance - right.openingBalance,
    )
  if (detectedScheduleIssues.length > 0) {
    return deepFreeze({
      committed: false,
      scheduleIssues: detectedScheduleIssues,
      balances: unchangedBalances,
      evidence: [],
    })
  }

  const accounts = indexUnique(input.plan.accounts, (account) => account.id)
  const snapshots = indexUnique(openingBalances, (snapshot) => snapshot.accountId)
  let workingBalances = new Map<string, UsdCents>()
  for (const [accountId, snapshot] of snapshots) {
    if (snapshot !== null) workingBalances.set(accountId, snapshot.openingBalance)
  }

  const evidence: CashOrdinaryWithdrawalExecutionEvidence[] = []
  for (const item of scheduled) {
    const request = item.request
    const allocations = canonicalAllocations(request)
    const preflight = evaluateRetirementActionEligibilityFromPlan(
      request,
      input.plan,
      input.runtimeEvidence,
    )
    const blockingReasons: ActionReason[] =
      preflight.status === 'accepted' ? [] : [...preflight.reasons]

    if (item.scheduleInvalid) blockingReasons.push(unsupportedScopeReason(request))
    if (request.kind !== 'ordinaryWithdrawal') {
      blockingReasons.push(unsupportedScopeReason(request))
    } else if (conversionLinkedWithdrawalIds.has(request.actionId)) {
      // Linked tax funding belongs to the conversion's atomic annual group.
      // Until that group executor exists, it must not move independently.
      blockingReasons.push(
        createActionReason('conversion-tax-funding-evidence-unsupported', {
          personId: request.personId,
        }),
      )
    } else {
      for (const allocation of allocations) {
        const account = accounts.get(allocation.sourceAccountId)
        if (account == null) {
          blockingReasons.push(
            createActionReason('source-account-not-found', {
              accountId: allocation.sourceAccountId,
              allocationId: allocation.allocationId,
            }),
          )
        } else {
          if (account.type !== 'cash') {
            blockingReasons.push(
              createActionReason('withdrawal-source-type-unsupported', {
                accountId: allocation.sourceAccountId,
                allocationId: allocation.allocationId,
              }),
            )
          } else if (account.ownerPersonId === null) {
            blockingReasons.push(
              createActionReason('joint-source-acting-person-mismatch', {
                personId: request.personId,
                accountId: allocation.sourceAccountId,
                allocationId: allocation.allocationId,
              }),
            )
          } else if (account.ownerPersonId !== request.personId) {
            blockingReasons.push(
              createActionReason('source-owner-mismatch', {
                personId: request.personId,
                accountId: allocation.sourceAccountId,
                allocationId: allocation.allocationId,
              }),
            )
          }
        }
        if (snapshots.get(allocation.sourceAccountId) == null) {
          blockingReasons.push(
            createActionReason('required-facts-missing', {
              personId: request.personId,
              accountId: allocation.sourceAccountId,
              allocationId: allocation.allocationId,
            }),
          )
        }
      }
    }

    if (blockingReasons.length > 0) {
      const disposition = nonActionableDisposition(
        request.requestedAmount,
        blockingReasons,
      )
      evidence.push(
        executionEvidence(
          item,
          disposition,
          unresolvedAllocationEvidence(
            allocations,
            accounts,
            snapshots,
            workingBalances,
            requestPersonId(request),
          ),
        ),
      )
      continue
    }
    if (request.kind !== 'ordinaryWithdrawal') {
      throw new Error('Unsupported action scope reached cash movement')
    }

    const stagedBalances = new Map(workingBalances)
    const allocationEvidence: SourceAllocationExecutionEvidence[] = []
    const taxCharacter: CashPrincipalTaxCharacter[] = []
    const penaltyCoverage: CashSourcePenaltyCoverageEvidence[] = []
    const acceptedSourceEligibility: AcceptedCashSourceEligibilityEvidence[] = []
    let executedTotal = 0n
    for (const allocation of allocations) {
      const before = stagedBalances.get(allocation.sourceAccountId)
      if (before === undefined) throw new Error('Validated cash snapshot disappeared')
      const executedAmount = centsFromBigInt(
        BigInt(before) < BigInt(allocation.requestedAmount)
          ? BigInt(before)
          : BigInt(allocation.requestedAmount),
      )
      const after = centsFromBigInt(BigInt(before) - BigInt(executedAmount))
      const unexecutedAmount = centsFromBigInt(
        BigInt(allocation.requestedAmount) - BigInt(executedAmount),
      )
      stagedBalances.set(allocation.sourceAccountId, after)
      executedTotal += BigInt(executedAmount)
      allocationEvidence.push({
        ...allocation,
        resolution: 'resolved',
        ownerPersonIds: [request.personId],
        actingPersonId: request.personId,
        balanceBefore: before,
        executedAmount,
        unexecutedAmount,
        balanceAfter: after,
      })
      if (executedAmount > 0) {
        const positiveExecutedAmount = asPositiveUsdCents(executedAmount)
        taxCharacter.push({
          actionId: request.actionId,
          allocationId: allocation.allocationId,
          sourceAccountId: allocation.sourceAccountId,
          sourceClass: 'cash',
          kind: 'cashPrincipal',
          amount: positiveExecutedAmount,
          characterEvidence: {
            rule: 'intrinsicCashPrincipal',
            allocationId: allocation.allocationId,
            segmentAmount: positiveExecutedAmount,
          },
        })
      }
      penaltyCoverage.push({
        coverageEvidenceId: cashCoverageEvidenceId(
          request.actionId,
          allocation.allocationId,
        ),
        actionId: request.actionId,
        allocationId: allocation.allocationId,
        sourceAccountId: allocation.sourceAccountId,
        applicability: 'notApplicable',
        sourceClass: 'cash',
        reason: 'nonRetirementSource',
        executedAmount,
        penaltyRelevantCharacterAmount: 0,
        nonPenaltyRelevantCharacterAmount: executedAmount,
        coveredPenaltyExposureAmount: 0,
        coverageDifferenceAmount: 0,
        segments: [],
      })
      if (item.executionDate === null) {
        throw new Error('Validated cash schedule disappeared')
      }
      acceptedSourceEligibility.push({
        predicate: 'isSpendableInYear',
        allocationId: allocation.allocationId,
        sourceAccountId: allocation.sourceAccountId,
        evaluationDate: item.executionDate,
        sourceClass: 'cash',
        availabilityEvidence: { kind: 'intrinsicallySpendable' },
      })
    }
    const disposition = actionableDisposition(
      request.requestedAmount,
      centsFromBigInt(executedTotal),
    )
    if (disposition.readiness === 'actionable') workingBalances = stagedBalances
    evidence.push(
      executionEvidence(
        item,
        disposition,
        allocationEvidence,
        taxCharacter,
        penaltyCoverage,
        acceptedSourceEligibility,
      ),
    )
  }

  const balances = openingBalances
    .map((snapshot): AccountBalanceExecutionEvidence => ({
      ...snapshot,
      closingBalance:
        snapshotCounts.get(snapshot.accountId) === 1
          ? (workingBalances.get(snapshot.accountId) ?? snapshot.openingBalance)
          : snapshot.openingBalance,
    }))
    .sort(
      (left, right) =>
        compareUtf16CodeUnits(left.accountId, right.accountId) ||
        left.openingBalance - right.openingBalance,
    )

  return deepFreeze({
    committed: true,
    scheduleIssues: [],
    balances,
    evidence,
  })
}
