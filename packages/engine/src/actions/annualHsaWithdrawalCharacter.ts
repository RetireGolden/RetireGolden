import {
  evaluateAnnualHsaReimbursementLedger,
  type AnnualHsaReimbursementLedgerBlocked,
  type AnnualHsaReimbursementLedgerEvaluated,
  type EvaluateAnnualHsaReimbursementLedgerInput,
  type HsaReimbursementLedgerEntry,
} from './annualHsaReimbursementLedger.js'
import type {
  AccountId,
  ActionId,
  AllocationId,
  PersonId,
} from './identity.js'
import {
  addUsdCents,
  asPositiveUsdCents,
  type PositiveUsdCents,
  type UsdCents,
} from './money.js'
import { deriveActionStructuralId } from './structuralId.js'
import { deepFreeze } from './freeze.js'

export interface HsaWithdrawalCharacterEvidence {
  rule: 'hsaImmutableReimbursementLedger'
  annualLedgerEvidenceId: string
  characterEvidenceId: string
  ledgerEvidenceId: string
  segmentId: string
  segmentKind: HsaWithdrawalTaxCharacter['kind']
  segmentAmount: PositiveUsdCents
}

interface HsaWithdrawalTaxCharacterBase {
  segmentId: string
  sequence: number
  actionId: ActionId
  allocationId: AllocationId
  sourceAccountId: AccountId
  ownerPersonId: PersonId
  evaluationDate: string
  sourceClass: 'hsa'
  amount: PositiveUsdCents
  characterEvidence: Readonly<HsaWithdrawalCharacterEvidence>
}

export interface HsaQualifiedTaxFreeWithdrawalCharacter
  extends HsaWithdrawalTaxCharacterBase {
  kind: 'qualifiedTaxFree'
}

export interface HsaOrdinaryIncomeWithdrawalCharacter
  extends HsaWithdrawalTaxCharacterBase {
  kind: 'ordinaryIncome'
}

export type HsaWithdrawalTaxCharacter =
  | HsaQualifiedTaxFreeWithdrawalCharacter
  | HsaOrdinaryIncomeWithdrawalCharacter

export interface HsaWithdrawalAllocationCharacterCoverage {
  predicate: 'completeHsaWithdrawalCharacterCoverageForAllocation'
  reimbursementScopeId: string
  actionId: ActionId
  allocationId: AllocationId
  sourceAccountId: AccountId
  ownerPersonId: PersonId
  evaluationDate: string
  executedAmount: UsdCents
  qualifiedMedicalAmount: UsdCents
  nonqualifiedAmount: UsdCents
  ledgerEvidenceId: string
  previousLedgerEvidenceId: string | null
  expenseStateBeforeId: string
  expenseStateAfterId: string
  consumptionEvidenceIds: readonly string[]
  annualLedgerEvidenceId: string
  characterEvidenceId: string
  taxCharacter: readonly Readonly<HsaWithdrawalTaxCharacter>[]
}

export type AnnualHsaWithdrawalCharacterAccepted = Readonly<{
  status: 'accepted'
  committed: false
  movement: 'notEstablished'
  penalty: 'notEstablished'
  actionability: 'notEstablished'
  publication: 'notEstablished'
  ledger: Readonly<AnnualHsaReimbursementLedgerEvaluated>
  annualLedgerEvidenceId: string
  allocations:
    readonly Readonly<HsaWithdrawalAllocationCharacterCoverage>[]
  issues: readonly []
}>

export type AnnualHsaWithdrawalCharacterLedgerBlocked = Readonly<{
  status: 'ledgerBlocked'
  committed: false
  movement: 'notEstablished'
  penalty: 'notEstablished'
  actionability: 'notEstablished'
  publication: 'notEstablished'
  ledger: Readonly<AnnualHsaReimbursementLedgerBlocked>
  allocations: readonly []
  issues: Readonly<AnnualHsaReimbursementLedgerBlocked['issues']>
}>

export type AnnualHsaWithdrawalCharacterIdentifierCollision = Readonly<{
  status: 'identifierCollision'
  committed: false
  movement: 'notEstablished'
  penalty: 'notEstablished'
  actionability: 'notEstablished'
  publication: 'notEstablished'
  ledger: Readonly<AnnualHsaReimbursementLedgerEvaluated>
  allocations: readonly []
  issues: readonly [Readonly<{
    kind: 'characterIdentifierCollision'
    detail: string
  }>]
}>

export type ClassifyAnnualHsaWithdrawalCharacterResult =
  | AnnualHsaWithdrawalCharacterAccepted
  | AnnualHsaWithdrawalCharacterLedgerBlocked
  | AnnualHsaWithdrawalCharacterIdentifierCollision

function collectStrings(
  value: unknown,
  strings: Set<string>,
  seen = new WeakSet<object>(),
): boolean {
  if (typeof value === 'string') {
    strings.add(value)
    return true
  }
  if (value === null || typeof value !== 'object' || seen.has(value)) return true
  seen.add(value)
  try {
    for (const key of Reflect.ownKeys(value)) {
      if (Array.isArray(value) && key === 'length') continue
      const descriptor = typeof key === 'string'
        ? Object.getOwnPropertyDescriptor(value, key)
        : undefined
      if (
        descriptor === undefined ||
        !descriptor.enumerable ||
        !Object.hasOwn(descriptor, 'value') ||
        !collectStrings(descriptor.value, strings, seen)
      ) return false
    }
    return true
  } catch {
    return false
  }
}

function collision(
  ledger: Readonly<AnnualHsaReimbursementLedgerEvaluated>,
): AnnualHsaWithdrawalCharacterIdentifierCollision {
  return deepFreeze({
    status: 'identifierCollision',
    committed: false,
    movement: 'notEstablished',
    penalty: 'notEstablished',
    actionability: 'notEstablished',
    publication: 'notEstablished',
    ledger,
    allocations: [],
    issues: [{
      kind: 'characterIdentifierCollision',
      detail: 'Derived HSA character identifier collides with ledger evidence',
    }],
  }) as AnnualHsaWithdrawalCharacterIdentifierCollision
}

function characterCoverage(
  entry: Readonly<HsaReimbursementLedgerEntry>,
  annualLedgerEvidenceId: string,
  reservedIds: Set<string>,
): HsaWithdrawalAllocationCharacterCoverage | null {
  if (
    addUsdCents(entry.qualifiedMedicalAmount, entry.nonqualifiedAmount) !==
      entry.executedAmount
  ) return null
  const characterEvidenceId = deriveActionStructuralId(
    'hsa-withdrawal-character-evidence',
    [annualLedgerEvidenceId, entry],
  )
  if (reservedIds.has(characterEvidenceId)) return null
  reservedIds.add(characterEvidenceId)

  const taxCharacter: HsaWithdrawalTaxCharacter[] = []
  for (const [kind, cents] of [
    ['qualifiedTaxFree', entry.qualifiedMedicalAmount],
    ['ordinaryIncome', entry.nonqualifiedAmount],
  ] as const) {
    if (cents === 0) continue
    const amount = asPositiveUsdCents(cents)
    const sequence = taxCharacter.length + 1
    const segmentId = deriveActionStructuralId('hsa-withdrawal-character-segment', [
      characterEvidenceId,
      sequence,
      kind,
      amount,
    ])
    if (reservedIds.has(segmentId)) return null
    reservedIds.add(segmentId)
    taxCharacter.push({
      segmentId,
      sequence,
      actionId: entry.actionId,
      allocationId: entry.allocationId,
      sourceAccountId: entry.sourceAccountId,
      ownerPersonId: entry.distributionOwnerPersonId,
      evaluationDate: entry.evaluationDate,
      sourceClass: 'hsa',
      kind,
      amount,
      characterEvidence: {
        rule: 'hsaImmutableReimbursementLedger',
        annualLedgerEvidenceId,
        characterEvidenceId,
        ledgerEvidenceId: entry.ledgerEvidenceId,
        segmentId,
        segmentKind: kind,
        segmentAmount: amount,
      },
    })
  }
  return {
    predicate: 'completeHsaWithdrawalCharacterCoverageForAllocation',
    reimbursementScopeId: entry.reimbursementScopeId,
    actionId: entry.actionId,
    allocationId: entry.allocationId,
    sourceAccountId: entry.sourceAccountId,
    ownerPersonId: entry.distributionOwnerPersonId,
    evaluationDate: entry.evaluationDate,
    executedAmount: entry.executedAmount,
    qualifiedMedicalAmount: entry.qualifiedMedicalAmount,
    nonqualifiedAmount: entry.nonqualifiedAmount,
    ledgerEvidenceId: entry.ledgerEvidenceId,
    previousLedgerEvidenceId: entry.previousLedgerEvidenceId,
    expenseStateBeforeId: entry.expenseStateBeforeId,
    expenseStateAfterId: entry.expenseStateAfterId,
    consumptionEvidenceIds: entry.consumptions.map((item) =>
      item.consumptionEvidenceId),
    annualLedgerEvidenceId,
    characterEvidenceId,
    taxCharacter,
  }
}

/**
 * Rebuilds the immutable HSA reimbursement ledger and derives only federal
 * withdrawal character. Age and disability never affect this classification.
 */
export function classifyAnnualHsaWithdrawalCharacter(
  input: Readonly<EvaluateAnnualHsaReimbursementLedgerInput>,
): Readonly<ClassifyAnnualHsaWithdrawalCharacterResult> {
  const ledger = evaluateAnnualHsaReimbursementLedger(input)
  if (ledger.status === 'blocked') {
    return deepFreeze({
      status: 'ledgerBlocked',
      committed: false,
      movement: 'notEstablished',
      penalty: 'notEstablished',
      actionability: 'notEstablished',
      publication: 'notEstablished',
      ledger,
      allocations: [],
      issues: ledger.issues,
    }) as AnnualHsaWithdrawalCharacterLedgerBlocked
  }

  const reservedIds = new Set<string>()
  if (
    !collectStrings(input, reservedIds) ||
    !collectStrings(ledger, reservedIds)
  ) return collision(ledger)
  const annualLedgerEvidenceId = deriveActionStructuralId(
    'hsa-annual-reimbursement-ledger-character-binding',
    [ledger],
  )
  if (reservedIds.has(annualLedgerEvidenceId)) return collision(ledger)
  reservedIds.add(annualLedgerEvidenceId)
  const allocations: HsaWithdrawalAllocationCharacterCoverage[] = []
  for (const entry of ledger.entries) {
    const coverage = characterCoverage(entry, annualLedgerEvidenceId, reservedIds)
    if (coverage === null) return collision(ledger)
    allocations.push(coverage)
  }
  return deepFreeze({
    status: 'accepted',
    committed: false,
    movement: 'notEstablished',
    penalty: 'notEstablished',
    actionability: 'notEstablished',
    publication: 'notEstablished',
    ledger,
    annualLedgerEvidenceId,
    allocations,
    issues: [],
  }) as AnnualHsaWithdrawalCharacterAccepted
}
