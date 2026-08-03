import { describe, expect, it } from 'vitest'
import { describeRule } from '../rules/describeRule.js'
import {
  evaluateAnnualHsaPenalty,
  type EvaluateAnnualHsaPenaltyInput,
  type HsaPenaltyDisabilityStatusEvidence,
  type HsaPenaltyOwnerBirthEvidence,
} from './annualHsaPenaltyEvaluation.js'
import type {
  EvaluateAnnualHsaReimbursementLedgerInput,
  HsaExecutedAllocationEvidence,
} from './annualHsaReimbursementLedger.js'
import { asAccountId, asActionId, asAllocationId, asPersonId } from './identity.js'
import { asPositiveUsdCents, asUsdCents } from './money.js'
import { compareUtf16CodeUnits, deriveActionStructuralId } from './structuralId.js'

const owner = asPersonId('owner-a')
const account = asAccountId('hsa-a')

type MutableCharacterInput = Omit<
  EvaluateAnnualHsaReimbursementLedgerInput,
  'allocations'
> & { allocations: HsaExecutedAllocationEvidence[] }
type MutablePenaltyInput = Omit<
  EvaluateAnnualHsaPenaltyInput,
  'characterInput' | 'ownerBirthEvidence' | 'disabilityStatusEvidence'
> & {
  characterInput: MutableCharacterInput
  ownerBirthEvidence: HsaPenaltyOwnerBirthEvidence[]
  disabilityStatusEvidence: HsaPenaltyDisabilityStatusEvidence[]
}

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

function characterInput(): MutableCharacterInput {
  const input: MutableCharacterInput = {
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

function disability(
  qualifiedOnEvaluationDate = false,
  disabilityQualificationDate: string | null = null,
): HsaPenaltyDisabilityStatusEvidence {
  return {
    predicate: 'authoritativeHsaDisabilityStatusOnDistributionDate',
    ownerPersonId: owner,
    evaluationDate: '2026-03-01',
    disabilityQualificationDate,
    qualifiedOnEvaluationDate,
    disabilityEvidenceId: 'disability-a',
    authoritative: true,
  }
}

function fixture(): MutablePenaltyInput {
  return {
    characterInput: characterInput(),
    ownerBirthEvidenceComplete: true,
    ownerBirthEvidence: [{
      predicate: 'authoritativeHsaOwnerBirthDate',
      ownerPersonId: owner,
      birthDate: '1970-01-01',
      birthDateEvidenceId: 'birth-a',
      authoritative: true,
    }],
    disabilityStatusEvidenceComplete: true,
    disabilityStatusEvidence: [disability()],
  }
}

function evaluated(input = fixture()) {
  const result = evaluateAnnualHsaPenalty(input)
  expect(result.status).toBe('evaluated')
  if (result.status !== 'evaluated') throw new Error(result.issues[0].detail)
  return result
}

describe('evaluateAnnualHsaPenalty', () => {
  it('covers every partial-qualified segment once while applying 20% only to the residual', () => {
    const result = evaluated()
    const coverage = result.allocations[0]!

    expect(result).toMatchObject({
      committed: false,
      movement: 'notEstablished',
      actionability: 'notEstablished',
      publication: 'notEstablished',
      aggregatePenaltyAmount: 400,
    })
    expect(coverage).toMatchObject({
      executedAmount: 6_000,
      // The 4,000c reimbursement is excluded from income under 223(f)(1); only
      // the 2,000c residual is exposed. Coverage still spans the whole
      // allocation, because every segment is evaluated even at a zero rate.
      penaltyRelevantCharacterAmount: 2_000,
      nonPenaltyRelevantCharacterAmount: 4_000,
      coveredPenaltyExposureAmount: 6_000,
      coverageDifferenceAmount: 0,
      aggregatePenaltyAmount: 400,
    })
    expect(coverage.evaluations).toEqual([
      expect.objectContaining({
        characterKind: 'qualifiedTaxFree',
        characterAmount: 4_000,
        taxableAmountExposed: 0,
        treatment: 'hsaQualifiedMedical',
        penaltyRatePercent: 0,
        finalPenaltyAmount: 0,
      }),
      expect.objectContaining({
        characterKind: 'ordinaryIncome',
        characterAmount: 2_000,
        taxableAmountExposed: 2_000,
        treatment: 'penaltyApplies',
        penaltyRatePercent: 20,
        finalPenaltyAmount: 400,
      }),
    ])
    expect(new Set(coverage.evaluations.map((item) => item.characterSegmentId)))
      .toEqual(new Set(coverage.characterEvidenceId
        ? result.character.allocations[0]!.taxCharacter.map((item) => item.segmentId)
        : []))
    expect(coverage.evaluations.reduce(
      (sum, item) => sum + item.taxableAmountExposed, 0,
    )).toBe(coverage.penaltyRelevantCharacterAmount)
    expect(coverage.evaluations.filter((item) => item.penaltyRatePercent === 20))
      .toEqual([expect.objectContaining({
        characterKind: 'ordinaryIncome',
        taxableAmountExposed: 2_000,
        finalPenaltyAmount: 400,
      })])
  })

  // IRC 223(f)(1) excludes a qualified medical distribution from gross income
  // entirely, so it carries no taxable exposure. Reporting the full segment as
  // exposed would let a downstream income sum add tax-free reimbursements to
  // ordinary income; the penalty rate was already correctly zero either way,
  // so only the reported exposure distinguishes the readings.
  describeRule('irc-223-f-1-hsa-qualified-medical-exclusion', {
    readings: { excludedFromGrossIncome: 0, reportedAsFullyExposed: 4_000 },
    accepted: 'excludedFromGrossIncome',
  }, ({ accepted, readings }) => {
    it('reports no taxable exposure for the qualified medical segment', () => {
      const coverage = evaluated().allocations[0]!
      const qualified = coverage.evaluations[0]!
      expect(qualified.characterKind).toBe('qualifiedTaxFree')
      expect(qualified.characterAmount).toBe(4_000)
      expect(qualified.taxableAmountExposed).toBe(accepted)
      expect(qualified.taxableAmountExposed).not.toBe(readings.reportedAsFullyExposed)
      // The exclusion partitions the allocation rather than shrinking it.
      expect(coverage.penaltyRelevantCharacterAmount).toBe(2_000)
      expect(coverage.nonPenaltyRelevantCharacterAmount).toBe(4_000)
      expect(coverage.coveredPenaltyExposureAmount).toBe(coverage.executedAmount)
    })
  })

  // IRC 223(f)(4)(C) waives the additional tax only "after the date on which"
  // the beneficiary attains 65. Congress used the inclusive form in
  // 72(t)(2)(A)(i) ("on or after") when it meant it, and Pub 969 and the Form
  // 8889 instructions both say "after". A 1961-03-01 birth puts the 65th
  // birthday exactly on the 2026-03-01 evaluation date, so the readings differ.
  describeRule('irc-223-f-4-hsa-age-65-boundary', {
    readings: {
      statuteStrictlyAfterAttainment: 'penaltyApplies',
      inclusiveOnTheBirthday: 'hsaAge65',
    },
    accepted: 'statuteStrictlyAfterAttainment',
  }, ({ accepted, readings }) => {
    it('still taxes a distribution taken on the 65th birthday itself', () => {
      const input = fixture()
      input.ownerBirthEvidence[0] = { ...input.ownerBirthEvidence[0]!, birthDate: '1961-03-01' }

      const ordinary = evaluated(input).allocations[0]!.evaluations[1]!
      expect(ordinary).toMatchObject({ treatment: accepted, finalPenaltyAmount: 400 })
      expect(ordinary.treatment).not.toBe(readings.inclusiveOnTheBirthday)
    })
  })

  it.each([
    ['1961-03-02', 'penaltyApplies', 400],
    ['1961-03-01', 'penaltyApplies', 400],
    ['1961-02-28', 'hsaAge65', 0],
  ] as const)('uses the exact age-65 boundary for birth %s', (birthDate, treatment, penalty) => {
    const input = fixture()
    input.ownerBirthEvidence[0] = { ...input.ownerBirthEvidence[0]!, birthDate }
    if (treatment === 'hsaAge65') input.disabilityStatusEvidence = []

    const ordinary = evaluated(input).allocations[0]!.evaluations[1]!
    expect(ordinary).toMatchObject({ treatment, finalPenaltyAmount: penalty })
  })

  it('clamps a leap-day birth to February 28 at age 65', () => {
    const input = fixture()
    input.characterInput.taxYear = 2025
    input.characterInput.allocations[0] = {
      ...input.characterInput.allocations[0]!, evaluationDate: '2025-03-01',
    }
    input.ownerBirthEvidence[0] = {
      ...input.ownerBirthEvidence[0]!, birthDate: '1960-02-29',
    }
    input.disabilityStatusEvidence = []

    const ordinary = evaluated(input).allocations[0]!.evaluations[1]!
    expect(ordinary).toMatchObject({
      treatment: 'hsaAge65',
      acceptedEvidence: { ageEvidence: { age65Date: '2025-02-28', age65Reached: true } },
    })
  })

  it('uses dated positive disability only as a zero-penalty exception', () => {
    const input = fixture()
    input.disabilityStatusEvidence = [disability(true, '2025-12-31')]

    const result = evaluated(input)
    expect(result.allocations[0]!.evaluations[1]).toMatchObject({
      characterKind: 'ordinaryIncome',
      taxableAmountExposed: 2_000,
      treatment: 'hsaDisability',
      finalPenaltyAmount: 0,
      acceptedEvidence: {
        disabilityEvidence: {
          disabilityQualificationDate: '2025-12-31',
          qualifiedOnEvaluationDate: true,
        },
      },
    })
  })

  // IRC 223(f)(4)(B) switches off the 20 percent additional tax, and nothing
  // else. Subparagraph (A) increases the tax by 20 percent of the amount "which
  // is so includible", so the inclusion survives the exception. The trap is the
  // 223(f)(1) qualified-medical exclusion sitting in the same subsection, which
  // does remove inclusion -- reading the two alike would zero the income here.
  describeRule('irc-223-f-4-B-hsa-disability-exception', {
    readings: { additionalTaxWaivedInclusionKept: 2_000, bothWaived: 0 },
    accepted: 'additionalTaxWaivedInclusionKept',
  }, ({ accepted, readings }) => {
    it('keeps the distribution in income while waiving the additional tax', () => {
      const input = fixture()
      input.disabilityStatusEvidence = [disability(true, '2025-12-31')]

      const evaluation = evaluated(input).allocations[0]!.evaluations[1]!
      expect(evaluation.taxableAmountExposed).toBe(accepted)
      expect(evaluation.taxableAmountExposed).not.toBe(readings.bothWaived)
      expect(evaluation.finalPenaltyAmount).toBe(0)
    })
  })

  it('preserves a known-false future qualification date and applies the fixed rate', () => {
    const input = fixture()
    input.disabilityStatusEvidence = [disability(false, '2026-03-02')]
    const ordinary = evaluated(input).allocations[0]!.evaluations[1]!
    expect(ordinary).toMatchObject({
      treatment: 'penaltyApplies',
      acceptedEvidence: {
        rejectedDisabilityEvidence: { disabilityQualificationDate: '2026-03-02' },
        rateEvidence: { numerator: 1, denominator: 5, percent: 20 },
      },
    })
  })

  it.each([
    ['missing status', (input: MutablePenaltyInput) => { input.disabilityStatusEvidence = [] }],
    ['wrong owner', (input: MutablePenaltyInput) => { input.disabilityStatusEvidence[0] = { ...input.disabilityStatusEvidence[0]!, ownerPersonId: asPersonId('owner-b') } }],
    ['wrong date', (input: MutablePenaltyInput) => { input.disabilityStatusEvidence[0] = { ...input.disabilityStatusEvidence[0]!, evaluationDate: '2026-03-02' } }],
    ['contradictory positive status', (input: MutablePenaltyInput) => { input.disabilityStatusEvidence[0] = disability(true, '2026-03-02') }],
    ['contradictory false status', (input: MutablePenaltyInput) => { input.disabilityStatusEvidence[0] = disability(false, '2026-03-01') }],
  ] as const)('blocks %s rather than inventing negative exception evidence', (_label, mutate) => {
    const input = fixture()
    mutate(input)
    expect(evaluateAnnualHsaPenalty(input)).toMatchObject({
      status: 'blocked', allocations: [], aggregatePenaltyAmount: 0,
    })
  })

  it('needs no age or disability inventory for fully qualified or zero execution', () => {
    for (const zero of [false, true]) {
      const input = fixture()
      input.characterInput.allocations[0] = {
        ...input.characterInput.allocations[0]!,
        executedAmount: asUsdCents(zero ? 0 : 4_000),
        reimbursementClaims: zero ? [] : input.characterInput.allocations[0]!.reimbursementClaims,
      }
      input.ownerBirthEvidence = []
      input.disabilityStatusEvidence = []
      const result = evaluated(input)
      expect(result.aggregatePenaltyAmount).toBe(0)
      // IRC 223(f)(1): a wholly qualified distribution is excluded from gross
      // income, so nothing is penalty-relevant and the whole amount lands in
      // the non-penalty partition.
      expect(result.allocations[0]!.penaltyRelevantCharacterAmount).toBe(0)
      expect(result.allocations[0]!.nonPenaltyRelevantCharacterAmount)
        .toBe(zero ? 0 : 4_000)
      if (!zero) {
        expect(result.allocations[0]!.evaluations).toEqual([
          expect.objectContaining({
            treatment: 'hsaQualifiedMedical',
            characterAmount: 4_000,
            taxableAmountExposed: 0,
            penaltyRatePercent: 0,
            finalPenaltyAmount: 0,
          }),
        ])
      }
    }
  })

  it('reuses shared age and fixed-rate authority across same-owner same-date segments', () => {
    const input = fixture()
    input.characterInput.allocations.push({
      ...input.characterInput.allocations[0]!,
      actionId: asActionId('action-b'),
      allocationId: asAllocationId('allocation-b'),
      actionExecutionSequence: 2,
      reimbursementClaims: [],
      physicalApplicationEvidenceId: 'physical-b',
    })

    const result = evaluated(input)
    const ordinary = result.allocations.flatMap((item) => item.evaluations)
      .filter((item) => item.treatment === 'penaltyApplies')
    expect(ordinary).toHaveLength(2)
    expect(new Set(ordinary.map((item) => item.acceptedEvidence.ageEvidence.ageEvidenceId)).size)
      .toBe(1)
    expect(new Set(ordinary.map((item) => item.acceptedEvidence.rateEvidence.rateEvidenceId)).size)
      .toBe(1)
  })

  it('rejects caller-supplied age, rate, or character authority at the exact boundary', () => {
    for (const key of ['age', 'penaltyRatePercent', 'character'] as const) {
      const input = fixture() as EvaluateAnnualHsaPenaltyInput & Record<string, unknown>
      input[key] = key === 'age' ? 65 : key === 'penaltyRatePercent' ? 0 : []
      expect(evaluateAnnualHsaPenalty(input)).toMatchObject({ status: 'blocked' })
    }
  })

  it('does not invoke accessors and freezes a detached result without mutating input', () => {
    const input = fixture()
    const before = structuredClone(input)
    let invoked = false
    Object.defineProperty(input, 'age', {
      enumerable: true,
      configurable: true,
      get: () => { invoked = true; throw new Error('must not run') },
    })

    const result = evaluateAnnualHsaPenalty(input)
    expect(invoked).toBe(false)
    expect(result.status).toBe('blocked')
    delete (input as EvaluateAnnualHsaPenaltyInput & { age?: unknown }).age
    expect(input).toEqual(before)
    expect(Object.isFrozen(result)).toBe(true)
  })

  it('changes derived lineage when authoritative exception facts change', () => {
    const first = evaluated()
    const changed = fixture()
    changed.ownerBirthEvidence[0] = {
      ...changed.ownerBirthEvidence[0]!, birthDate: '1970-01-02',
    }
    const second = evaluated(changed)

    expect(second.allocations[0]!.coverageEvidenceId)
      .not.toBe(first.allocations[0]!.coverageEvidenceId)
    expect(second.allocations[0]!.evaluations[1]!.penaltyEvidenceId)
      .not.toBe(first.allocations[0]!.evaluations[1]!.penaltyEvidenceId)
  })
})
