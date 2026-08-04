/**
 * Fixtures pinning six `approximated` registry records: the SEPP pair, the two
 * HSA reimbursement gaps, and the two withdrawal-character gaps.
 *
 * Every suite here asserts the figure this engine ACTUALLY returns, which is by
 * construction not the figure the registered authority supports. That is what
 * `produced` is for. The day one of these gaps is closed the assertion fails and
 * names the record that has to be reclassified, which is the only way an
 * `approximated` record stops rotting quietly in the direction of looking
 * responsible.
 */

import { expect, it } from 'vitest'

import { describeRule } from '../describeRule.js'

import { createEmptyPlan, parsePlan, type Account, type Plan } from '../../model/plan.js'
import { createFlatTaxCalculator } from '../../projection/flatTax.js'
import { simulatePlan } from '../../projection/simulate.js'
import { acceptsContributions } from '../../strategies/accountEligibility.js'

import {
  asAccountId,
  asActionId,
  asAllocationId,
  asPersonId,
} from '../../actions/identity.js'
import { asPositiveUsdCents, asUsdCents } from '../../actions/money.js'
import {
  compareUtf16CodeUnits,
  deriveActionStructuralId,
} from '../../actions/structuralId.js'
import {
  evaluateAnnualHsaReimbursementLedger,
  type EvaluateAnnualHsaReimbursementLedgerInput,
} from '../../actions/annualHsaReimbursementLedger.js'
import {
  classifyTraditionalEmployerPlanWithdrawal,
  type ClassifyTraditionalEmployerPlanWithdrawalInput,
} from '../../actions/traditionalEmployerPlanWithdrawalCharacter.js'
import {
  classifyIndividuallyOwnedTaxableWithdrawal,
  type ClassifyIndividuallyOwnedTaxableWithdrawalInput,
} from '../../actions/taxableWithdrawalCharacter.js'

// ---------------------------------------------------------------------------
// Shared projection scaffolding
// ---------------------------------------------------------------------------

let counter = 0
const ids = () => `approx-${++counter}`
const noTax = createFlatTaxCalculator(0)
const fixedNow = () => new Date('2026-06-11T00:00:00.000Z')

/** Single filer born 1970-03-15, so attained age 56 in 2026. */
function pat(retirementAge: number | null, planningAge = 70) {
  return {
    id: 'p1',
    name: 'Pat',
    dob: '1970-03-15',
    sex: 'average' as const,
    retirementAge,
    longevity: { planningAge, source: 'manual' as const },
  }
}

function quietPlan(retirementAge: number | null, planningAge = 70): Plan {
  const plan = createEmptyPlan({ newId: ids, now: fixedNow })
  plan.household.people[0] = pat(retirementAge, planningAge)
  plan.assumptions.inflationPct = 0
  plan.assumptions.defaultReturnPct = 0
  plan.expenses.baseAnnual = 5_000
  plan.expenses.healthcare = {
    pre65MonthlyPremiumPerPerson: 0,
    applyAcaCredit: false,
    medicareExtrasMonthlyPerPerson: 0,
  }
  return plan
}

function run(plan: Plan) {
  const parsed = parsePlan(plan)
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  return simulatePlan(parsed.plan, { startYear: 2026, taxCalculator: noTax })
}

function year2026(plan: Plan) {
  return run(plan).years.find((y) => y.year === 2026)!
}

/** Single Life Table divisor at attained age 56, per the parameter pack. */
const SINGLE_LIFE_AT_56 = 30.6
const SEPP_BALANCE = 500_000
/** The RMD-method series payment from a 500,000 balance at 56. */
const SEPP_PAYMENT_2026 = SEPP_BALANCE / SINGLE_LIFE_AT_56

// ---------------------------------------------------------------------------
// 1. notice-2022-6-3-02-e-1-projection-contribution-during-series
// ---------------------------------------------------------------------------

/**
 * A plan that states BOTH an annual contribution and a SEPP election on one
 * traditional IRA. The contribution is an addition to the account balance other
 * than by reason of investment experience made after the first valuation date,
 * so Notice 2022-6 section 3.02(e)(1) modifies the series and IRC 72(t)(4)(A)
 * increases the tax for the year of the modification by the penalty the
 * exception had been suppressing. In the FIRST series year that increase is
 * exactly 10% of that year's payment, with nothing earlier to recapture, which
 * is why the fixture reads 2026 rather than a later year.
 *
 * An IRA rather than an employer plan, deliberately: 72(t)(3)(B) does not reach
 * IRAs, so nothing in the separation proxy pinned below can be what suppresses
 * or allows this series. Wages are present because the contribution pass
 * requires compensation, and they are what makes the two facts coexist.
 */
const CONTRIBUTION_DURING_SERIES_PENALTY = SEPP_PAYMENT_2026 * 0.1

function contributionDuringSeriesPlan(): Plan {
  const plan = quietPlan(65)
  plan.incomes = [{
    type: 'wages',
    id: 'w1',
    personId: 'p1',
    annualGross: 100_000,
    endAge: null,
    realGrowthPct: 0,
  }]
  plan.accounts = [
    {
      type: 'traditional',
      id: 'ira1',
      name: 'IRA',
      ownerPersonId: 'p1',
      annualReturnPct: null,
      kind: 'ira',
      balance: SEPP_BALANCE,
      annualContribution: 5_000,
      sepp: { startAge: 56, method: 'rmd' },
    } as Account,
    {
      type: 'cash',
      id: 'cash1',
      name: 'Cash',
      ownerPersonId: null,
      annualReturnPct: null,
      balance: 50_000,
      annualContribution: 0,
    } as Account,
  ]
  return plan
}

describeRule('notice-2022-6-3-02-e-1-projection-contribution-during-series', {
  readings: {
    statuteSeriesModifiedByTheContribution: CONTRIBUTION_DURING_SERIES_PENALTY,
    engineRunsNoModificationTestAndPaysPenaltyFree: 0,
  },
  accepted: 'statuteSeriesModifiedByTheContribution',
  produced: 'engineRunsNoModificationTestAndPaysPenaltyFree',
  note: 'penalty in the first year of a contributed-to series',
}, ({ accepted, produced }) => {
  it('deposits into the SEPP account and still reports the series penalty-free', () => {
    const y2026 = year2026(contributionDuringSeriesPlan())

    // Both facts are live in the same year on the same account: money went in,
    // and a series payment came out. That coexistence IS the modification.
    expect(y2026.contributions).toBeGreaterThan(0)
    expect(y2026.sepp).toBeCloseTo(SEPP_PAYMENT_2026, 6)

    expect(y2026.penalties).toBe(produced)
    expect(y2026.penalties).not.toBeCloseTo(accepted, 2)
    expect(accepted).toBeGreaterThan(0)
  })

  it('admits the SEPP-elected account to the contribution pass on the sole inherited test', () => {
    // The mechanism behind the figure above: the contribution pass asks only
    // whether the account is inherited. A running series is not a fact it can
    // see, so nothing refuses the deposit and nothing records that it happened.
    const seppAccount = contributionDuringSeriesPlan().accounts
      .find((account) => account.id === 'ira1')!
    expect(seppAccount.type === 'traditional' && seppAccount.sepp !== undefined)
      .toBe(true)
    expect(acceptsContributions(seppAccount)).toBe(true)
  })

  it('charges no 72(t)(4) recapture in any later year of the contributed-to series', () => {
    // The statement records two losses, not one: the current year is shown
    // penalty-free, AND the recapture of every earlier payment plus interest is
    // never charged. 2027 is the first year that second loss is observable.
    const years = run(contributionDuringSeriesPlan()).years
    for (const year of [2027, 2028]) {
      const observed = years.find((y) => y.year === year)!
      expect(observed.sepp, `sepp in ${year}`).toBeGreaterThan(0)
      expect(observed.contributions, `contributions in ${year}`).toBeGreaterThan(0)
      expect(observed.penalties, `penalties in ${year}`).toBe(0)
    }
  })
})

// ---------------------------------------------------------------------------
// 2. irc-72-t-3-B-sepp-separation-annual-proxy
// ---------------------------------------------------------------------------

function employerSeppPlan(over: {
  retirementAge: number | null
  wages?: { annualGross: number; endAge: number | null }
}): Plan {
  const plan = quietPlan(over.retirementAge)
  plan.incomes = over.wages === undefined ? [] : [{
    type: 'wages',
    id: 'w1',
    personId: 'p1',
    annualGross: over.wages.annualGross,
    endAge: over.wages.endAge,
    realGrowthPct: 0,
  }]
  plan.accounts = [
    {
      type: 'traditional',
      id: 'plan1',
      name: 'Plan',
      ownerPersonId: 'p1',
      annualReturnPct: null,
      kind: 'employer',
      balance: SEPP_BALANCE,
      annualContribution: 0,
      sepp: { startAge: 56, method: 'rmd' },
    } as Account,
    {
      type: 'cash',
      id: 'cash1',
      name: 'Cash',
      ownerPersonId: null,
      annualReturnPct: null,
      balance: 200_000,
      annualContribution: 0,
    } as Account,
  ]
  return plan
}

/**
 * The over-refusing direction. A participant with no wage stream at all has
 * plainly separated from service — that is how the plan model spells someone
 * with nothing left to stop paying them — and a series they begin now begins
 * after that separation, so 72(t)(3)(B) is satisfied and the exception applies.
 * The projection cannot see it: it derives separation from the retirement age
 * and from nothing else, and a plan stating no retirement age states no
 * separation, so the employer-plan series is refused outright.
 */
describeRule('irc-72-t-3-B-sepp-separation-annual-proxy', {
  readings: {
    statuteSeriesBeganAfterSeparation: SEPP_PAYMENT_2026,
    engineNoRetirementAgeSoNoSeparation: 0,
  },
  accepted: 'statuteSeriesBeganAfterSeparation',
  produced: 'engineNoRetirementAgeSoNoSeparation',
  note: 'separated participant whose plan states no retirement age',
}, ({ accepted, produced }) => {
  it('refuses the series because no retirement age stands in for the separation', () => {
    const plan = employerSeppPlan({ retirementAge: null })
    const y2026 = year2026(plan)

    // No wages at any age: nothing is paying this participant, which is the
    // only employment fact the projection carries.
    expect(y2026.incomes.wages).toBe(0)

    expect(y2026.sepp).toBe(produced)
    expect(y2026.sepp).not.toBeCloseTo(accepted, 2)
  })

  it('pays the same series the moment a retirement age is stated, on facts 72(t)(3)(B) does not mention', () => {
    // The discriminator is the retirement age alone. Nothing else in the plan
    // moved, and the statute nowhere asks for one.
    const stated = year2026(employerSeppPlan({ retirementAge: 55 }))
    expect(stated.sepp).toBeCloseTo(accepted, 6)
  })
})

/**
 * The under-refusing direction, on the same record. A participant still drawing
 * wages at 56 has not separated from service, so 72(t)(3)(B) withholds the
 * exception from any employer-plan series they begin. The projection grants it
 * anyway: it reads the stated retirement age as the separation and never asks
 * whether the wage model is still paying them, which it is here because the
 * stream carries its own `endAge`.
 */
describeRule('irc-72-t-3-B-sepp-separation-annual-proxy', {
  readings: {
    statuteNoSeparationSoNoException: 0,
    engineRetirementAgePassedSoSeriesExcepted: SEPP_PAYMENT_2026,
  },
  accepted: 'statuteNoSeparationSoNoException',
  produced: 'engineRetirementAgePassedSoSeriesExcepted',
  note: 'still-paid participant past a stated retirement age',
}, ({ accepted, produced }) => {
  it('excepts an employer-plan series for a participant the wage model is still paying', () => {
    const plan = employerSeppPlan({
      retirementAge: 50,
      wages: { annualGross: 100_000, endAge: 70 },
    })
    const y2026 = year2026(plan)

    // Still on the payroll at 56, so no separation from service has occurred.
    expect(y2026.incomes.wages).toBeCloseTo(100_000, 6)

    expect(y2026.sepp).toBeCloseTo(produced, 6)
    expect(y2026.sepp).not.toBe(accepted)
  })
})

// ---------------------------------------------------------------------------
// HSA reimbursement ledger scaffolding
// ---------------------------------------------------------------------------

const hsaOwner = asPersonId('hsa-owner')
const hsaOld = asAccountId('hsa-old')
const hsaNew = asAccountId('hsa-new')

/**
 * Binds the opening expense state and prior-history identifiers, which the
 * ledger derives structurally and refuses to accept unbound.
 */
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

function ledgerFor(input: EvaluateAnnualHsaReimbursementLedgerInput) {
  const result = evaluateAnnualHsaReimbursementLedger(input)
  if (result.status !== 'evaluated') throw new Error(result.issues[0].detail)
  return result
}

// ---------------------------------------------------------------------------
// 3. notice-2004-50-a-39-prior-section-213-deduction
// ---------------------------------------------------------------------------

const DEDUCTED_EXPENSE = 500_000

/**
 * One expense, incurred and itemized under section 213 on the prior year's
 * return, then reimbursed from the HSA this year. Notice 2004-50 A-39 makes the
 * distribution non-excludable for exactly that reason, so the whole $5,000 is
 * nonqualified. The ledger has nowhere to record the prior deduction, so it
 * reads the expense's asserted qualified flag and reimburses it in full.
 */
function priorlyDeductedInput(): EvaluateAnnualHsaReimbursementLedgerInput {
  const input: EvaluateAnnualHsaReimbursementLedgerInput = {
    taxYear: 2026,
    allocationInventoryComplete: true,
    scope: {
      predicate: 'completeHsaFamilyReimbursementScope',
      reimbursementScopeId: 'deducted-scope',
      eligibleHsaOwnerPersonIds: [hsaOwner],
      coveredHsaAccountIds: [hsaOld],
      ownerEstablishmentInventoryComplete: true,
      ownerEstablishments: [{
        predicate: 'authoritativeOwnerHsaEstablishment',
        ownerPersonId: hsaOwner,
        ownerHsaEstablishedDate: '2015-01-01',
        ownerHsaEstablishedDateEvidenceId: 'deducted-established',
        authoritative: true,
      }],
      expenseInventoryComplete: true,
      priorHistory: {
        predicate: 'completeHsaReimbursementPriorHistory',
        reimbursementScopeId: 'deducted-scope',
        completeness: 'completeBeforeFirstAllocation',
        priorHistoryEvidenceId: 'bound-below',
        terminalLedgerEvidenceId: null,
        terminalExpenseStateId: 'bound-below',
      },
      expenses: [{
        reimbursementScopeId: 'deducted-scope',
        medicalExpenseId: 'surgery-2025',
        medicalExpenseEvidenceId: 'surgery-2025-record',
        immutableExpenseSourceRecordId: 'surgery-2025-provider',
        patientPersonId: hsaOwner,
        // Incurred and DEDUCTED on the 2025 Schedule A under section 213.
        expenseIncurredDate: '2025-06-01',
        originalEligibleExpenseAmount: asPositiveUsdCents(DEDUCTED_EXPENSE),
        reimbursedBeforeAmount: asUsdCents(0),
        qualifiedMedicalExpense: true,
        eligibilityEvidenceId: 'surgery-2025-qualified',
      }],
    },
    allocations: [{
      actionId: asActionId('deducted-action'),
      allocationId: asAllocationId('deducted-allocation'),
      sourceAccountId: hsaOld,
      distributionOwnerPersonId: hsaOwner,
      evaluationDate: '2026-05-01',
      actionExecutionSequence: 1,
      allocationSequenceWithinAction: 1,
      physicalApplicationEvidenceId: 'deducted-physical',
      executedAmount: asUsdCents(DEDUCTED_EXPENSE),
      ownerHsaEstablishedDate: '2015-01-01',
      ownerHsaEstablishedDateEvidenceId: 'deducted-established',
      reimbursementClaims: [{
        medicalExpenseId: 'surgery-2025',
        reimbursedByAllocationAmount: asPositiveUsdCents(DEDUCTED_EXPENSE),
        patientRelationshipToDistributionOwner: 'self',
        patientRelationshipEvidenceId: 'deducted-relationship',
      }],
    }],
  }
  bindOpeningState(input)
  return input
}

describeRule('notice-2004-50-a-39-prior-section-213-deduction', {
  readings: {
    statutePreviouslyDeductedIsNotExcludable: DEDUCTED_EXPENSE,
    engineAssumesTheExpenseWasNeverDeducted: 0,
  },
  accepted: 'statutePreviouslyDeductedIsNotExcludable',
  produced: 'engineAssumesTheExpenseWasNeverDeducted',
  note: 'nonqualified cents on a reimbursement of a deducted expense',
}, ({ accepted, produced }) => {
  it('excludes the whole distribution though the expense was deducted last year', () => {
    const entry = ledgerFor(priorlyDeductedInput()).entries[0]!

    expect(entry.nonqualifiedAmount).toBe(produced)
    expect(entry.nonqualifiedAmount).not.toBe(accepted)
    expect(entry.qualifiedMedicalAmount).toBe(DEDUCTED_EXPENSE)
  })

  it('cannot be told about the prior deduction at all', () => {
    // Not a calculation that reads the wrong field: the expense record has no
    // field for it, and the shape is closed, so a caller who KNOWS the expense
    // was deducted has no way to say so.
    const input = priorlyDeductedInput()
    const expense = input.scope.expenses[0]!
    expect(Object.keys(expense)).not.toContain('previouslyDeductedUnderSection213')

    Object.assign(expense, { previouslyDeductedUnderSection213: true })
    bindOpeningState(input)
    const refused = evaluateAnnualHsaReimbursementLedger(input)
    expect(refused.status).toBe('blocked')
  })
})

// ---------------------------------------------------------------------------
// 4. notice-2008-59-a-41-hsa-establishment-date-per-account
// ---------------------------------------------------------------------------

const GAP_EXPENSE = 480_000

/**
 * Two HSAs, one owner. The old account was established 2015-01-01 and emptied
 * and closed in 2020; the new one was established 2026-03-01, and because no
 * HSA of this beneficiary held a balance greater than zero at any point in the
 * 18 months ending on that date, the A-41 relate-back test FAILS and the new
 * account's own establishment date governs. An expense incurred 2026-02-01
 * therefore predates the only account this distribution comes out of, and none
 * of it is excludable.
 *
 * The evidence shape cannot express that. Establishment is keyed by PERSON, the
 * allocation names a source ACCOUNT, and nothing joins the two, so the owner's
 * single 2015 date is applied to a distribution from the 2026 account.
 */
function twoAccountInput(): EvaluateAnnualHsaReimbursementLedgerInput {
  const input: EvaluateAnnualHsaReimbursementLedgerInput = {
    taxYear: 2026,
    allocationInventoryComplete: true,
    scope: {
      predicate: 'completeHsaFamilyReimbursementScope',
      reimbursementScopeId: 'two-account-scope',
      eligibleHsaOwnerPersonIds: [hsaOwner],
      coveredHsaAccountIds: [hsaOld, hsaNew],
      ownerEstablishmentInventoryComplete: true,
      ownerEstablishments: [{
        predicate: 'authoritativeOwnerHsaEstablishment',
        ownerPersonId: hsaOwner,
        // The OLD account's date, and the only one the shape can hold.
        ownerHsaEstablishedDate: '2015-01-01',
        ownerHsaEstablishedDateEvidenceId: 'two-account-established',
        authoritative: true,
      }],
      expenseInventoryComplete: true,
      priorHistory: {
        predicate: 'completeHsaReimbursementPriorHistory',
        reimbursementScopeId: 'two-account-scope',
        completeness: 'completeBeforeFirstAllocation',
        priorHistoryEvidenceId: 'bound-below',
        terminalLedgerEvidenceId: null,
        terminalExpenseStateId: 'bound-below',
      },
      expenses: [{
        reimbursementScopeId: 'two-account-scope',
        medicalExpenseId: 'dental-2026',
        medicalExpenseEvidenceId: 'dental-2026-record',
        immutableExpenseSourceRecordId: 'dental-2026-provider',
        patientPersonId: hsaOwner,
        // Between the two establishment dates: after 2015-01-01, before
        // 2026-03-01.
        expenseIncurredDate: '2026-02-01',
        originalEligibleExpenseAmount: asPositiveUsdCents(GAP_EXPENSE),
        reimbursedBeforeAmount: asUsdCents(0),
        qualifiedMedicalExpense: true,
        eligibilityEvidenceId: 'dental-2026-qualified',
      }],
    },
    allocations: [{
      actionId: asActionId('two-account-action'),
      allocationId: asAllocationId('two-account-allocation'),
      // Paid from the NEWER account, established 2026-03-01.
      sourceAccountId: hsaNew,
      distributionOwnerPersonId: hsaOwner,
      evaluationDate: '2026-06-01',
      actionExecutionSequence: 1,
      allocationSequenceWithinAction: 1,
      physicalApplicationEvidenceId: 'two-account-physical',
      executedAmount: asUsdCents(GAP_EXPENSE),
      ownerHsaEstablishedDate: '2015-01-01',
      ownerHsaEstablishedDateEvidenceId: 'two-account-established',
      reimbursementClaims: [{
        medicalExpenseId: 'dental-2026',
        reimbursedByAllocationAmount: asPositiveUsdCents(GAP_EXPENSE),
        patientRelationshipToDistributionOwner: 'self',
        patientRelationshipEvidenceId: 'two-account-relationship',
      }],
    }],
  }
  bindOpeningState(input)
  return input
}

describeRule('notice-2008-59-a-41-hsa-establishment-date-per-account', {
  readings: {
    statuteRelateBackFailsSoNothingIsQualified: 0,
    engineAppliesTheOwnerLevelDateToEveryAccount: GAP_EXPENSE,
  },
  accepted: 'statuteRelateBackFailsSoNothingIsQualified',
  produced: 'engineAppliesTheOwnerLevelDateToEveryAccount',
  note: 'expense incurred between two establishment dates',
}, ({ accepted, produced }) => {
  it('qualifies a distribution from the newer account against the older account date', () => {
    const entry = ledgerFor(twoAccountInput()).entries[0]!

    expect(entry.sourceAccountId).toBe(hsaNew)
    expect(entry.qualifiedMedicalAmount).toBe(produced)
    expect(entry.qualifiedMedicalAmount).not.toBe(accepted)
    expect(entry.nonqualifiedAmount).toBe(0)

    // The date it reasoned from belongs to the other account entirely.
    expect(entry.ownerHsaEstablishedDate).toBe('2015-01-01')
    expect(entry.consumptions[0]!.ownerHsaEstablishedDate).toBe('2015-01-01')
  })

  it('has no shape in which the two accounts could carry different dates', () => {
    // The establishment record is keyed by person and nothing joins it to an
    // account, so the failing case cannot be described to the engine even by a
    // caller who holds both dates.
    const establishment = twoAccountInput().scope.ownerEstablishments[0]!
    expect(Object.keys(establishment)).not.toContain('hsaAccountId')

    const twoDates = twoAccountInput()
    Object.assign(twoDates.scope, {
      ownerEstablishments: [
        twoDates.scope.ownerEstablishments[0]!,
        {
          ...twoDates.scope.ownerEstablishments[0]!,
          ownerHsaEstablishedDate: '2026-03-01',
          ownerHsaEstablishedDateEvidenceId: 'two-account-established-new',
        },
      ],
    })
    bindOpeningState(twoDates)
    const refused = evaluateAnnualHsaReimbursementLedger(twoDates)
    expect(refused.status).toBe('blocked')
  })
})

// ---------------------------------------------------------------------------
// 5. irc-72-e-8-D-pre-1987-employee-contributions
// ---------------------------------------------------------------------------

const PLAN_VALUE = 10_000_000
/** All of it the December 31, 1986 investment in the contract. */
const GRANDFATHERED_BASIS = 2_000_000
const PLAN_DISTRIBUTION = 1_000_000
const PRO_RATA_ORDINARY_INCOME =
  PLAN_DISTRIBUTION - (PLAN_DISTRIBUTION * GRANDFATHERED_BASIS) / PLAN_VALUE

function pre1987Input(): ClassifyTraditionalEmployerPlanWithdrawalInput {
  const actionId = asActionId('pre-1987-withdrawal')
  const allocationId = asAllocationId('pre-1987-allocation')
  const sourceAccountId = asAccountId('pre-1987-plan')
  const participantPersonId = asPersonId('pre-1987-participant')
  const evaluationDate = '2026-06-15'
  return {
    actionId,
    allocationId,
    sourceAccountId,
    participantPersonId,
    evaluationDate,
    executedAmount: asUsdCents(PLAN_DISTRIBUTION),
    availabilityEvidence: {
      predicate: 'employerDistributionEligibility',
      actionId,
      allocationId,
      sourceAccountId,
      participantPersonId,
      evaluationDate,
      availabilityEvidence: {
        kind: 'distributableEvent',
        eventKind: 'separationFromService',
        eventDate: '2026-01-02',
        planTermsEvidenceId: 'pre-1987-plan-terms',
        availableOnEvaluationDate: true,
      },
    },
    basisSnapshot: {
      predicate: 'traditionalEmployerPlanBasisSnapshot',
      actionId,
      allocationId,
      sourceAccountId,
      participantPersonId,
      evaluationDate,
      preDistributionAccountValue: asPositiveUsdCents(PLAN_VALUE),
      afterTaxEmployeeBasisBeforeDistribution: asUsdCents(GRANDFATHERED_BASIS),
      basisEvidenceId: 'pre-1987-basis',
    },
  }
}

/**
 * A participant in a plan that on May 5, 1986 permitted withdrawal of employee
 * contributions before separation, whose whole $20,000 of after-tax basis is
 * the investment in the contract as of December 31, 1986. Under 72(e)(8)(D) the
 * pro-rata rule of subparagraph (A) reaches only amounts received IN EXCESS of
 * that figure, so a $10,000 distribution is recovered entirely out of the
 * grandfathered layer and carries no ordinary income at all. The engine holds
 * one undifferentiated after-tax number and no plan-terms flag, so it prorates
 * from the first dollar and taxes 80% of the distribution.
 */
describeRule('irc-72-e-8-D-pre-1987-employee-contributions', {
  readings: {
    statuteGrandfatheredBasisComesOutFirst: 0,
    engineProratesFromTheFirstDollar: PRO_RATA_ORDINARY_INCOME,
  },
  accepted: 'statuteGrandfatheredBasisComesOutFirst',
  produced: 'engineProratesFromTheFirstDollar',
  note: 'ordinary income on a distribution inside the grandfathered layer',
}, ({ accepted, produced }) => {
  it('taxes four fifths of a distribution the statute returns whole', () => {
    const result = classifyTraditionalEmployerPlanWithdrawal(pre1987Input())
    if (result.status !== 'accepted') throw new Error(result.reasons[0].code)
    const basis = result.acceptedSourceEligibility.basisEvidence

    expect(basis.rule).toBe('proRataSingleDistribution')
    expect(basis.ordinaryIncomeAmount).toBe(produced)
    expect(basis.ordinaryIncomeAmount).not.toBe(accepted)
    // The mirror figure: 200,000 cents recovered where the statute returns all
    // 1,000,000, which is the deferral the record calls a timing error.
    expect(basis.basisRecoveredAmount).toBe(PLAN_DISTRIBUTION - produced)

    const ordinary = result.taxCharacter.find((c) => c.kind === 'ordinaryIncome')
    expect(ordinary?.amount).toBe(produced)
  })

  it('carries no pre-1987 layer and no May 5, 1986 plan-terms flag to carry one', () => {
    const snapshot = pre1987Input().basisSnapshot!
    const keys = Object.keys(snapshot)
    expect(keys).toContain('afterTaxEmployeeBasisBeforeDistribution')
    for (const absent of [
      'preDecember311986InvestmentInTheContract',
      'permittedPreSeparationWithdrawalOnMay51986',
    ]) {
      expect(keys).not.toContain(absent)
    }
  })
})

// ---------------------------------------------------------------------------
// 6. treas-reg-1-1012-1-c-lot-basis-and-holding-period
// ---------------------------------------------------------------------------

/**
 * Two lots of the same stock, 100 shares each, now worth $1,000 a share:
 *   - the EARLIEST lot, bought years ago at $100 a share  ->  $10,000 basis
 *   - a later lot, bought 30 days ago at $900 a share     ->  $90,000 basis
 * The taxpayer sells 100 shares for $100,000 and identifies no lot, so
 * 1.1012-1(c)(1)(i) charges the sale against the earliest lot: $10,000 of basis
 * and $90,000 of long-term gain. The engine holds one blended basis for the
 * whole account and recovers it in the ratio of basis to fair market value.
 */
const LOT_FMV = 20_000_000
const EARLIEST_LOT_BASIS = 1_000_000
const LATER_LOT_BASIS = 9_000_000
const LOT_BLENDED_BASIS = EARLIEST_LOT_BASIS + LATER_LOT_BASIS
const LOT_SALE = 10_000_000
const EARLIEST_LOT_GAIN = LOT_SALE - EARLIEST_LOT_BASIS
const AVERAGE_COST_GAIN = LOT_SALE - (LOT_SALE * LOT_BLENDED_BASIS) / LOT_FMV

function lotSaleInput(): ClassifyIndividuallyOwnedTaxableWithdrawalInput {
  const owner = asPersonId('lot-owner')
  return {
    actionId: asActionId('lot-sale'),
    allocationId: asAllocationId('lot-sale-allocation'),
    sourceAccountId: asAccountId('lot-brokerage'),
    actingPersonId: owner,
    evaluationDate: '2026-06-15',
    executedAmount: asUsdCents(LOT_SALE),
    preExecutionFairMarketValue: asPositiveUsdCents(LOT_FMV),
    remainingCostBasisBeforeExecution: asUsdCents(LOT_BLENDED_BASIS),
    ownership: {
      accountOwnerPersonIds: [owner],
      accountOwnershipEvidenceId: 'lot-ownership',
      beneficialOwnershipShare: {
        representation: 'exactRational',
        numerator: 1,
        denominator: 1,
        intermediateArithmetic: 'bigintRational',
      },
      attributionEvidenceId: 'lot-attribution',
    },
    taxUnit: {
      taxUnitId: 'lot-tax-unit',
      taxUnitMemberPersonIds: [owner],
      federalFilingStatus: 'single',
      stateFilingStatusId: 'state-single',
      taxUnitEvidenceId: 'lot-tax-unit-record',
      taxYear: 2026,
    },
  }
}

describeRule('treas-reg-1-1012-1-c-lot-basis-and-holding-period', {
  readings: {
    regulationChargesTheEarliestLot: EARLIEST_LOT_GAIN,
    engineRecoversAccountLevelAverageCost: AVERAGE_COST_GAIN,
  },
  accepted: 'regulationChargesTheEarliestLot',
  produced: 'engineRecoversAccountLevelAverageCost',
  note: 'basis recovered on a partial sale of two lots',
}, ({ accepted, produced }) => {
  it('recovers blended basis where the regulation charges the earliest lot', () => {
    const result = classifyIndividuallyOwnedTaxableWithdrawal(lotSaleInput())
    const basis = result.acceptedSourceEligibility.basisEvidence

    expect(basis.method).toBe('planningAggregateBasisRatio')
    expect(basis.realizedCapitalGainOrLossAmount).toBe(produced)
    expect(basis.realizedCapitalGainOrLossAmount).not.toBe(accepted)
    expect(basis.basisRecoveredAmount).toBe(LOT_SALE - produced)

    const gain = result.taxCharacter.find((c) => c.kind === 'capitalGain')
    expect(gain?.amount).toBe(produced)
  })

  it('takes one cost-basis figure for the account and no lot at all', () => {
    const input = lotSaleInput()
    const keys = Object.keys(input)
    expect(keys).toContain('remainingCostBasisBeforeExecution')
    for (const absent of ['lots', 'lotIdentification', 'acquisitionDates']) {
      expect(keys).not.toContain(absent)
    }
  })
})

/**
 * The second, larger half of the same record. The later lot above was bought 30
 * days before the sale, so a taxpayer who identified it would realize SHORT-TERM
 * gain taxed as ordinary income rather than at the preferential rate. The engine
 * emits one realized figure and attaches no holding period to it anywhere, so
 * the two rate schedules are reported as one number and nothing downstream can
 * separate them.
 */
function reportedHoldingPeriod(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return null
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (/holdingperiod|longterm|shortterm/i.test(key.replace(/[^a-z]/gi, ''))) {
      return child
    }
    const nested = reportedHoldingPeriod(child)
    if (nested !== null) return nested
  }
  return null
}

describeRule('treas-reg-1-1012-1-c-lot-basis-and-holding-period', {
  readings: {
    regulationFixesAHoldingPeriodFromTheLot: 'shortTerm',
    engineEmitsNoHoldingPeriodAtAll: null,
  },
  accepted: 'regulationFixesAHoldingPeriodFromTheLot',
  produced: 'engineEmitsNoHoldingPeriodAtAll',
  note: 'holding-period character of the realized gain',
}, ({ accepted, produced }) => {
  it('reports gain with no holding period, so short-term and long-term are one number', () => {
    const result = classifyIndividuallyOwnedTaxableWithdrawal(lotSaleInput())

    expect(reportedHoldingPeriod(result)).toBe(produced)
    expect(reportedHoldingPeriod(result)).not.toBe(accepted)

    // The emitted character names the kind of gain and nothing about its rate
    // schedule, which is the fact 1222(3) turns on.
    const gain = result.taxCharacter.find((c) => c.kind === 'capitalGain')!
    expect(gain.kind).toBe('capitalGain')
    expect(Object.keys(gain)).toEqual([
      'actionId',
      'allocationId',
      'sourceAccountId',
      'sourceClass',
      'kind',
      'amount',
      'taxAttribution',
      'characterEvidence',
    ])
  })

  it('never receives an acquisition date it could derive one from', () => {
    expect(reportedHoldingPeriod(lotSaleInput())).toBe(null)
    expect(Object.keys(lotSaleInput())).not.toContain('acquisitionDate')
  })
})
