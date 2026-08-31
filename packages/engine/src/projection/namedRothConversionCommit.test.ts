import { describe, expect, it } from 'vitest'

import {
  parseRetirementActionRequest,
  planDollarsToFlooredLedgerCents,
  planDollarsToLedgerCents,
} from '../actions/index.js'
import { validateOwnedNonRothIraRuntimeSourceSeries } from '../internal/ownedNonRothIraRuntimeSourceSeries.js'
import type { Account, Plan } from '../model/plan.js'
import {
  singlePersonPlan,
  validatePlan,
} from '../testing/planFixtures.js'
import { createFlatTaxCalculator } from '../testing/flatTax.js'
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
    expect(series.years[0]!.aggregateRothDestinationCredits).toEqual([])
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

  // This once pinned a refusal, and the refusal was right while it stood.
  // Nothing in section 408A conditions a conversion's legality on the owner's
  // basis: 408A(d)(3)(A) treats the conversion as a section 72 distribution
  // and waives the 72(t) additional tax on it, which makes a positive basis
  // numerator a question about how much of the gross is includible and not
  // about whether the movement may occur. What the old reading was protecting
  // was real -- the line-10 ratio's denominator does not exist at that
  // mid-year call site, so committing there meant stating a character the
  // executor could not derive. It is superseded because the executor no longer
  // states one: it commits with a null character and the annual settlement
  // supplies the ratio, feeding it back through the assumption vector until
  // observed equals assumed. Refusing now would suppress a lawful conversion,
  // which is a different plan than the household stated rather than a
  // conservative reading of the one they did.
  it('converts at a nonzero basis numerator instead of refusing', () => {
    const year = project(committedPlan({ nondeductibleBasis: 20_000 }))[0]!

    expect(year.rothConversionActionExecution?.committed).toBe(true)
    expect(conversionEvidence(year)).toMatchObject({
      outcome: 'executed',
      readiness: 'actionable',
      executedAmount: 10_000_00,
      unexecutedAmount: 0,
      // Not zero and not the gross. The executor authorised the movement and
      // said nothing about its character, which is the one honest answer at a
      // call site that cannot see Form 8606 line 6.
      taxableConvertedAmount: null,
      nontaxableConvertedAmount: null,
      reasons: [],
    })
    expect(conversionEvidence(year).reasons.map((reason) => reason.code))
      .not.toContain('conversion-basis-evidence-missing')
    expect(year.balances['ira-a']).toBeCloseTo(90_000, 6)
    expect(year.balances['roth-second']).toBeCloseTo(10_000, 6)
    expect(year.rothConversion).toBeCloseTo(10_000, 6)
    // What the numerator changed is the character, and only the character:
    // a fifth of the pool is basis, so a fifth of the gross is excluded.
    expect(year.magi).toBeCloseTo(8_000, 6)
  })


  // The two below pin the invariant a nonzero-basis conversion will have to
  // rest on. Form 8606 line 8 is a whole-year figure: an allocation across it
  // is only lawful if the entries are every conversion the owner made that
  // year. In this engine two authorities can convert — the aggregate strategy
  // and the exact-cent executor — so the entry set is knowable only because a
  // named request switches the aggregate one off. That suppression is stated
  // in one comment in `simulate.ts` and asserted nowhere, and the whole
  // completeness argument collapses without it.
  it('suppresses the aggregate schedule, leaving the named batch as the whole of line 8', () => {
    const withAggregateOnly = committedPlan()
    withAggregateOnly.strategies.retirementActions = []
    withAggregateOnly.strategies.rothConversion = {
      mode: 'manual',
      conversions: [{ year: TAX_YEAR, amount: 25_000 }],
    }
    // The control: absent the named request this schedule really does convert.
    // Without it the assertion below would pass on a plan that was never going
    // to convert anything anyway.
    expect(project(withAggregateOnly)[0]!.rothConversion).toBeCloseTo(25_000, 6)

    const plan = committedPlan()
    plan.strategies.rothConversion = {
      mode: 'manual',
      conversions: [{ year: TAX_YEAR, amount: 25_000 }],
    }
    const years = project(plan)
    const year = years[0]!

    // 10,000 and not 35,000: the named request is the year's only conversion
    // authority, so no aggregate sweep ran on top of the committed one.
    expect(year.rothConversionActionExecution?.committed).toBe(true)
    expect(year.rothConversion).toBeCloseTo(10_000, 6)
    expect(year.balances['ira-a']).toBeCloseTo(90_000, 6)

    // Said again against the replay's own source of truth: every line-8
    // application for the year, not just the published dollar total. A
    // `legacyRothConversion` entry here would mean the executor's batch was
    // not the complete line-8 set.
    const series = validateOwnedNonRothIraRuntimeSourceSeries(
      validatePlan(plan), TAX_YEAR, years,
    )
    if (series.status !== 'ownedNonRothIraRuntimeSourceSeriesComplete') {
      throw new Error(`source series blocked: ${JSON.stringify(series.issues)}`)
    }
    expect(series.years[0]!.ownerSources[0]!.applications
      .filter((entry) => entry.form8606Line === 'line8')
      .map((entry) => entry.occurrenceKind))
      .toEqual(['namedRothConversion'])
  })

  it('keeps the named batch the whole of line 8 at a nonzero basis numerator too', () => {
    const plan = committedPlan({ nondeductibleBasis: 20_000 })
    plan.strategies.rothConversion = {
      mode: 'manual',
      conversions: [{ year: TAX_YEAR, amount: 25_000 }],
    }
    const years = project(plan)
    const year = years[0]!

    // The completeness argument matters more here than in the zero-basis case,
    // not less. A line-10 ratio is only lawful if line 8 is every conversion
    // the owner made that year; an aggregate sweep landing alongside the
    // committed batch would put the denominator and the entry set out of step.
    expect(year.rothConversionActionExecution?.committed).toBe(true)
    expect(year.rothConversion).toBeCloseTo(10_000, 6)
    expect(year.balances['ira-a']).toBeCloseTo(90_000, 6)
    expect(year.balances['roth-first']).toBeCloseTo(0, 6)
    expect(year.balances['roth-second']).toBeCloseTo(10_000, 6)

    const series = validateOwnedNonRothIraRuntimeSourceSeries(
      validatePlan(plan), TAX_YEAR, years,
    )
    if (series.status !== 'ownedNonRothIraRuntimeSourceSeriesComplete') {
      throw new Error(`source series blocked: ${JSON.stringify(series.issues)}`)
    }
    expect(series.years[0]!.ownerSources[0]!.applications
      .filter((entry) => entry.form8606Line === 'line8')
      .map((entry) => entry.occurrenceKind))
      .toEqual(['namedRothConversion'])
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

/**
 * A conversion sized against everything its source holds.
 *
 * A Plan balance is a float, and a float dollar balance almost never lands on
 * a whole cent. The snapshot handed to the executor used to round that balance
 * half-up, so it could report up to half a cent more than the account held --
 * and the commit subtracts the executor's exact cents from the live float, so
 * a request sized against the reported figure drove the balance below zero.
 * Permanently: nothing downstream rebuilds a balance, so the negative cent
 * survived every remaining year and refused the owned-IRA source series with
 * it, silently rolling back the annual exact-basis settlement.
 *
 * The snapshot is truncated now. A source can only ever be asked for cents it
 * actually holds, and the commit site asserts that rather than assuming it.
 */
describe('a named conversion that drains its source', () => {
  /**
   * 1,234,567.8901234 cents. Half-up reports 1,234,568 -- one more cent than
   * the account can fund -- and truncation reports 1,234,567, which is exactly
   * what it can.
   */
  const IRA_DOLLARS = 12_345.678901234
  const FUNDABLE_CENTS = 1_234_567
  const OVERSTATED_CENTS = 1_234_568

  function drainingPlan(requestedAmount: number): Plan {
    const plan = committedPlan()
    plan.id = 'named-conversion-drain'
    plan.accounts = [
      cash('cash-a', 1_000_000),
      traditionalIra('ira-a', IRA_DOLLARS),
      rothIra('roth-first'),
      rothIra('roth-second'),
    ]
    const parsed = parseRetirementActionRequest({
      actionId: 'named-conversion',
      kind: 'rothConversion',
      personId: 'p1',
      year: TAX_YEAR,
      executionDate: '2026-06-15',
      executionSequence: 1,
      requestedAmount,
      allocations: [{
        allocationId: 'named-conversion-allocation',
        sourceAccountId: 'ira-a',
        requestedAmount,
      }],
      destinationRothAccountId: 'roth-second',
      taxFunding: { kind: 'noneExpected' },
      provenance: { source: 'manual' },
    })
    if (!parsed.ok) throw new Error(parsed.issues.join('; '))
    plan.strategies.retirementActions = [parsed.request]
    return plan
  }

  function projectTwoYears(plan: Plan): YearResult[] {
    return simulatePlan(validatePlan(plan), {
      startYear: TAX_YEAR,
      horizonEndYear: TAX_YEAR + 1,
      taxCalculator: createFlatTaxCalculator(0),
    }).years
  }

  it('converts every whole cent the source can fund and never one it cannot', () => {
    const plan = drainingPlan(FUNDABLE_CENTS)
    const years = projectTwoYears(plan)

    expect(years[0]!.rothConversionActionExecution?.committed).toBe(true)
    expect(conversionEvidence(years[0]!)).toMatchObject({
      outcome: 'executed',
      executedAmount: FUNDABLE_CENTS,
      unexecutedAmount: 0,
    })
    expect(years[0]!.balances['roth-second']).toBeCloseTo(12_345.67, 6)

    // The bound is one-sided and tight. What is left is the sub-cent residue
    // the exact-cent ledger has no way to express, which was in the account
    // before the conversion and stays in it after.
    for (const year of years) {
      expect(year.balances['ira-a']).toBeGreaterThanOrEqual(0)
      expect(year.balances['ira-a']).toBeLessThan(0.01)
    }
    expect(years[1]!.balances['ira-a']).toBe(years[0]!.balances['ira-a'])
  })

  it('closes the source series over both the drain and the residue it leaves', () => {
    // Two years, because the overdraw was permanent and the residue is not.
    // The first year is the movement; the second is the year the residue has
    // to be inert in, which it is only because a forced distribution too small
    // to move is discharged rather than journalled.
    const plan = drainingPlan(FUNDABLE_CENTS)
    const series = validateOwnedNonRothIraRuntimeSourceSeries(
      validatePlan(plan), TAX_YEAR, projectTwoYears(plan),
    )

    if (series.status !== 'ownedNonRothIraRuntimeSourceSeriesComplete') {
      throw new Error(`source series blocked: ${JSON.stringify(series.issues)}`)
    }
    expect(series.years.map((year) => year.taxYear)).toEqual([TAX_YEAR, TAX_YEAR + 1])
    expect(series.years[0]!.ownerSources[0]!.applications.map((entry) => entry.amount))
      .toEqual([FUNDABLE_CENTS])
    expect(series.years[1]!.ownerSources[0]!.applications).toEqual([])
  })

  it('hands the executor the cents the source can fund, not the cent it cannot', () => {
    // The snapshot itself, which is where the overdraw was decided. Half-up
    // reported OVERSTATED_CENTS here, and the executor admits an allocation
    // whenever the reported opening covers it -- so the extra cent was
    // authorised, moved, and only then found to be absent. The published
    // opening is the fundable figure, and the destination's is unchanged,
    // because nothing is ever drawn against a destination.
    const year = projectTwoYears(drainingPlan(FUNDABLE_CENTS))[0]!

    // The fixture's own premise, checked rather than asserted in a comment:
    // this balance is one the two roundings disagree about.
    expect(planDollarsToFlooredLedgerCents(IRA_DOLLARS)).toBe(FUNDABLE_CENTS)
    expect(planDollarsToLedgerCents(IRA_DOLLARS)).toBe(OVERSTATED_CENTS)
    expect(year.rothConversionActionExecution?.balances).toEqual([
      expect.objectContaining({
        accountId: 'ira-a',
        openingBalance: FUNDABLE_CENTS,
        closingBalance: 0,
      }),
      expect.objectContaining({
        accountId: 'roth-second',
        openingBalance: 0,
        closingBalance: FUNDABLE_CENTS,
      }),
    ])
  })
})
