import { describe, expect, it } from 'vitest'
import { describeRule } from '../rules/describeRule.js'
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

// Every reading below was derived from the authority before the implementation
// was consulted, and each pair predicts a different number under the same facts.
describeRule('irc-223-d-2-A-qualified-expense-related-persons', {
  // Allocation B is a distribution from person B's HSA reimbursing person A's
  // expense. IRC 223(d)(2)(A) reaches the beneficiary, that beneficiary's
  // spouse, and dependents, so the whole 5,000 claim is qualified. The reading
  // that an HSA may only reimburse its own beneficiary's care qualifies none of
  // it and makes the entire distribution includible.
  readings: { statute: 5_000, rejectedOwnExpensesOnly: 0 },
  accepted: 'statute',
}, ({ accepted, readings }) => {
  it('qualifies a distribution reimbursing the spouse of the account owner', () => {
    const entry = evaluated().entries[1]!

    expect(entry.distributionOwnerPersonId).toBe(personB)
    expect(entry.consumptions[0]!.patientPersonId).toBe(personA)
    expect(entry.consumptions[0]!.patientRelationshipToDistributionOwner).toBe('spouse')
    expect(entry.qualifiedMedicalAmount).toBe(accepted)
    expect(entry.qualifiedMedicalAmount).not.toBe(readings.rejectedOwnExpensesOnly)
    expect(entry.nonqualifiedAmount).toBe(0)
  })

  it('refuses a relationship claim that contradicts the patient identity', () => {
    const value = fixture()
    Object.assign(value.allocations[1]!.reimbursementClaims[0]!, {
      patientRelationshipToDistributionOwner: 'self',
    })

    expect(evaluateAnnualHsaReimbursementLedger(value).status).toBe('blocked')
  })
})

describeRule('notice-2004-2-a-26-expense-incurred-after-hsa-established', {
  // The expense is incurred 2020-06-01. Move person A's establishment to
  // 2021-01-01 and Notice 2004-2 A-26 makes the expense permanently
  // unreimbursable from that account, so the ledger refuses. The reading that
  // establishment only has to precede the distribution admits the claim and
  // reports 4,000 of qualified medical expense.
  readings: { notice: 'blocked', rejectedEstablishedBeforeDistribution: 4_000 },
  accepted: 'notice',
}, ({ accepted, readings }) => {
  it('refuses to reimburse an expense incurred before the HSA existed', () => {
    const value = fixture()
    Object.assign(value.scope.ownerEstablishments[0]!, {
      ownerHsaEstablishedDate: '2021-01-01',
    })
    Object.assign(value.allocations[0]!, { ownerHsaEstablishedDate: '2021-01-01' })
    const result = evaluateAnnualHsaReimbursementLedger(value)

    expect(result.status).toBe(accepted)
    expect(result.entries).toEqual([])
    expect(result.entries).not.toHaveLength(readings.rejectedEstablishedBeforeDistribution)
  })

  it('admits the same claim once establishment precedes the expense', () => {
    const value = fixture()
    Object.assign(value.scope.ownerEstablishments[0]!, {
      ownerHsaEstablishedDate: '2020-05-31',
    })
    Object.assign(value.allocations[0]!, { ownerHsaEstablishedDate: '2020-05-31' })

    expect(evaluated(value).entries[0]!.qualifiedMedicalAmount).toBe(4_000)
  })
})

describeRule('notice-2004-50-a-39-deferred-reimbursement-no-deadline', {
  // The expense was incurred in 2020 and the distribution is taken in tax year
  // 2026. Notice 2004-50 A-39 puts no time limit on the reimbursement, so
  // 4,000 is qualified. The reading that a distribution may only reimburse an
  // expense incurred in the same tax year qualifies none of it.
  readings: { notice: 4_000, rejectedSameTaxYearOnly: 0 },
  accepted: 'notice',
}, ({ accepted, readings }) => {
  it('reimburses an expense incurred six tax years earlier', () => {
    const value = fixture()
    const result = evaluated(value)

    expect(value.taxYear).toBe(2026)
    expect(value.scope.expenses[0]!.expenseIncurredDate).toBe('2020-06-01')
    expect(result.entries[0]!.evaluationDate.slice(0, 4)).toBe('2026')
    expect(result.entries[0]!.qualifiedMedicalAmount).toBe(accepted)
    expect(result.entries[0]!.qualifiedMedicalAmount).not.toBe(readings.rejectedSameTaxYearOnly)
  })
})

describeRule('irc-223-d-2-A-expense-reimbursable-once', {
  // The single 10,000 expense is reimbursed 4,000 by the first allocation, so
  // 6,000 remains when the second one runs. IRC 223(d)(2)(A) qualifies an
  // amount only to the extent it is not already compensated, so a 7,000 claim
  // exceeds that remainder and the ledger refuses. The reading that the
  // reimbursable amount stays at the original eligible figure however much has
  // already been paid admits it and reports 7,000 of qualified expense.
  readings: { statute: 'blocked', rejectedRemainderNeverReduced: 7_000 },
  accepted: 'statute',
}, ({ accepted, readings }) => {
  it('measures a claim against the remainder, not the original amount', () => {
    const value = fixture()
    Object.assign(value.allocations[1]!, { executedAmount: asUsdCents(7_000) })
    Object.assign(value.allocations[1]!.reimbursementClaims[0]!, {
      reimbursedByAllocationAmount: asPositiveUsdCents(7_000),
    })
    const result = evaluateAnnualHsaReimbursementLedger(value)

    expect(result.status).toBe(accepted)
    expect(result.entries).toEqual([])
    expect(result.entries).not.toHaveLength(readings.rejectedRemainderNeverReduced)
  })

  it('chains the remainder across allocations within the year', () => {
    const result = evaluated()

    expect(result.entries[0]!.expenseStateAfter[0]!.remainingUnreimbursedAmount).toBe(6_000)
    expect(result.entries[1]!.expenseStateBefore[0]!.remainingUnreimbursedAmount).toBe(6_000)
    expect(result.entries[1]!.expenseStateAfter[0]!.remainingUnreimbursedAmount).toBe(1_000)
  })
})
