import { describe, expect, it } from 'vitest'

import { parseRetirementActionRequest } from '../actions/index.js'
import type { Account, Plan } from '../model/plan.js'
import {
  recurringOrdinaryIncome,
  singlePersonPlan,
  validatePlan,
} from '../testing/planFixtures.js'
import { createFlatTaxCalculator } from './flatTax.js'
import { simulatePlan } from './simulate.js'
import type { ProjectionResult, YearResult } from './types.js'

/**
 * The linked funding group that actually moves, end to end.
 *
 * Its sibling file pins the group that refuses; this one pins the one that
 * does not, and every figure below is exact rather than approximate because a
 * flat tax calculator makes the whole chain arithmetic:
 *
 *   the conversion converts $40,000 from an IRA with a provably zero
 *   nondeductible basis, so all of it is includible;
 *   at a flat 22% that costs the filing unit $8,800;
 *   the plan authors a dedicated cash withdrawal of exactly $8,800;
 *   `T0` is $19,800, `T1(F)` is $28,600, and `max(0, T1 - T0)` is $8,800;
 *   the fixed point holds to the cent, and both legs move.
 *
 * Change any one of those and the group refuses, which is the property the
 * refusal fixtures below exercise from three different directions.
 *
 * **Why the basis is zero here and $20,000 in the sibling file.** A conversion
 * whose owner holds a positive nondeductible basis commits with a *null*
 * Form 8606 character, because the line-10 denominator does not exist at the
 * executor's mid-year call site — the annual settlement states it later. A null
 * character is a null `allocationWeight`, and the funding evaluation refuses an
 * unstateable weight rather than reading it as zero. So the executable arm is
 * reachable today only for an owner whose aggregated-IRA basis numerator is
 * provably zero. That is a real limit of this slice rather than a property of
 * the fixture, and it is stated here so nobody discovers it as a surprise.
 */

const START_YEAR = 2026
const END_YEAR = 2028
const ACTION_YEAR = 2026
const FLAT_RATE_PCT = 22
const CONVERSION_ACTION_ID = 'funded-conversion'
const WITHDRAWAL_ACTION_ID = 'funded-conversion-tax-withdrawal'
const CONVERSION_CENTS = 40_000_00
/** `40,000 x 22%`, to the cent: the whole of what the conversion costs. */
const FUNDED_WITHDRAWAL_CENTS = 8_800_00
/** A cent-accurate figure for a year whose basis is not zero. Short here. */
const SHORT_WITHDRAWAL_CENTS = 8_360_00
const BASELINE_LIABILITY_CENTS = 19_800_00
const CANDIDATE_LIABILITY_CENTS = 28_600_00
const IRA_OPENING_DOLLARS = 400_000
const CASH_OPENING_DOLLARS = 1_000_000

function cash(balance = CASH_OPENING_DOLLARS): Account {
  return {
    type: 'cash',
    id: 'cash-a',
    name: 'cash-a',
    ownerPersonId: 'p1',
    annualReturnPct: 0,
    balance,
    annualContribution: 0,
  }
}

function traditionalIra(balance = IRA_OPENING_DOLLARS): Account {
  return {
    type: 'traditional',
    id: 'ira-a',
    name: 'ira-a',
    ownerPersonId: 'p1',
    annualReturnPct: 0,
    kind: 'ira',
    balance,
    annualContribution: 0,
    // Provably zero, which is what makes the conversion's Form 8606 character
    // knowable at commit and therefore its allocation weight stateable.
    nondeductibleBasis: 0,
  }
}

function rothIra(): Account {
  return {
    type: 'roth',
    id: 'roth-a',
    name: 'roth-a',
    ownerPersonId: 'p1',
    annualReturnPct: 0,
    kind: 'ira',
    balance: 0,
    annualContribution: 0,
  }
}

function request(input: Record<string, unknown>) {
  const parsed = parseRetirementActionRequest(input)
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  return parsed.request
}

function fundingWithdrawal(cents: number) {
  return request({
    actionId: WITHDRAWAL_ACTION_ID,
    kind: 'ordinaryWithdrawal',
    personId: 'p1',
    year: ACTION_YEAR,
    executionDate: `${ACTION_YEAR}-06-14`,
    executionSequence: 1,
    requestedAmount: cents,
    allocations: [{
      allocationId: `${WITHDRAWAL_ACTION_ID}-allocation`,
      sourceAccountId: 'cash-a',
      requestedAmount: cents,
    }],
    purpose: { kind: 'taxPayment', referenceId: CONVERSION_ACTION_ID },
    provenance: { source: 'manual' },
  })
}

function linkedConversion() {
  return request({
    actionId: CONVERSION_ACTION_ID,
    kind: 'rothConversion',
    personId: 'p1',
    year: ACTION_YEAR,
    executionDate: `${ACTION_YEAR}-06-15`,
    executionSequence: 2,
    requestedAmount: CONVERSION_CENTS,
    allocations: [{
      allocationId: `${CONVERSION_ACTION_ID}-allocation`,
      sourceAccountId: 'ira-a',
      requestedAmount: CONVERSION_CENTS,
    }],
    destinationRothAccountId: 'roth-a',
    taxFunding: {
      kind: 'linkedWithdrawal',
      withdrawalActionId: WITHDRAWAL_ACTION_ID,
    },
    provenance: { source: 'manual' },
  })
}

function planWith(input: Readonly<{
  withdrawalCents?: number
  iraDollars?: number
  cashDollars?: number
  reversedAccountOrder?: boolean
}> = {}): Plan {
  const base = singlePersonPlan({ planningAge: 60, dob: '1970-01-01' })
  base.id = 'linked-funding-group-funded'
  const accounts = [
    cash(input.cashDollars),
    traditionalIra(input.iraDollars),
    rothIra(),
  ]
  base.accounts = input.reversedAccountOrder ? [...accounts].reverse() : accounts
  base.incomes = [recurringOrdinaryIncome('pension', 90_000)]
  base.expenses.baseAnnual = 50_000
  base.retirementActionEligibilityFacts = {
    iraClassifications: [{
      evidenceId: 'ira-a-classification',
      provenance: { source: 'manual' },
      sourceAccountId: 'ira-a',
      subtype: 'traditional',
    }],
    sepSimpleActivities: [],
    deductibleIraContributions: [],
  }
  base.strategies.retirementActions = [
    fundingWithdrawal(input.withdrawalCents ?? FUNDED_WITHDRAWAL_CENTS),
    linkedConversion(),
  ]
  return validatePlan(base)
}

/** The same year with the group's two legs simply absent: the `T0` shape. */
function withoutGroupPlan(): Plan {
  const base = planWith()
  base.strategies.retirementActions = []
  return validatePlan(base)
}

function project(target: Plan): ProjectionResult {
  return simulatePlan(target, {
    startYear: START_YEAR,
    horizonEndYear: END_YEAR,
    taxCalculator: createFlatTaxCalculator(FLAT_RATE_PCT),
  })
}

function actionYear(target: Plan): YearResult {
  const year = project(target).years.find((entry) => entry.year === ACTION_YEAR)
  if (year === undefined) throw new Error('the action year is missing')
  return year
}

function groupExecution(year: YearResult) {
  const execution = year.conversionLinkedWithdrawalGroupExecution
  if (execution === undefined) {
    throw new Error('the year published no linked-funding group execution')
  }
  return execution
}

function evaluatedFunding(year: YearResult) {
  const funding = groupExecution(year).funding
  if (funding.status !== 'annualGroupEvaluated') {
    throw new Error(`funding not evaluated: ${funding.reason}`)
  }
  return funding
}

function publishedRecord(year: YearResult, actionId: string) {
  const record = year.retirementActionPublication?.records
    .find((entry) => entry.actionId === actionId)
  if (record === undefined) throw new Error(`no published record for ${actionId}`)
  return record
}

describe('the conversion-linked withdrawal group that funds itself', () => {
  const funded = actionYear(planWith())
  const withoutGroup = actionYear(withoutGroupPlan())

  it('moves both legs, whole, at the positions the household authored', () => {
    const conversion = publishedRecord(funded, CONVERSION_ACTION_ID)
    const withdrawal = publishedRecord(funded, WITHDRAWAL_ACTION_ID)

    expect(withdrawal).toMatchObject({
      outcome: 'executed',
      readiness: 'actionable',
      requestedAmount: FUNDED_WITHDRAWAL_CENTS,
      executedAmount: FUNDED_WITHDRAWAL_CENTS,
      unexecutedAmount: 0,
      executedDate: `${ACTION_YEAR}-06-14`,
      executedSequence: 1,
    })
    expect(conversion).toMatchObject({
      outcome: 'executed',
      readiness: 'actionable',
      requestedAmount: CONVERSION_CENTS,
      executedAmount: CONVERSION_CENTS,
      unexecutedAmount: 0,
      executedDate: `${ACTION_YEAR}-06-15`,
      executedSequence: 2,
    })
    // The group says the same thing about the same pair, in its own vocabulary
    // and against the amounts each leg was authored.
    expect(groupExecution(funded)).toMatchObject({
      status: 'executed',
      movement: 'bothLegs',
    })
    expect(groupExecution(funded).groups).toEqual([expect.objectContaining({
      conversionActionId: CONVERSION_ACTION_ID,
      withdrawalActionId: WITHDRAWAL_ACTION_ID,
      disposition: 'executedAsAtomicGroup',
      refusalKind: null,
      reasonCode: null,
      movement: 'bothLegs',
      movementCoherent: true,
      orderingComplete: true,
      conversionAuthoredAmount: CONVERSION_CENTS,
      conversionExecutedAmount: CONVERSION_CENTS,
      withdrawalAuthoredAmount: FUNDED_WITHDRAWAL_CENTS,
      withdrawalExecutedAmount: FUNDED_WITHDRAWAL_CENTS,
    })])
  })

  it('proves the withdrawal covered the group tax delta, to the cent', () => {
    const evidence = evaluatedFunding(funded).members[0]!

    // The two liabilities are two whole annual passes, and the difference
    // between them is what the conversion cost the filing unit. Nothing here
    // is a marginal-rate estimate: `T0` really is the year re-run with both
    // legs removed.
    expect(evidence.baselineAnnualTaxLiability).toEqual({
      representation: 'exactRationalMinorUnits',
      numeratorMinorUnits: BASELINE_LIABILITY_CENTS,
      denominator: 1,
      intermediateArithmetic: 'bigintRational',
    })
    expect(evidence.candidateAnnualTaxLiability).toEqual({
      representation: 'exactRationalMinorUnits',
      numeratorMinorUnits: CANDIDATE_LIABILITY_CENTS,
      denominator: 1,
      intermediateArithmetic: 'bigintRational',
    })
    expect(Math.round((withoutGroup.tax + withoutGroup.penalties) * 100))
      .toBe(BASELINE_LIABILITY_CENTS)
    expect(Math.round((funded.tax + funded.penalties) * 100))
      .toBe(CANDIDATE_LIABILITY_CENTS)

    expect(evidence).toMatchObject({
      evaluation: 'satisfied',
      fundingEquality: 'exactCentQuantized',
      annualGroupRequiredFundingAmount: FUNDED_WITHDRAWAL_CENTS,
      annualGroupFundedAmount: FUNDED_WITHDRAWAL_CENTS,
      requiredFundingAmount: FUNDED_WITHDRAWAL_CENTS,
      fundedAmount: FUNDED_WITHDRAWAL_CENTS,
      fundedAmountDifference: 0,
      annualGroupFundedAmountDifference: 0,
      allocationOrder: 1,
      // The whole conversion is includible, so the weight is the whole of it.
      allocationWeight: CONVERSION_CENTS,
      liabilityQuantization: 'nearestCentHalfUp',
      currencyMinorUnit: 0.01,
    })
    expect(evidence.unquantizedAnnualGroupRequiredFundingAmount).toEqual({
      representation: 'exactRationalMinorUnits',
      numeratorMinorUnits: FUNDED_WITHDRAWAL_CENTS,
      denominator: 1,
      intermediateArithmetic: 'bigintRational',
    })
    // `T1 - T0` and the withdrawal's proceeds are the same number reached two
    // different ways, which is the whole claim the pathway makes.
    expect(CANDIDATE_LIABILITY_CENTS - BASELINE_LIABILITY_CENTS)
      .toBe(publishedRecord(funded, WITHDRAWAL_ACTION_ID).executedAmount)
  })

  it('publishes the evidence on the record, bound to two distinct runs', () => {
    const funding = evaluatedFunding(funded)
    const conversion = publishedRecord(funded, CONVERSION_ACTION_ID)
    const withdrawal = publishedRecord(funded, WITHDRAWAL_ACTION_ID)

    expect(conversion.conversionTaxFunding).toEqual(funding.members[0])
    // The withdrawal leg carries no evaluation: the share being allocated is
    // the conversion's, and a withdrawal has no share.
    expect('conversionTaxFunding' in withdrawal).toBe(false)

    expect(funding.baselineRun.liabilityRun.liabilityRunKind).toBe('baselineT0')
    expect(funding.candidateRun.liabilityRun.liabilityRunKind).toBe('candidateT1')
    expect(funding.baselineRun.annualTaxLiabilityEvidenceId)
      .not.toBe(funding.candidateRun.annualTaxLiabilityEvidenceId)
    // Distinct input snapshots, which is the stronger claim: the baseline
    // removed two requests and said so.
    expect(funding.taxInputSnapshotsShared).toBe(false)
    // And the candidate names the vector it was run against — the year's real
    // one, with the withdrawal's executed cents in it. This is what makes it a
    // `candidateT1` rather than an ordinary committed run, and the figure in it
    // is now nonzero for the first time.
    expect(funding.candidateRun.liabilityRun.candidateFundingVectorEvidenceId)
      .toEqual(expect.stringMatching(
        /^retirement-action-conversion-tax-funding-vector:/,
      ))
  })

  it('publishes `funded` with the figures it was proved, not figures it made up', () => {
    const evidence = funded.rothConversionActionExecution?.evidence
      .find((entry) => entry.actionId === CONVERSION_ACTION_ID)

    expect(evidence?.taxFunding).toMatchObject({
      kind: 'linkedWithdrawal',
      status: 'funded',
      requiredFundingAmount: FUNDED_WITHDRAWAL_CENTS,
      fundedAmount: FUNDED_WITHDRAWAL_CENTS,
    })
    expect(evidence?.taxFunding.evidenceId).toEqual(expect.stringMatching(
      /^retirement-action-conversion-tax-funding:/,
    ))
  })

  it('closes the year: the owned-IRA series carries the conversion and only it', () => {
    // The conversion leg binds into the owned-IRA runtime series exactly as a
    // named conversion always has — a debit keyed by the five-tuple and its
    // destination credit, in mutation-ordinal order. The withdrawal leg is
    // absent from it by construction: an ordinary withdrawal may only source
    // cash, equity compensation or taxable, and the series answers for owned
    // non-Roth IRAs alone.
    const applications = funded.retirementRuntimeApplicationSource?.applications
      ?? []
    expect(applications.map((application) => [
      application.applicationKind,
      application.simulatorPhase,
      application.mutationOrdinal,
    ])).toEqual([
      ['debit', 'namedRothConversionDebit', 1],
      ['namedRothDestinationCredit', 'namedRothConversionDestinationCredit', 2],
    ])
    expect(applications[0]).toMatchObject({
      sourceAccountId: 'ira-a',
      producerOccurrenceKey: JSON.stringify([
        'namedRothConversion', 'ira-a', 'roth-a',
        CONVERSION_ACTION_ID, `${CONVERSION_ACTION_ID}-allocation`,
      ]),
      sourceBalanceBeforePlanDollars: IRA_OPENING_DOLLARS,
      appliedAmountPlanDollars: CONVERSION_CENTS / 100,
      sourceBalanceAfterPlanDollars: IRA_OPENING_DOLLARS - CONVERSION_CENTS / 100,
    })
    expect(applications.some((application) =>
      application.sourceAccountId === 'cash-a')).toBe(false)

    // The owner's pool closes on the same figure after growth, and the year's
    // balances agree with both legs having moved: the IRA down by the
    // conversion, the Roth up by it, and cash down by the withdrawal net of
    // the year's surplus.
    expect(funded.ownedNonRothIraPostGrowthSource?.ownerPools).toEqual([{
      ownerPersonId: 'p1',
      accountBalances: [{
        sourceAccountId: 'ira-a',
        balancePlanDollars: IRA_OPENING_DOLLARS - CONVERSION_CENTS / 100,
      }],
    }])
    expect(funded.balances['ira-a'])
      .toBe(IRA_OPENING_DOLLARS - CONVERSION_CENTS / 100)
    expect(funded.balances['roth-a']).toBe(CONVERSION_CENTS / 100)
    expect(funded.balances['cash-a']).toBe(
      CASH_OPENING_DOLLARS - FUNDED_WITHDRAWAL_CENTS / 100 +
      (funded.surplusInvested ?? 0),
    )
  })

  it('does not disturb the year it did not have a group in', () => {
    // The staging run is a whole extra annual pass that is rolled back. If any
    // of it leaked, the year without a group would not be the year without a
    // group any more.
    expect(withoutGroup.retirementActionPublication).toBeUndefined()
    expect(withoutGroup.conversionLinkedWithdrawalGroupExecution).toBeUndefined()
    expect(withoutGroup.balances['ira-a']).toBe(IRA_OPENING_DOLLARS)
    expect(withoutGroup.balances['roth-a']).toBe(0)
  })
})

describe('the linked group that does not fund itself', () => {
  it('refuses both legs when the withdrawal is authored a cent short', () => {
    const short = actionYear(planWith({
      withdrawalCents: SHORT_WITHDRAWAL_CENTS,
    }))

    expect(publishedRecord(short, CONVERSION_ACTION_ID).executedAmount).toBe(0)
    expect(publishedRecord(short, WITHDRAWAL_ACTION_ID).executedAmount).toBe(0)
    expect(groupExecution(short)).toMatchObject({
      status: 'refused',
      movement: 'none',
    })
    expect(groupExecution(short).groups[0]).toMatchObject({
      disposition: 'refusedPendingGroupExecution',
      refusalKind: 'pendingGroupExecution',
      // The run held a baseline, so the refusal is on the merits: the required
      // amount was computable and the funding did not reconcile to it.
      reasonCode: 'conversion-tax-funding-unallocated',
      movement: 'none',
      movementCoherent: true,
    })
    // Both legs carry the same reason, from the one verdict both read.
    for (const actionId of [CONVERSION_ACTION_ID, WITHDRAWAL_ACTION_ID]) {
      expect(publishedRecord(short, actionId).reasons.map((reason) => reason.code))
        .toContain('conversion-tax-funding-unallocated')
    }
  })

  it.each([
    ['the conversion leg', { iraDollars: 30_000 }],
    ['the withdrawal leg', { cashDollars: 5_000 }],
  ])('refuses BOTH legs when %s cannot be funded', (_label, shortfall) => {
    // Atomicity from either direction. A group whose two legs are not both
    // fundable at the positions they occupy is never released at all, so the
    // fundable leg does not move on its own — which is the failure
    // `assertLinkedWithdrawalRecordAtomicity` exists to catch, prevented
    // upstream rather than caught downstream.
    const year = actionYear(planWith(shortfall))

    expect(publishedRecord(year, CONVERSION_ACTION_ID).executedAmount).toBe(0)
    expect(publishedRecord(year, WITHDRAWAL_ACTION_ID).executedAmount).toBe(0)
    expect(groupExecution(year)).toMatchObject({
      status: 'refused',
      movement: 'none',
    })
    expect(groupExecution(year).groups[0]).toMatchObject({
      disposition: 'refusedPendingGroupExecution',
      movement: 'none',
      movementCoherent: true,
    })
  })

  it('reaches the same answer whichever order the accounts are declared in', () => {
    const declared = actionYear(planWith())
    const reversed = actionYear(planWith({ reversedAccountOrder: true }))

    expect(reversed.balances).toEqual(declared.balances)
    expect(reversed.tax).toBe(declared.tax)
    expect(reversed.retirementActionPublication?.records)
      .toEqual(declared.retirementActionPublication?.records)
    expect(reversed.conversionLinkedWithdrawalGroupExecution)
      .toEqual(declared.conversionLinkedWithdrawalGroupExecution)
  })
})
