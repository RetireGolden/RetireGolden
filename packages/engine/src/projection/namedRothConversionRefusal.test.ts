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
