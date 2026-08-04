import { describe, expect, it } from 'vitest'

import { parseRetirementActionRequest } from '../actions/index.js'
import { validateOwnedNonRothIraRuntimeSourceSeries } from '../internal/ownedNonRothIraRuntimeSourceSeries.js'
import type { Account, Plan } from '../model/plan.js'
import {
  singlePersonPlan,
  validatePlan,
} from '../testing/planFixtures.js'
import { createFlatTaxCalculator } from './flatTax.js'
import { simulatePlan } from './simulate.js'
import type { YearResult } from './types.js'

const TAX_YEAR = 2026
const FLAT_RATE_PCT = 22

function traditionalIra(
  id: string,
  balance: number,
  nondeductibleBasis?: number,
): Account {
  return {
    type: 'traditional',
    id,
    name: id,
    ownerPersonId: 'p1',
    annualReturnPct: 0,
    kind: 'ira',
    balance,
    annualContribution: 0,
    ...(nondeductibleBasis === undefined ? {} : { nondeductibleBasis }),
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
 * One owner, no RMD age, one traditional IRA and two Roth IRAs -- and the
 * request names the SECOND Roth. `plan.accounts` order is the whole point of
 * the fixture: the aggregate conversion path credits
 * `plan.accounts.find((account) => account.type === 'roth')`, so a destination
 * that is deliberately not first is what separates a real per-request credit
 * from one that merely looks like it.
 *
 * Cash is generous so the year's tax is paid without selling anything else; a
 * traditional sale to fund the bill would add ordinary income of its own and
 * make the tax delta below inexact for a reason that has nothing to do with
 * the conversion.
 */
function committedPlan(options: {
  nondeductibleBasis?: number
  destination?: string
  reversedAccounts?: boolean
} = {}): Plan {
  const plan = singlePersonPlan({ planningAge: 60, dob: '1970-01-01' })
  plan.id = 'named-conversion-commit'
  const accounts = [
    cash('cash-a', 1_000_000),
    traditionalIra('ira-a', 100_000, options.nondeductibleBasis),
    rothIra('roth-first'),
    rothIra('roth-second'),
  ]
  plan.accounts = options.reversedAccounts ? [...accounts].reverse() : accounts
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
  plan.strategies.retirementActions = [conversionRequest(
    options.destination ?? 'roth-second',
  )]
  return plan
}

function conversionRequest(destinationRothAccountId: string) {
  const parsed = parseRetirementActionRequest({
    actionId: 'named-conversion',
    kind: 'rothConversion',
    personId: 'p1',
    year: TAX_YEAR,
    executionDate: '2026-06-15',
    executionSequence: 1,
    requestedAmount: 10_000_00,
    allocations: [{
      allocationId: 'named-conversion-allocation',
      sourceAccountId: 'ira-a',
      requestedAmount: 10_000_00,
    }],
    destinationRothAccountId,
    taxFunding: { kind: 'noneExpected' },
    provenance: { source: 'manual' },
  })
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  return parsed.request
}

function project(plan: Plan, ratePct = 0): YearResult[] {
  return simulatePlan(validatePlan(plan), {
    startYear: TAX_YEAR,
    horizonEndYear: TAX_YEAR,
    taxCalculator: createFlatTaxCalculator(ratePct),
  }).years
}

function conversionEvidence(year: Readonly<YearResult>) {
  const evidence = year.rothConversionActionExecution?.evidence ?? []
  if (evidence.length !== 1) throw new Error('fixture drift: expected one conversion record')
  return evidence[0]!
}

describe('committed named Roth conversion', () => {
  it('credits the Roth its own request named, not the first one in Plan order', () => {
    const year = project(committedPlan())[0]!

    expect(year.rothConversionActionExecution?.committed).toBe(true)
    expect(conversionEvidence(year)).toMatchObject({
      outcome: 'executed',
      readiness: 'actionable',
      executedAmount: 10_000_00,
      unexecutedAmount: 0,
      taxableConvertedAmount: 10_000_00,
      nontaxableConvertedAmount: 0,
      destinationRothAccountId: 'roth-second',
      executedDate: '2026-06-15',
      reasons: [],
    })
    // The dollars landed in the named account and the first Roth never moved.
    // Under the aggregate credit these two expectations are unsatisfiable
    // together: it can only credit `roth-first`.
    expect(year.balances['roth-second']).toBeCloseTo(10_000, 6)
    expect(year.balances['roth-first']).toBeCloseTo(0, 6)
    expect(year.balances['ira-a']).toBeCloseTo(90_000, 6)
    expect(year.rothConversion).toBeCloseTo(10_000, 6)
  })

  it('binds the source-series credit to the named destination rather than Plan order', () => {
    const plan = committedPlan()
    const years = project(plan)
    const series = validateOwnedNonRothIraRuntimeSourceSeries(
      validatePlan(plan), TAX_YEAR, years,
    )

    if (series.status !== 'ownedNonRothIraRuntimeSourceSeriesComplete') {
      throw new Error(`source series blocked: ${JSON.stringify(series.issues)}`)
    }
    expect(series.years[0]!.aggregateRothDestinationCredit).toBeNull()
    expect(series.years[0]!.namedRothDestinationCredits).toEqual([
      expect.objectContaining({
        status: 'namedDestinationCreditActionReconciled',
        destinationAttribution: 'namedRequestDestination',
        actionId: 'named-conversion',
        destinationRothAccountId: 'roth-second',
        destinationCreditedAmount: 10_000_00,
      }),
    ])
    // The Form 8606 line the replay will read for this movement.
    const applications = series.years[0]!.ownerSources[0]!.applications
    expect(applications.filter((entry) =>
      entry.occurrenceKind === 'namedRothConversion')).toEqual([
      expect.objectContaining({
        simulatorPhase: 'namedRothConversionDebit',
        form8606Line: 'line8',
        sourceAccountId: 'ira-a',
        amount: 10_000_00,
      }),
    ])
  })

  it('converts the same dollars to the same destination when Plan account order is reversed', () => {
    const forward = project(committedPlan(), FLAT_RATE_PCT)[0]!
    const reversed = project(
      committedPlan({ reversedAccounts: true }), FLAT_RATE_PCT,
    )[0]!

    expect(conversionEvidence(reversed).executedAmount)
      .toBe(conversionEvidence(forward).executedAmount)
    expect(conversionEvidence(reversed).destinationRothAccountId)
      .toBe(conversionEvidence(forward).destinationRothAccountId)
    expect(conversionEvidence(reversed).taxableConvertedAmount)
      .toBe(conversionEvidence(forward).taxableConvertedAmount)
    expect(conversionEvidence(reversed).nontaxableConvertedAmount)
      .toBe(conversionEvidence(forward).nontaxableConvertedAmount)
    expect(reversed.balances).toEqual(forward.balances)
    expect(reversed.tax).toBeCloseTo(forward.tax, 6)
  })

  it('raises the year federal tax by exactly the tax on the executed amount', () => {
    const withConversion = project(committedPlan(), FLAT_RATE_PCT)[0]!
    const withoutAction = committedPlan()
    withoutAction.strategies.retirementActions = []
    const baseline = project(withoutAction, FLAT_RATE_PCT)[0]!

    // Balances move whether or not the executed amount reaches the tax fixed
    // point, so this is the assertion that separates the two.
    expect(withConversion.tax - baseline.tax)
      .toBeCloseTo(10_000 * (FLAT_RATE_PCT / 100), 6)
  })

  it('refuses rather than converting when the owner basis numerator is not zero', () => {
    const year = project(committedPlan({ nondeductibleBasis: 20_000 }))[0]!

    expect(year.rothConversionActionExecution?.committed).toBe(false)
    expect(conversionEvidence(year)).toMatchObject({
      outcome: 'unsupported',
      readiness: 'nonActionable',
      executedAmount: 0,
    })
    expect(conversionEvidence(year).reasons.map((reason) => reason.code))
      .toContain('conversion-basis-evidence-missing')
    // No approximation, no partial conversion at an assumed character.
    expect(year.balances['ira-a']).toBeCloseTo(100_000, 6)
    expect(year.balances['roth-second']).toBeCloseTo(0, 6)
    expect(year.rothConversion).toBeCloseTo(0, 6)
  })

  it('starts the 408A(d)(3)(F) clock with the whole gross exposed', () => {
    const plan = committedPlan()
    // Leave the Roth as the only place next year's spending can come from, so
    // the 1,500 shortfall is drawn straight out of the conversion layer while
    // its five-year window is open and the owner is under 59.5.
    plan.accounts = [
      cash('cash-a', 500),
      traditionalIra('ira-a', 10_000),
      rothIra('roth-first'),
      rothIra('roth-second'),
    ]
    plan.expenses.baseAnnual = 0
    plan.expenses.oneTimeGoals = [{
      id: 'spend-2027',
      label: 'spend-2027',
      year: TAX_YEAR + 1,
      amount: 2_000,
    }]
    const years = simulatePlan(validatePlan(plan), {
      startYear: TAX_YEAR,
      horizonEndYear: TAX_YEAR + 1,
      taxCalculator: createFlatTaxCalculator(0),
    }).years

    expect(years[0]!.balances['roth-second']).toBeCloseTo(10_000, 6)
    // (F)(ii) limits the recapture to the portion that was includible. At a
    // zero basis numerator that is the whole layer, so every dollar drawn
    // carries the 10 percent -- including the dollars drawn to pay it, which
    // is why the 1,500 net need grosses up to 1,500/0.9. A layer recorded with
    // a zero taxable amount would recapture nothing here.
    expect(years[1]!.penalties).toBeCloseTo(150 / 0.9, 2)
  })
})
