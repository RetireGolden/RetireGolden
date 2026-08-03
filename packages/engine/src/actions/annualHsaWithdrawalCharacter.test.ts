import { describe, expect, it } from 'vitest'
import {
  classifyAnnualHsaWithdrawalCharacter,
} from './annualHsaWithdrawalCharacter.js'
import type {
  EvaluateAnnualHsaReimbursementLedgerInput,
} from './annualHsaReimbursementLedger.js'
import { asAccountId, asActionId, asAllocationId, asPersonId } from './identity.js'
import { asPositiveUsdCents, asUsdCents } from './money.js'
import { compareUtf16CodeUnits, deriveActionStructuralId } from './structuralId.js'

const owner = asPersonId('owner-a')
const account = asAccountId('hsa-a')

function bindOpeningState(input: EvaluateAnnualHsaReimbursementLedgerInput): void {
  const state = input.scope.expenses.map((expense) => ({
    ...expense,
    remainingUnreimbursedAmount: asUsdCents(
      expense.originalEligibleExpenseAmount - expense.reimbursedBeforeAmount,
    ),
  })).sort((left, right) =>
    compareUtf16CodeUnits(left.medicalExpenseId, right.medicalExpenseId))
  const terminalExpenseStateId = deriveActionStructuralId(
    'hsa-reimbursement-expense-state',
    [input.scope.reimbursementScopeId, state],
  )
  Object.assign(input.scope.priorHistory, {
    terminalExpenseStateId,
    priorHistoryEvidenceId: deriveActionStructuralId(
      'hsa-reimbursement-prior-history',
      [
        input.scope.reimbursementScopeId,
        input.scope.priorHistory.terminalLedgerEvidenceId,
        terminalExpenseStateId,
      ],
    ),
  })
}

function fixture(): EvaluateAnnualHsaReimbursementLedgerInput {
  const input: EvaluateAnnualHsaReimbursementLedgerInput = {
    taxYear: 2026,
    allocationInventoryComplete: true,
    scope: {
      predicate: 'completeHsaFamilyReimbursementScope',
      reimbursementScopeId: 'scope-a',
      eligibleHsaOwnerPersonIds: [owner],
      coveredHsaAccountIds: [account],
      ownerEstablishmentInventoryComplete: true,
      ownerEstablishments: [{
        predicate: 'authoritativeOwnerHsaEstablishment',
        ownerPersonId: owner,
        ownerHsaEstablishedDate: '2019-01-01',
        ownerHsaEstablishedDateEvidenceId: 'establishment-a',
        authoritative: true,
      }],
      expenseInventoryComplete: true,
      priorHistory: {
        predicate: 'completeHsaReimbursementPriorHistory',
        reimbursementScopeId: 'scope-a',
        completeness: 'completeBeforeFirstAllocation',
        priorHistoryEvidenceId: 'bound-below',
        terminalLedgerEvidenceId: null,
        terminalExpenseStateId: 'bound-below',
      },
      expenses: [{
        reimbursementScopeId: 'scope-a',
        medicalExpenseId: 'expense-a',
        medicalExpenseEvidenceId: 'expense-evidence-a',
        immutableExpenseSourceRecordId: 'provider-record-a',
        patientPersonId: owner,
        expenseIncurredDate: '2020-06-01',
        originalEligibleExpenseAmount: asPositiveUsdCents(10_000),
        reimbursedBeforeAmount: asUsdCents(0),
        qualifiedMedicalExpense: true,
        eligibilityEvidenceId: 'eligibility-a',
      }],
    },
    allocations: [{
      actionId: asActionId('action-a'),
      allocationId: asAllocationId('allocation-a'),
      sourceAccountId: account,
      distributionOwnerPersonId: owner,
      evaluationDate: '2026-03-01',
      actionExecutionSequence: 1,
      allocationSequenceWithinAction: 1,
      physicalApplicationEvidenceId: 'physical-a',
      executedAmount: asUsdCents(6_000),
      ownerHsaEstablishedDate: '2019-01-01',
      ownerHsaEstablishedDateEvidenceId: 'establishment-a',
      reimbursementClaims: [{
        medicalExpenseId: 'expense-a',
        reimbursedByAllocationAmount: asPositiveUsdCents(4_000),
        patientRelationshipToDistributionOwner: 'self',
        patientRelationshipEvidenceId: 'relationship-a',
      }],
    }],
  }
  bindOpeningState(input)
  return input
}

function accepted(input = fixture()) {
  const result = classifyAnnualHsaWithdrawalCharacter(input)
  expect(result.status).toBe('accepted')
  if (result.status !== 'accepted') throw new Error(result.issues[0]?.detail)
  return result
}

describe('classifyAnnualHsaWithdrawalCharacter', () => {
  it('derives exact qualified-tax-free and ordinary-income segments from the rebuilt ledger', () => {
    const result = accepted()
    const ledgerEntry = result.ledger.entries[0]!
    const coverage = result.allocations[0]!

    expect(result).toMatchObject({
      committed: false,
      movement: 'notEstablished',
      penalty: 'notEstablished',
      actionability: 'notEstablished',
      publication: 'notEstablished',
    })
    expect(coverage).toMatchObject({
      predicate: 'completeHsaWithdrawalCharacterCoverageForAllocation',
      reimbursementScopeId: ledgerEntry.reimbursementScopeId,
      actionId: ledgerEntry.actionId,
      allocationId: ledgerEntry.allocationId,
      sourceAccountId: ledgerEntry.sourceAccountId,
      ownerPersonId: ledgerEntry.distributionOwnerPersonId,
      evaluationDate: ledgerEntry.evaluationDate,
      executedAmount: 6_000,
      qualifiedMedicalAmount: 4_000,
      nonqualifiedAmount: 2_000,
      ledgerEvidenceId: ledgerEntry.ledgerEvidenceId,
      previousLedgerEvidenceId: ledgerEntry.previousLedgerEvidenceId,
      expenseStateBeforeId: ledgerEntry.expenseStateBeforeId,
      expenseStateAfterId: ledgerEntry.expenseStateAfterId,
      consumptionEvidenceIds: ledgerEntry.consumptions.map((item) =>
        item.consumptionEvidenceId),
      annualLedgerEvidenceId: result.annualLedgerEvidenceId,
    })
    expect(coverage.taxCharacter.map((segment) => [segment.kind, segment.amount]))
      .toEqual([['qualifiedTaxFree', 4_000], ['ordinaryIncome', 2_000]])
    for (const [index, segment] of coverage.taxCharacter.entries()) {
      expect(segment).toMatchObject({
        sequence: index + 1,
        actionId: coverage.actionId,
        allocationId: coverage.allocationId,
        sourceAccountId: coverage.sourceAccountId,
        ownerPersonId: coverage.ownerPersonId,
        evaluationDate: coverage.evaluationDate,
        sourceClass: 'hsa',
        characterEvidence: {
          annualLedgerEvidenceId: result.annualLedgerEvidenceId,
          characterEvidenceId: coverage.characterEvidenceId,
          ledgerEvidenceId: coverage.ledgerEvidenceId,
          segmentId: segment.segmentId,
          segmentKind: segment.kind,
          segmentAmount: segment.amount,
        },
      })
    }
  })

  it('emits complete empty character coverage for a zero execution', () => {
    const input = fixture()
    input.allocations = [{
      ...input.allocations[0]!,
      executedAmount: asUsdCents(0),
      reimbursementClaims: [],
    }]

    expect(accepted(input).allocations[0]).toMatchObject({
      executedAmount: 0,
      qualifiedMedicalAmount: 0,
      nonqualifiedAmount: 0,
      taxCharacter: [],
    })
  })

  it('emits only qualified-tax-free character when the ledger fully matches expenses', () => {
    const input = fixture()
    Object.assign(input.allocations[0]!, { executedAmount: asUsdCents(4_000) })
    expect(accepted(input).allocations[0]!.taxCharacter).toEqual([
      expect.objectContaining({ kind: 'qualifiedTaxFree', amount: 4_000 }),
    ])
  })

  it('emits only ordinary-income character when the ledger has no reimbursement claims', () => {
    const input = fixture()
    Object.assign(input.allocations[0]!, { reimbursementClaims: [] })
    expect(accepted(input).allocations[0]!.taxCharacter).toEqual([
      expect.objectContaining({ kind: 'ordinaryIncome', amount: 6_000 }),
    ])
  })

  it('is canonical across allocation, expense, scope, and claim input ordering', () => {
    const first = fixture()
    Object.assign(first.scope, { expenses: [...first.scope.expenses, {
      ...first.scope.expenses[0]!,
      medicalExpenseId: 'expense-b',
      medicalExpenseEvidenceId: 'expense-evidence-b',
      immutableExpenseSourceRecordId: 'provider-record-b',
      originalEligibleExpenseAmount: asPositiveUsdCents(500),
      eligibilityEvidenceId: 'eligibility-b',
    }] })
    Object.assign(first.allocations[0]!, {
      reimbursementClaims: [...first.allocations[0]!.reimbursementClaims, {
        medicalExpenseId: 'expense-b',
        reimbursedByAllocationAmount: asPositiveUsdCents(500),
        patientRelationshipToDistributionOwner: 'self',
        patientRelationshipEvidenceId: 'relationship-b',
      }],
    })
    bindOpeningState(first)
    const second = structuredClone(first)
    Object.assign(second.scope, {
      expenses: [...second.scope.expenses].reverse(),
      eligibleHsaOwnerPersonIds: [...second.scope.eligibleHsaOwnerPersonIds].reverse(),
      coveredHsaAccountIds: [...second.scope.coveredHsaAccountIds].reverse(),
    })
    Object.assign(second.allocations[0]!, {
      reimbursementClaims: [...second.allocations[0]!.reimbursementClaims].reverse(),
    })

    expect(accepted(second)).toEqual(accepted(first))
  })

  it('changes character and segment evidence IDs when any bound ledger authority changes', () => {
    const original = accepted().allocations[0]!
    const changed = fixture()
    Object.assign(changed.scope.ownerEstablishments[0]!, {
      ownerHsaEstablishedDate: '2018-12-01',
    })
    Object.assign(changed.allocations[0]!, {
      ownerHsaEstablishedDate: '2018-12-01',
    })
    Object.assign(changed.scope.expenses[0]!, {
      expenseIncurredDate: '2020-05-01',
    })
    bindOpeningState(changed)
    const revised = accepted(changed).allocations[0]!

    expect(revised.characterEvidenceId).not.toBe(original.characterEvidenceId)
    expect(revised.taxCharacter.map((segment) => segment.segmentId))
      .not.toEqual(original.taxCharacter.map((segment) => segment.segmentId))
  })

  it.each([
    ['malformed cents', (input: EvaluateAnnualHsaReimbursementLedgerInput) => {
      Object.assign(input.allocations[0]!, { executedAmount: 1.5 })
    }],
    ['future expense', (input: EvaluateAnnualHsaReimbursementLedgerInput) => {
      Object.assign(input.scope.expenses[0]!, { expenseIncurredDate: '2027-01-01' })
      bindOpeningState(input)
    }],
    ['incomplete inventory', (input: EvaluateAnnualHsaReimbursementLedgerInput) => {
      input.allocationInventoryComplete = false as never
    }],
  ] as const)('returns no character when the rebuilt ledger rejects %s', (_label, change) => {
    const input = fixture()
    change(input)
    expect(classifyAnnualHsaWithdrawalCharacter(input)).toMatchObject({
      status: 'ledgerBlocked',
      allocations: [],
      penalty: 'notEstablished',
    })
  })

  it('rejects caller-supplied character, age, or disability authority', () => {
    const input = fixture() as EvaluateAnnualHsaReimbursementLedgerInput & {
      qualifiedMedicalAmount?: number
      age65Reached?: boolean
      disabilityQualified?: boolean
    }
    input.qualifiedMedicalAmount = 6_000
    input.age65Reached = true
    input.disabilityQualified = true
    expect(classifyAnnualHsaWithdrawalCharacter(input)).toMatchObject({
      status: 'ledgerBlocked',
      allocations: [],
    })
  })

  it('fails closed without invoking accessor-backed evidence', () => {
    const input = fixture()
    let invoked = false
    Object.defineProperty(input, 'allocations', {
      enumerable: true,
      get: () => {
        invoked = true
        return []
      },
    })
    expect(classifyAnnualHsaWithdrawalCharacter(input)).toMatchObject({
      status: 'ledgerBlocked',
      allocations: [],
    })
    expect(invoked).toBe(false)
  })

  it('accepts a complete empty allocation inventory without inventing character', () => {
    const input = fixture()
    input.allocations = []
    expect(accepted(input).allocations).toEqual([])
  })

  it('deep-freezes output and leaves caller input unchanged', () => {
    const input = fixture()
    const before = structuredClone(input)
    const result = accepted(input)
    expect(input).toEqual(before)
    expect(Object.isFrozen(result)).toBe(true)
    expect(Object.isFrozen(result.allocations[0]!.taxCharacter)).toBe(true)
  })
})
