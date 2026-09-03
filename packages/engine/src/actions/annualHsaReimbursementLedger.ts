import { formatCivilDate, parseCivilIsoDate } from './civilDate.js'
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
  addUsdCents,
  subtractUsdCents,
  usdCentsSchema,
  positiveUsdCentsSchema,
  type PositiveUsdCents,
  type UsdCents,
} from './money.js'
import {
  compareUtf16CodeUnits,
  deriveActionStructuralId,
} from './structuralId.js'
import { deepFreeze } from './freeze.js'
import { INVALID_SNAPSHOT, exactKeys, plainDataSnapshot } from './plainData.js'

export interface HsaReimbursementPriorHistoryEvidence {
  predicate: 'completeHsaReimbursementPriorHistory'
  reimbursementScopeId: string
  completeness: 'completeBeforeFirstAllocation'
  priorHistoryEvidenceId: string
  terminalLedgerEvidenceId: string | null
  terminalExpenseStateId: string
}

export interface HsaQualifiedMedicalExpenseRecord {
  reimbursementScopeId: string
  medicalExpenseId: string
  medicalExpenseEvidenceId: string
  immutableExpenseSourceRecordId: string
  patientPersonId: PersonId
  expenseIncurredDate: string
  originalEligibleExpenseAmount: PositiveUsdCents
  reimbursedBeforeAmount: UsdCents
  qualifiedMedicalExpense: true
  eligibilityEvidenceId: string
}

export interface HsaOwnerEstablishmentEvidence {
  predicate: 'authoritativeOwnerHsaEstablishment'
  ownerPersonId: PersonId
  ownerHsaEstablishedDate: string
  ownerHsaEstablishedDateEvidenceId: string
  authoritative: true
}

export interface CompleteHsaFamilyReimbursementScopeEvidence {
  predicate: 'completeHsaFamilyReimbursementScope'
  reimbursementScopeId: string
  eligibleHsaOwnerPersonIds: readonly PersonId[]
  coveredHsaAccountIds: readonly AccountId[]
  ownerEstablishmentInventoryComplete: true
  ownerEstablishments: readonly Readonly<HsaOwnerEstablishmentEvidence>[]
  expenseInventoryComplete: true
  priorHistory: Readonly<HsaReimbursementPriorHistoryEvidence>
  expenses: readonly Readonly<HsaQualifiedMedicalExpenseRecord>[]
}

export interface HsaReimbursementClaim {
  medicalExpenseId: string
  reimbursedByAllocationAmount: PositiveUsdCents
  patientRelationshipToDistributionOwner:
    | 'self'
    | 'spouse'
    | 'qualifyingDependent'
  patientRelationshipEvidenceId: string
}

export interface HsaExecutedAllocationEvidence {
  actionId: ActionId
  allocationId: AllocationId
  sourceAccountId: AccountId
  distributionOwnerPersonId: PersonId
  evaluationDate: string
  actionExecutionSequence: number
  allocationSequenceWithinAction: number
  physicalApplicationEvidenceId: string
  executedAmount: UsdCents
  ownerHsaEstablishedDate: string
  ownerHsaEstablishedDateEvidenceId: string
  reimbursementClaims: readonly Readonly<HsaReimbursementClaim>[]
}

export interface EvaluateAnnualHsaReimbursementLedgerInput {
  taxYear: number
  allocationInventoryComplete: true
  scope: Readonly<CompleteHsaFamilyReimbursementScopeEvidence>
  allocations: readonly Readonly<HsaExecutedAllocationEvidence>[]
}

export interface HsaReimbursementExpenseStateRecord
  extends HsaQualifiedMedicalExpenseRecord {
  remainingUnreimbursedAmount: UsdCents
}

export interface HsaQualifiedExpenseConsumptionEvidence {
  consumptionEvidenceId: string
  medicalExpenseId: string
  medicalExpenseEvidenceId: string
  immutableExpenseSourceRecordId: string
  patientPersonId: PersonId
  patientRelationshipToDistributionOwner:
    HsaReimbursementClaim['patientRelationshipToDistributionOwner']
  patientRelationshipEvidenceId: string
  expenseIncurredDate: string
  ownerHsaEstablishedDate: string
  ownerHsaEstablishedDateEvidenceId: string
  originalEligibleExpenseAmount: PositiveUsdCents
  reimbursedBeforeAmount: UsdCents
  remainingUnreimbursedBeforeAmount: UsdCents
  reimbursedByAllocationAmount: PositiveUsdCents
  reimbursedAfterAmount: UsdCents
  remainingUnreimbursedAfterAmount: UsdCents
  eligibilityEvidenceId: string
}

export interface HsaReimbursementLedgerEntry {
  reimbursementScopeId: string
  eligibleHsaOwnerPersonIds: readonly PersonId[]
  coveredHsaAccountIds: readonly AccountId[]
  actionId: ActionId
  allocationId: AllocationId
  sourceAccountId: AccountId
  distributionOwnerPersonId: PersonId
  evaluationDate: string
  actionExecutionSequence: number
  allocationSequenceWithinAction: number
  reimbursementSequence: number
  physicalApplicationEvidenceId: string
  executedAmount: UsdCents
  qualifiedMedicalAmount: UsdCents
  nonqualifiedAmount: UsdCents
  ownerHsaEstablishedDate: string
  ownerHsaEstablishedDateEvidenceId: string
  priorHistoryEvidenceId: string
  priorTerminalLedgerEvidenceId: string | null
  previousLedgerEvidenceId: string | null
  expenseStateBeforeId: string
  expenseStateBefore: readonly Readonly<HsaReimbursementExpenseStateRecord>[]
  expenseStateAfterId: string
  expenseStateAfter: readonly Readonly<HsaReimbursementExpenseStateRecord>[]
  consumptions: readonly Readonly<HsaQualifiedExpenseConsumptionEvidence>[]
  ledgerEvidenceId: string
}

export interface AnnualHsaReimbursementLedgerIssue {
  kind: 'invalidInput' | 'identifierCollision' | 'incompleteEvidence'
  detail: string
}

export type AnnualHsaReimbursementLedgerEvaluated = Readonly<{
  status: 'evaluated'
  committed: false
  movement: 'notEstablished'
  actionability: 'notEstablished'
  publication: 'notEstablished'
  taxYear: number
  reimbursementScopeId: string
  openingExpenseStateId: string
  entries: readonly Readonly<HsaReimbursementLedgerEntry>[]
  terminalExpenseStateId: string
  terminalExpenseState:
    readonly Readonly<HsaReimbursementExpenseStateRecord>[]
  issues: readonly []
}>

export type AnnualHsaReimbursementLedgerBlocked = Readonly<{
  status: 'blocked'
  committed: false
  movement: 'notEstablished'
  actionability: 'notEstablished'
  publication: 'notEstablished'
  taxYear: number | null
  reimbursementScopeId: null
  openingExpenseStateId: null
  entries: readonly []
  terminalExpenseStateId: null
  terminalExpenseState: readonly []
  issues: readonly [Readonly<AnnualHsaReimbursementLedgerIssue>]
}>

export type EvaluateAnnualHsaReimbursementLedgerResult =
  | AnnualHsaReimbursementLedgerEvaluated
  | AnnualHsaReimbursementLedgerBlocked

const INPUT_KEYS = ['taxYear', 'allocationInventoryComplete', 'scope', 'allocations']
const SCOPE_KEYS = ['predicate', 'reimbursementScopeId', 'eligibleHsaOwnerPersonIds', 'coveredHsaAccountIds', 'ownerEstablishmentInventoryComplete', 'ownerEstablishments', 'expenseInventoryComplete', 'priorHistory', 'expenses']
const HISTORY_KEYS = ['predicate', 'reimbursementScopeId', 'completeness', 'priorHistoryEvidenceId', 'terminalLedgerEvidenceId', 'terminalExpenseStateId']
const ESTABLISHMENT_KEYS = ['predicate', 'ownerPersonId', 'ownerHsaEstablishedDate', 'ownerHsaEstablishedDateEvidenceId', 'authoritative']
const EXPENSE_KEYS = ['reimbursementScopeId', 'medicalExpenseId', 'medicalExpenseEvidenceId', 'immutableExpenseSourceRecordId', 'patientPersonId', 'expenseIncurredDate', 'originalEligibleExpenseAmount', 'reimbursedBeforeAmount', 'qualifiedMedicalExpense', 'eligibilityEvidenceId']
const ALLOCATION_KEYS = ['actionId', 'allocationId', 'sourceAccountId', 'distributionOwnerPersonId', 'evaluationDate', 'actionExecutionSequence', 'allocationSequenceWithinAction', 'physicalApplicationEvidenceId', 'executedAmount', 'ownerHsaEstablishedDate', 'ownerHsaEstablishedDateEvidenceId', 'reimbursementClaims']
const CLAIM_KEYS = ['medicalExpenseId', 'reimbursedByAllocationAmount', 'patientRelationshipToDistributionOwner', 'patientRelationshipEvidenceId']

function nonblank(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) throw new TypeError(`${label} must be a nonblank stable identifier`)
  return value
}

function civilDate(value: unknown, taxYear?: number): string {
  if (typeof value !== 'string') throw new TypeError('HSA evidence requires canonical civil dates')
  const parsed = parseCivilIsoDate(value)
  if (parsed === null || formatCivilDate(parsed) !== value || (taxYear !== undefined && parsed.year !== taxYear)) throw new RangeError('HSA evidence requires canonical civil dates in the tax year')
  return value
}

function positiveSequence(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || (value as number) <= 0) throw new RangeError(`${label} must be a positive safe integer`)
  return value as number
}

function blocked(taxYear: number | null, kind: AnnualHsaReimbursementLedgerIssue['kind'], detail: string): AnnualHsaReimbursementLedgerBlocked {
  return deepFreeze({ status: 'blocked', committed: false, movement: 'notEstablished', actionability: 'notEstablished', publication: 'notEstablished', taxYear, reimbursementScopeId: null, openingExpenseStateId: null, entries: [], terminalExpenseStateId: null, terminalExpenseState: [], issues: [{ kind, detail }] }) as AnnualHsaReimbursementLedgerBlocked
}

type StateRecord = HsaReimbursementExpenseStateRecord
type Allocation = HsaExecutedAllocationEvidence

function stateId(scopeId: string, state: readonly Readonly<StateRecord>[]): string {
  return deriveActionStructuralId('hsa-reimbursement-expense-state', [scopeId, state])
}

function canonicalState(state: readonly Readonly<StateRecord>[]): StateRecord[] {
  return state.map((record) => ({ ...record })).sort((left, right) => compareUtf16CodeUnits(left.medicalExpenseId, right.medicalExpenseId))
}

function compareAllocations(left: Allocation, right: Allocation): number {
  return compareUtf16CodeUnits(left.evaluationDate, right.evaluationDate) || left.actionExecutionSequence - right.actionExecutionSequence || left.allocationSequenceWithinAction - right.allocationSequenceWithinAction || compareUtf16CodeUnits(left.allocationId, right.allocationId)
}

function claimId(registry: Map<string, string>, id: unknown, role: string, identity: readonly unknown[]): string {
  const accepted = nonblank(id, `${role} ID`)
  const claim = JSON.stringify([role, ...identity])
  const prior = registry.get(accepted)
  if (prior !== undefined && prior !== claim) throw new Error(`Identifier ${accepted} is reused across HSA evidence identities`)
  registry.set(accepted, claim)
  return accepted
}

function validatedInput(raw: unknown): EvaluateAnnualHsaReimbursementLedgerInput {
  if (!exactKeys(raw, INPUT_KEYS)) throw new TypeError('Annual HSA ledger input has an invalid shape')
  const input = raw as unknown as EvaluateAnnualHsaReimbursementLedgerInput
  if (!Number.isSafeInteger(input.taxYear) || input.taxYear < 1 || input.taxYear > 9999 || input.allocationInventoryComplete !== true) throw new RangeError('Annual HSA ledger requires a complete inventory and four-digit tax year')
  if (!exactKeys(input.scope, SCOPE_KEYS) || !exactKeys(input.scope.priorHistory, HISTORY_KEYS) || input.scope.predicate !== 'completeHsaFamilyReimbursementScope' || input.scope.ownerEstablishmentInventoryComplete !== true || input.scope.expenseInventoryComplete !== true || input.scope.priorHistory.predicate !== 'completeHsaReimbursementPriorHistory' || input.scope.priorHistory.completeness !== 'completeBeforeFirstAllocation') throw new TypeError('Annual HSA ledger requires complete scope and prior-history evidence')
  for (const establishment of input.scope.ownerEstablishments) if (!exactKeys(establishment, ESTABLISHMENT_KEYS)) throw new TypeError('HSA owner-establishment records must have exact shapes')
  for (const expense of input.scope.expenses) if (!exactKeys(expense, EXPENSE_KEYS)) throw new TypeError('Annual HSA expense records must have exact shapes')
  for (const allocation of input.allocations) {
    if (!exactKeys(allocation, ALLOCATION_KEYS)) throw new TypeError('Annual HSA allocations must have exact shapes')
    for (const claim of allocation.reimbursementClaims) if (!exactKeys(claim, CLAIM_KEYS)) throw new TypeError('Annual HSA reimbursement claims must have exact shapes')
  }
  return input
}

/**
 * Builds an immutable household HSA reimbursement ledger from a complete,
 * already-executed allocation inventory. It does not move money, establish
 * actionability, classify income, evaluate penalties, publish, or mutate Plan.
 */
export function evaluateAnnualHsaReimbursementLedger(input: Readonly<EvaluateAnnualHsaReimbursementLedgerInput>): Readonly<EvaluateAnnualHsaReimbursementLedgerResult> {
  const snapshot = plainDataSnapshot(input)
  if (snapshot === INVALID_SNAPSHOT) return blocked(null, 'invalidInput', 'Annual HSA ledger input must be losslessly snapshottable acyclic plain data')
  let taxYear: number | null = null
  try {
    const accepted = validatedInput(snapshot)
    taxYear = accepted.taxYear
    const scopeId = nonblank(accepted.scope.reimbursementScopeId, 'HSA reimbursement scope')
    const history = accepted.scope.priorHistory
    if (history.reimbursementScopeId !== scopeId) throw new RangeError('Prior history must bind the reimbursement scope')
    const registry = new Map<string, string>()
    claimId(registry, scopeId, 'reimbursementScope', [scopeId])
    claimId(registry, history.priorHistoryEvidenceId, 'priorHistoryEvidence', [scopeId])
    if (history.terminalLedgerEvidenceId !== null) claimId(registry, history.terminalLedgerEvidenceId, 'priorTerminalLedgerEvidence', [scopeId])

    const ownerIds = accepted.scope.eligibleHsaOwnerPersonIds.map((id) => personIdSchema.parse(id)).sort(compareUtf16CodeUnits)
    const accountIds = accepted.scope.coveredHsaAccountIds.map((id) => accountIdSchema.parse(id)).sort(compareUtf16CodeUnits)
    if (ownerIds.length === 0 || accountIds.length === 0 || new Set(ownerIds).size !== ownerIds.length || new Set(accountIds).size !== accountIds.length) throw new RangeError('HSA family scope requires unique nonempty owner and account sets')
    for (const ownerId of ownerIds) claimId(registry, ownerId, 'person', [ownerId])
    for (const accountId of accountIds) claimId(registry, accountId, 'account', [accountId])
    const establishments = new Map<PersonId, HsaOwnerEstablishmentEvidence>()
    for (const record of accepted.scope.ownerEstablishments) {
      const owner = personIdSchema.parse(record.ownerPersonId)
      const date = civilDate(record.ownerHsaEstablishedDate)
      if (record.predicate !== 'authoritativeOwnerHsaEstablishment' || record.authoritative !== true || !ownerIds.includes(owner) || establishments.has(owner)) throw new RangeError('Complete HSA establishment inventory requires one authoritative record per eligible owner')
      const evidenceId = claimId(registry, record.ownerHsaEstablishedDateEvidenceId, 'ownerHsaEstablishmentEvidence', [owner, date])
      establishments.set(owner, { ...record, ownerPersonId: owner, ownerHsaEstablishedDate: date, ownerHsaEstablishedDateEvidenceId: evidenceId })
    }
    if (establishments.size !== ownerIds.length) throw new RangeError('Complete HSA establishment inventory requires one authoritative record per eligible owner')

    const expenseIds = new Set<string>()
    const expenseIdentity = new Set<string>()
    let state: StateRecord[] = accepted.scope.expenses.map((expense) => {
      const medicalExpenseId = nonblank(expense.medicalExpenseId, 'Medical expense')
      if (expenseIds.has(medicalExpenseId)) throw new RangeError('Medical expense IDs must be unique within a reimbursement scope')
      expenseIds.add(medicalExpenseId)
      claimId(registry, medicalExpenseId, 'medicalExpense', [scopeId, medicalExpenseId])
      const immutableSourceRecordId = nonblank(expense.immutableExpenseSourceRecordId, 'Immutable medical expense source record')
      const patientPersonId = personIdSchema.parse(expense.patientPersonId)
      const incurred = civilDate(expense.expenseIncurredDate)
      const original = positiveUsdCentsSchema.parse(expense.originalEligibleExpenseAmount)
      const reimbursed = usdCentsSchema.parse(expense.reimbursedBeforeAmount)
      if (expense.reimbursementScopeId !== scopeId || expense.qualifiedMedicalExpense !== true || reimbursed > original) throw new RangeError('Medical expense state does not belong to the complete scope or exceeds its eligible amount')
      const medicalEvidence = claimId(registry, expense.medicalExpenseEvidenceId, 'medicalExpenseEvidence', [scopeId, medicalExpenseId])
      const eligibilityEvidence = claimId(registry, expense.eligibilityEvidenceId, 'medicalExpenseEligibility', [scopeId, medicalExpenseId])
      claimId(registry, patientPersonId, 'person', [patientPersonId])
      claimId(registry, immutableSourceRecordId, 'immutableMedicalExpenseSourceRecord', [scopeId, patientPersonId, incurred, original])
      const identity = JSON.stringify([immutableSourceRecordId, patientPersonId, incurred, original])
      if (expenseIdentity.has(identity)) throw new RangeError('One underlying medical expense cannot be reminted within the reimbursement scope')
      expenseIdentity.add(identity)
      return { reimbursementScopeId: scopeId, medicalExpenseId, medicalExpenseEvidenceId: medicalEvidence, immutableExpenseSourceRecordId: immutableSourceRecordId, patientPersonId, expenseIncurredDate: incurred, originalEligibleExpenseAmount: original, reimbursedBeforeAmount: reimbursed, qualifiedMedicalExpense: true, eligibilityEvidenceId: eligibilityEvidence, remainingUnreimbursedAmount: subtractUsdCents(original, reimbursed) }
    })
    state = canonicalState(state)
    const openingExpenseStateId = stateId(scopeId, state)
    if (nonblank(history.terminalExpenseStateId, 'Prior-history terminal expense state') !== openingExpenseStateId) throw new RangeError('Prior history must bind the exact opening expense state')
    const expectedHistoryId = deriveActionStructuralId('hsa-reimbursement-prior-history', [scopeId, history.terminalLedgerEvidenceId, openingExpenseStateId])
    if (history.priorHistoryEvidenceId !== expectedHistoryId) throw new RangeError('Prior-history evidence ID must bind its terminal ledger and expense state')
    if (state.some((record) => record.reimbursedBeforeAmount > 0) && history.terminalLedgerEvidenceId === null) throw new RangeError('Opening reimbursements require a prior-history terminal ledger')
    const allocations: Allocation[] = accepted.allocations.map((allocation) => {
      const actionId = actionIdSchema.parse(allocation.actionId)
      const allocationId = allocationIdSchema.parse(allocation.allocationId)
      const sourceAccountId = accountIdSchema.parse(allocation.sourceAccountId)
      const owner = personIdSchema.parse(allocation.distributionOwnerPersonId)
      const evaluationDate = civilDate(allocation.evaluationDate, accepted.taxYear)
      const established = civilDate(allocation.ownerHsaEstablishedDate)
      const actionSequence = positiveSequence(allocation.actionExecutionSequence, 'HSA action execution sequence')
      const allocationSequence = positiveSequence(allocation.allocationSequenceWithinAction, 'HSA allocation sequence')
      const executedAmount = usdCentsSchema.parse(allocation.executedAmount)
      const authoritativeEstablishment = establishments.get(owner)
      if (!ownerIds.includes(owner) || !accountIds.includes(sourceAccountId) || authoritativeEstablishment === undefined || authoritativeEstablishment.ownerHsaEstablishedDate !== established || authoritativeEstablishment.ownerHsaEstablishedDateEvidenceId !== allocation.ownerHsaEstablishedDateEvidenceId || established > evaluationDate) throw new RangeError('HSA allocation owner, source, or establishment evidence is outside the complete family scope')
      claimId(registry, actionId, 'action', [actionId])
      claimId(registry, allocationId, 'allocation', [allocationId])
      claimId(registry, allocation.physicalApplicationEvidenceId, 'physicalApplicationEvidence', [actionId, allocationId])
      claimId(registry, allocation.ownerHsaEstablishedDateEvidenceId, 'ownerHsaEstablishmentEvidence', [owner, established])
      const reimbursementClaims = allocation.reimbursementClaims.map((claim) => ({ ...claim, medicalExpenseId: nonblank(claim.medicalExpenseId, 'Claimed medical expense') })).sort((left, right) => compareUtf16CodeUnits(left.medicalExpenseId, right.medicalExpenseId))
      for (const claim of reimbursementClaims) claimId(registry, claim.patientRelationshipEvidenceId, 'patientRelationshipEvidence', [owner, claim.medicalExpenseId, claim.patientRelationshipToDistributionOwner, evaluationDate])
      return { ...allocation, actionId, allocationId, sourceAccountId, distributionOwnerPersonId: owner, evaluationDate, actionExecutionSequence: actionSequence, allocationSequenceWithinAction: allocationSequence, executedAmount, ownerHsaEstablishedDate: established, reimbursementClaims }
    }).sort(compareAllocations)
    claimId(registry, openingExpenseStateId, 'expenseStateEvidence', [scopeId, state])

    const allocationIds = new Set<string>()
    const actionBindings = new Map<string, string>()
    const actionSlots = new Map<string, string>()
    const allocationSlots = new Set<string>()
    const entries: HsaReimbursementLedgerEntry[] = []
    let previousLedgerEvidenceId: string | null = null
    for (const allocation of allocations) {
      if (allocationIds.has(allocation.allocationId)) throw new RangeError('HSA allocation IDs must be unique')
      allocationIds.add(allocation.allocationId)
      const actionBinding = JSON.stringify([allocation.distributionOwnerPersonId, allocation.evaluationDate, allocation.actionExecutionSequence])
      if (actionBindings.has(allocation.actionId) && actionBindings.get(allocation.actionId) !== actionBinding) throw new RangeError('Every HSA action allocation must share one owner and execution position')
      actionBindings.set(allocation.actionId, actionBinding)
      const slot = JSON.stringify([allocation.evaluationDate, allocation.actionExecutionSequence])
      if (actionSlots.has(slot) && actionSlots.get(slot) !== allocation.actionId) throw new RangeError('Different HSA actions cannot share one execution position')
      actionSlots.set(slot, allocation.actionId)
      const allocationSlot = JSON.stringify([allocation.actionId, allocation.allocationSequenceWithinAction])
      if (allocationSlots.has(allocationSlot)) throw new RangeError('HSA allocation sequence must be unique within its action')
      allocationSlots.add(allocationSlot)

      const before = canonicalState(state)
      const beforeId = stateId(scopeId, before)
      const claims = new Set<string>()
      const consumptions: HsaQualifiedExpenseConsumptionEvidence[] = []
      let qualified = usdCentsSchema.parse(0)
      for (const claim of allocation.reimbursementClaims) {
        const medicalExpenseId = nonblank(claim.medicalExpenseId, 'Claimed medical expense')
        if (claims.has(medicalExpenseId)) throw new RangeError('A medical expense may appear only once in an HSA allocation')
        claims.add(medicalExpenseId)
        const index = state.findIndex((record) => record.medicalExpenseId === medicalExpenseId)
        if (index < 0) throw new RangeError('HSA reimbursement claim references a foreign medical expense')
        const expense = state[index]!
        const amount = positiveUsdCentsSchema.parse(claim.reimbursedByAllocationAmount)
        const relationship = claim.patientRelationshipToDistributionOwner
        if (!['self', 'spouse', 'qualifyingDependent'].includes(relationship) || (relationship === 'self') !== (expense.patientPersonId === allocation.distributionOwnerPersonId)) throw new RangeError('HSA patient relationship evidence does not bind the distribution owner')
        if (allocation.ownerHsaEstablishedDate > expense.expenseIncurredDate || expense.expenseIncurredDate > allocation.evaluationDate || amount > expense.remainingUnreimbursedAmount) throw new RangeError('HSA claim is future, pre-establishment, or exceeds the chained remainder')
        const relationshipId = claimId(registry, claim.patientRelationshipEvidenceId, 'patientRelationshipEvidence', [allocation.distributionOwnerPersonId, medicalExpenseId, relationship, allocation.evaluationDate])
        const reimbursedAfter = addUsdCents(expense.reimbursedBeforeAmount, amount)
        const remainingAfter = subtractUsdCents(expense.remainingUnreimbursedAmount, amount)
        const consumption = { medicalExpenseId, medicalExpenseEvidenceId: expense.medicalExpenseEvidenceId, immutableExpenseSourceRecordId: expense.immutableExpenseSourceRecordId, patientPersonId: expense.patientPersonId, patientRelationshipToDistributionOwner: relationship, patientRelationshipEvidenceId: relationshipId, expenseIncurredDate: expense.expenseIncurredDate, ownerHsaEstablishedDate: allocation.ownerHsaEstablishedDate, ownerHsaEstablishedDateEvidenceId: allocation.ownerHsaEstablishedDateEvidenceId, originalEligibleExpenseAmount: expense.originalEligibleExpenseAmount, reimbursedBeforeAmount: expense.reimbursedBeforeAmount, remainingUnreimbursedBeforeAmount: expense.remainingUnreimbursedAmount, reimbursedByAllocationAmount: amount, reimbursedAfterAmount: reimbursedAfter, remainingUnreimbursedAfterAmount: remainingAfter, eligibilityEvidenceId: expense.eligibilityEvidenceId }
        const consumptionEvidenceId = deriveActionStructuralId('hsa-qualified-expense-consumption', [scopeId, allocation.allocationId, consumption])
        claimId(registry, consumptionEvidenceId, 'qualifiedExpenseConsumptionEvidence', [scopeId, allocation.allocationId, consumption])
        consumptions.push({ consumptionEvidenceId, ...consumption })
        state[index] = { ...expense, reimbursedBeforeAmount: reimbursedAfter, remainingUnreimbursedAmount: remainingAfter }
        qualified = addUsdCents(qualified, amount)
      }
      if (qualified > allocation.executedAmount) throw new RangeError('Qualified HSA reimbursements cannot exceed the executed allocation')
      const after = canonicalState(state)
      const afterId = stateId(scopeId, after)
      claimId(registry, afterId, 'expenseStateEvidence', [scopeId, after])
      const entryCore = { reimbursementScopeId: scopeId, eligibleHsaOwnerPersonIds: ownerIds, coveredHsaAccountIds: accountIds, actionId: allocation.actionId, allocationId: allocation.allocationId, sourceAccountId: allocation.sourceAccountId, distributionOwnerPersonId: allocation.distributionOwnerPersonId, evaluationDate: allocation.evaluationDate, actionExecutionSequence: allocation.actionExecutionSequence, allocationSequenceWithinAction: allocation.allocationSequenceWithinAction, reimbursementSequence: entries.length + 1, physicalApplicationEvidenceId: allocation.physicalApplicationEvidenceId, executedAmount: allocation.executedAmount, qualifiedMedicalAmount: qualified, nonqualifiedAmount: subtractUsdCents(allocation.executedAmount, qualified), ownerHsaEstablishedDate: allocation.ownerHsaEstablishedDate, ownerHsaEstablishedDateEvidenceId: allocation.ownerHsaEstablishedDateEvidenceId, priorHistoryEvidenceId: history.priorHistoryEvidenceId, priorTerminalLedgerEvidenceId: history.terminalLedgerEvidenceId, previousLedgerEvidenceId, expenseStateBeforeId: beforeId, expenseStateBefore: before, expenseStateAfterId: afterId, expenseStateAfter: after, consumptions }
      const ledgerEvidenceId = deriveActionStructuralId('hsa-reimbursement-ledger-entry', [entryCore])
      claimId(registry, ledgerEvidenceId, 'reimbursementLedgerEvidence', [entryCore])
      entries.push({ ...entryCore, ledgerEvidenceId })
      previousLedgerEvidenceId = ledgerEvidenceId
      state = canonicalState(after)
    }
    const terminalExpenseState = canonicalState(state)
    return deepFreeze({ status: 'evaluated', committed: false, movement: 'notEstablished', actionability: 'notEstablished', publication: 'notEstablished', taxYear: accepted.taxYear, reimbursementScopeId: scopeId, openingExpenseStateId, entries, terminalExpenseStateId: stateId(scopeId, terminalExpenseState), terminalExpenseState, issues: [] }) as AnnualHsaReimbursementLedgerEvaluated
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Annual HSA reimbursement evidence is invalid'
    const kind = detail.includes('collid') || detail.includes('reused') ? 'identifierCollision' : detail.includes('complete') ? 'incompleteEvidence' : 'invalidInput'
    return blocked(taxYear, kind, detail)
  }
}
