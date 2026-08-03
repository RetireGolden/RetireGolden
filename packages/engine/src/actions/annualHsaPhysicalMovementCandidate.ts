import { ordinaryWithdrawalRequestSchema, type OrdinaryWithdrawalRequest } from './contract.js'
import { formatCivilDate, parseCivilIsoDate } from './civilDate.js'
import { evaluateRetirementActionSchedule } from './execution.js'
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
import { compareUtf16CodeUnits, deriveActionStructuralId } from './structuralId.js'

export interface OwnedHsaPhysicalSourceEvidence {
  predicate: 'ownedHsaOrdinaryWithdrawalPhysicalSource'
  sourceAccountId: AccountId
  ownerPersonId: PersonId
  accountType: 'hsa'
  ownership: 'individual'
  accountOwnershipEvidenceId: string
  hsaClassificationEvidenceId: string
  authoritative: true
}

export interface HsaDetachedBatchOpeningBalanceSnapshot {
  predicate: 'authoritativeHsaDetachedBatchOpeningBalance'
  boundary: 'detachedBatchStart'
  sourceAccountId: AccountId
  ownerPersonId: PersonId
  taxYear: number
  openingBalance: UsdCents
  openingBalanceEvidenceId: string
  authoritative: true
}

export interface StageAnnualHsaPhysicalMovementCandidateInput {
  taxYear: number
  requestInventoryComplete: true
  requests: readonly Readonly<OrdinaryWithdrawalRequest>[]
  sourceEvidenceInventoryComplete: true
  sourceEvidence: readonly Readonly<OwnedHsaPhysicalSourceEvidence>[]
  openingBalanceInventoryComplete: true
  openingBalances: readonly Readonly<HsaDetachedBatchOpeningBalanceSnapshot>[]
}

export type HsaPhysicalApplicationStatus = 'full' | 'partial' | 'zero'

export interface HsaPhysicalAllocationApplication {
  physicalApplicationEvidenceId: string
  actionId: ActionId
  allocationId: AllocationId
  sourceAccountId: AccountId
  distributionOwnerPersonId: PersonId
  evaluationDate: string
  actionExecutionSequence: number
  allocationSequenceWithinAction: number
  applicationStatus: HsaPhysicalApplicationStatus
  requestedAmount: PositiveUsdCents
  stagedAmount: UsdCents
  unstagedAmount: UsdCents
  sourceBalanceBefore: UsdCents
  sourceBalanceAfter: UsdCents
  sourceEvidence: Readonly<OwnedHsaPhysicalSourceEvidence>
  openingBalanceSnapshot: Readonly<HsaDetachedBatchOpeningBalanceSnapshot>
}

export interface HsaStagedPhysicalDistribution {
  actionId: ActionId
  allocationId: AllocationId
  sourceAccountId: AccountId
  distributionOwnerPersonId: PersonId
  evaluationDate: string
  actionExecutionSequence: number
  allocationSequenceWithinAction: number
  physicalApplicationEvidenceId: string
  stagedAmount: PositiveUsdCents
}

export interface HsaPhysicalActionDisposition {
  request: Readonly<OrdinaryWithdrawalRequest>
  status: 'fullyStaged' | 'partiallyStaged' | 'notStaged'
  requestedAmount: PositiveUsdCents
  stagedAmount: UsdCents
  unstagedAmount: UsdCents
  applications: readonly [Readonly<HsaPhysicalAllocationApplication>, ...Readonly<HsaPhysicalAllocationApplication>[]]
}

export interface HsaPhysicalCandidateSourceBalance {
  sourceAccountId: AccountId
  ownerPersonId: PersonId
  openingBalance: UsdCents
  requestedAmount: UsdCents
  stagedAmount: UsdCents
  unstagedAmount: UsdCents
  candidateClosingBalance: UsdCents
  accountOwnershipEvidenceId: string
  hsaClassificationEvidenceId: string
  openingBalanceEvidenceId: string
}

export interface AnnualHsaPhysicalMovementCandidate {
  status: 'physicalMovementCandidateStaged'
  movementCandidateId: string
  taxYear: number
  committed: false
  movement: 'notCommitted'
  actionability: 'notEstablished'
  publication: 'notEstablished'
  taxCharacter: 'notEstablished'
  penalty: 'notEstablished'
  runtimeInflows: 'notInventoried'
  priorCharacterReusable: false
  priorPenaltyReusable: false
  downstreamRequirement: 'rebuildReimbursementThenCharacterThenPenaltyFromCandidate'
  actions: readonly Readonly<HsaPhysicalActionDisposition>[]
  applications: readonly Readonly<HsaPhysicalAllocationApplication>[]
  stagedDistributions: readonly Readonly<HsaStagedPhysicalDistribution>[]
  candidateSourceBalances: readonly Readonly<HsaPhysicalCandidateSourceBalance>[]
}

const INPUT_KEYS = ['taxYear', 'requestInventoryComplete', 'requests', 'sourceEvidenceInventoryComplete', 'sourceEvidence', 'openingBalanceInventoryComplete', 'openingBalances']
const SOURCE_KEYS = ['predicate', 'sourceAccountId', 'ownerPersonId', 'accountType', 'ownership', 'accountOwnershipEvidenceId', 'hsaClassificationEvidenceId', 'authoritative']
const OPENING_KEYS = ['predicate', 'boundary', 'sourceAccountId', 'ownerPersonId', 'taxYear', 'openingBalance', 'openingBalanceEvidenceId', 'authoritative']
const INVALID = Symbol('invalid')

function plainSnapshot(value: unknown, seen = new WeakSet<object>()): unknown | typeof INVALID {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'number') return Number.isFinite(value) && !Object.is(value, -0) ? value : INVALID
  if (typeof value !== 'object' || seen.has(value)) return INVALID
  try {
    const array = Array.isArray(value)
    const prototype = Object.getPrototypeOf(value)
    if ((array && prototype !== Array.prototype) || (!array && prototype !== Object.prototype && prototype !== null)) return INVALID
    const keys = Reflect.ownKeys(value)
    if (keys.some((key) => typeof key !== 'string')) return INVALID
    if (array && (keys.length !== value.length + 1 || !keys.includes('length'))) return INVALID
    const output: unknown[] | Record<string, unknown> = array ? [] : Object.create(null) as Record<string, unknown>
    seen.add(value)
    for (const key of keys) {
      if (array && key === 'length') continue
      const descriptor = Object.getOwnPropertyDescriptor(value, key)
      if (descriptor === undefined || !descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) return INVALID
      if (array && (!Number.isSafeInteger(Number(key)) || String(Number(key)) !== key || Number(key) >= value.length)) return INVALID
      const child = plainSnapshot(descriptor.value, seen)
      if (child === INVALID) return INVALID
      Object.defineProperty(output, key, { enumerable: true, configurable: true, writable: true, value: child })
    }
    return output
  } catch {
    return INVALID
  }
}

function exactKeys(value: unknown, expected: readonly string[]): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  const keys = Object.keys(value)
  return keys.length === expected.length && keys.every((key) => expected.includes(key))
}

function deepFreeze<T>(value: T): Readonly<T> {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child)
    Object.freeze(value)
  }
  return value as Readonly<T>
}

function nonblank(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) throw new TypeError(`${label} must be a nonblank stable identifier`)
  return value
}

function cents(value: bigint, label: string): UsdCents {
  if (value < 0n || value > BigInt(Number.MAX_SAFE_INTEGER)) throw new RangeError(`${label} exceeds safe-integer cents`)
  return asUsdCents(Number(value))
}

function claim(registry: Map<string, string>, id: string, identity: readonly unknown[]): void {
  const canonical = JSON.stringify(identity)
  const prior = registry.get(id)
  if (prior !== undefined && prior !== canonical) throw new Error(`Identifier collision for "${id}"`)
  registry.set(id, canonical)
}

function collectStrings(value: unknown, strings: Set<string>): void {
  if (typeof value === 'string') {
    strings.add(value)
    return
  }
  if (value !== null && typeof value === 'object') {
    for (const child of Object.values(value as Record<string, unknown>)) collectStrings(child, strings)
  }
}

function applicationStatus(requested: PositiveUsdCents, staged: UsdCents): HsaPhysicalApplicationStatus {
  return staged === requested ? 'full' : staged === 0 ? 'zero' : 'partial'
}

function actionStatus(requested: PositiveUsdCents, staged: UsdCents): HsaPhysicalActionDisposition['status'] {
  return staged === requested ? 'fullyStaged' : staged === 0 ? 'notStaged' : 'partiallyStaged'
}

/**
 * Replays a complete detached-batch inventory of dated HSA withdrawals against
 * exact balances at that batch's start. Runtime inflows are not inventoried.
 * The result neither mutates balances nor reuses pre-movement tax conclusions.
 */
export function stageAnnualHsaPhysicalMovementCandidate(
  raw: Readonly<StageAnnualHsaPhysicalMovementCandidateInput>,
): Readonly<AnnualHsaPhysicalMovementCandidate> {
  const snapshot = plainSnapshot(raw)
  if (snapshot === INVALID || !exactKeys(snapshot, INPUT_KEYS)) throw new TypeError('Annual HSA physical input must be acyclic plain data with an exact shape')
  const input = snapshot as unknown as StageAnnualHsaPhysicalMovementCandidateInput
  const suppliedStrings = new Set<string>()
  collectStrings(snapshot, suppliedStrings)
  if (!Number.isSafeInteger(input.taxYear) || input.taxYear < 1 || input.taxYear > 9999) throw new RangeError('Annual HSA physical tax year must be a four-digit year')
  if (input.requestInventoryComplete !== true || input.sourceEvidenceInventoryComplete !== true || input.openingBalanceInventoryComplete !== true) throw new RangeError('Annual HSA physical inventories must be explicitly complete')
  if (input.requests.length === 0) throw new RangeError('Annual HSA physical inventory requires at least one request')
  for (const evidence of input.sourceEvidence) if (!exactKeys(evidence, SOURCE_KEYS)) throw new TypeError('HSA physical source evidence must have an exact shape')
  for (const opening of input.openingBalances) if (!exactKeys(opening, OPENING_KEYS)) throw new TypeError('HSA opening balances must have an exact shape')

  const parsedRequests = input.requests.map((request) => ordinaryWithdrawalRequestSchema.parse(request))
  const schedule = evaluateRetirementActionSchedule(input.taxYear, parsedRequests)
  if (schedule.scheduleIssues.length > 0) throw new RangeError(`Annual HSA physical schedule is invalid: ${JSON.stringify(schedule.scheduleIssues)}`)
  const requests = schedule.requests.map((request) => {
    if (request.kind !== 'ordinaryWithdrawal') throw new TypeError('Annual HSA physical inventory accepts only ordinary withdrawals')
    const date = request.executionDate
    const parsed = date === undefined ? null : parseCivilIsoDate(date)
    if (date === undefined || parsed === null || formatCivilDate(parsed) !== date || parsed.year !== input.taxYear) throw new RangeError(`HSA withdrawal "${request.actionId}" requires a canonical date in the tax year`)
    return request
  })

  const requestedSources = new Set<AccountId>()
  const allocationIds = new Set<AllocationId>()
  const idRegistry = new Map<string, string>()
  for (const request of requests) {
    claim(idRegistry, request.actionId, ['action', request.actionId])
    claim(idRegistry, request.personId, ['person', request.personId])
    for (const allocation of request.allocations) {
      if (allocationIds.has(allocation.allocationId)) throw new RangeError(`Duplicate annual HSA allocation ID "${allocation.allocationId}"`)
      allocationIds.add(allocation.allocationId)
      requestedSources.add(allocation.sourceAccountId)
      claim(idRegistry, allocation.allocationId, ['allocation', allocation.allocationId])
      claim(idRegistry, allocation.sourceAccountId, ['account', allocation.sourceAccountId])
    }
  }
  const sources = input.sourceEvidence.map((rawEvidence): OwnedHsaPhysicalSourceEvidence => {
    if (rawEvidence.predicate !== 'ownedHsaOrdinaryWithdrawalPhysicalSource' || rawEvidence.accountType !== 'hsa' || rawEvidence.ownership !== 'individual' || rawEvidence.authoritative !== true) throw new RangeError('HSA physical source evidence must establish an authoritative individually owned HSA')
    const sourceAccountId = accountIdSchema.parse(rawEvidence.sourceAccountId)
    const ownerPersonId = personIdSchema.parse(rawEvidence.ownerPersonId)
    const accountOwnershipEvidenceId = nonblank(rawEvidence.accountOwnershipEvidenceId, 'HSA account ownership evidence ID')
    const hsaClassificationEvidenceId = nonblank(rawEvidence.hsaClassificationEvidenceId, 'HSA classification evidence ID')
    claim(idRegistry, sourceAccountId, ['account', sourceAccountId])
    claim(idRegistry, ownerPersonId, ['person', ownerPersonId])
    claim(idRegistry, accountOwnershipEvidenceId, ['ownership', sourceAccountId, ownerPersonId])
    claim(idRegistry, hsaClassificationEvidenceId, ['classification', sourceAccountId, ownerPersonId])
    return { predicate: rawEvidence.predicate, sourceAccountId, ownerPersonId, accountType: rawEvidence.accountType, ownership: rawEvidence.ownership, accountOwnershipEvidenceId, hsaClassificationEvidenceId, authoritative: rawEvidence.authoritative }
  }).sort((left, right) => compareUtf16CodeUnits(left.sourceAccountId, right.sourceAccountId))
  const sourceById = new Map<AccountId, OwnedHsaPhysicalSourceEvidence>()
  for (const source of sources) {
    if (sourceById.has(source.sourceAccountId)) throw new RangeError(`Duplicate HSA source evidence for "${source.sourceAccountId}"`)
    sourceById.set(source.sourceAccountId, source)
  }

  const openings = input.openingBalances.map((rawOpening): HsaDetachedBatchOpeningBalanceSnapshot => {
    if (rawOpening.predicate !== 'authoritativeHsaDetachedBatchOpeningBalance' || rawOpening.boundary !== 'detachedBatchStart' || rawOpening.authoritative !== true || rawOpening.taxYear !== input.taxYear) throw new RangeError('HSA opening balance evidence must be authoritative only at the detached batch start in the tax year')
    const sourceAccountId = accountIdSchema.parse(rawOpening.sourceAccountId)
    const ownerPersonId = personIdSchema.parse(rawOpening.ownerPersonId)
    const openingBalance = usdCentsSchema.parse(rawOpening.openingBalance)
    const openingBalanceEvidenceId = nonblank(rawOpening.openingBalanceEvidenceId, 'HSA opening balance evidence ID')
    claim(idRegistry, sourceAccountId, ['account', sourceAccountId])
    claim(idRegistry, ownerPersonId, ['person', ownerPersonId])
    claim(idRegistry, openingBalanceEvidenceId, ['opening', sourceAccountId, ownerPersonId, input.taxYear, openingBalance])
    return { predicate: rawOpening.predicate, boundary: rawOpening.boundary, sourceAccountId, ownerPersonId, taxYear: rawOpening.taxYear, openingBalance, openingBalanceEvidenceId, authoritative: rawOpening.authoritative }
  }).sort((left, right) => compareUtf16CodeUnits(left.sourceAccountId, right.sourceAccountId))
  const openingById = new Map<AccountId, HsaDetachedBatchOpeningBalanceSnapshot>()
  for (const opening of openings) {
    if (openingById.has(opening.sourceAccountId)) throw new RangeError(`Duplicate HSA opening balance for "${opening.sourceAccountId}"`)
    openingById.set(opening.sourceAccountId, opening)
  }
  const canonicalRequestedSources = [...requestedSources].sort(compareUtf16CodeUnits)
  if (canonicalRequestedSources.length !== sources.length || canonicalRequestedSources.length !== openings.length || canonicalRequestedSources.some((id, index) => sources[index]?.sourceAccountId !== id || openings[index]?.sourceAccountId !== id)) throw new RangeError('Requested HSA sources, source evidence, and opening balances must be exact bijections')
  for (const sourceAccountId of canonicalRequestedSources) {
    const source = sourceById.get(sourceAccountId)!
    const opening = openingById.get(sourceAccountId)!
    if (source.ownerPersonId !== opening.ownerPersonId) throw new RangeError(`HSA source and opening owner conflict for "${sourceAccountId}"`)
  }

  const working = new Map(openings.map((opening) => [opening.sourceAccountId, opening.openingBalance]))
  const requestedBySource = new Map<AccountId, bigint>()
  const stagedBySource = new Map<AccountId, bigint>()
  const applications: HsaPhysicalAllocationApplication[] = []
  const actions: HsaPhysicalActionDisposition[] = []
  const derivedIds = new Map<string, string>()
  for (const request of requests) {
    const actionApplications: HsaPhysicalAllocationApplication[] = []
    let actionStaged = 0n
    request.allocations.forEach((allocation, index) => {
      const source = sourceById.get(allocation.sourceAccountId)!
      const opening = openingById.get(allocation.sourceAccountId)!
      if (request.personId !== source.ownerPersonId) throw new RangeError(`HSA withdrawal "${request.actionId}" owner does not own source "${allocation.sourceAccountId}"`)
      const before = working.get(allocation.sourceAccountId)!
      const staged = asUsdCents(Math.min(before, allocation.requestedAmount))
      const after = asUsdCents(before - staged)
      const unstaged = asUsdCents(allocation.requestedAmount - staged)
      const core = {
        actionId: request.actionId,
        allocationId: allocation.allocationId,
        sourceAccountId: allocation.sourceAccountId,
        distributionOwnerPersonId: request.personId,
        evaluationDate: request.executionDate!,
        actionExecutionSequence: request.executionSequence,
        allocationSequenceWithinAction: index + 1,
        applicationStatus: applicationStatus(allocation.requestedAmount, staged),
        requestedAmount: allocation.requestedAmount,
        stagedAmount: staged,
        unstagedAmount: unstaged,
        sourceBalanceBefore: before,
        sourceBalanceAfter: after,
        sourceEvidence: source,
        openingBalanceSnapshot: opening,
      } as const
      const physicalApplicationEvidenceId = deriveActionStructuralId('hsa-physical-application', [input.taxYear, core])
      const identity = JSON.stringify(core)
      if (derivedIds.has(physicalApplicationEvidenceId) || idRegistry.has(physicalApplicationEvidenceId) || suppliedStrings.has(physicalApplicationEvidenceId)) throw new Error(`Derived HSA physical application identifier collision for "${physicalApplicationEvidenceId}"`)
      derivedIds.set(physicalApplicationEvidenceId, identity)
      const application = { physicalApplicationEvidenceId, ...core }
      working.set(allocation.sourceAccountId, after)
      requestedBySource.set(allocation.sourceAccountId, (requestedBySource.get(allocation.sourceAccountId) ?? 0n) + BigInt(allocation.requestedAmount))
      stagedBySource.set(allocation.sourceAccountId, (stagedBySource.get(allocation.sourceAccountId) ?? 0n) + BigInt(staged))
      actionStaged += BigInt(staged)
      actionApplications.push(application)
      applications.push(application)
    })
    const stagedAmount = cents(actionStaged, 'HSA action staged total')
    actions.push({ request, status: actionStatus(request.requestedAmount, stagedAmount), requestedAmount: request.requestedAmount, stagedAmount, unstagedAmount: asUsdCents(request.requestedAmount - stagedAmount), applications: actionApplications as [HsaPhysicalAllocationApplication, ...HsaPhysicalAllocationApplication[]] })
  }

  const stagedDistributions = applications.filter((application) => application.stagedAmount > 0).map((application): HsaStagedPhysicalDistribution => ({
    actionId: application.actionId,
    allocationId: application.allocationId,
    sourceAccountId: application.sourceAccountId,
    distributionOwnerPersonId: application.distributionOwnerPersonId,
    evaluationDate: application.evaluationDate,
    actionExecutionSequence: application.actionExecutionSequence,
    allocationSequenceWithinAction: application.allocationSequenceWithinAction,
    physicalApplicationEvidenceId: application.physicalApplicationEvidenceId,
    stagedAmount: application.stagedAmount as PositiveUsdCents,
  }))
  const candidateSourceBalances = openings.map((opening): HsaPhysicalCandidateSourceBalance => {
    const source = sourceById.get(opening.sourceAccountId)!
    const requestedAmount = cents(requestedBySource.get(opening.sourceAccountId) ?? 0n, 'HSA source requested total')
    const stagedAmount = cents(stagedBySource.get(opening.sourceAccountId) ?? 0n, 'HSA source staged total')
    return { sourceAccountId: opening.sourceAccountId, ownerPersonId: opening.ownerPersonId, openingBalance: opening.openingBalance, requestedAmount, stagedAmount, unstagedAmount: asUsdCents(requestedAmount - stagedAmount), candidateClosingBalance: working.get(opening.sourceAccountId)!, accountOwnershipEvidenceId: source.accountOwnershipEvidenceId, hsaClassificationEvidenceId: source.hsaClassificationEvidenceId, openingBalanceEvidenceId: opening.openingBalanceEvidenceId }
  })
  const boundaries = { movement: 'notCommitted', actionability: 'notEstablished', publication: 'notEstablished', taxCharacter: 'notEstablished', penalty: 'notEstablished', runtimeInflows: 'notInventoried', priorCharacterReusable: false, priorPenaltyReusable: false, downstreamRequirement: 'rebuildReimbursementThenCharacterThenPenaltyFromCandidate' } as const
  const movementCandidateId = deriveActionStructuralId('annual-hsa-physical-movement-candidate', [input.taxYear, requests, sources, openings, actions, applications, stagedDistributions, candidateSourceBalances, boundaries])
  if (derivedIds.has(movementCandidateId) || idRegistry.has(movementCandidateId) || suppliedStrings.has(movementCandidateId)) throw new Error(`Derived HSA movement candidate identifier collision for "${movementCandidateId}"`)
  return deepFreeze({ status: 'physicalMovementCandidateStaged', movementCandidateId, taxYear: input.taxYear, committed: false, ...boundaries, actions, applications, stagedDistributions, candidateSourceBalances })
}
