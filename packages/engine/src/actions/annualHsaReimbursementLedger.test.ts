import { describe, expect, it } from 'vitest'
import {
  evaluateAnnualHsaReimbursementLedger,
  type EvaluateAnnualHsaReimbursementLedgerInput,
} from './annualHsaReimbursementLedger.js'
import { asAccountId, asActionId, asAllocationId, asPersonId } from './identity.js'
import { asPositiveUsdCents, asUsdCents } from './money.js'
import { compareUtf16CodeUnits, deriveActionStructuralId } from './structuralId.js'

const personA = asPersonId('person-a')
const personB = asPersonId('person-b')
const accountA = asAccountId('hsa-a')
const accountB = asAccountId('hsa-b')

function fixture(): EvaluateAnnualHsaReimbursementLedgerInput {
  const input: EvaluateAnnualHsaReimbursementLedgerInput = {
    taxYear: 2026,
    allocationInventoryComplete: true,
    scope: {
      predicate: 'completeHsaFamilyReimbursementScope',
      reimbursementScopeId: 'family-scope-a',
      eligibleHsaOwnerPersonIds: [personB, personA],
      coveredHsaAccountIds: [accountB, accountA],
      ownerEstablishmentInventoryComplete: true,
      ownerEstablishments: [{
        predicate: 'authoritativeOwnerHsaEstablishment',
        ownerPersonId: personA,
        ownerHsaEstablishedDate: '2019-01-01',
        ownerHsaEstablishedDateEvidenceId: 'established-a',
        authoritative: true,
      }, {
        predicate: 'authoritativeOwnerHsaEstablishment',
        ownerPersonId: personB,
        ownerHsaEstablishedDate: '2018-01-01',
        ownerHsaEstablishedDateEvidenceId: 'established-b',
        authoritative: true,
      }],
      expenseInventoryComplete: true,
      priorHistory: {
        predicate: 'completeHsaReimbursementPriorHistory',
        reimbursementScopeId: 'family-scope-a',
        completeness: 'completeBeforeFirstAllocation',
        priorHistoryEvidenceId: 'bound-below',
        terminalLedgerEvidenceId: null,
        terminalExpenseStateId: 'bound-below',
      },
      expenses: [{
        reimbursementScopeId: 'family-scope-a',
        medicalExpenseId: 'expense-a',
        medicalExpenseEvidenceId: 'expense-a-record',
        immutableExpenseSourceRecordId: 'provider-record-a',
        patientPersonId: personA,
        expenseIncurredDate: '2020-06-01',
        originalEligibleExpenseAmount: asPositiveUsdCents(10_000),
        reimbursedBeforeAmount: asUsdCents(0),
        qualifiedMedicalExpense: true,
        eligibilityEvidenceId: 'expense-a-qualified',
      }],
    },
    allocations: [
      {
        actionId: asActionId('action-a'),
        allocationId: asAllocationId('allocation-a'),
        sourceAccountId: accountA,
        distributionOwnerPersonId: personA,
        evaluationDate: '2026-03-01',
        actionExecutionSequence: 1,
        allocationSequenceWithinAction: 1,
        physicalApplicationEvidenceId: 'physical-a',
        executedAmount: asUsdCents(6_000),
        ownerHsaEstablishedDate: '2019-01-01',
        ownerHsaEstablishedDateEvidenceId: 'established-a',
        reimbursementClaims: [{
          medicalExpenseId: 'expense-a',
          reimbursedByAllocationAmount: asPositiveUsdCents(4_000),
          patientRelationshipToDistributionOwner: 'self',
          patientRelationshipEvidenceId: 'relationship-a-self',
        }],
      },
      {
        actionId: asActionId('action-b'),
        allocationId: asAllocationId('allocation-b'),
        sourceAccountId: accountB,
        distributionOwnerPersonId: personB,
        evaluationDate: '2026-04-01',
        actionExecutionSequence: 2,
        allocationSequenceWithinAction: 1,
        physicalApplicationEvidenceId: 'physical-b',
        executedAmount: asUsdCents(5_000),
        ownerHsaEstablishedDate: '2018-01-01',
        ownerHsaEstablishedDateEvidenceId: 'established-b',
        reimbursementClaims: [{
          medicalExpenseId: 'expense-a',
          reimbursedByAllocationAmount: asPositiveUsdCents(5_000),
          patientRelationshipToDistributionOwner: 'spouse',
          patientRelationshipEvidenceId: 'relationship-b-spouse',
        }],
      },
    ],
  }
  bindOpeningState(input)
  return input
}

function bindOpeningState(input: EvaluateAnnualHsaReimbursementLedgerInput): void {
  const state = input.scope.expenses.map((expense) => ({
    ...expense,
    remainingUnreimbursedAmount: asUsdCents(
      expense.originalEligibleExpenseAmount - expense.reimbursedBeforeAmount,
    ),
  })).sort((left, right) =>
    compareUtf16CodeUnits(left.medicalExpenseId, right.medicalExpenseId))
  Object.assign(input.scope.priorHistory, {
    terminalExpenseStateId: deriveActionStructuralId(
      'hsa-reimbursement-expense-state',
      [input.scope.reimbursementScopeId, state],
    ),
  })
  Object.assign(input.scope.priorHistory, {
    priorHistoryEvidenceId: deriveActionStructuralId(
      'hsa-reimbursement-prior-history',
      [
        input.scope.reimbursementScopeId,
        input.scope.priorHistory.terminalLedgerEvidenceId,
        input.scope.priorHistory.terminalExpenseStateId,
      ],
    ),
  })
}

function evaluated(input = fixture()) {
  const result = evaluateAnnualHsaReimbursementLedger(input)
  expect(result.status).toBe('evaluated')
  if (result.status !== 'evaluated') throw new Error(result.issues[0].detail)
  return result
}

describe('evaluateAnnualHsaReimbursementLedger', () => {
  it('chains one household expense across owners and accounts without classifying tax', () => {
    const result = evaluated()

    expect(result).toMatchObject({
      committed: false,
      movement: 'notEstablished',
      actionability: 'notEstablished',
      publication: 'notEstablished',
      reimbursementScopeId: 'family-scope-a',
    })
    expect(result.entries).toHaveLength(2)
    expect(result.entries[0]).toMatchObject({
      reimbursementSequence: 1,
      previousLedgerEvidenceId: null,
      qualifiedMedicalAmount: 4_000,
      nonqualifiedAmount: 2_000,
      expenseStateBefore: [{ reimbursedBeforeAmount: 0, remainingUnreimbursedAmount: 10_000 }],
      expenseStateAfter: [{ reimbursedBeforeAmount: 4_000, remainingUnreimbursedAmount: 6_000 }],
    })
    expect(result.entries[1]).toMatchObject({
      reimbursementSequence: 2,
      previousLedgerEvidenceId: result.entries[0]!.ledgerEvidenceId,
      expenseStateBeforeId: result.entries[0]!.expenseStateAfterId,
      qualifiedMedicalAmount: 5_000,
      nonqualifiedAmount: 0,
      expenseStateAfter: [{ reimbursedBeforeAmount: 9_000, remainingUnreimbursedAmount: 1_000 }],
    })
    expect(result.terminalExpenseStateId).toBe(result.entries[1]!.expenseStateAfterId)
    expect(Object.isFrozen(result.entries[0]!.expenseStateAfter)).toBe(true)
    expect('taxCharacter' in result.entries[0]!).toBe(false)
    expect('penalty' in result.entries[0]!).toBe(false)

    const changedFacts = fixture()
    Object.assign(changedFacts.scope.ownerEstablishments[0]!, {
      ownerHsaEstablishedDate: '2018-12-01',
    })
    Object.assign(changedFacts.allocations[0]!, {
      ownerHsaEstablishedDate: '2018-12-01',
    })
    Object.assign(changedFacts.scope.expenses[0]!, {
      expenseIncurredDate: '2020-05-01',
    })
    bindOpeningState(changedFacts)
    expect(evaluated(changedFacts).entries[0]!.consumptions[0]!.consumptionEvidenceId)
      .not.toBe(result.entries[0]!.consumptions[0]!.consumptionEvidenceId)
  })

  it('is input-order invariant and canonicalizes family sets', () => {
    const first = fixture()
    Object.assign(first.scope, { expenses: [...first.scope.expenses, {
      ...first.scope.expenses[0]!,
      medicalExpenseId: 'expense-b',
      medicalExpenseEvidenceId: 'expense-b-record',
      immutableExpenseSourceRecordId: 'provider-record-b',
      originalEligibleExpenseAmount: asPositiveUsdCents(1_000),
      eligibilityEvidenceId: 'expense-b-qualified',
    }] })
    Object.assign(first.allocations[0]!, {
      reimbursementClaims: [...first.allocations[0]!.reimbursementClaims, {
        medicalExpenseId: 'expense-b',
        reimbursedByAllocationAmount: asPositiveUsdCents(1_000),
        patientRelationshipToDistributionOwner: 'self',
        patientRelationshipEvidenceId: 'relationship-b-self',
      }],
    })
    bindOpeningState(first)
    const second = structuredClone(first)
    second.allocations = [...second.allocations].reverse()
    Object.assign(second.allocations[1]!, {
      reimbursementClaims: [...second.allocations[1]!.reimbursementClaims].reverse(),
    })
    Object.assign(second.scope, {
      eligibleHsaOwnerPersonIds: [...second.scope.eligibleHsaOwnerPersonIds].reverse(),
      coveredHsaAccountIds: [...second.scope.coveredHsaAccountIds].reverse(),
    })

    const left = evaluated(first)
    const right = evaluated(second)
    expect(right).toEqual(left)
    expect(left.entries[0]!.eligibleHsaOwnerPersonIds).toEqual([personA, personB])
    expect(left.entries[0]!.coveredHsaAccountIds).toEqual([accountA, accountB])
  })

  it('emits a zero-allocation entry with an unchanged state', () => {
    const input = fixture()
    input.allocations = [{
      ...input.allocations[0]!,
      executedAmount: asUsdCents(0),
      reimbursementClaims: [],
    }]

    const entry = evaluated(input).entries[0]!
    expect(entry).toMatchObject({
      executedAmount: 0,
      qualifiedMedicalAmount: 0,
      nonqualifiedAmount: 0,
      consumptions: [],
      previousLedgerEvidenceId: null,
    })
    expect(entry.expenseStateAfter).toEqual(entry.expenseStateBefore)
    expect(entry.expenseStateAfterId).toBe(entry.expenseStateBeforeId)
  })

  it('accepts an explicitly complete empty allocation and expense inventory', () => {
    const input = fixture()
    Object.assign(input.scope, { expenses: [] })
    input.allocations = []
    Object.assign(input.scope.priorHistory, { terminalLedgerEvidenceId: 'prior-zero-effect-ledger' })
    bindOpeningState(input)

    const result = evaluated(input)
    expect(result.entries).toEqual([])
    expect(result.terminalExpenseState).toEqual([])
    expect(result.terminalExpenseStateId).toBe(result.openingExpenseStateId)
  })

  it('accepts a complete prior-history opening state and binds it to the first entry', () => {
    const input = fixture()
    Object.assign(input.scope.expenses[0]!, { reimbursedBeforeAmount: asUsdCents(2_000) })
    Object.assign(input.scope.priorHistory, { terminalLedgerEvidenceId: 'prior-terminal-ledger-a' })
    bindOpeningState(input)
    input.allocations = [input.allocations[0]!]

    const result = evaluated(input)
    expect(result.entries[0]).toMatchObject({
      priorHistoryEvidenceId: input.scope.priorHistory.priorHistoryEvidenceId,
      priorTerminalLedgerEvidenceId: 'prior-terminal-ledger-a',
      previousLedgerEvidenceId: null,
      expenseStateBefore: [{ reimbursedBeforeAmount: 2_000, remainingUnreimbursedAmount: 8_000 }],
    })
  })

  it.each([
    ['overconsumption', (input: EvaluateAnnualHsaReimbursementLedgerInput) => {
      Object.assign(input.allocations[1]!.reimbursementClaims[0]!, { reimbursedByAllocationAmount: asPositiveUsdCents(7_000) })
      Object.assign(input.allocations[1]!, { executedAmount: asUsdCents(7_000) })
    }],
    ['duplicate expense in one allocation', (input: EvaluateAnnualHsaReimbursementLedgerInput) => {
      Object.assign(input.allocations[0]!, { reimbursementClaims: [input.allocations[0]!.reimbursementClaims[0]!, structuredClone(input.allocations[0]!.reimbursementClaims[0]!)] })
    }],
    ['future expense', (input: EvaluateAnnualHsaReimbursementLedgerInput) => {
      Object.assign(input.scope.expenses[0]!, { expenseIncurredDate: '2026-03-02' })
    }],
    ['owner pre-establishment expense', (input: EvaluateAnnualHsaReimbursementLedgerInput) => {
      Object.assign(input.allocations[1]!, {
        ownerHsaEstablishedDate: '2021-01-01',
        ownerHsaEstablishedDateEvidenceId: 'invented-establishment-b',
      })
    }],
    ['foreign self relationship', (input: EvaluateAnnualHsaReimbursementLedgerInput) => {
      Object.assign(input.allocations[1]!.reimbursementClaims[0]!, { patientRelationshipToDistributionOwner: 'self' })
    }],
  ] as const)('rejects %s', (_label, change) => {
    const input = fixture()
    change(input)
    expect(evaluateAnnualHsaReimbursementLedger(input).status).toBe('blocked')
  })

  it('fails closed on incomplete inventory or inconsistent prior-history state', () => {
    const inputs = [fixture(), fixture(), fixture(), fixture()]
    inputs[0]!.allocationInventoryComplete = false as never
    Object.assign(inputs[1]!.scope.expenses[0]!, { reimbursedBeforeAmount: asUsdCents(1) })
    bindOpeningState(inputs[1]!)
    Object.assign(inputs[2]!.scope.priorHistory, { terminalExpenseStateId: 'foreign-state' })
    const staleHistoryId = inputs[3]!.scope.priorHistory.priorHistoryEvidenceId
    Object.assign(inputs[3]!.scope.expenses[0]!, { reimbursedBeforeAmount: asUsdCents(1) })
    Object.assign(inputs[3]!.scope.priorHistory, { terminalLedgerEvidenceId: 'prior-terminal' })
    bindOpeningState(inputs[3]!)
    Object.assign(inputs[3]!.scope.priorHistory, { priorHistoryEvidenceId: staleHistoryId })
    for (const input of inputs) {
      expect(evaluateAnnualHsaReimbursementLedger(input)).toMatchObject({
        status: 'blocked',
        movement: 'notEstablished',
        entries: [],
      })
    }
  })

  it.each([
    ['duplicate allocation ID', (input: EvaluateAnnualHsaReimbursementLedgerInput) => {
      Object.assign(input.allocations[1]!, { allocationId: input.allocations[0]!.allocationId })
    }],
    ['later supplied ID colliding with a derived ledger ID', (input: EvaluateAnnualHsaReimbursementLedgerInput) => {
      const ledgerId = evaluated(input).entries[0]!.ledgerEvidenceId
      Object.assign(input.allocations[1]!.reimbursementClaims[0]!, { patientRelationshipEvidenceId: ledgerId })
    }],
    ['reminted medical expense', (input: EvaluateAnnualHsaReimbursementLedgerInput) => {
      Object.assign(input.scope, { expenses: [input.scope.expenses[0]!, {
        ...input.scope.expenses[0]!,
        medicalExpenseId: 'expense-remint',
        medicalExpenseEvidenceId: 'expense-remint-record',
        eligibilityEvidenceId: 'expense-remint-qualified',
      }] })
    }],
    ['duplicate allocation sequence', (input: EvaluateAnnualHsaReimbursementLedgerInput) => {
      input.allocations = [input.allocations[0]!, {
        ...input.allocations[0]!,
        allocationId: asAllocationId('allocation-a-duplicate-slot'),
        physicalApplicationEvidenceId: 'physical-a-duplicate-slot',
      }]
    }],
  ] as const)('rejects %s', (_label, change) => {
    const input = fixture()
    change(input)
    expect(evaluateAnnualHsaReimbursementLedger(input).status).toBe('blocked')
  })

  it('rejects negative-zero, fractional, and unsafe cent inputs', () => {
    for (const amount of [-0, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
      const input = fixture()
      Object.assign(input.allocations[0]!, { executedAmount: amount })
      expect(evaluateAnnualHsaReimbursementLedger(input).status).toBe('blocked')
    }
  })

  it('rejects foreign owners, accounts, and colliding action slots', () => {
    const input = fixture()
    input.allocations = [input.allocations[0]!, {
        ...input.allocations[1]!,
        sourceAccountId: asAccountId('foreign-hsa'),
        actionExecutionSequence: 1,
      }]
    expect(evaluateAnnualHsaReimbursementLedger(input).status).toBe('blocked')
  })

  it('rejects unknown fields rather than silently dropping authority-bearing data', () => {
    const input = fixture() as EvaluateAnnualHsaReimbursementLedgerInput & { withdrawalTreatment?: string }
    input.withdrawalTreatment = 'assumeAllQualified'
    expect(evaluateAnnualHsaReimbursementLedger(input).status).toBe('blocked')
  })

  it('fails closed on accessors and aliased object graphs without invoking the getter', () => {
    let invoked = false
    const accessor = fixture()
    Object.defineProperty(accessor, 'allocations', {
      enumerable: true,
      get: () => {
        invoked = true
        return []
      },
    })
    expect(evaluateAnnualHsaReimbursementLedger(accessor).status).toBe('blocked')
    expect(invoked).toBe(false)

    const aliased = fixture()
    const claim = aliased.allocations[0]!.reimbursementClaims[0]!
    Object.assign(aliased.allocations[0]!, { reimbursementClaims: [claim, claim] })
    expect(evaluateAnnualHsaReimbursementLedger(aliased).status).toBe('blocked')
  })

  it('does not mutate the caller-owned input', () => {
    const input = fixture()
    const before = structuredClone(input)
    evaluated(input)
    expect(input).toEqual(before)
  })
})
