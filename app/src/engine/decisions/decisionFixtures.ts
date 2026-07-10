/**
 * Named fixture plans for the ledger-native decision engine test suite
 * (enhancement doc "Testing Strategy"). Test-only helper — not exported from
 * the module index, so it never reaches the app bundle.
 *
 * Fixtures deliberately use flat inflation/returns so tests can reason about
 * bracket, taxability, and basis effects without market noise.
 */

import { createEmptyPlan, parsePlan, type Plan } from '../model/plan'
import { createFederalTaxCalculator } from '../tax/federalTax'
import type { SimulateOptions } from '../projection/simulate'

let counter = 0
export const testIds = () => `dec-${++counter}`
export const fixedNow = () => new Date('2026-06-11T00:00:00.000Z')

export function validate(plan: Plan): Plan {
  const parsed = parsePlan(plan)
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  return parsed.plan
}

export function simOptions(): SimulateOptions {
  return { startYear: 2026, taxCalculator: createFederalTaxCalculator() }
}

function base(personOverrides: Partial<Plan['household']['people'][number]> = {}): Plan {
  const plan = createEmptyPlan({ newId: testIds, now: fixedNow })
  plan.household.people[0] = {
    id: 'p1',
    name: 'Pat',
    dob: '1958-06-15', // 68 in 2026; RMDs from 73
    sex: 'average',
    retirementAge: 65,
    longevity: { planningAge: 85, source: 'manual' },
    ...personOverrides,
  }
  plan.assumptions.inflationPct = 0
  plan.assumptions.healthcareExtraInflationPct = 0
  plan.assumptions.defaultReturnPct = 0
  plan.assumptions.stateEffectiveTaxPct = 0
  plan.assumptions.heirTaxRatePct = 25
  plan.expenses.baseAnnual = 0
  plan.expenses.healthcare = { pre65MonthlyPremiumPerPerson: 0, applyAcaCredit: false, medicareExtrasMonthlyPerPerson: 0 }
  return plan
}

/** Mostly traditional with a cash/taxable bridge: ripe for bracket-fill conversions. */
export function tradHeavyPlan(): Plan {
  const plan = base()
  plan.assumptions.defaultReturnPct = 4
  plan.expenses.baseAnnual = 45_000
  plan.accounts = [
    { type: 'traditional', id: testIds(), name: '401k', ownerPersonId: 'p1', annualReturnPct: null, kind: 'ira', balance: 800_000, annualContribution: 0 },
    { type: 'roth', id: testIds(), name: 'Roth', ownerPersonId: 'p1', annualReturnPct: null, kind: 'ira', balance: 0, annualContribution: 0 },
    { type: 'taxable', id: testIds(), name: 'Brokerage', ownerPersonId: null, annualReturnPct: null, balance: 150_000, costBasis: 150_000, annualContribution: 0 },
    { type: 'cash', id: testIds(), name: 'Cash', ownerPersonId: null, annualReturnPct: null, balance: 60_000, annualContribution: 0 },
  ]
  return validate(plan)
}

/** No traditional at all — every conversion candidate should execute $0 and stay non-beneficial. */
export function noTraditionalPlan(): Plan {
  const plan = base()
  plan.expenses.baseAnnual = 30_000
  plan.accounts = [
    { type: 'roth', id: testIds(), name: 'Roth', ownerPersonId: 'p1', annualReturnPct: 0, kind: 'ira', balance: 250_000, annualContribution: 0 },
    { type: 'taxable', id: testIds(), name: 'Brokerage', ownerPersonId: null, annualReturnPct: 0, balance: 400_000, costBasis: 400_000, annualContribution: 0 },
    { type: 'cash', id: testIds(), name: 'Cash', ownerPersonId: null, annualReturnPct: 0, balance: 50_000, annualContribution: 0 },
  ]
  return validate(plan)
}

/** Inherited-only traditional: distributable under the 10-year rule but never convertible. */
export function inheritedOnlyPlan(): Plan {
  const plan = base({ dob: '1960-01-01', longevity: { planningAge: 70, source: 'manual' } })
  plan.accounts = [
    {
      type: 'traditional',
      id: testIds(),
      name: 'Inherited IRA',
      ownerPersonId: 'p1',
      annualReturnPct: 0,
      kind: 'ira',
      balance: 300_000,
      annualContribution: 0,
      inherited: { ownerDeathYear: 2024, decedentHadStartedRmds: false },
    },
    { type: 'roth', id: testIds(), name: 'Roth', ownerPersonId: 'p1', annualReturnPct: 0, kind: 'ira', balance: 0, annualContribution: 0 },
    { type: 'cash', id: testIds(), name: 'Cash', ownerPersonId: null, annualReturnPct: 0, balance: 40_000, annualContribution: 0 },
  ]
  return validate(plan)
}

/** Own plus inherited traditional: only the own balance is convertible. */
export function mixedTraditionalPlan(): Plan {
  const plan = inheritedOnlyPlan()
  return validate({
    ...plan,
    accounts: [
      { type: 'traditional', id: testIds(), name: 'Own IRA', ownerPersonId: 'p1', annualReturnPct: 0, kind: 'ira', balance: 200_000, annualContribution: 0 },
      ...plan.accounts,
    ],
  })
}

/** Late-career accumulator with scheduled contributions and an employer match. */
export function accumulatorPlan(): Plan {
  const plan = base({ dob: '1971-01-01', retirementAge: 62, longevity: { planningAge: 80, source: 'manual' } })
  plan.expenses.baseAnnual = 50_000
  plan.accounts = [
    {
      type: 'traditional',
      id: testIds(),
      name: '401k',
      ownerPersonId: 'p1',
      annualReturnPct: 0,
      kind: 'employer',
      balance: 100_000,
      annualContribution: 20_000,
      employerMatch: { matchPct: 50, capPctOfPay: 6 },
    },
    { type: 'roth', id: testIds(), name: 'Roth', ownerPersonId: 'p1', annualReturnPct: 0, kind: 'ira', balance: 0, annualContribution: 0 },
    { type: 'cash', id: testIds(), name: 'Cash', ownerPersonId: null, annualReturnPct: 0, balance: 50_000, annualContribution: 0 },
  ]
  plan.incomes = [
    { type: 'wages', id: testIds(), personId: 'p1', annualGross: 150_000, endAge: null, realGrowthPct: 0 },
    { type: 'socialSecurity', id: testIds(), personId: 'p1', piaMonthly: 2_500, earnings: null, claimAge: { years: 67, months: 0 } },
  ]
  return validate(plan)
}

/**
 * Early retiree bridging on a taxable brokerage: spending is funded by selling
 * shares, so candidate evaluation must price the realized gains implied by the
 * account's basis ratio.
 */
export function taxableBridgePlan(basis: 'high' | 'low'): Plan {
  const plan = base({ dob: '1966-01-01', retirementAge: 60, longevity: { planningAge: 80, source: 'manual' } })
  plan.expenses.baseAnnual = 60_000
  plan.accounts = [
    { type: 'traditional', id: testIds(), name: 'IRA', ownerPersonId: 'p1', annualReturnPct: 0, kind: 'ira', balance: 400_000, annualContribution: 0 },
    { type: 'roth', id: testIds(), name: 'Roth', ownerPersonId: 'p1', annualReturnPct: 0, kind: 'ira', balance: 0, annualContribution: 0 },
    {
      type: 'taxable',
      id: testIds(),
      name: 'Brokerage',
      ownerPersonId: null,
      annualReturnPct: 0,
      balance: 600_000,
      costBasis: basis === 'high' ? 580_000 : 120_000,
      annualContribution: 0,
    },
    { type: 'cash', id: testIds(), name: 'Cash', ownerPersonId: null, annualReturnPct: 0, balance: 5_000, annualContribution: 0 },
  ]
  plan.incomes = [
    { type: 'socialSecurity', id: testIds(), personId: 'p1', piaMonthly: 2_800, earnings: null, claimAge: { years: 70, months: 0 } },
  ]
  return validate(plan)
}

/**
 * Social Security taxability edge: SS starts mid-horizon (claim at 70), so an
 * identical conversion is priced differently before vs during benefit years —
 * the provisional-income feedback only the exact ledger knows.
 */
export function ssTaxabilityPlan(): Plan {
  const plan = base({ dob: '1964-01-01', retirementAge: 62, longevity: { planningAge: 85, source: 'manual' } })
  plan.expenses.baseAnnual = 30_000
  plan.accounts = [
    { type: 'traditional', id: testIds(), name: 'IRA', ownerPersonId: 'p1', annualReturnPct: 0, kind: 'ira', balance: 400_000, annualContribution: 0 },
    { type: 'roth', id: testIds(), name: 'Roth', ownerPersonId: 'p1', annualReturnPct: 0, kind: 'ira', balance: 0, annualContribution: 0 },
    { type: 'cash', id: testIds(), name: 'Cash', ownerPersonId: null, annualReturnPct: 0, balance: 500_000, annualContribution: 0 },
  ]
  plan.incomes = [
    { type: 'socialSecurity', id: testIds(), personId: 'p1', piaMonthly: 3_000, earnings: null, claimAge: { years: 70, months: 0 } },
  ]
  return validate(plan)
}

/** Lumpy one-time ordinary income in 2028 that stacks under any conversion that year. */
export function oneTimeIncomePlan(): Plan {
  const plan = base({ dob: '1960-01-01', longevity: { planningAge: 72, source: 'manual' } })
  plan.accounts = [
    { type: 'traditional', id: testIds(), name: 'IRA', ownerPersonId: 'p1', annualReturnPct: 0, kind: 'ira', balance: 300_000, annualContribution: 0 },
    { type: 'roth', id: testIds(), name: 'Roth', ownerPersonId: 'p1', annualReturnPct: 0, kind: 'ira', balance: 0, annualContribution: 0 },
    { type: 'cash', id: testIds(), name: 'Cash', ownerPersonId: null, annualReturnPct: 0, balance: 250_000, annualContribution: 0 },
  ]
  plan.incomes = [
    { type: 'oneTime', id: testIds(), label: 'Deferred comp payout', year: 2028, amount: 80_000, taxTreatment: 'ordinary' },
  ]
  return validate(plan)
}

/**
 * Asset-location fixture (asset-allocation-and-return-model-v2, step 5): a
 * bond-heavy allocated brokerage next to a stock-heavy-capable traditional and
 * Roth, where *where* classes are held changes the after-tax estate — bonds
 * throw ordinary interest in taxable and inflate the heir-taxed traditional
 * balance when they grow there instead.
 */
export function assetLocationPlan(): Plan {
  const plan = base({ dob: '1961-06-15', longevity: { planningAge: 90, source: 'manual' } })
  plan.expenses.baseAnnual = 40_000
  const weights5050 = { usStocks: 50, intlStocks: 0, bonds: 50, cash: 0 }
  plan.accounts = [
    {
      type: 'taxable',
      id: testIds(),
      name: 'Brokerage',
      ownerPersonId: null,
      annualReturnPct: null,
      balance: 500_000,
      costBasis: 350_000,
      annualContribution: 0,
      allocation: { mode: 'static', rebalancing: 'annual', weights: weights5050 },
    },
    {
      type: 'traditional',
      id: testIds(),
      name: 'IRA',
      ownerPersonId: 'p1',
      annualReturnPct: null,
      kind: 'ira',
      balance: 500_000,
      annualContribution: 0,
      allocation: { mode: 'static', rebalancing: 'annual', weights: weights5050 },
    },
    {
      type: 'roth',
      id: testIds(),
      name: 'Roth',
      ownerPersonId: 'p1',
      annualReturnPct: null,
      kind: 'ira',
      balance: 200_000,
      annualContribution: 0,
      allocation: { mode: 'static', rebalancing: 'annual', weights: weights5050 },
    },
    { type: 'cash', id: testIds(), name: 'Cash', ownerPersonId: null, annualReturnPct: 0, balance: 60_000, annualContribution: 0 },
  ]
  plan.incomes = [
    { type: 'socialSecurity', id: testIds(), personId: 'p1', piaMonthly: 2_400, earnings: null, claimAge: { years: 67, months: 0 } },
  ]
  return validate(plan)
}

/** Married couple where the second spouse's earlier planning age creates survivor years. */
export function survivorPlan(): Plan {
  const plan = base({ dob: '1960-01-01', longevity: { planningAge: 90, source: 'manual' } })
  plan.household.filingStatus = 'marriedFilingJointly'
  plan.household.people.push({
    id: 'p2',
    name: 'Sam',
    dob: '1958-01-01',
    sex: 'average',
    retirementAge: 65,
    longevity: { planningAge: 78, source: 'manual' },
  })
  plan.expenses.baseAnnual = 40_000
  plan.accounts = [
    { type: 'traditional', id: testIds(), name: 'IRA', ownerPersonId: 'p1', annualReturnPct: 0, kind: 'ira', balance: 600_000, annualContribution: 0 },
    { type: 'roth', id: testIds(), name: 'Roth', ownerPersonId: 'p1', annualReturnPct: 0, kind: 'ira', balance: 0, annualContribution: 0 },
    { type: 'cash', id: testIds(), name: 'Cash', ownerPersonId: null, annualReturnPct: 0, balance: 700_000, annualContribution: 0 },
  ]
  return validate(plan)
}
