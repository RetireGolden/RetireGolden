import { describe, expect, it } from 'vitest'

import { parseRetirementActionRequest } from '../actions/index.js'
import type { Account, Plan } from '../model/plan.js'
import {
  recurringOrdinaryIncome,
  singlePersonPlan,
  validatePlan,
} from '../testing/planFixtures.js'
import { createFlatTaxCalculator } from '../testing/flatTax.js'
import { simulatePlan } from './simulate.js'
import type { ProjectionResult, YearResult } from './types.js'

/**
 * One self-funding group per year, and one year per group.
 *
 * This file exists because of a defect the adversarial pass found, and the
 * defect is worth stating because the symptom pointed nowhere near the cause.
 * A plan holding the *same* self-funding pair in two different years could
 * release neither of them, in either year.
 *
 * `assessConversionLinkedWithdrawalGroups` has no year predicate — membership
 * is read off the conversion side alone, deliberately — and the simulator was
 * handing it the Plan's whole multi-year retirement-action array. So in 2026
 * the candidate set contained 2027's conversion, and two independent
 * consequences followed, either of which was on its own fatal:
 *
 *  - the funding evaluation's members are built from that same set, and a
 *    conversion belonging to another year has no execution evidence in this
 *    one, so its `allocationWeight` was null and the whole annual group refused
 *    `allocationWeightUnavailable`;
 *  - the release is all-or-nothing across the candidate set, so 2027's pair had
 *    to be authorized alongside 2026's — whereupon `withdrawalLegsMovedWhole`
 *    found no 2027 withdrawal evidence in the 2026 run and revoked every
 *    release.
 *
 * The reason surfaced to a household was untrue as well as unhelpful: 2026's
 * refusal named 2027's conversion as having "no stateable taxable principal to
 * allocate by" — a Form 8606 character claim about a conversion whose only
 * relevant property was belonging to a different year.
 *
 * The all-or-nothing rule was not the defect and has not moved: it is a rule
 * about one filing unit in one year, and what was wrong was the set it ranged
 * over. The candidate set is now the year's own actions.
 *
 * Every figure below is exact. Each year converts $40,000 from a zero-basis
 * IRA at a flat 22% and funds it with a dedicated $8,800 cash withdrawal, so
 * both years reach the same fixed point from different opening balances.
 */

const START_YEAR = 2026
const END_YEAR = 2028
const FLAT_RATE_PCT = 22
const CONVERSION_CENTS = 40_000_00
const FUNDED_WITHDRAWAL_CENTS = 8_800_00
const BASELINE_LIABILITY_CENTS = 19_800_00
const CANDIDATE_LIABILITY_CENTS = 28_600_00
const IRA_OPENING_DOLLARS = 400_000
const CASH_OPENING_DOLLARS = 1_000_000
/** Pension less expenses less this year's tax, swept into cash each year. */
const ANNUAL_SURPLUS_DOLLARS = 20_200

function cash(): Account {
  return {
    type: 'cash',
    id: 'cash-a',
    name: 'cash-a',
    ownerPersonId: 'p1',
    annualReturnPct: 0,
    balance: CASH_OPENING_DOLLARS,
    annualContribution: 0,
  }
}

function traditionalIra(): Account {
  return {
    type: 'traditional',
    id: 'ira-a',
    name: 'ira-a',
    ownerPersonId: 'p1',
    annualReturnPct: 0,
    kind: 'ira',
    balance: IRA_OPENING_DOLLARS,
    annualContribution: 0,
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

/**
 * One self-funding pair: $40,000 converted, $8,800 withdrawn to pay for it.
 *
 * `slot` moves the pair to its own pair of days and sequence numbers, so two
 * pairs can share a year without colliding on the merged schedule.
 */
function pair(suffix: string, year: number, slot = 0) {
  const conversionActionId = `conversion-${suffix}`
  const withdrawalActionId = `withdrawal-${suffix}`
  return [
    request({
      actionId: withdrawalActionId,
      kind: 'ordinaryWithdrawal',
      personId: 'p1',
      year,
      executionDate: `${year}-06-${14 + slot * 2}`,
      executionSequence: 1 + slot * 2,
      requestedAmount: FUNDED_WITHDRAWAL_CENTS,
      allocations: [{
        allocationId: `${withdrawalActionId}-allocation`,
        sourceAccountId: 'cash-a',
        requestedAmount: FUNDED_WITHDRAWAL_CENTS,
      }],
      purpose: { kind: 'taxPayment', referenceId: conversionActionId },
      provenance: { source: 'manual' },
    }),
    request({
      actionId: conversionActionId,
      kind: 'rothConversion',
      personId: 'p1',
      year,
      executionDate: `${year}-06-${15 + slot * 2}`,
      executionSequence: 2 + slot * 2,
      requestedAmount: CONVERSION_CENTS,
      allocations: [{
        allocationId: `${conversionActionId}-allocation`,
        sourceAccountId: 'ira-a',
        requestedAmount: CONVERSION_CENTS,
      }],
      destinationRothAccountId: 'roth-a',
      taxFunding: {
        kind: 'linkedWithdrawal',
        withdrawalActionId,
      },
      provenance: { source: 'manual' },
    }),
  ]
}

function planWith(actions: readonly ReturnType<typeof request>[]): Plan {
  const base = singlePersonPlan({ planningAge: 60, dob: '1970-01-01' })
  base.id = 'linked-funding-group-multi-year'
  base.accounts = [cash(), traditionalIra(), rothIra()]
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
  base.strategies.retirementActions = [...actions]
  return validatePlan(base)
}

function project(target: Plan): ProjectionResult {
  return simulatePlan(target, {
    startYear: START_YEAR,
    horizonEndYear: END_YEAR,
    taxCalculator: createFlatTaxCalculator(FLAT_RATE_PCT),
  })
}

function yearOf(result: ProjectionResult, year: number): YearResult {
  const found = result.years.find((entry) => entry.year === year)
  if (found === undefined) throw new Error(`missing year ${year}`)
  return found
}

function groupExecution(year: YearResult) {
  const execution = year.conversionLinkedWithdrawalGroupExecution
  if (execution === undefined) {
    throw new Error(`year ${year.year} published no linked-funding group execution`)
  }
  return execution
}

function evaluatedFunding(year: YearResult) {
  const funding = groupExecution(year).funding
  if (funding.status !== 'annualGroupEvaluated') {
    throw new Error(`year ${year.year} funding not evaluated: ${funding.reason}`)
  }
  return funding
}

function publishedRecord(year: YearResult, actionId: string) {
  const record = year.retirementActionPublication?.records
    .find((entry) => entry.actionId === actionId)
  if (record === undefined) {
    throw new Error(`no published record for ${actionId} in ${year.year}`)
  }
  return record
}

describe('a self-funding linked group in each of two years', () => {
  const result = project(planWith([
    ...pair('a', 2026),
    ...pair('b', 2027),
  ]))
  const years = [
    { year: 2026, suffix: 'a', conversions: 1 },
    { year: 2027, suffix: 'b', conversions: 2 },
  ] as const

  it.each(years)('moves both legs of $year whole', ({ year, suffix }) => {
    const observed = yearOf(result, year)

    expect(groupExecution(observed)).toMatchObject({
      status: 'executed',
      movement: 'bothLegs',
      taxYear: year,
    })
    expect(publishedRecord(observed, `conversion-${suffix}`)).toMatchObject({
      outcome: 'executed',
      executedAmount: CONVERSION_CENTS,
      unexecutedAmount: 0,
      executedDate: `${year}-06-15`,
    })
    expect(publishedRecord(observed, `withdrawal-${suffix}`)).toMatchObject({
      outcome: 'executed',
      executedAmount: FUNDED_WITHDRAWAL_CENTS,
      unexecutedAmount: 0,
      executedDate: `${year}-06-14`,
    })
  })

  it.each(years)('reaches the same fixed point in $year, to the cent', ({ year }) => {
    // Both years cost the filing unit the same $8,800 and fund it with the same
    // $8,800, from different opening balances — which is the point. The
    // liabilities are this year's own two annual passes, not last year's.
    const evidence = evaluatedFunding(yearOf(result, year)).members[0]!

    expect(evidence).toMatchObject({
      evaluation: 'satisfied',
      allocationOrder: 1,
      allocationWeight: CONVERSION_CENTS,
      annualGroupRequiredFundingAmount: FUNDED_WITHDRAWAL_CENTS,
      annualGroupFundedAmount: FUNDED_WITHDRAWAL_CENTS,
      requiredFundingAmount: FUNDED_WITHDRAWAL_CENTS,
      fundedAmount: FUNDED_WITHDRAWAL_CENTS,
      fundedAmountDifference: 0,
      annualGroupFundedAmountDifference: 0,
    })
    expect(evidence.baselineAnnualTaxLiability.numeratorMinorUnits)
      .toBe(BASELINE_LIABILITY_CENTS)
    expect(evidence.candidateAnnualTaxLiability.numeratorMinorUnits)
      .toBe(CANDIDATE_LIABILITY_CENTS)
    expect(evidence.taxUnit.taxYear).toBe(year)
  })

  it.each(years)('closes $year on balances both movements explain', ({
    year, conversions,
  }) => {
    const observed = yearOf(result, year)
    const elapsed = year - START_YEAR + 1

    expect(observed.balances['ira-a'])
      .toBe(IRA_OPENING_DOLLARS - conversions * CONVERSION_CENTS / 100)
    expect(observed.balances['roth-a']).toBe(conversions * CONVERSION_CENTS / 100)
    expect(observed.balances['cash-a']).toBe(
      CASH_OPENING_DOLLARS +
      elapsed * (ANNUAL_SURPLUS_DOLLARS - FUNDED_WITHDRAWAL_CENTS / 100),
    )
    expect(Math.round((observed.tax + observed.penalties) * 100))
      .toBe(CANDIDATE_LIABILITY_CENTS)
  })

  it.each(years)('assesses only $year own group, and nothing from elsewhere', ({
    year, suffix,
  }) => {
    // The pin that the defect cannot come back. A mixed-year member set is
    // exactly what produced it, so what is asserted is that neither the group
    // records nor the funding members can name an action from another year.
    const observed = yearOf(result, year)
    const execution = groupExecution(observed)

    expect(execution.groups.map((group) => [
      group.year,
      group.conversionActionId,
      group.withdrawalActionId,
    ])).toEqual([[year, `conversion-${suffix}`, `withdrawal-${suffix}`]])
    expect(evaluatedFunding(observed).members.map((member) =>
      member.conversionActionId)).toEqual([`conversion-${suffix}`])
    // The merged ordering is the year's own two legs and no more.
    expect(execution.ordering?.positions.map((position) => position.actionId))
      .toEqual([`withdrawal-${suffix}`, `conversion-${suffix}`])
  })

  it('never blames another year on a Form 8606 character it cannot state', () => {
    // The untruthful reason died with the defect: there is no refusal left in
    // either year to carry it. Asserted as an absence rather than a rewording,
    // because the honest answer to "why did 2026 refuse" turned out to be that
    // it should not have.
    for (const { year } of years) {
      const funding = groupExecution(yearOf(result, year)).funding
      expect(funding.status).toBe('annualGroupEvaluated')
    }
  })
})

describe('two self-funding linked groups in one year', () => {
  // The control that isolates the defect to the missing year predicate rather
  // than to multiplicity as such: two groups sharing a year release together,
  // and the all-or-nothing rule is doing its job over the right set.
  const observed = yearOf(project(planWith([
    ...pair('a', 2026, 0),
    ...pair('b', 2026, 1),
  ])), 2026)

  it('releases both, and allocates the year cost across both conversions', () => {
    expect(groupExecution(observed)).toMatchObject({
      status: 'executed',
      movement: 'bothLegs',
    })
    expect(groupExecution(observed).groups.map((group) => group.movement))
      .toEqual(['bothLegs', 'bothLegs'])

    const members = evaluatedFunding(observed).members
    expect(members.map((member) => [
      member.conversionActionId,
      member.allocationOrder,
      member.allocationWeight,
      member.requiredFundingAmount,
      member.fundedAmount,
      member.evaluation,
    ])).toEqual([
      ['conversion-a', 1, CONVERSION_CENTS, FUNDED_WITHDRAWAL_CENTS,
        FUNDED_WITHDRAWAL_CENTS, 'satisfied'],
      ['conversion-b', 2, CONVERSION_CENTS, FUNDED_WITHDRAWAL_CENTS,
        FUNDED_WITHDRAWAL_CENTS, 'satisfied'],
    ])
    // Two conversions, one annual group: the unit's whole cost and the whole
    // of what its two dedicated withdrawals raised.
    expect(members[0]?.annualGroupRequiredFundingAmount)
      .toBe(2 * FUNDED_WITHDRAWAL_CENTS)
    expect(members[0]?.annualGroupFundedAmount).toBe(2 * FUNDED_WITHDRAWAL_CENTS)
  })

  it('moves both pairs at their own authored positions', () => {
    for (const [suffix, day, sequence] of [
      ['a', 14, 1],
      ['b', 16, 3],
    ] as const) {
      expect(publishedRecord(observed, `withdrawal-${suffix}`)).toMatchObject({
        executedAmount: FUNDED_WITHDRAWAL_CENTS,
        executedDate: `2026-06-${day}`,
        executedSequence: sequence,
      })
      expect(publishedRecord(observed, `conversion-${suffix}`)).toMatchObject({
        executedAmount: CONVERSION_CENTS,
        executedDate: `2026-06-${day + 1}`,
        executedSequence: sequence + 1,
      })
    }
    expect(observed.balances['roth-a']).toBe(2 * CONVERSION_CENTS / 100)
  })
})
