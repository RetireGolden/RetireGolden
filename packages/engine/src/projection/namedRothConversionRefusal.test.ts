import { describe, expect, it } from 'vitest'

import { parseRetirementActionRequest } from '../actions/index.js'
import { validateOwnedNonRothIraRuntimeSourceSeries } from '../internal/ownedNonRothIraRuntimeSourceSeries.js'
import type { Account, Plan } from '../model/plan.js'
import { singlePersonPlan, validatePlan } from '../testing/planFixtures.js'
import { createFlatTaxCalculator } from './flatTax.js'
import { simulatePlan } from './simulate.js'
import type { YearResult } from './types.js'

const TAX_YEAR = 2026
const SOURCE_BALANCE = 100_000
const REQUESTED_AMOUNT = 200_000_00

function traditionalIra(id: string, balance: number): Account {
  return {
    type: 'traditional',
    id,
    name: id,
    ownerPersonId: 'p1',
    annualReturnPct: 0,
    kind: 'ira',
    balance,
    annualContribution: 0,
  }
}

function rothIra(id: string): Account {
  return {
    type: 'roth',
    id,
    name: id,
    ownerPersonId: 'p1',
    annualReturnPct: 0,
    kind: 'ira',
    balance: 0,
    annualContribution: 0,
  }
}

function cash(id: string, balance: number): Account {
  return {
    type: 'cash',
    id,
    name: id,
    ownerPersonId: 'p1',
    annualReturnPct: 0,
    balance,
    annualContribution: 0,
  }
}

/**
 * One owner, one traditional IRA, and a named conversion that asks for twice
 * what the IRA holds. Every owner-wide prerequisite is deliberately satisfied:
 * the owner is under RMD age, the IRA is classified, the basis numerator is a
 * proven zero, and the request expects no tax funding. That leaves the short
 * source as the request's only blocker, which is the whole point — a refusal
 * carried by a physical-balance reason alone is the case the classification has
 * to answer for on its own, with no owner-wide reason beside it.
 */
function overdrawnPlan(): Plan {
  const plan = singlePersonPlan({ planningAge: 60, dob: '1970-01-01' })
  plan.id = 'named-conversion-overdrawn'
  plan.accounts = [
    cash('cash-a', 1_000_000),
    traditionalIra('ira-a', SOURCE_BALANCE),
    rothIra('roth-second'),
  ]
  plan.retirementActionEligibilityFacts = {
    iraClassifications: [{
      evidenceId: 'ira-a-classification',
      provenance: { source: 'manual' },
      sourceAccountId: 'ira-a',
      subtype: 'traditional',
    }],
    sepSimpleActivities: [],
    deductibleIraContributions: [],
  }
  const parsed = parseRetirementActionRequest({
    actionId: 'named-conversion',
    kind: 'rothConversion',
    personId: 'p1',
    year: TAX_YEAR,
    executionDate: '2026-06-15',
    executionSequence: 1,
    requestedAmount: REQUESTED_AMOUNT,
    allocations: [{
      allocationId: 'named-conversion-allocation',
      sourceAccountId: 'ira-a',
      requestedAmount: REQUESTED_AMOUNT,
    }],
    destinationRothAccountId: 'roth-second',
    taxFunding: { kind: 'noneExpected' },
    provenance: { source: 'manual' },
  })
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  plan.strategies.retirementActions = [parsed.request]
  return plan
}

/**
 * The same request across two sources, with a second blocker that is not about
 * balances at all. `ira-a` is classified and short; `ira-b` is short too but is
 * left out of `iraClassifications`, so it draws `conversion-ira-subtype-unknown`
 * — an allocation-bound blocker, not an owner-wide prerequisite, so nothing
 * routes this record to the staged-conversion bypass.
 *
 * The two reasons the year should carry are about two different sources. What
 * `ira-b` must NOT also carry is a balance report: the disqualification says it
 * was never established as a source, so a report that its balance was consulted
 * would claim something the disqualification rules out.
 */
const MIXED_ALLOCATION_A = 150_000_00
const MIXED_ALLOCATION_B = 200_000_00
const MIXED_REQUESTED_AMOUNT = MIXED_ALLOCATION_A + MIXED_ALLOCATION_B

function mixedBlockerPlan(): Plan {
  const plan = singlePersonPlan({ planningAge: 60, dob: '1970-01-01' })
  plan.id = 'named-conversion-mixed-blockers'
  plan.accounts = [
    cash('cash-a', 1_000_000),
    traditionalIra('ira-a', SOURCE_BALANCE),
    traditionalIra('ira-b', SOURCE_BALANCE),
    rothIra('roth-second'),
  ]
  plan.retirementActionEligibilityFacts = {
    iraClassifications: [{
      evidenceId: 'ira-a-classification',
      provenance: { source: 'manual' },
      sourceAccountId: 'ira-a',
      subtype: 'traditional',
    }],
    sepSimpleActivities: [],
    deductibleIraContributions: [],
  }
  const parsed = parseRetirementActionRequest({
    actionId: 'named-conversion',
    kind: 'rothConversion',
    personId: 'p1',
    year: TAX_YEAR,
    executionDate: '2026-06-15',
    executionSequence: 1,
    requestedAmount: MIXED_REQUESTED_AMOUNT,
    allocations: [
      {
        allocationId: 'alloc-a',
        sourceAccountId: 'ira-a',
        requestedAmount: MIXED_ALLOCATION_A,
      },
      {
        allocationId: 'alloc-b',
        sourceAccountId: 'ira-b',
        requestedAmount: MIXED_ALLOCATION_B,
      },
    ],
    destinationRothAccountId: 'roth-second',
    taxFunding: { kind: 'noneExpected' },
    provenance: { source: 'manual' },
  })
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  plan.strategies.retirementActions = [parsed.request]
  return plan
}

function project(plan: Plan): YearResult[] {
  return simulatePlan(validatePlan(plan), {
    startYear: TAX_YEAR,
    horizonEndYear: TAX_YEAR,
    taxCalculator: createFlatTaxCalculator(0),
  }).years
}

describe('named Roth conversion that outruns its source', () => {
  it('publishes a refusal instead of aborting the projection', () => {
    const year = project(overdrawnPlan())[0]!
    const records = year.retirementActionPublication?.records ?? []

    expect(records).toHaveLength(1)
    expect(records[0]).toMatchObject({
      actionId: 'named-conversion',
      kind: 'rothConversion',
      executorSource: 'rothConversionExecutor',
      outcome: 'refused',
      readiness: 'nonActionable',
      executedAmount: 0,
      unexecutedAmount: REQUESTED_AMOUNT,
      executedDate: null,
      executedSequence: null,
    })
    expect(records[0]?.reasons.map((reason) => reason.code))
      .toContain('conversion-balance-trimmed')
    // The refusal is carried by the short source alone. If an owner-wide
    // prerequisite were also outstanding the record would take the staged
    // bypass and prove nothing about the classification.
    expect(records[0]?.reasons.map((reason) => reason.code)).toEqual([
      'conversion-balance-trimmed',
    ])
  })

  it('moves no principal out of the source and credits no destination', () => {
    const year = project(overdrawnPlan())[0]!

    expect(year.rothConversionActionExecution?.committed).toBe(false)
    expect(year.balances['ira-a']).toBeCloseTo(SOURCE_BALANCE, 6)
    expect(year.balances['roth-second']).toBeCloseTo(0, 6)
    expect(year.rothConversion).toBeCloseTo(0, 6)
  })

  it('leaves the runtime source series complete with no conversion movement', () => {
    const plan = overdrawnPlan()
    const years = project(plan)
    const series = validateOwnedNonRothIraRuntimeSourceSeries(
      validatePlan(plan), TAX_YEAR, years,
    )

    if (series.status !== 'ownedNonRothIraRuntimeSourceSeriesComplete') {
      throw new Error(`source series blocked: ${JSON.stringify(series.issues)}`)
    }
    expect(series.years[0]!.aggregateRothDestinationCredits).toEqual([])
    expect(series.years[0]!.namedRothDestinationCredits).toEqual([])
    expect(series.years[0]!.ownerSources[0]!.applications.filter((entry) =>
      entry.occurrenceKind === 'namedRothConversion')).toEqual([])
  })
})

describe('named Roth conversion blocked on one source and short on another', () => {
  it('publishes both blockers instead of aborting the projection', () => {
    const year = project(mixedBlockerPlan())[0]!
    const records = year.retirementActionPublication?.records ?? []

    expect(records).toHaveLength(1)
    expect(records[0]).toMatchObject({
      actionId: 'named-conversion',
      executorSource: 'rothConversionExecutor',
      // Unsupported, not refused: the contract orders an unsupported reason
      // first and the subtype blocker is the unsupported one.
      outcome: 'unsupported',
      readiness: 'nonActionable',
      executedAmount: 0,
      unexecutedAmount: MIXED_REQUESTED_AMOUNT,
      executedDate: null,
      executedSequence: null,
    })
    expect(records[0]?.reasons).toEqual([
      expect.objectContaining({
        code: 'conversion-ira-subtype-unknown',
        outcome: 'unsupported',
        accountId: 'ira-b',
        allocationId: 'alloc-b',
      }),
      expect.objectContaining({
        code: 'conversion-balance-trimmed',
        outcome: 'refused',
        accountId: 'ira-a',
        allocationId: 'alloc-a',
      }),
    ])
  })

  it('withholds the balance report for the source it could not establish', () => {
    const year = project(mixedBlockerPlan())[0]!
    const reasons = year.retirementActionPublication?.records[0]?.reasons ?? []

    // `ira-b` is short as well as unclassified, and says only that it is
    // unclassified. `ira-a` is the one source proven convertible, so it is the
    // only one whose balance this record answers for.
    expect(reasons.filter((reason) => reason.allocationId === 'alloc-b')
      .map((reason) => reason.code)).toEqual(['conversion-ira-subtype-unknown'])
    expect(reasons.filter((reason) => reason.allocationId === 'alloc-a')
      .map((reason) => reason.code)).toEqual(['conversion-balance-trimmed'])
  })

  it('moves no principal out of either source', () => {
    const plan = mixedBlockerPlan()
    const years = project(plan)
    const year = years[0]!

    expect(year.rothConversionActionExecution?.committed).toBe(false)
    expect(year.balances['ira-a']).toBeCloseTo(SOURCE_BALANCE, 6)
    expect(year.balances['ira-b']).toBeCloseTo(SOURCE_BALANCE, 6)
    expect(year.balances['roth-second']).toBeCloseTo(0, 6)
    expect(year.rothConversion).toBeCloseTo(0, 6)

    const series = validateOwnedNonRothIraRuntimeSourceSeries(
      validatePlan(plan), TAX_YEAR, years,
    )
    if (series.status !== 'ownedNonRothIraRuntimeSourceSeriesComplete') {
      throw new Error(`source series blocked: ${JSON.stringify(series.issues)}`)
    }
    expect(series.years[0]!.namedRothDestinationCredits).toEqual([])
  })
})
