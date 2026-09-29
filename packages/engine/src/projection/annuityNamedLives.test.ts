/**
 * Fixture for irc-72-c-3-A-annuity-measured-on-named-lives: a contract is paid
 * on the lives it names. The household lists Alex first; the life-only annuity
 * names Sam, who is younger and dies first. Read on the named annuitant it pays
 * from Sam's 66th year to Sam's death; read on the person listed first (the
 * rule before plan schema v7) it would start on Alex's 66th year and run to
 * Alex's death.
 */
import { expect, it } from 'vitest'

import { createEmptyPlan, parsePlan, type Plan } from '../model/plan.js'
import { describeRule } from '../rules/describeRule.js'
import { createFlatTaxCalculator } from '../testing/flatTax.js'
import { simulatePlan } from './simulate.js'

const ALEX_BIRTH = 1962
const SAM_BIRTH = 1964
const START_AGE = 66
const ALEX_PLANNING_AGE = 92
const SAM_PLANNING_AGE = 70

function household(annuitant: 'alex' | 'sam', people: 'alexFirst' | 'samFirst' = 'alexFirst'): Plan {
  const plan = createEmptyPlan({ newId: () => 'named-lives', now: () => new Date('2026-06-29T12:00:00.000Z') })
  plan.household.filingStatus = 'marriedFilingJointly'
  const alex = { id: 'alex', name: 'Alex', dob: `${ALEX_BIRTH}-04-15`, sex: 'male' as const, retirementAge: 66, longevity: { planningAge: ALEX_PLANNING_AGE, source: 'manual' as const } }
  const sam = { id: 'sam', name: 'Sam', dob: `${SAM_BIRTH}-09-02`, sex: 'female' as const, retirementAge: 64, longevity: { planningAge: SAM_PLANNING_AGE, source: 'manual' as const } }
  plan.household.people = people === 'alexFirst' ? [alex, sam] : [sam, alex]
  plan.assumptions.inflationPct = 0
  plan.assumptions.defaultReturnPct = 0
  plan.expenses.baseAnnual = 30_000
  plan.expenses.healthcare = { pre65MonthlyPremiumPerPerson: 0, applyAcaCredit: false, medicareExtrasMonthlyPerPerson: 0 }
  plan.accounts = [
    { type: 'cash', id: 'cash', name: 'Cash', ownerPersonId: null, annualReturnPct: 0, balance: 3_000_000, annualContribution: 0 },
    { type: 'annuity', id: 'spia', name: 'Life annuity', ownerPersonId: annuitant, annualReturnPct: null, startAge: START_AGE, monthlyAmount: 1_000, colaPct: 0, taxablePct: 100, payoutForm: { kind: 'lifeOnly' } },
  ]
  const parsed = parsePlan(plan)
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  return parsed.plan
}

function payingYears(plan: Plan): { first: number; last: number } {
  const paying = simulatePlan(plan, { startYear: 2026, taxCalculator: createFlatTaxCalculator(0) })
    .years.filter((y) => y.incomes.annuity > 0).map((y) => y.year)
  return { first: Math.min(...paying), last: Math.max(...paying) }
}

describeRule('irc-72-c-3-A-annuity-measured-on-named-lives', {
  readings: {
    // The contract names Sam: it starts on Sam's age and ends at Sam's death.
    paidOnTheNamedAnnuitant: { first: SAM_BIRTH + START_AGE, last: SAM_BIRTH + SAM_PLANNING_AGE },
    // The rule before schema v7 for a contract with no owner: whoever is listed first.
    paidOnThePersonListedFirst: { first: ALEX_BIRTH + START_AGE, last: ALEX_BIRTH + ALEX_PLANNING_AGE },
  },
  accepted: 'paidOnTheNamedAnnuitant',
  note: 'whose age and life the payments follow',
}, ({ accepted, readings }) => {
  it('pays Sam’s annuity from 2030 through 2034, on Sam’s age and life', () => {
    expect(payingYears(household('sam'))).toEqual(accepted)
    expect(accepted).toEqual({ first: 2030, last: 2034 })
    expect(payingYears(household('sam'))).not.toEqual(readings.paidOnThePersonListedFirst)
  })

  it('pays the same years with the people listed the other way round', () => {
    expect(payingYears(household('sam', 'samFirst'))).toEqual(accepted)
  })

  it('moves with the name on the contract, not with the list', () => {
    // Naming Alex instead is the other contract, and it is paid on Alex.
    expect(payingYears(household('alex'))).toEqual(readings.paidOnThePersonListedFirst)
    expect(payingYears(household('alex', 'samFirst'))).toEqual(readings.paidOnThePersonListedFirst)
  })
})

// A surviving spouse stands in the dead owner's place (independent review M2):
// a distribution paid to the spouse is treated "as if the spouse were the
// employee" (IRC 402(c)(9)), and a spouse's IRA is not "inherited" (IRC
// 408(d)(3)(C)(ii)(II)). Alex's planning age 68 ends in 2030; in 2032 Sam, alive,
// buys a qualified annuity from what was Alex's 401(k), paying $1,500 a month
// from Sam's 70th year, 2034.
function survivorPurchase(annuitant: 'alex' | 'sam') {
  const plan = createEmptyPlan({ newId: () => 'surviving-spouse', now: () => new Date('2026-06-29T12:00:00.000Z') })
  plan.household.filingStatus = 'marriedFilingJointly'
  plan.household.people = [
    { id: 'alex', name: 'Alex', dob: '1962-04-15', sex: 'male', retirementAge: 66, longevity: { planningAge: 68, source: 'manual' } },
    { id: 'sam', name: 'Sam', dob: '1964-09-02', sex: 'female', retirementAge: 64, longevity: { planningAge: 95, source: 'manual' } },
  ]
  plan.assumptions.inflationPct = 0
  plan.assumptions.defaultReturnPct = 0
  plan.expenses.baseAnnual = 30_000
  plan.expenses.healthcare = { pre65MonthlyPremiumPerPerson: 0, applyAcaCredit: false, medicareExtrasMonthlyPerPerson: 0 }
  plan.accounts = [
    { type: 'cash', id: 'cash', name: 'Cash', ownerPersonId: null, annualReturnPct: 0, balance: 2_000_000, annualContribution: 0 },
    { type: 'traditional', id: 'alex-401k', name: 'Alex 401(k)', ownerPersonId: 'alex', annualReturnPct: 0, kind: 'employer', balance: 400_000, annualContribution: 0 },
    { type: 'annuity', id: 'after', name: 'Annuity', ownerPersonId: annuitant, annualReturnPct: null, startAge: 70, monthlyAmount: 1_500, colaPct: 0, taxablePct: 100,
      purchase: { year: 2032, premium: 120_000, fundingAccountId: 'alex-401k', taxQualification: 'qualified' } },
  ]
  return parsePlan(plan)
}

describeRule('irc-72-c-3-A-annuity-measured-on-named-lives', {
  readings: {
    // The spouse, alive in 2032, buys from the dead owner's account and is paid.
    survivingSpouseMayBuy: { parses: true, annuityIncome2034: 18_000 },
    // Only the account's (dead) owner may be named: the contract pays nothing.
    onlyTheDeadOwner: { parses: false, annuityIncome2034: 0 },
  },
  accepted: 'survivingSpouseMayBuy',
  note: "a surviving spouse buys from the decedent's account",
}, ({ accepted, readings }) => {
  it("accepts Sam's purchase from Alex's 401(k) after Alex's death, and pays Sam from 2034", () => {
    const parsed = survivorPurchase('sam')
    if (!parsed.ok) throw new Error(parsed.issues.join('; '))
    const year = simulatePlan(parsed.plan, { startYear: 2026, taxCalculator: createFlatTaxCalculator(0) }).years.find((y) => y.year === 2034)!
    expect({ parses: parsed.ok, annuityIncome2034: year.incomes.annuity }).toEqual(accepted)
    expect({ parses: parsed.ok, annuityIncome2034: year.incomes.annuity }).not.toEqual(readings.onlyTheDeadOwner)
  })

  it('refuses the same purchase named for Alex, who has died by 2032, in plain words', () => {
    const parsed = survivorPurchase('alex')
    expect(parsed.ok).toBe(false)
    if (!parsed.ok) expect(parsed.issues.join('; ')).toContain("Alex's planning age ends in 2030, so an annuity bought in 2032 on Alex's life would never pay")
  })
})
