import { describe, expect, it } from 'vitest'

import { asAccountId, asActionId, asAllocationId, asPersonId } from './identity.js'
import { asPositiveUsdCents, asUsdCents } from './money.js'
import { compareUtf16CodeUnits, deriveActionStructuralId } from './structuralId.js'
import {
  coordinateAnnualHsaTreatmentBinding,
  type CoordinateAnnualHsaTreatmentBindingInput,
} from './annualHsaTreatmentBindingCoordinator.js'
import { stageAnnualHsaPhysicalMovementCandidate } from './annualHsaPhysicalMovementCandidate.js'

type MutableInput = CoordinateAnnualHsaTreatmentBindingInput & {
  reimbursementClaims: CoordinateAnnualHsaTreatmentBindingInput['reimbursementClaims'][number][]
  ownerBirthEvidence: CoordinateAnnualHsaTreatmentBindingInput['ownerBirthEvidence'][number][]
  disabilityStatusEvidence: CoordinateAnnualHsaTreatmentBindingInput['disabilityStatusEvidence'][number][]
}

function request(actionId: string, owner: string, date: string, sequence: number, allocationId: string, source: string, amount: number) {
  return {
    actionId: asActionId(actionId), kind: 'ordinaryWithdrawal' as const, year: 2026,
    executionDate: date, executionSequence: sequence, personId: asPersonId(owner),
    requestedAmount: asPositiveUsdCents(amount), provenance: { source: 'manual' as const },
    purpose: { kind: 'spending' as const }, allocations: [{ allocationId: asAllocationId(allocationId), sourceAccountId: asAccountId(source), requestedAmount: asPositiveUsdCents(amount) }],
  }
}

function source(account: string, owner: string) {
  return { predicate: 'ownedHsaOrdinaryWithdrawalPhysicalSource' as const, sourceAccountId: asAccountId(account), ownerPersonId: asPersonId(owner), accountType: 'hsa' as const, ownership: 'individual' as const, accountOwnershipEvidenceId: `ownership-${account}`, hsaClassificationEvidenceId: `classification-${account}`, authoritative: true as const }
}

function opening(account: string, owner: string, balance: number) {
  return { predicate: 'authoritativeHsaDetachedBatchOpeningBalance' as const, boundary: 'detachedBatchStart' as const, sourceAccountId: asAccountId(account), ownerPersonId: asPersonId(owner), taxYear: 2026, openingBalance: asUsdCents(balance), openingBalanceEvidenceId: `opening-${account}`, authoritative: true as const }
}

function bindOpeningState(input: MutableInput): void {
  const state = input.reimbursementScope.expenses.map((expense) => ({ ...expense, remainingUnreimbursedAmount: asUsdCents(expense.originalEligibleExpenseAmount - expense.reimbursedBeforeAmount) })).sort((left, right) => compareUtf16CodeUnits(left.medicalExpenseId, right.medicalExpenseId))
  const terminalExpenseStateId = deriveActionStructuralId('hsa-reimbursement-expense-state', [input.reimbursementScope.reimbursementScopeId, state])
  Object.assign(input.reimbursementScope.priorHistory, {
    terminalExpenseStateId,
    priorHistoryEvidenceId: deriveActionStructuralId('hsa-reimbursement-prior-history', [input.reimbursementScope.reimbursementScopeId, input.reimbursementScope.priorHistory.terminalLedgerEvidenceId, terminalExpenseStateId]),
  })
}

function fixture(): MutableInput {
  const ownerA = asPersonId('owner-a')
  const ownerB = asPersonId('owner-b')
  const input = {
    physicalInput: {
      taxYear: 2026, requestInventoryComplete: true as const,
      requests: [
        request('late', 'owner-a', '2026-06-01', 2, 'partial', 'hsa-a', 400),
        request('zero-action', 'owner-b', '2026-03-01', 1, 'zero-allocation', 'hsa-b', 100),
        request('early', 'owner-a', '2026-01-15', 1, 'full', 'hsa-a', 600),
      ],
      sourceEvidenceInventoryComplete: true as const,
      sourceEvidence: [source('hsa-b', 'owner-b'), source('hsa-a', 'owner-a')],
      openingBalanceInventoryComplete: true as const,
      openingBalances: [opening('hsa-b', 'owner-b', 0), opening('hsa-a', 'owner-a', 700)],
    },
    reimbursementScope: {
      predicate: 'completeHsaFamilyReimbursementScope' as const,
      reimbursementScopeId: 'scope-family',
      eligibleHsaOwnerPersonIds: [ownerB, ownerA], coveredHsaAccountIds: [asAccountId('hsa-b'), asAccountId('hsa-a')],
      ownerEstablishmentInventoryComplete: true as const,
      ownerEstablishments: [
        { predicate: 'authoritativeOwnerHsaEstablishment' as const, ownerPersonId: ownerB, ownerHsaEstablishedDate: '2020-01-01', ownerHsaEstablishedDateEvidenceId: 'establishment-b', authoritative: true as const },
        { predicate: 'authoritativeOwnerHsaEstablishment' as const, ownerPersonId: ownerA, ownerHsaEstablishedDate: '2019-01-01', ownerHsaEstablishedDateEvidenceId: 'establishment-a', authoritative: true as const },
      ],
      expenseInventoryComplete: true as const,
      priorHistory: { predicate: 'completeHsaReimbursementPriorHistory' as const, reimbursementScopeId: 'scope-family', completeness: 'completeBeforeFirstAllocation' as const, priorHistoryEvidenceId: 'bound-below', terminalLedgerEvidenceId: null, terminalExpenseStateId: 'bound-below' },
      expenses: [{ reimbursementScopeId: 'scope-family', medicalExpenseId: 'expense-a', medicalExpenseEvidenceId: 'medical-evidence-a', immutableExpenseSourceRecordId: 'provider-record-a', patientPersonId: ownerA, expenseIncurredDate: '2020-06-01', originalEligibleExpenseAmount: asPositiveUsdCents(700), reimbursedBeforeAmount: asUsdCents(0), qualifiedMedicalExpense: true as const, eligibilityEvidenceId: 'eligibility-a' }],
    },
    reimbursementClaimInventoryComplete: true as const,
    reimbursementClaims: [
      { actionId: asActionId('late'), allocationId: asAllocationId('partial'), reimbursementClaims: [{ medicalExpenseId: 'expense-a', reimbursedByAllocationAmount: asPositiveUsdCents(100), patientRelationshipToDistributionOwner: 'self' as const, patientRelationshipEvidenceId: 'relationship-late' }] },
      { actionId: asActionId('zero-action'), allocationId: asAllocationId('zero-allocation'), reimbursementClaims: [] },
      { actionId: asActionId('early'), allocationId: asAllocationId('full'), reimbursementClaims: [{ medicalExpenseId: 'expense-a', reimbursedByAllocationAmount: asPositiveUsdCents(400), patientRelationshipToDistributionOwner: 'self' as const, patientRelationshipEvidenceId: 'relationship-early' }] },
    ],
    ownerBirthEvidenceComplete: true as const,
    ownerBirthEvidence: [{ predicate: 'authoritativeHsaOwnerBirthDate' as const, ownerPersonId: ownerA, birthDate: '1970-01-01', birthDateEvidenceId: 'birth-a', authoritative: true as const }],
    disabilityStatusEvidenceComplete: true as const,
    disabilityStatusEvidence: [{ predicate: 'authoritativeHsaDisabilityStatusOnDistributionDate' as const, ownerPersonId: ownerA, evaluationDate: '2026-01-15', disabilityQualificationDate: null, qualifiedOnEvaluationDate: false, disabilityEvidenceId: 'disability-a', authoritative: true as const }],
  } as MutableInput
  bindOpeningState(input)
  return input
}

function prepared(input = fixture()) {
  const result = coordinateAnnualHsaTreatmentBinding(input)
  if (result.status !== 'annualHsaTreatmentBindingPrepared') throw new Error(result.issues[0].detail)
  expect(result.status).toBe('annualHsaTreatmentBindingPrepared')
  return result
}

function reverseKeys<T extends object>(value: T): T {
  return Object.fromEntries(Object.entries(value).reverse()) as T
}

describe('coordinateAnnualHsaTreatmentBinding', () => {
  it('binds full, partial, and zero physical applications through exact ledger, character, and penalty coverage', () => {
    const result = prepared()
    expect(result.candidate.applications.map((item) => [item.allocationId, item.applicationStatus, item.stagedAmount])).toEqual([['full', 'full', 600], ['zero-allocation', 'zero', 0], ['partial', 'partial', 100]])
    expect(result.applications.map((item) => [item.application.allocationId, item.inputAllocation.executedAmount, item.ledgerEntry.executedAmount, item.characterAllocation.executedAmount, item.penaltyAllocation.executedAmount])).toEqual([['full', 600, 600, 600, 600], ['zero-allocation', 0, 0, 0, 0], ['partial', 100, 100, 100, 100]])
    expect(result.character.allocations.map((item) => item.taxCharacter.map((segment) => [segment.kind, segment.amount]))).toEqual([[['qualifiedTaxFree', 400], ['ordinaryIncome', 200]], [], [['qualifiedTaxFree', 100]]])
    expect(result.penalty.aggregatePenaltyAmount).toBe(40)
    expect(result.penalty.allocations[1]).toMatchObject({ executedAmount: 0, penaltyRelevantCharacterAmount: 0, coveredPenaltyExposureAmount: 0, aggregatePenaltyAmount: 0, evaluations: [] })
    expect(result).toMatchObject({ committed: false, movement: 'notCommitted', runtimeInflows: 'notInventoried', actionability: 'notEstablished', publication: 'notEstablished', planMutation: 'notPerformed', simulatorIntegration: 'notPerformed' })
  })

  it('derives owner establishment and candidate physical identity without accepting caller physical conclusions', () => {
    const result = prepared()
    expect(result.characterInput.allocations.map((item, index) => [item.ownerHsaEstablishedDateEvidenceId, item.physicalApplicationEvidenceId === result.candidate.applications[index]!.physicalApplicationEvidenceId, item.executedAmount === result.candidate.applications[index]!.stagedAmount])).toEqual([['establishment-a', true, true], ['establishment-b', true, true], ['establishment-a', true, true]])
    const hostile = fixture() as MutableInput & { candidate?: unknown }
    hostile.candidate = result.candidate
    expect(coordinateAnnualHsaTreatmentBinding(hostile)).toMatchObject({ status: 'annualHsaTreatmentBindingBlocked', candidate: null, issues: [{ stage: 'input', kind: 'invalidInput' }] })
  })

  it('canonicalizes physical, scope, establishment, expense, claim-record, and claim permutations', () => {
    const input = fixture()
    Object.assign(input.physicalInput, { requests: [...input.physicalInput.requests].reverse(), sourceEvidence: [...input.physicalInput.sourceEvidence].reverse(), openingBalances: [...input.physicalInput.openingBalances].reverse() })
    Object.assign(input.reimbursementScope, { eligibleHsaOwnerPersonIds: [...input.reimbursementScope.eligibleHsaOwnerPersonIds].reverse(), coveredHsaAccountIds: [...input.reimbursementScope.coveredHsaAccountIds].reverse(), ownerEstablishments: [...input.reimbursementScope.ownerEstablishments].reverse(), expenses: [...input.reimbursementScope.expenses].reverse() })
    input.reimbursementClaims = [...input.reimbursementClaims].reverse().map((record) => ({ ...record, reimbursementClaims: [...record.reimbursementClaims].reverse() }))
    expect(prepared(input)).toEqual(prepared())
  })

  it('canonicalizes nested scope, claim, birth, and disability property insertion order', () => {
    const input = fixture()
    const scope = input.reimbursementScope
    Object.assign(input, {
      reimbursementScope: reverseKeys({ ...scope, priorHistory: reverseKeys(scope.priorHistory), ownerEstablishments: scope.ownerEstablishments.map(reverseKeys), expenses: scope.expenses.map(reverseKeys) }),
      reimbursementClaims: input.reimbursementClaims.map((record) => reverseKeys({ ...record, reimbursementClaims: record.reimbursementClaims.map(reverseKeys) })),
      ownerBirthEvidence: input.ownerBirthEvidence.map(reverseKeys),
      disabilityStatusEvidence: input.disabilityStatusEvidence.map(reverseKeys),
    })
    expect(prepared(input)).toEqual(prepared())
  })

  it('allows stable purpose, provenance, and scenario references to alias existing identities', () => {
    const input = fixture()
    const request = input.physicalInput.requests[0]!
    Object.assign(request, { purpose: { kind: 'other', referenceId: 'medical-evidence-a' }, provenance: { source: 'manual', sourceId: 'hsa-a', scenarioId: 'birth-a' } })
    expect(prepared(input).status).toBe('annualHsaTreatmentBindingPrepared')
  })

  it('blocks fresh expense-state identifiers reused through purpose or provenance references', () => {
    const stateId = prepared().ledger.terminalExpenseStateId
    for (const field of ['purpose', 'provenance'] as const) {
      const input = fixture()
      const request = input.physicalInput.requests[0]!
      if (field === 'purpose') Object.assign(request, { purpose: { kind: 'other', referenceId: stateId } })
      else Object.assign(request, { provenance: { source: 'manual', sourceId: stateId, scenarioId: 'scenario-ok' } })
      expect(coordinateAnnualHsaTreatmentBinding(input)).toMatchObject({ status: 'annualHsaTreatmentBindingBlocked', issues: [{ stage: 'identifierRegistry', kind: 'identifierCollision' }] })
    }
  })

  it.each([
    ['missing', (input: MutableInput) => { input.reimbursementClaims = input.reimbursementClaims.slice(1) }],
    ['extra', (input: MutableInput) => { input.reimbursementClaims.push({ actionId: asActionId('foreign'), allocationId: asAllocationId('foreign'), reimbursementClaims: [] }) }],
    ['duplicate', (input: MutableInput) => { input.reimbursementClaims.push({ ...input.reimbursementClaims[0]! }) }],
    ['wrong action', (input: MutableInput) => { input.reimbursementClaims[0] = { ...input.reimbursementClaims[0]!, actionId: asActionId('early') } }],
  ])('blocks a %s claim inventory without partial authority', (_label, mutate) => {
    const input = fixture(); mutate(input)
    expect(coordinateAnnualHsaTreatmentBinding(input)).toMatchObject({ status: 'annualHsaTreatmentBindingBlocked', applications: [], treatmentBindingId: null, issues: [{ stage: 'input', kind: expect.stringMatching(/claimInventoryMismatch|invalidInput/) }] })
  })

  it('blocks scope and establishment mismatches with nullable diagnostics', () => {
    const input = fixture()
    Object.assign(input.reimbursementScope, { ownerEstablishments: input.reimbursementScope.ownerEstablishments.filter((item) => item.ownerPersonId !== 'owner-b') })
    const result = coordinateAnnualHsaTreatmentBinding(input)
    expect(result).toMatchObject({ status: 'annualHsaTreatmentBindingBlocked', applications: [], treatmentBindingId: null, issues: [{ kind: 'rejoinMismatch' }] })
    if (result.status === 'annualHsaTreatmentBindingBlocked') expect(result.candidate).not.toBeNull()
  })

  it('handles qualified-only, age-65, disability, and under-65 20% treatments', () => {
    const qualified = fixture()
    qualified.reimbursementClaims[2] = { ...qualified.reimbursementClaims[2]!, reimbursementClaims: [{ ...qualified.reimbursementClaims[2]!.reimbursementClaims[0]!, reimbursedByAllocationAmount: asPositiveUsdCents(600) }] }
    qualified.ownerBirthEvidence = []
    qualified.disabilityStatusEvidence = []
    expect(prepared(qualified).penalty.aggregatePenaltyAmount).toBe(0)

    const age65 = fixture()
    age65.ownerBirthEvidence[0] = { ...age65.ownerBirthEvidence[0]!, birthDate: '1960-01-01' }
    age65.disabilityStatusEvidence = []
    expect(prepared(age65).penalty.allocations[0]!.evaluations[1]).toMatchObject({ treatment: 'hsaAge65', finalPenaltyAmount: 0 })

    const disability = fixture()
    disability.disabilityStatusEvidence[0] = { ...disability.disabilityStatusEvidence[0]!, qualifiedOnEvaluationDate: true, disabilityQualificationDate: '2025-01-01' }
    expect(prepared(disability).penalty.allocations[0]!.evaluations[1]).toMatchObject({ treatment: 'hsaDisability', finalPenaltyAmount: 0 })
    expect(prepared().penalty.allocations[0]!.evaluations[1]).toMatchObject({ treatment: 'penaltyApplies', penaltyRatePercent: 20, finalPenaltyAmount: 40 })
  })

  it('detects cross-role and cross-boundary identifier collisions', () => {
    const crossRole = fixture()
    crossRole.reimbursementClaims[2] = { ...crossRole.reimbursementClaims[2]!, reimbursementClaims: [{ ...crossRole.reimbursementClaims[2]!.reimbursementClaims[0]!, patientRelationshipEvidenceId: 'hsa-a' }] }
    expect(coordinateAnnualHsaTreatmentBinding(crossRole)).toMatchObject({ status: 'annualHsaTreatmentBindingBlocked', issues: [{ kind: expect.stringMatching(/reimbursementLedgerBlocked|identifierCollision/) }] })

    const crossBoundary = fixture()
    const candidateId = stageAnnualHsaPhysicalMovementCandidate(crossBoundary.physicalInput).movementCandidateId
    Object.assign(crossBoundary.reimbursementScope, { expenses: [{ ...crossBoundary.reimbursementScope.expenses[0]!, medicalExpenseId: candidateId }] })
    crossBoundary.reimbursementClaims = crossBoundary.reimbursementClaims.map((record) => ({ ...record, reimbursementClaims: record.reimbursementClaims.map((claim) => ({ ...claim, medicalExpenseId: candidateId })) }))
    bindOpeningState(crossBoundary)
    expect(coordinateAnnualHsaTreatmentBinding(crossBoundary)).toMatchObject({ status: 'annualHsaTreatmentBindingBlocked', issues: [{ stage: 'identifierRegistry', kind: 'identifierCollision' }] })
  })

  it('rejects hostile plain-data shapes and returns a deeply immutable snapshot without mutating input', () => {
    const getter = fixture()
    Object.defineProperty(getter, 'reimbursementClaims', { enumerable: true, get: () => [] })
    expect(coordinateAnnualHsaTreatmentBinding(getter)).toMatchObject({ status: 'annualHsaTreatmentBindingBlocked', issues: [{ kind: 'invalidInput' }] })
    const input = fixture(); const before = structuredClone(input); const result = prepared(input)
    expect(input).toEqual(before)
    expect(Object.isFrozen(result)).toBe(true)
    expect(Object.isFrozen(result.applications[0]?.penaltyAllocation)).toBe(true)
    expect(() => { (result.applications as unknown as unknown[]).push('bad') }).toThrow()
  })

  it.each([
    ['null scope', (input: MutableInput) => { Object.assign(input, { reimbursementScope: null }) }],
    ['null claim inventory', (input: MutableInput) => { Object.assign(input, { reimbursementClaims: null }) }],
    ['null nested claims', (input: MutableInput) => { Object.assign(input.reimbursementClaims[0]!, { reimbursementClaims: null }) }],
    ['string owner array', (input: MutableInput) => { Object.assign(input.reimbursementScope, { eligibleHsaOwnerPersonIds: 'x' }) }],
    ['string account array', (input: MutableInput) => { Object.assign(input.reimbursementScope, { coveredHsaAccountIds: 'x' }) }],
  ])('blocks hostile %s containers without throwing', (_label, mutate) => {
    const input = fixture(); mutate(input)
    expect(() => coordinateAnnualHsaTreatmentBinding(input)).not.toThrow()
    expect(coordinateAnnualHsaTreatmentBinding(input)).toMatchObject({ status: 'annualHsaTreatmentBindingBlocked', candidate: null, issues: [{ stage: 'input', kind: 'invalidInput' }] })
  })
})
