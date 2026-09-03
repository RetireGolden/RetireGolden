import {
  accountIdSchema,
  personIdSchema,
  type AccountId,
  type PersonId,
} from './identity.js'
import {
  asUsdCents,
  positiveUsdCentsSchema,
  usdCentsSchema,
  type PositiveUsdCents,
  type UsdCents,
} from './money.js'
import type {
  HsaDetachedBatchOpeningBalanceSnapshot,
  OwnedHsaPhysicalSourceEvidence,
} from './annualHsaPhysicalMovementCandidate.js'
import { compareUtf16CodeUnits, deriveActionStructuralId } from './structuralId.js'
import { deepFreeze } from './freeze.js'
import { INVALID_SNAPSHOT, exactKeys, plainDataSnapshot } from './plainData.js'

export interface HsaAnnualStartBalanceEvidence {
  predicate: 'authoritativeHsaAnnualStartBalance'
  boundary: 'annualStart'
  sourceAccountId: AccountId
  ownerPersonId: PersonId
  taxYear: number
  annualStartBalance: UsdCents
  annualStartBalanceEvidenceId: string
  authoritative: true
}

export interface SettledHsaRuntimeCreditEvidence {
  predicate: 'settledHsaRuntimeCreditBeforeDetachedBatch'
  sourceAccountId: AccountId
  ownerPersonId: PersonId
  taxYear: number
  settlementPhase: 'simulatorPreActionContributionPhase'
  boundaryRelation: 'beforeDetachedHsaActionBatch'
  amount: PositiveUsdCents
  settled: true
  runtimeEventId: string
  runtimeMovementEvidenceId: string
  upstreamEvidenceId: string
}

interface HsaRuntimeInflowInventoryBase {
  predicate: 'completeSettledHsaRuntimeInflowsBeforeDetachedBatch'
  taxYear: number
  detachedBatchStart: 'afterSimulatorPreActionContributionPhaseBeforeDetachedHsaActionBatch'
  complete: true
}

export interface ExplicitEmptyHsaRuntimeInflowInventory
  extends HsaRuntimeInflowInventoryBase {
  status: 'explicitEmpty'
  inflows: readonly []
}

export interface CompleteHsaRuntimeInflowInventory
  extends HsaRuntimeInflowInventoryBase {
  status: 'completeWithCredits'
  inflows: readonly [
    Readonly<SettledHsaRuntimeCreditEvidence>,
    ...Readonly<SettledHsaRuntimeCreditEvidence>[],
  ]
}

export type HsaRuntimeInflowInventory =
  | ExplicitEmptyHsaRuntimeInflowInventory
  | CompleteHsaRuntimeInflowInventory

export interface EstablishAnnualHsaOpeningAuthorityInput {
  taxYear: number
  detachedBatchStart: 'afterSimulatorPreActionContributionPhaseBeforeDetachedHsaActionBatch'
  sourceEvidenceInventoryComplete: true
  sourceEvidence: readonly Readonly<OwnedHsaPhysicalSourceEvidence>[]
  annualStartBalanceInventoryComplete: true
  annualStartBalances: readonly Readonly<HsaAnnualStartBalanceEvidence>[]
  runtimeInflowInventory: Readonly<HsaRuntimeInflowInventory>
}

export interface HsaSourceOpeningAuthority {
  sourceEvidence: Readonly<OwnedHsaPhysicalSourceEvidence>
  annualStartBalanceEvidence: Readonly<HsaAnnualStartBalanceEvidence>
  settledRuntimeCredits: readonly Readonly<SettledHsaRuntimeCreditEvidence>[]
  detachedBatchOpeningBalance: Readonly<HsaDetachedBatchOpeningBalanceSnapshot>
}

export interface AnnualHsaOpeningAuthority {
  status: 'annualHsaDetachedBatchOpeningAuthorityEstablished'
  openingAuthorityId: string
  runtimeInflowInventoryEvidenceId: string
  taxYear: number
  detachedBatchStart: 'afterSimulatorPreActionContributionPhaseBeforeDetachedHsaActionBatch'
  committed: false
  movement: 'notCommitted'
  actionability: 'notEstablished'
  publication: 'notEstablished'
  planMutation: 'notPerformed'
  simulatorIntegration: 'notPerformed'
  runtimeInflows: 'completeBeforeDetachedHsaActionBatch'
  runtimeInflowInventoryStatus: HsaRuntimeInflowInventory['status']
  sources: readonly Readonly<HsaSourceOpeningAuthority>[]
  settledRuntimeCredits: readonly Readonly<SettledHsaRuntimeCreditEvidence>[]
  openingBalances: readonly Readonly<HsaDetachedBatchOpeningBalanceSnapshot>[]
}

const INPUT_KEYS = ['taxYear', 'detachedBatchStart', 'sourceEvidenceInventoryComplete', 'sourceEvidence', 'annualStartBalanceInventoryComplete', 'annualStartBalances', 'runtimeInflowInventory']
const SOURCE_KEYS = ['predicate', 'sourceAccountId', 'ownerPersonId', 'accountType', 'ownership', 'accountOwnershipEvidenceId', 'hsaClassificationEvidenceId', 'authoritative']
const ANNUAL_START_KEYS = ['predicate', 'boundary', 'sourceAccountId', 'ownerPersonId', 'taxYear', 'annualStartBalance', 'annualStartBalanceEvidenceId', 'authoritative']
const INFLOW_INVENTORY_KEYS = ['predicate', 'taxYear', 'detachedBatchStart', 'complete', 'status', 'inflows']
const INFLOW_KEYS = ['predicate', 'sourceAccountId', 'ownerPersonId', 'taxYear', 'settlementPhase', 'boundaryRelation', 'amount', 'settled', 'runtimeEventId', 'runtimeMovementEvidenceId', 'upstreamEvidenceId']

function stableId(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) throw new TypeError(`${label} must be a nonblank stable identifier`)
  return value
}

function claim(registry: Map<string, string>, id: string, role: string, identity: readonly unknown[]): void {
  const signature = JSON.stringify([role, identity])
  const prior = registry.get(id)
  if (prior !== undefined && prior !== signature) throw new Error(`Identifier collision for "${id}"`)
  registry.set(id, signature)
}

function collectStrings(value: unknown, output: Set<string>): void {
  if (typeof value === 'string') {
    output.add(value)
  } else if (value !== null && typeof value === 'object') {
    for (const child of Object.values(value as Record<string, unknown>)) collectStrings(child, output)
  }
}

function derivedId(
  kind: string,
  payload: readonly unknown[],
  suppliedStrings: ReadonlySet<string>,
  derivedIds: Set<string>,
): string {
  const id = deriveActionStructuralId(kind, payload)
  if (suppliedStrings.has(id) || derivedIds.has(id)) throw new Error(`Derived HSA opening-authority identifier collision for "${id}"`)
  derivedIds.add(id)
  return id
}

function safeCents(value: bigint, label: string): UsdCents {
  if (value < 0n || value > BigInt(Number.MAX_SAFE_INTEGER)) throw new RangeError(`${label} exceeds safe-integer cents`)
  return asUsdCents(Number(value))
}

function compareCredits(left: SettledHsaRuntimeCreditEvidence, right: SettledHsaRuntimeCreditEvidence): number {
  return compareUtf16CodeUnits(left.sourceAccountId, right.sourceAccountId)
    || compareUtf16CodeUnits(left.runtimeEventId, right.runtimeEventId)
    || compareUtf16CodeUnits(left.runtimeMovementEvidenceId, right.runtimeMovementEvidenceId)
    || compareUtf16CodeUnits(left.upstreamEvidenceId, right.upstreamEvidenceId)
}

/**
 * Sums a complete, detached inventory of same-phase settled HSA credits into
 * exact annual-start balances. The result authorizes openings for a later
 * physical candidate; it does not commit movement or mutate a Plan.
 */
export function establishAnnualHsaOpeningAuthority(
  raw: Readonly<EstablishAnnualHsaOpeningAuthorityInput>,
): Readonly<AnnualHsaOpeningAuthority> {
  const snapshot = plainDataSnapshot(raw)
  if (snapshot === INVALID_SNAPSHOT || !exactKeys(snapshot, INPUT_KEYS)) throw new TypeError('Annual HSA opening-authority input must be acyclic plain data with an exact shape')
  const input = snapshot as unknown as EstablishAnnualHsaOpeningAuthorityInput
  const suppliedStrings = new Set<string>()
  collectStrings(snapshot, suppliedStrings)
  if (!Number.isSafeInteger(input.taxYear) || input.taxYear < 1 || input.taxYear > 9999) throw new RangeError('Annual HSA opening-authority tax year must be a four-digit year')
  const detachedBatchStart = input.detachedBatchStart
  if (detachedBatchStart !== 'afterSimulatorPreActionContributionPhaseBeforeDetachedHsaActionBatch') throw new RangeError('Detached HSA batch start must be the named post-contribution, pre-action boundary')
  if (input.sourceEvidenceInventoryComplete !== true || input.annualStartBalanceInventoryComplete !== true) throw new RangeError('Annual HSA source and annual-start inventories must be explicitly complete')
  if (input.sourceEvidence.length === 0) throw new RangeError('Annual HSA opening authority requires at least one owned source')
  for (const source of input.sourceEvidence) if (!exactKeys(source, SOURCE_KEYS)) throw new TypeError('HSA source evidence must have an exact shape')
  for (const opening of input.annualStartBalances) if (!exactKeys(opening, ANNUAL_START_KEYS)) throw new TypeError('HSA annual-start balance evidence must have an exact shape')
  if (!exactKeys(input.runtimeInflowInventory, INFLOW_INVENTORY_KEYS)) throw new TypeError('HSA runtime inflow inventory must be a first-class exact-shape object')
  const inventory = input.runtimeInflowInventory
  if (inventory.predicate !== 'completeSettledHsaRuntimeInflowsBeforeDetachedBatch' || inventory.complete !== true || inventory.taxYear !== input.taxYear || inventory.detachedBatchStart !== detachedBatchStart) throw new RangeError('HSA runtime inflow inventory must explicitly and exactly cover the detached-batch boundary')
  if (inventory.status !== 'explicitEmpty' && inventory.status !== 'completeWithCredits') throw new RangeError('HSA runtime inflow inventory status is invalid')
  if ((inventory.status === 'explicitEmpty') !== (inventory.inflows.length === 0)) throw new RangeError('HSA runtime inflow inventory status must explicitly distinguish empty from credited inventory')
  for (const inflow of inventory.inflows) if (!exactKeys(inflow, INFLOW_KEYS)) throw new TypeError('HSA runtime credit evidence must have an exact shape')

  const ids = new Map<string, string>()
  const sources = input.sourceEvidence.map((rawSource): OwnedHsaPhysicalSourceEvidence => {
    if (rawSource.predicate !== 'ownedHsaOrdinaryWithdrawalPhysicalSource' || rawSource.accountType !== 'hsa' || rawSource.ownership !== 'individual' || rawSource.authoritative !== true) throw new RangeError('HSA source evidence must establish an authoritative individually owned HSA')
    const sourceAccountId = accountIdSchema.parse(rawSource.sourceAccountId)
    const ownerPersonId = personIdSchema.parse(rawSource.ownerPersonId)
    const accountOwnershipEvidenceId = stableId(rawSource.accountOwnershipEvidenceId, 'HSA account ownership evidence ID')
    const hsaClassificationEvidenceId = stableId(rawSource.hsaClassificationEvidenceId, 'HSA classification evidence ID')
    claim(ids, sourceAccountId, 'account', [sourceAccountId])
    claim(ids, ownerPersonId, 'person', [ownerPersonId])
    claim(ids, accountOwnershipEvidenceId, 'accountOwnershipEvidence', [sourceAccountId, ownerPersonId])
    claim(ids, hsaClassificationEvidenceId, 'hsaClassificationEvidence', [sourceAccountId, ownerPersonId])
    return { predicate: 'ownedHsaOrdinaryWithdrawalPhysicalSource', sourceAccountId, ownerPersonId, accountType: 'hsa', ownership: 'individual', accountOwnershipEvidenceId, hsaClassificationEvidenceId, authoritative: true }
  }).sort((left, right) => compareUtf16CodeUnits(left.sourceAccountId, right.sourceAccountId))
  const sourceById = new Map<AccountId, OwnedHsaPhysicalSourceEvidence>()
  for (const source of sources) {
    if (sourceById.has(source.sourceAccountId)) throw new RangeError(`Duplicate HSA source evidence for "${source.sourceAccountId}"`)
    sourceById.set(source.sourceAccountId, source)
  }

  const annualStarts = input.annualStartBalances.map((rawOpening): HsaAnnualStartBalanceEvidence => {
    if (rawOpening.predicate !== 'authoritativeHsaAnnualStartBalance' || rawOpening.boundary !== 'annualStart' || rawOpening.authoritative !== true || rawOpening.taxYear !== input.taxYear) throw new RangeError('HSA annual-start balance evidence must be authoritative at the annual-start boundary in the tax year')
    const sourceAccountId = accountIdSchema.parse(rawOpening.sourceAccountId)
    const ownerPersonId = personIdSchema.parse(rawOpening.ownerPersonId)
    const annualStartBalance = usdCentsSchema.parse(rawOpening.annualStartBalance)
    const annualStartBalanceEvidenceId = stableId(rawOpening.annualStartBalanceEvidenceId, 'HSA annual-start balance evidence ID')
    claim(ids, sourceAccountId, 'account', [sourceAccountId])
    claim(ids, ownerPersonId, 'person', [ownerPersonId])
    claim(ids, annualStartBalanceEvidenceId, 'annualStartBalanceEvidence', [sourceAccountId, ownerPersonId, input.taxYear, annualStartBalance])
    return { predicate: 'authoritativeHsaAnnualStartBalance', boundary: 'annualStart', sourceAccountId, ownerPersonId, taxYear: input.taxYear, annualStartBalance, annualStartBalanceEvidenceId, authoritative: true }
  }).sort((left, right) => compareUtf16CodeUnits(left.sourceAccountId, right.sourceAccountId))
  if (annualStarts.length !== sources.length || annualStarts.some((opening, index) => opening.sourceAccountId !== sources[index]?.sourceAccountId)) throw new RangeError('HSA source evidence and annual-start balances must be exact bijections')
  const annualStartById = new Map<AccountId, HsaAnnualStartBalanceEvidence>()
  for (const opening of annualStarts) {
    if (annualStartById.has(opening.sourceAccountId)) throw new RangeError(`Duplicate HSA annual-start balance for "${opening.sourceAccountId}"`)
    const source = sourceById.get(opening.sourceAccountId)!
    if (source.ownerPersonId !== opening.ownerPersonId) throw new RangeError(`HSA source and annual-start owner conflict for "${opening.sourceAccountId}"`)
    annualStartById.set(opening.sourceAccountId, opening)
  }

  const credits = inventory.inflows.map((rawCredit): SettledHsaRuntimeCreditEvidence => {
    if (rawCredit.predicate !== 'settledHsaRuntimeCreditBeforeDetachedBatch' || rawCredit.settled !== true || rawCredit.taxYear !== input.taxYear) throw new RangeError('HSA runtime credit must be settled in the authority tax year')
    const sourceAccountId = accountIdSchema.parse(rawCredit.sourceAccountId)
    const ownerPersonId = personIdSchema.parse(rawCredit.ownerPersonId)
    if (rawCredit.settlementPhase !== 'simulatorPreActionContributionPhase' || rawCredit.boundaryRelation !== 'beforeDetachedHsaActionBatch') throw new RangeError('HSA runtime credit must be settled in the observed pre-action contribution phase')
    const amount = positiveUsdCentsSchema.parse(rawCredit.amount)
    const runtimeEventId = stableId(rawCredit.runtimeEventId, 'HSA runtime event ID')
    const runtimeMovementEvidenceId = stableId(rawCredit.runtimeMovementEvidenceId, 'HSA runtime movement evidence ID')
    const upstreamEvidenceId = stableId(rawCredit.upstreamEvidenceId, 'HSA upstream evidence ID')
    const source = sourceById.get(sourceAccountId)
    if (source === undefined) throw new RangeError(`HSA runtime credit references foreign source "${sourceAccountId}"`)
    if (source.ownerPersonId !== ownerPersonId) throw new RangeError(`HSA runtime credit owner conflicts for "${sourceAccountId}"`)
    claim(ids, sourceAccountId, 'account', [sourceAccountId])
    claim(ids, ownerPersonId, 'person', [ownerPersonId])
    claim(ids, runtimeEventId, 'runtimeEvent', [sourceAccountId, ownerPersonId, input.taxYear, amount])
    claim(ids, runtimeMovementEvidenceId, 'runtimeMovementEvidence', [runtimeEventId, sourceAccountId, ownerPersonId, input.taxYear, amount])
    claim(ids, upstreamEvidenceId, 'upstreamEvidence', [runtimeEventId, sourceAccountId, ownerPersonId, input.taxYear, amount])
    return { predicate: 'settledHsaRuntimeCreditBeforeDetachedBatch', sourceAccountId, ownerPersonId, taxYear: input.taxYear, settlementPhase: 'simulatorPreActionContributionPhase', boundaryRelation: 'beforeDetachedHsaActionBatch', amount, settled: true, runtimeEventId, runtimeMovementEvidenceId, upstreamEvidenceId }
  }).sort(compareCredits)
  const eventIds = new Set<string>()
  const movementIds = new Set<string>()
  const upstreamIds = new Set<string>()
  for (const credit of credits) {
    if (eventIds.has(credit.runtimeEventId) || movementIds.has(credit.runtimeMovementEvidenceId) || upstreamIds.has(credit.upstreamEvidenceId)) throw new RangeError('HSA runtime credits require unique event, movement-evidence, and upstream-evidence identifiers')
    eventIds.add(credit.runtimeEventId)
    movementIds.add(credit.runtimeMovementEvidenceId)
    upstreamIds.add(credit.upstreamEvidenceId)
  }

  const canonicalInventory = { predicate: 'completeSettledHsaRuntimeInflowsBeforeDetachedBatch', taxYear: input.taxYear, detachedBatchStart, complete: true, status: inventory.status, inflows: credits } as const
  const derivedIds = new Set<string>()
  const runtimeInflowInventoryEvidenceId = derivedId('annual-hsa-runtime-inflow-inventory', [canonicalInventory], suppliedStrings, derivedIds)
  const sourceAuthorities = sources.map((source): HsaSourceOpeningAuthority => {
    const annualStartBalanceEvidence = annualStartById.get(source.sourceAccountId)!
    const settledRuntimeCredits = credits.filter((credit) => credit.sourceAccountId === source.sourceAccountId)
    const creditedAmount = settledRuntimeCredits.reduce((sum, credit) => sum + BigInt(credit.amount), 0n)
    const openingBalance = safeCents(BigInt(annualStartBalanceEvidence.annualStartBalance) + creditedAmount, 'HSA detached-batch opening balance')
    const openingCore = { predicate: 'authoritativeHsaDetachedBatchOpeningBalance', boundary: 'detachedBatchStart', sourceAccountId: source.sourceAccountId, ownerPersonId: source.ownerPersonId, taxYear: input.taxYear, openingBalance, authoritative: true } as const
    const openingBalanceEvidenceId = derivedId('hsa-detached-batch-opening-balance', [detachedBatchStart, source, annualStartBalanceEvidence, runtimeInflowInventoryEvidenceId, settledRuntimeCredits, openingCore], suppliedStrings, derivedIds)
    const detachedBatchOpeningBalance: HsaDetachedBatchOpeningBalanceSnapshot = { predicate: 'authoritativeHsaDetachedBatchOpeningBalance', boundary: 'detachedBatchStart', sourceAccountId: source.sourceAccountId, ownerPersonId: source.ownerPersonId, taxYear: input.taxYear, openingBalance, openingBalanceEvidenceId, authoritative: true }
    return { sourceEvidence: source, annualStartBalanceEvidence, settledRuntimeCredits, detachedBatchOpeningBalance }
  })
  const openingBalances = sourceAuthorities.map((authority) => authority.detachedBatchOpeningBalance)
  const boundaries = { committed: false, movement: 'notCommitted', actionability: 'notEstablished', publication: 'notEstablished', planMutation: 'notPerformed', simulatorIntegration: 'notPerformed', runtimeInflows: 'completeBeforeDetachedHsaActionBatch' } as const
  const openingAuthorityId = derivedId('annual-hsa-detached-batch-opening-authority', [input.taxYear, detachedBatchStart, runtimeInflowInventoryEvidenceId, sourceAuthorities, credits, boundaries], suppliedStrings, derivedIds)
  return deepFreeze({ status: 'annualHsaDetachedBatchOpeningAuthorityEstablished', openingAuthorityId, runtimeInflowInventoryEvidenceId, taxYear: input.taxYear, detachedBatchStart, ...boundaries, runtimeInflowInventoryStatus: inventory.status, sources: sourceAuthorities, settledRuntimeCredits: credits, openingBalances })
}
