import {
  stageAnnualHsaPhysicalMovementCandidate,
  type AnnualHsaPhysicalMovementCandidate,
  type HsaPhysicalAllocationApplication,
  type StageAnnualHsaPhysicalMovementCandidateInput,
} from './annualHsaPhysicalMovementCandidate.js'
import {
  evaluateAnnualHsaReimbursementLedger,
  type AnnualHsaReimbursementLedgerEvaluated,
  type CompleteHsaFamilyReimbursementScopeEvidence,
  type EvaluateAnnualHsaReimbursementLedgerInput,
  type HsaReimbursementClaim,
} from './annualHsaReimbursementLedger.js'
import {
  classifyAnnualHsaWithdrawalCharacter,
  type AnnualHsaWithdrawalCharacterAccepted,
  type ClassifyAnnualHsaWithdrawalCharacterResult,
} from './annualHsaWithdrawalCharacter.js'
import {
  evaluateAnnualHsaPenalty,
  type AnnualHsaPenaltyEvaluated,
  type EvaluateAnnualHsaPenaltyResult,
  type HsaPenaltyDisabilityStatusEvidence,
  type HsaPenaltyOwnerBirthEvidence,
} from './annualHsaPenaltyEvaluation.js'
import type { ActionId, AllocationId } from './identity.js'
import { compareUtf16CodeUnits, deriveActionStructuralId } from './structuralId.js'
import { deepFreeze } from './freeze.js'
import { INVALID_SNAPSHOT, plainDataSnapshot } from './plainData.js'

export interface HsaAllocationReimbursementClaims {
  actionId: ActionId
  allocationId: AllocationId
  reimbursementClaims: readonly Readonly<HsaReimbursementClaim>[]
}

export interface CoordinateAnnualHsaTreatmentBindingInput {
  physicalInput: Readonly<StageAnnualHsaPhysicalMovementCandidateInput>
  reimbursementScope: Readonly<CompleteHsaFamilyReimbursementScopeEvidence>
  reimbursementClaimInventoryComplete: true
  reimbursementClaims: readonly Readonly<HsaAllocationReimbursementClaims>[]
  ownerBirthEvidenceComplete: true
  ownerBirthEvidence: readonly Readonly<HsaPenaltyOwnerBirthEvidence>[]
  disabilityStatusEvidenceComplete: true
  disabilityStatusEvidence: readonly Readonly<HsaPenaltyDisabilityStatusEvidence>[]
}

export interface HsaPreparedTreatmentBinding {
  application: Readonly<HsaPhysicalAllocationApplication>
  inputAllocation: Readonly<EvaluateAnnualHsaReimbursementLedgerInput['allocations'][number]>
  ledgerEntry: Readonly<AnnualHsaReimbursementLedgerEvaluated['entries'][number]>
  characterAllocation: Readonly<AnnualHsaWithdrawalCharacterAccepted['allocations'][number]>
  penaltyAllocation: Readonly<AnnualHsaPenaltyEvaluated['allocations'][number]>
  bindingEvidenceId: string
}

export type AnnualHsaTreatmentBindingIssueKind =
  | 'invalidInput'
  | 'claimInventoryMismatch'
  | 'physicalCandidateBlocked'
  | 'reimbursementLedgerBlocked'
  | 'withdrawalCharacterBlocked'
  | 'penaltyBlocked'
  | 'rejoinMismatch'
  | 'identifierCollision'

export interface AnnualHsaTreatmentBindingIssue {
  stage: 'input' | 'physicalCandidate' | 'reimbursementLedger' | 'withdrawalCharacter' | 'penalty' | 'rejoin' | 'identifierRegistry'
  kind: AnnualHsaTreatmentBindingIssueKind
  detail: string
}

interface Boundaries {
  committed: false
  movement: 'notCommitted'
  runtimeInflows: 'notInventoried'
  actionability: 'notEstablished'
  publication: 'notEstablished'
  planMutation: 'notPerformed'
  simulatorIntegration: 'notPerformed'
}

export type AnnualHsaTreatmentBindingPrepared = Readonly<Boundaries & {
  status: 'annualHsaTreatmentBindingPrepared'
  candidate: Readonly<AnnualHsaPhysicalMovementCandidate>
  characterInput: Readonly<EvaluateAnnualHsaReimbursementLedgerInput>
  ledger: Readonly<AnnualHsaReimbursementLedgerEvaluated>
  character: Readonly<AnnualHsaWithdrawalCharacterAccepted>
  penalty: Readonly<AnnualHsaPenaltyEvaluated>
  applications: readonly Readonly<HsaPreparedTreatmentBinding>[]
  treatmentBindingId: string
  issues: readonly []
}>

export type AnnualHsaTreatmentBindingBlocked = Readonly<Boundaries & {
  status: 'annualHsaTreatmentBindingBlocked'
  candidate: Readonly<AnnualHsaPhysicalMovementCandidate> | null
  characterInput: Readonly<EvaluateAnnualHsaReimbursementLedgerInput> | null
  ledger: Readonly<ReturnType<typeof evaluateAnnualHsaReimbursementLedger>> | null
  character: Readonly<ClassifyAnnualHsaWithdrawalCharacterResult> | null
  penalty: Readonly<EvaluateAnnualHsaPenaltyResult> | null
  applications: readonly []
  treatmentBindingId: null
  issues: readonly [Readonly<AnnualHsaTreatmentBindingIssue>]
}>

export type CoordinateAnnualHsaTreatmentBindingResult =
  | AnnualHsaTreatmentBindingPrepared
  | AnnualHsaTreatmentBindingBlocked

const INPUT_KEYS = ['physicalInput', 'reimbursementScope', 'reimbursementClaimInventoryComplete', 'reimbursementClaims', 'ownerBirthEvidenceComplete', 'ownerBirthEvidence', 'disabilityStatusEvidenceComplete', 'disabilityStatusEvidence']
const CLAIM_RECORD_KEYS = ['actionId', 'allocationId', 'reimbursementClaims']
const SCOPE_KEYS = ['predicate', 'reimbursementScopeId', 'eligibleHsaOwnerPersonIds', 'coveredHsaAccountIds', 'ownerEstablishmentInventoryComplete', 'ownerEstablishments', 'expenseInventoryComplete', 'priorHistory', 'expenses']
const HISTORY_KEYS = ['predicate', 'reimbursementScopeId', 'completeness', 'priorHistoryEvidenceId', 'terminalLedgerEvidenceId', 'terminalExpenseStateId']
const ESTABLISHMENT_KEYS = ['predicate', 'ownerPersonId', 'ownerHsaEstablishedDate', 'ownerHsaEstablishedDateEvidenceId', 'authoritative']
const EXPENSE_KEYS = ['reimbursementScopeId', 'medicalExpenseId', 'medicalExpenseEvidenceId', 'immutableExpenseSourceRecordId', 'patientPersonId', 'expenseIncurredDate', 'originalEligibleExpenseAmount', 'reimbursedBeforeAmount', 'qualifiedMedicalExpense', 'eligibilityEvidenceId']
const CLAIM_KEYS = ['medicalExpenseId', 'reimbursedByAllocationAmount', 'patientRelationshipToDistributionOwner', 'patientRelationshipEvidenceId']
const BOUNDARIES: Boundaries = { committed: false, movement: 'notCommitted', runtimeInflows: 'notInventoried', actionability: 'notEstablished', publication: 'notEstablished', planMutation: 'notPerformed', simulatorIntegration: 'notPerformed' }

function exactKeys(value: unknown, expected: readonly string[]): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  const keys = Object.keys(value)
  return keys.length === expected.length && keys.every((key) => expected.includes(key))
}

function validContainers(input: Record<string, unknown>): boolean {
  if (!Array.isArray(input.reimbursementClaims) || !Array.isArray(input.ownerBirthEvidence) || !Array.isArray(input.disabilityStatusEvidence)) return false
  const scope = input.reimbursementScope
  if (!exactKeys(scope, SCOPE_KEYS) || !Array.isArray(scope.eligibleHsaOwnerPersonIds) || !Array.isArray(scope.coveredHsaAccountIds) || !Array.isArray(scope.ownerEstablishments) || !Array.isArray(scope.expenses) || !exactKeys(scope.priorHistory, HISTORY_KEYS)) return false
  if (scope.ownerEstablishments.some((item) => !exactKeys(item, ESTABLISHMENT_KEYS)) || scope.expenses.some((item) => !exactKeys(item, EXPENSE_KEYS))) return false
  return input.reimbursementClaims.every((record) => exactKeys(record, CLAIM_RECORD_KEYS) && Array.isArray(record.reimbursementClaims) && record.reimbursementClaims.every((claim) => exactKeys(claim, CLAIM_KEYS)))
}

function blocked(
  diagnostics: {
    candidate?: Readonly<AnnualHsaPhysicalMovementCandidate> | null
    characterInput?: Readonly<EvaluateAnnualHsaReimbursementLedgerInput> | null
    ledger?: Readonly<ReturnType<typeof evaluateAnnualHsaReimbursementLedger>> | null
    character?: Readonly<ClassifyAnnualHsaWithdrawalCharacterResult> | null
    penalty?: Readonly<EvaluateAnnualHsaPenaltyResult> | null
  },
  stage: AnnualHsaTreatmentBindingIssue['stage'],
  kind: AnnualHsaTreatmentBindingIssueKind,
  detail: string,
): AnnualHsaTreatmentBindingBlocked {
  return deepFreeze({ status: 'annualHsaTreatmentBindingBlocked', ...BOUNDARIES, candidate: diagnostics.candidate ?? null, characterInput: diagnostics.characterInput ?? null, ledger: diagnostics.ledger ?? null, character: diagnostics.character ?? null, penalty: diagnostics.penalty ?? null, applications: [], treatmentBindingId: null, issues: [{ stage, kind, detail }] }) as AnnualHsaTreatmentBindingBlocked
}

function same(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

function idRole(key: string): string | null {
  const lower = key.toLowerCase()
  if (key === 'actionId') return 'action'
  if (key.endsWith('PersonId') || key.endsWith('PersonIds')) return 'person'
  if (key.endsWith('AccountId') || key.endsWith('AccountIds')) return 'account'
  if (key === 'allocationId') return 'allocation'
  if (key === 'medicalExpenseId') return 'medicalExpense'
  if (key === 'reimbursementScopeId') return 'reimbursementScope'
  if (lower.includes('expensestate') && key.endsWith('Id')) return 'expenseStateEvidence'
  if (lower.includes('ledgerevidence') && key.endsWith('Id')) return key === 'annualLedgerEvidenceId' ? 'annualLedgerEvidence' : 'ledgerEvidence'
  if (key === 'segmentId' || key === 'characterSegmentId') return 'characterSegment'
  if (key.endsWith('EvidenceId')) return key.replace(/Id$/, '')
  if (key.endsWith('EvidenceIds')) return key.replace(/Ids$/, '')
  if (key === 'immutableExpenseSourceRecordId') return 'immutableExpenseSourceRecord'
  if (key === 'movementCandidateId') return 'movementCandidate'
  if (key === 'bindingEvidenceId') return 'treatmentApplicationBindingEvidence'
  if (key === 'treatmentBindingId') return 'treatmentBinding'
  return null
}

function collectStrings(value: unknown, output: Set<string>, seen = new WeakSet<object>()): void {
  if (typeof value === 'string') { output.add(value); return }
  if (value === null || typeof value !== 'object' || seen.has(value)) return
  seen.add(value)
  for (const child of Object.values(value as Record<string, unknown>)) collectStrings(child, output, seen)
}

interface CallerStringOccurrence { value: string; path: string }

function collectStringOccurrences(value: unknown, output: CallerStringOccurrence[], path = '', seen = new WeakSet<object>()): void {
  if (typeof value === 'string') { output.push({ value, path }); return }
  if (value === null || typeof value !== 'object' || seen.has(value)) return
  seen.add(value)
  if (Array.isArray(value)) value.forEach((child, index) => collectStringOccurrences(child, output, `${path}[${index}]`, seen))
  else for (const [key, child] of Object.entries(value as Record<string, unknown>)) collectStringOccurrences(child, output, path.length === 0 ? key : `${path}.${key}`, seen)
}

function freshDownstreamIds(
  ledger: Readonly<AnnualHsaReimbursementLedgerEvaluated>,
  character: Readonly<AnnualHsaWithdrawalCharacterAccepted>,
  penalty: Readonly<AnnualHsaPenaltyEvaluated>,
): string[] {
  const ids = [character.annualLedgerEvidenceId]
  for (const entry of ledger.entries) {
    ids.push(entry.ledgerEvidenceId)
    for (const consumption of entry.consumptions) ids.push(consumption.consumptionEvidenceId)
  }
  for (const allocation of character.allocations) {
    ids.push(allocation.characterEvidenceId)
    for (const segment of allocation.taxCharacter) ids.push(segment.segmentId)
  }
  for (const allocation of penalty.allocations) {
    ids.push(allocation.coverageEvidenceId)
    for (const evaluation of allocation.evaluations) {
      ids.push(evaluation.penaltyEvidenceId)
      if ('ageEvidence' in evaluation.acceptedEvidence) ids.push(evaluation.acceptedEvidence.ageEvidence.ageEvidenceId)
      if ('rateEvidence' in evaluation.acceptedEvidence) ids.push(evaluation.acceptedEvidence.rateEvidence.rateEvidenceId)
    }
  }
  return ids
}

function registerIds(value: unknown, registry: Map<string, string>, key = '', seen = new WeakSet<object>()): void {
  const role = idRole(key)
  if (typeof value === 'string') {
    if (role === null) return
    if (value.trim().length === 0) throw new TypeError(`${key} must be a nonblank identifier`)
    const prior = registry.get(value)
    if (prior !== undefined && prior !== role) throw new Error(`Coordinator identifier collision for "${value}" between ${prior} and ${role}`)
    registry.set(value, role)
    return
  }
  if (Array.isArray(value)) {
    if (role !== null) for (const item of value) registerIds(item, registry, key, seen)
    else for (const item of value) registerIds(item, registry, '', seen)
    return
  }
  if (value === null || typeof value !== 'object' || seen.has(value)) return
  seen.add(value)
  for (const [childKey, child] of Object.entries(value as Record<string, unknown>)) registerIds(child, registry, childKey, seen)
}

function assertRejoin(
  candidate: Readonly<AnnualHsaPhysicalMovementCandidate>,
  characterInput: Readonly<EvaluateAnnualHsaReimbursementLedgerInput>,
  ledger: Readonly<AnnualHsaReimbursementLedgerEvaluated>,
  character: Readonly<AnnualHsaWithdrawalCharacterAccepted>,
  penalty: Readonly<AnnualHsaPenaltyEvaluated>,
): void {
  if (!same(character.ledger, ledger) || !same(penalty.character, character)) throw new RangeError('HSA downstream rebuilds do not equal the independently rebuilt ledger and character')
  const arrays = [characterInput.allocations, ledger.entries, character.allocations, penalty.allocations]
  if (arrays.some((items) => items.length !== candidate.applications.length)) throw new RangeError('HSA treatment stages must exactly cover every physical application')
  candidate.applications.forEach((application, index) => {
    const expected = { actionId: application.actionId, allocationId: application.allocationId, sourceAccountId: application.sourceAccountId, owner: application.distributionOwnerPersonId, evaluationDate: application.evaluationDate, actionExecutionSequence: application.actionExecutionSequence, allocationSequenceWithinAction: application.allocationSequenceWithinAction, physicalApplicationEvidenceId: application.physicalApplicationEvidenceId, amount: application.stagedAmount }
    for (const item of arrays.map((items) => items[index]!)) {
      const actual = { actionId: item.actionId, allocationId: item.allocationId, sourceAccountId: item.sourceAccountId, owner: 'distributionOwnerPersonId' in item ? item.distributionOwnerPersonId : item.ownerPersonId, evaluationDate: item.evaluationDate, actionExecutionSequence: 'actionExecutionSequence' in item ? item.actionExecutionSequence : expected.actionExecutionSequence, allocationSequenceWithinAction: 'allocationSequenceWithinAction' in item ? item.allocationSequenceWithinAction : expected.allocationSequenceWithinAction, physicalApplicationEvidenceId: 'physicalApplicationEvidenceId' in item ? item.physicalApplicationEvidenceId : expected.physicalApplicationEvidenceId, amount: item.executedAmount }
      if (!same(actual, expected)) throw new RangeError(`HSA treatment rejoin mismatch for allocation "${application.allocationId}"`)
    }
    const entry = ledger.entries[index]!
    const coverage = character.allocations[index]!
    const penaltyCoverage = penalty.allocations[index]!
    if (entry.qualifiedMedicalAmount + entry.nonqualifiedAmount !== application.stagedAmount || coverage.qualifiedMedicalAmount + coverage.nonqualifiedAmount !== application.stagedAmount || coverage.taxCharacter.reduce((sum, segment) => sum + segment.amount, 0) !== application.stagedAmount || penaltyCoverage.penaltyRelevantCharacterAmount + penaltyCoverage.nonPenaltyRelevantCharacterAmount !== application.stagedAmount || penaltyCoverage.coveredPenaltyExposureAmount !== application.stagedAmount || penaltyCoverage.coverageDifferenceAmount !== 0 || penaltyCoverage.evaluations.reduce((sum, item) => sum + item.characterAmount, 0) !== application.stagedAmount) throw new RangeError(`HSA treatment cent coverage mismatch for allocation "${application.allocationId}"`)
  })
  if (penalty.allocations.reduce((sum, item) => sum + item.aggregatePenaltyAmount, 0) !== penalty.aggregatePenaltyAmount) throw new RangeError('HSA aggregate penalty amount does not equal its allocation coverage')
}

/** Rebuilds all tax treatment from a freshly staged, still-detached HSA candidate. */
export function coordinateAnnualHsaTreatmentBinding(
  raw: Readonly<CoordinateAnnualHsaTreatmentBindingInput>,
): Readonly<CoordinateAnnualHsaTreatmentBindingResult> {
  const snapshot = plainDataSnapshot(raw)
  if (snapshot === INVALID_SNAPSHOT || !exactKeys(snapshot, INPUT_KEYS) || !validContainers(snapshot)) return blocked({}, 'input', 'invalidInput', 'Annual HSA treatment input must be acyclic plain data with exact object and array shapes')
  const input = snapshot as unknown as CoordinateAnnualHsaTreatmentBindingInput
  if (input.reimbursementClaimInventoryComplete !== true || input.ownerBirthEvidenceComplete !== true || input.disabilityStatusEvidenceComplete !== true) return blocked({}, 'input', 'invalidInput', 'Annual HSA treatment inventories must be explicitly complete')
  const callerStrings = new Set<string>()
  collectStrings(snapshot, callerStrings)
  const callerOccurrences: CallerStringOccurrence[] = []
  collectStringOccurrences(snapshot, callerOccurrences)
  let candidate: Readonly<AnnualHsaPhysicalMovementCandidate>
  try { candidate = stageAnnualHsaPhysicalMovementCandidate(input.physicalInput) }
  catch (error) { return blocked({}, 'physicalCandidate', 'physicalCandidateBlocked', error instanceof Error ? error.message : 'HSA physical candidate staging failed') }
  if (callerStrings.has(candidate.movementCandidateId) || candidate.applications.some((application) => callerStrings.has(application.physicalApplicationEvidenceId))) return blocked({ candidate }, 'identifierRegistry', 'identifierCollision', 'A derived HSA physical identifier collides with caller-provided data outside the physical stage')

  const claimByAllocation = new Map<string, Readonly<HsaAllocationReimbursementClaims>>()
  for (const rawRecord of input.reimbursementClaims) {
    const record: HsaAllocationReimbursementClaims = {
      actionId: rawRecord.actionId,
      allocationId: rawRecord.allocationId,
      reimbursementClaims: rawRecord.reimbursementClaims.map((claim): HsaReimbursementClaim => ({
        medicalExpenseId: claim.medicalExpenseId,
        reimbursedByAllocationAmount: claim.reimbursedByAllocationAmount,
        patientRelationshipToDistributionOwner: claim.patientRelationshipToDistributionOwner,
        patientRelationshipEvidenceId: claim.patientRelationshipEvidenceId,
      })).sort((left, right) => compareUtf16CodeUnits(left.medicalExpenseId, right.medicalExpenseId)),
    }
    if (typeof record.actionId !== 'string' || typeof record.allocationId !== 'string') return blocked({ candidate }, 'input', 'invalidInput', 'HSA reimbursement claims must identify an action and allocation')
    if (claimByAllocation.has(record.allocationId)) return blocked({ candidate }, 'input', 'claimInventoryMismatch', 'HSA reimbursement claims must uniquely identify every allocation')
    claimByAllocation.set(record.allocationId, record)
  }
  if (claimByAllocation.size !== candidate.applications.length || candidate.applications.some((application) => claimByAllocation.get(application.allocationId)?.actionId !== application.actionId)) return blocked({ candidate }, 'input', 'claimInventoryMismatch', 'HSA reimbursement claim records must bijectively cover every physical application, including zero applications')

  const scope: CompleteHsaFamilyReimbursementScopeEvidence = {
    predicate: input.reimbursementScope.predicate,
    reimbursementScopeId: input.reimbursementScope.reimbursementScopeId,
    eligibleHsaOwnerPersonIds: [...input.reimbursementScope.eligibleHsaOwnerPersonIds].sort(compareUtf16CodeUnits),
    coveredHsaAccountIds: [...input.reimbursementScope.coveredHsaAccountIds].sort(compareUtf16CodeUnits),
    ownerEstablishmentInventoryComplete: input.reimbursementScope.ownerEstablishmentInventoryComplete,
    ownerEstablishments: input.reimbursementScope.ownerEstablishments.map((item) => ({ predicate: item.predicate, ownerPersonId: item.ownerPersonId, ownerHsaEstablishedDate: item.ownerHsaEstablishedDate, ownerHsaEstablishedDateEvidenceId: item.ownerHsaEstablishedDateEvidenceId, authoritative: item.authoritative })).sort((left, right) => compareUtf16CodeUnits(left.ownerPersonId, right.ownerPersonId)),
    expenseInventoryComplete: input.reimbursementScope.expenseInventoryComplete,
    priorHistory: {
      predicate: input.reimbursementScope.priorHistory.predicate,
      reimbursementScopeId: input.reimbursementScope.priorHistory.reimbursementScopeId,
      completeness: input.reimbursementScope.priorHistory.completeness,
      priorHistoryEvidenceId: input.reimbursementScope.priorHistory.priorHistoryEvidenceId,
      terminalLedgerEvidenceId: input.reimbursementScope.priorHistory.terminalLedgerEvidenceId,
      terminalExpenseStateId: input.reimbursementScope.priorHistory.terminalExpenseStateId,
    },
    expenses: input.reimbursementScope.expenses.map((item) => ({ reimbursementScopeId: item.reimbursementScopeId, medicalExpenseId: item.medicalExpenseId, medicalExpenseEvidenceId: item.medicalExpenseEvidenceId, immutableExpenseSourceRecordId: item.immutableExpenseSourceRecordId, patientPersonId: item.patientPersonId, expenseIncurredDate: item.expenseIncurredDate, originalEligibleExpenseAmount: item.originalEligibleExpenseAmount, reimbursedBeforeAmount: item.reimbursedBeforeAmount, qualifiedMedicalExpense: item.qualifiedMedicalExpense, eligibilityEvidenceId: item.eligibilityEvidenceId })).sort((left, right) => compareUtf16CodeUnits(left.medicalExpenseId, right.medicalExpenseId)),
  }
  const establishments = new Map(scope.ownerEstablishments.map((item) => [item.ownerPersonId, item] as const))
  const allocations: EvaluateAnnualHsaReimbursementLedgerInput['allocations'][number][] = []
  for (const application of candidate.applications) {
    const establishment = establishments.get(application.distributionOwnerPersonId)
    if (establishment === undefined) return blocked({ candidate }, 'input', 'rejoinMismatch', `HSA reimbursement scope lacks establishment evidence for owner "${application.distributionOwnerPersonId}"`)
    allocations.push({ actionId: application.actionId, allocationId: application.allocationId, sourceAccountId: application.sourceAccountId, distributionOwnerPersonId: application.distributionOwnerPersonId, evaluationDate: application.evaluationDate, actionExecutionSequence: application.actionExecutionSequence, allocationSequenceWithinAction: application.allocationSequenceWithinAction, physicalApplicationEvidenceId: application.physicalApplicationEvidenceId, executedAmount: application.stagedAmount, ownerHsaEstablishedDate: establishment.ownerHsaEstablishedDate, ownerHsaEstablishedDateEvidenceId: establishment.ownerHsaEstablishedDateEvidenceId, reimbursementClaims: claimByAllocation.get(application.allocationId)!.reimbursementClaims })
  }
  const characterInput: EvaluateAnnualHsaReimbursementLedgerInput = { taxYear: candidate.taxYear, allocationInventoryComplete: true, scope, allocations }
  const ledger = evaluateAnnualHsaReimbursementLedger(characterInput)
  if (ledger.status !== 'evaluated') return blocked({ candidate, characterInput, ledger }, 'reimbursementLedger', 'reimbursementLedgerBlocked', ledger.issues[0].detail)
  const character = classifyAnnualHsaWithdrawalCharacter(characterInput)
  if (character.status !== 'accepted') return blocked({ candidate, characterInput, ledger, character }, 'withdrawalCharacter', 'withdrawalCharacterBlocked', character.issues[0]?.detail ?? 'HSA withdrawal character was not accepted')
  const ownerBirthEvidence = input.ownerBirthEvidence.map((item): HsaPenaltyOwnerBirthEvidence => ({ predicate: item.predicate, ownerPersonId: item.ownerPersonId, birthDate: item.birthDate, birthDateEvidenceId: item.birthDateEvidenceId, authoritative: item.authoritative })).sort((left, right) => compareUtf16CodeUnits(left.ownerPersonId, right.ownerPersonId))
  const disabilityStatusEvidence = input.disabilityStatusEvidence.map((item): HsaPenaltyDisabilityStatusEvidence => ({ predicate: item.predicate, ownerPersonId: item.ownerPersonId, evaluationDate: item.evaluationDate, disabilityQualificationDate: item.disabilityQualificationDate, qualifiedOnEvaluationDate: item.qualifiedOnEvaluationDate, disabilityEvidenceId: item.disabilityEvidenceId, authoritative: item.authoritative })).sort((left, right) => compareUtf16CodeUnits(`${left.ownerPersonId}\u0000${left.evaluationDate}`, `${right.ownerPersonId}\u0000${right.evaluationDate}`))
  const penalty = evaluateAnnualHsaPenalty({ characterInput, ownerBirthEvidenceComplete: true, ownerBirthEvidence, disabilityStatusEvidenceComplete: true, disabilityStatusEvidence })
  if (penalty.status !== 'evaluated') return blocked({ candidate, characterInput, ledger, character, penalty }, 'penalty', 'penaltyBlocked', penalty.issues[0].detail)
  try {
    assertRejoin(candidate, characterInput, ledger, character, penalty)
    if (freshDownstreamIds(ledger, character, penalty).some((id) => callerStrings.has(id))) throw new Error('A freshly derived HSA treatment identifier collides with caller-provided data')
    const expenseStateIds = new Set<string>([ledger.openingExpenseStateId, ledger.terminalExpenseStateId])
    for (const entry of ledger.entries) { expenseStateIds.add(entry.expenseStateBeforeId); expenseStateIds.add(entry.expenseStateAfterId) }
    const allowedOpeningPath = 'reimbursementScope.priorHistory.terminalExpenseStateId'
    for (const id of expenseStateIds) {
      const forbidden = callerOccurrences.some((occurrence) => occurrence.value === id && !(id === ledger.openingExpenseStateId && occurrence.path === allowedOpeningPath))
      if (forbidden) throw new Error(`Fresh HSA expense-state identifier collision with caller-provided data: "${id}"`)
    }
    const registry = new Map<string, string>()
    registerIds(snapshot, registry)
    registerIds(candidate, registry)
    registerIds(characterInput, registry)
    registerIds(ledger, registry)
    registerIds(character, registry)
    registerIds(penalty, registry)
    const applications = candidate.applications.map((application, index): HsaPreparedTreatmentBinding => {
      const core = { application, inputAllocation: characterInput.allocations[index]!, ledgerEntry: ledger.entries[index]!, characterAllocation: character.allocations[index]!, penaltyAllocation: penalty.allocations[index]! }
      const bindingEvidenceId = deriveActionStructuralId('hsa-treatment-application-binding', [core])
      const prior = registry.get(bindingEvidenceId)
      if (prior !== undefined || callerStrings.has(bindingEvidenceId)) throw new Error(`Coordinator identifier collision for "${bindingEvidenceId}" between ${prior ?? 'callerData'} and treatmentApplicationBindingEvidence`)
      registry.set(bindingEvidenceId, 'treatmentApplicationBindingEvidence')
      return { ...core, bindingEvidenceId }
    })
    const treatmentBindingId = deriveActionStructuralId('annual-hsa-treatment-binding', [candidate.movementCandidateId, characterInput, ledger, character, penalty, applications, BOUNDARIES])
    if (registry.has(treatmentBindingId) || callerStrings.has(treatmentBindingId)) throw new Error(`Coordinator identifier collision for "${treatmentBindingId}" and treatmentBinding`)
    return deepFreeze({ status: 'annualHsaTreatmentBindingPrepared', ...BOUNDARIES, candidate, characterInput, ledger, character, penalty, applications, treatmentBindingId, issues: [] }) as AnnualHsaTreatmentBindingPrepared
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'HSA treatment binding failed'
    const collision = detail.includes('collision')
    return blocked({ candidate, characterInput, ledger, character, penalty }, collision ? 'identifierRegistry' : 'rejoin', collision ? 'identifierCollision' : 'rejoinMismatch', detail)
  }
}
