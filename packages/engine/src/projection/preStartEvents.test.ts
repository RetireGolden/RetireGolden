/**
 * Plan events dated before the start year are named, one warning each, and
 * nothing moves (decision D-2027-ROLLOVER, 2026-09-28).
 *
 * The household is shaped on the derivation's U1 and the check's c04
 * isolations (A1 a non-qualified annuity from the brokerage, A2 a qualified
 * one from the 401(k), T1 a bridge TIPS ladder, G1 a one-time goal): a plan
 * saved in 2026 whose 2026 events are in the past once it runs from 2027.
 *
 * Authority: none governs how a planner treats an event whose date has
 * passed. The engine's convention (balances are as of the start year, so an
 * earlier purchase is already paid and an earlier goal or income is outside
 * the projection) is kept, and the test pins that it is now said out loud,
 * with the purchase's premium and funding account named, and that a 2026
 * start (where none of the events is past) says nothing.
 */

import { describe, expect, it } from 'vitest'

import { asAccountId, asActionId, asAllocationId, asPersonId } from '../actions/identity.js'
import { asPositiveUsdCents } from '../actions/money.js'
import type { QualifiedCharitableDistributionRequest } from '../actions/contract.js'
import type { Plan } from '../model/plan.js'
import {
  productionTaxCalculator,
  singlePersonPlan,
  taxableAccount,
  traditionalAccount,
  validatePlan,
} from '../testing/planFixtures.js'
import { preStartEvents } from './preStartEvents.js'
import { simulatePlan } from './simulate.js'

function household(): Plan {
  const plan = singlePersonPlan({ dob: '1961-05-01', planningAge: 90, retirementAge: 65 })
  plan.accounts = [
    { ...taxableAccount('brokerage', 700_000, 500_000), name: 'Joint brokerage' },
    { ...traditionalAccount('k401', 900_000, 'p1', 'employer'), name: '401(k)' },
    {
      type: 'annuity', id: 'nq', name: 'Income annuity', ownerPersonId: 'p1', annualReturnPct: null,
      startAge: 67, monthlyAmount: 550, colaPct: 0, taxablePct: 100,
      purchase: { year: 2026, premium: 100_000, fundingAccountId: 'brokerage', taxQualification: 'nonQualified' },
    },
    {
      type: 'annuity', id: 'q', name: 'Qualified annuity', ownerPersonId: 'p1', annualReturnPct: null,
      startAge: 70, monthlyAmount: 400, colaPct: 0, taxablePct: 100,
      purchase: { year: 2026, premium: 60_000, fundingAccountId: 'k401', taxQualification: 'qualified' },
    },
  ]
  plan.expenses.baseAnnual = 60_000
  plan.expenses.oneTimeGoals = [{ id: 'car', label: 'New car', year: 2026, amount: 30_000 }]
  plan.incomes = [
    { type: 'oneTime', id: 'inh', label: 'Inheritance', year: 2026, amount: 50_000, inflationAdjusted: false, taxTreatment: 'none' },
    { type: 'recurring', id: 'consult', label: 'Consulting', annualAmount: 20_000, startYear: 2024, endYear: 2026, inflationAdjusted: true, taxTreatment: 'ordinary' },
  ]
  plan.incomeFloor = {
    ladders: [
      {
        id: 'bridge', name: 'Bridge', purpose: 'bridge', startYear: 2028, endYear: 2031, annualRealAmount: 30_000,
        purchase: { year: 2026, fundingAccountId: 'brokerage' },
      },
    ],
  }
  plan.strategies.rothConversion = { mode: 'manual', conversions: [{ year: 2026, amount: 20_000 }, { year: 2027, amount: 20_000 }] }
  return validatePlan(plan)
}

describe('events dated before the start year', () => {
  it('lists nothing from a 2026 start, where none is past', () => {
    expect(preStartEvents(household(), 2026)).toEqual([])
  })

  it('names every kind from a 2027 start, in plan order', () => {
    expect(preStartEvents(household(), 2027).map((event) => [event.kind, event.label, event.year])).toEqual([
      ['oneTimeGoal', 'New car', 2026],
      ['oneTimeIncome', 'Inheritance', 2026],
      ['recurringIncomeEnded', 'Consulting', 2026],
      ['annuityPurchase', 'Income annuity', 2026],
      ['annuityPurchase', 'Qualified annuity', 2026],
      ['tipsLadderPurchase', 'Bridge', 2026],
      ['rothConversionScheduled', 'Roth conversion', 2026],
    ])
  })

  it('says what the projection assumed and what to change, with the premium and funding account', () => {
    const warnings = preStartEvents(household(), 2027).map((event) => event.warning)
    expect(warnings).toContain(
      'The New car goal is dated 2026, before this plan starts in 2027, so it is not counted. If it has not happened, move it to 2027 or later.',
    )
    expect(warnings).toContain(
      'The Income annuity purchase is dated 2026, before this plan starts in 2027, so it is treated as already paid: the premium is not taken from Joint brokerage. If that balance still includes the premium, lower it by $100,000.',
    )
    expect(warnings).toContain(
      'The Qualified annuity purchase is dated 2026, before this plan starts in 2027, so it is treated as already paid: the premium is not taken from 401(k). If that balance still includes the premium, lower it by $60,000.',
    )
    // The ladder is priced as the ledger prices a purchase in its own year:
    // quotePlanLadder's real cost, $114,426.17 for this window (review L2).
    expect(warnings).toContain(
      'The Bridge TIPS ladder purchase is dated 2026, before this plan starts in 2027, so it is treated as already paid: its $114,426 cost is not taken from Joint brokerage. If that balance still includes the cost, lower it by $114,426.',
    )
  })

  it('a flexible goal is listed only when its whole window is before the start', () => {
    const plan = household()
    plan.expenses.oneTimeGoals = [
      { id: 'late', label: 'Trip', year: 2026, amount: 5_000, flexibility: 'movable', latestYear: 2028 },
      { id: 'gone', label: 'Roof', year: 2025, amount: 5_000, flexibility: 'movable', latestYear: 2026 },
    ]
    expect(preStartEvents(plan, 2027).filter((event) => event.kind === 'oneTimeGoal').map((event) => event.label)).toEqual(['Roof'])
  })

  it('names named QCDs, Roth conversions and withdrawals by amount, person, account and date, so two are two warnings', () => {
    // Review L3: the warnings named no action, so two QCDs dated 2026 gave one
    // string and the projection's warning set kept one. Each now names its
    // amount (the request is in cents), the person, the source account, its
    // execution date where it has one (else its year: the second
    // verification's V3) and, for a QCD, the charity.
    const plan = household()
    const allocation = (id: string, account: string, cents: number) => ({ allocationId: id, sourceAccountId: account, requestedAmount: cents })
    plan.strategies.retirementActions = [
      { kind: 'qcd', actionId: 'gift', year: 2026, executionDate: '2026-08-01', requestedAmount: 1_000_000, donorPersonId: 'p1', allocation: allocation('a1', 'k401', 1_000_000), charity: { name: 'Food Bank' } },
      { kind: 'qcd', actionId: 'gift-2', year: 2026, requestedAmount: 500_000, donorPersonId: 'p1', allocation: allocation('a2', 'k401', 500_000), charity: { name: 'Library Fund' } },
      { kind: 'rothConversion', actionId: 'conv', year: 2026, requestedAmount: 2_500_000, personId: 'p1', allocations: [allocation('a3', 'k401', 2_500_000)] },
      { kind: 'ordinaryWithdrawal', actionId: 'draw', year: 2026, requestedAmount: 1_200_000, personId: 'p1', allocations: [allocation('a4', 'k401', 700_000), allocation('a5', 'brokerage', 500_000)] },
      { kind: 'qcd', actionId: 'later', year: 2027, requestedAmount: 1_000_000, donorPersonId: 'p1', allocation: allocation('a6', 'k401', 1_000_000), charity: { name: 'Food Bank' } },
    ] as never
    const warnings = preStartEvents(plan, 2027)
      .filter((event) => event.id === 'gift' || event.id === 'gift-2' || event.id === 'conv' || event.id === 'draw' || event.id === 'later')
      .map((event) => event.warning)
    expect(warnings).toEqual([
      'A $10,000 qualified charitable distribution by Pat from 401(k) to Food Bank is dated August 1, 2026, before this plan starts in 2027, so it is not modeled. If the gift has not been made, move it to 2027 or later.',
      'A $5,000 qualified charitable distribution by Pat from 401(k) to Library Fund is dated 2026, before this plan starts in 2027, so it is not modeled. If the gift has not been made, move it to 2027 or later.',
      'A $25,000 Roth conversion for Pat from 401(k) is dated 2026, before this plan starts in 2027, so it is not modeled. If it happened, its dollars are already in the account balances.',
      'A $12,000 withdrawal for Pat from 401(k) and Joint brokerage is dated 2026, before this plan starts in 2027, so it is not modeled. If it happened, the account balances already reflect it.',
    ])
    expect(new Set(warnings).size).toBe(warnings.length)
  })

  function qcd(actionId: string, executionSequence: number): QualifiedCharitableDistributionRequest {
    const amount = asPositiveUsdCents(1_000_000)
    return {
      actionId: asActionId(actionId),
      kind: 'qcd',
      year: 2026,
      executionDate: '2026-08-01',
      executionSequence,
      requestedAmount: amount,
      provenance: { source: 'manual' },
      donorPersonId: asPersonId('p1'),
      allocation: { allocationId: asAllocationId(`${actionId}-allocation`), sourceAccountId: asAccountId('k401'), requestedAmount: amount },
      charity: {
        designationId: 'charity-1',
        name: 'Food Bank',
        designationKind: 'eligiblePublicCharity',
        directFromCustodianAttested: true,
        eligibleOrganizationAttested: true,
        notDonorAdvisedFundOrSupportingOrganizationAttested: true,
        notSplitInterestEntityAttested: true,
        entireDistributionOtherwiseDeductibleAttested: true,
      },
    }
  }

  it('two identical QCDs on the same day are two numbered warnings, in the projection too (V3)', () => {
    // The second verification's V3: two gifts of the same amount, from the
    // same account, to the same charity on the same day read the same, and
    // the ledger's warning set kept one. Each is now numbered.
    const plan = household()
    plan.strategies.retirementActions = [qcd('gift-a', 1), qcd('gift-b', 2)]
    const same =
      'A $10,000 qualified charitable distribution by Pat from 401(k) to Food Bank is dated August 1, 2026, before this plan starts in 2027, ' +
      'so it is not modeled. If the gift has not been made, move it to 2027 or later.'
    const named = preStartEvents(plan, 2027).filter((event) => event.kind === 'namedQcd')
    expect(named.map((event) => [event.id, event.warning])).toEqual([
      ['gift-a', `${same} This is the first of two identical entries.`],
      ['gift-b', `${same} This is the second of two identical entries.`],
    ])
    const from2027 = simulatePlan(validatePlan(plan), { startYear: 2027, taxCalculator: productionTaxCalculator() })
    expect(from2027.warnings.filter((warning) => warning.startsWith(same))).toEqual([
      `${same} This is the first of two identical entries.`,
      `${same} This is the second of two identical entries.`,
    ])
  })

  it('names the year when an action has no valid execution date', () => {
    const plan = household()
    plan.strategies.retirementActions = [
      { ...qcd('undated', 1), executionDate: undefined },
      { ...qcd('bad-date', 2), executionDate: '2026-02-30', requestedAmount: asPositiveUsdCents(500_000) },
    ]
    expect(preStartEvents(plan, 2027).filter((event) => event.kind === 'namedQcd').map((event) => event.warning)).toEqual([
      'A $10,000 qualified charitable distribution by Pat from 401(k) to Food Bank is dated 2026, before this plan starts in 2027, so it is not modeled. If the gift has not been made, move it to 2027 or later.',
      'A $5,000 qualified charitable distribution by Pat from 401(k) to Food Bank is dated 2026, before this plan starts in 2027, so it is not modeled. If the gift has not been made, move it to 2027 or later.',
    ])
  })

  it('names conversion rows in optimized mode as it does in manual mode', () => {
    // Review L10 (E13): the optimizer's schedule behaves exactly like a manual
    // one in the ledger, so its rows dated before the start are named too.
    const plan = household()
    plan.strategies.rothConversion = {
      mode: 'optimized',
      conversions: [{ year: 2026, amount: 15_000 }, { year: 2027, amount: 15_000 }],
    }
    expect(preStartEvents(plan, 2027).filter((event) => event.kind === 'rothConversionScheduled').map((event) => event.warning)).toEqual([
      'A $15,000 Roth conversion is scheduled for 2026, before this plan starts in 2027, so it is not modeled. If it happened, its dollars are already in the account balances.',
    ])
  })

  it('names a Roth window that ended before the start, and not one that is still open', () => {
    // Review L1: a window from 2025 to 2026 converts nothing from a 2027 start.
    const plan = household()
    plan.strategies.rothConversion = { mode: 'fillToTarget', target: 'topOfBracket', targetValue: 22, startYear: 2025, endYear: 2026 }
    expect(preStartEvents(plan, 2027).filter((event) => event.kind === 'rothWindowEnded')).toEqual([
      {
        kind: 'rothWindowEnded',
        id: null,
        label: 'Roth conversion window',
        year: 2026,
        warning:
          'The Roth conversion window runs from 2025 to 2026, ending before this plan starts in 2027, so no conversion is modeled. If conversions are still planned, move the window to 2027 or later.',
      },
    ])
    plan.strategies.rothConversion = { mode: 'fillToTarget', target: 'topOfBracket', targetValue: 22, startYear: 2025, endYear: 2027 }
    expect(preStartEvents(plan, 2027).filter((event) => event.kind === 'rothWindowEnded')).toEqual([])
  })

  it('names a property sale and a debt payoff dated before the start, which the ledger runs in the first year', () => {
    // Review H1 and L4. The sale and the payoff are not already reflected (the
    // property and the balance are still on the plan), so the ledger acts on
    // each in the start year and the warning says so, with the amount paid.
    const plan = household()
    plan.accounts.push(
      {
        type: 'property', id: 'home', name: 'Home', ownerPersonId: null, annualReturnPct: 0,
        value: 420_000, plannedSaleYear: 2026, expectedNetProceeds: null,
      },
      {
        type: 'debt', id: 'mortgage', name: 'Mortgage', ownerPersonId: null, annualReturnPct: null,
        balance: 180_000, interestPct: 6, monthlyPayment: 1_500, payoffYear: 2026,
      },
    )
    expect(preStartEvents(plan, 2026).filter((event) => event.kind === 'propertySale' || event.kind === 'debtPayoff')).toEqual([])
    expect(preStartEvents(plan, 2027).filter((event) => event.kind === 'propertySale' || event.kind === 'debtPayoff')).toEqual([
      {
        kind: 'propertySale',
        id: 'home',
        label: 'Home',
        year: 2026,
        warning:
          'The Home sale is dated 2026, before this plan starts in 2027, so the plan sells it in 2027. If it has already been sold, remove the Home and add the proceeds to an account.',
      },
      {
        kind: 'debtPayoff',
        id: 'mortgage',
        label: 'Mortgage',
        year: 2026,
        warning:
          'The Mortgage payoff is dated 2026, before this plan starts in 2027, so the plan pays it off in 2027: $190,800, its $180,000 balance with a year of interest. If it was paid, set its balance to $0.',
      },
    ])
  })

  it('names a HECM line dated to open before the start, which the ledger opens in the start year', () => {
    const plan = household()
    plan.accounts.push({
      type: 'property', id: 'home', name: 'Home', ownerPersonId: null, annualReturnPct: 0,
      value: 800_000, plannedSaleYear: null, expectedNetProceeds: null, primaryResidence: true,
      hecm: { openYear: 2026, principalLimitPct: 40, growthRatePct: 6, drawPolicy: 'lastResort' },
    } as never)
    expect(preStartEvents(plan, 2026).filter((event) => event.kind === 'hecmLineOpening')).toEqual([])
    expect(preStartEvents(plan, 2027).filter((event) => event.kind === 'hecmLineOpening')).toEqual([
      {
        kind: 'hecmLineOpening',
        id: 'home',
        label: 'Home',
        year: 2026,
        warning:
          'The HECM line of credit on Home is dated to open in 2026, before this plan starts in 2027, so it is modeled as opening in 2027. If the line is already open, its credit and loan balance here start from 2027, not from 2026.',
      },
    ])
    const from2027 = simulatePlan(validatePlan(plan), { startYear: 2027, taxCalculator: productionTaxCalculator() })
    expect(from2027.warnings).toContain(
      'The HECM line of credit on Home is dated to open in 2026, before this plan starts in 2027, so it is modeled as opening in 2027. If the line is already open, its credit and loan balance here start from 2027, not from 2026.',
    )
  })

  it('reaches the projection: every one is a warning of the 2027 run and none of the 2026 run', () => {
    const plan = household()
    const taxCalculator = productionTaxCalculator()
    const from2026 = simulatePlan(plan, { startYear: 2026, taxCalculator })
    const from2027 = simulatePlan(plan, { startYear: 2027, taxCalculator })
    for (const event of preStartEvents(plan, 2027)) {
      expect(from2027.warnings).toContain(event.warning)
      expect(from2026.warnings).not.toContain(event.warning)
    }
  })
})
