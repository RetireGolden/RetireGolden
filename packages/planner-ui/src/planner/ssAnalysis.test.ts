import { describe, expect, it } from 'vitest'

import { createEmptyPlan, parsePlan, type Account, type Plan } from '@retiregolden/engine/model/plan'
import { simulatePlan } from '@retiregolden/engine/projection/simulate'
import { taxCalculatorFor } from './useProjection'
import { benefitsOnlyRanking, expectedPvSingle, singleBenefitInYear } from '@retiregolden/engine/socialSecurity/analysis/expectedValue'
import { candidateClaimAges, claimingPeople, piaAsOfPlan, resolvePia, ssStreamFor } from './ssAnalysis'

let counter = 0
const id = () => `ssa-${++counter}`

function taxable(balance: number): Account {
  return { type: 'taxable', id: id(), name: 'Brokerage', ownerPersonId: null, annualReturnPct: null, balance, costBasis: balance, annualContribution: 0 }
}

function singlePlan(): Plan {
  const plan = createEmptyPlan({ newId: id })
  plan.household.people[0] = {
    id: 'p1', name: 'Pat', dob: '1964-06-15', sex: 'average', retirementAge: null,
    longevity: { planningAge: 92, source: 'manual' },
  }
  plan.assumptions.inflationPct = 2
  plan.assumptions.defaultReturnPct = 5
  plan.expenses.baseAnnual = 45_000
  plan.accounts = [taxable(900_000)]
  plan.incomes = [{ type: 'socialSecurity', id: id(), personId: 'p1', piaMonthly: 2_500, earnings: null, claimAge: { years: 67, months: 0 } }]
  const r = parsePlan(plan)
  if (!r.ok) throw new Error(r.issues.join('; '))
  return r.plan
}

function couplePlan(): Plan {
  const plan = singlePlan()
  plan.household.filingStatus = 'marriedFilingJointly'
  plan.household.people = [
    { id: 'p1', name: 'High', dob: '1962-06-15', sex: 'male', retirementAge: null, longevity: { planningAge: 90, source: 'manual' } },
    { id: 'p2', name: 'Low', dob: '1963-03-10', sex: 'female', retirementAge: null, longevity: { planningAge: 94, source: 'manual' } },
  ]
  plan.incomes = [
    { type: 'socialSecurity', id: id(), personId: 'p1', piaMonthly: 3_000, earnings: null, claimAge: { years: 67, months: 0 } },
    { type: 'socialSecurity', id: id(), personId: 'p2', piaMonthly: 1_200, earnings: null, claimAge: { years: 67, months: 0 } },
  ]
  const r = parsePlan(plan)
  if (!r.ok) throw new Error(r.issues.join('; '))
  return r.plan
}

describe('resolvePia / claimingPeople', () => {
  it('reads a quick PIA directly', () => {
    const plan = singlePlan()
    const stream = ssStreamFor(plan, 'p1')!
    expect(resolvePia(plan.household.people[0]!, stream, piaAsOfPlan(plan, 2026)).piaMonthly).toBe(2_500)
    expect(claimingPeople(plan)).toHaveLength(1)
  })

  it('derives a PIA from an earnings history', () => {
    const plan = singlePlan()
    const earnings = Array.from({ length: 35 }, (_, i) => ({ year: 1990 + i, amount: 60_000 }))
    plan.incomes = [{ type: 'socialSecurity', id: id(), personId: 'p1', piaMonthly: null, earnings, claimAge: { years: 67, months: 0 } }]
    const stream = ssStreamFor(plan, 'p1')!
    const r = resolvePia(plan.household.people[0]!, stream, piaAsOfPlan(plan, 2026))
    expect(r.piaMonthly).not.toBeNull()
    expect(r.piaMonthly!).toBeGreaterThan(1_000)
  })

  // The pia-cost-of-living-since-eligibility worksheet's case A: born
  // 1960-05-01, $50,000 of covered earnings in each year 1982-2021. The earnings
  // give 2,846.40 for 2022, the eligibility year; the December 2022 to 2025
  // increases (8.7%, 3.2%, 2.5%, 2.8%, each floored to the dime) raise it to
  // 3,364.40, the PIA a projection starting in 2026 pays from.
  function earningsPlan(): Plan {
    const plan = singlePlan()
    plan.household.people[0] = { ...plan.household.people[0]!, dob: '1960-05-01' }
    plan.assumptions.inflationPct = 0
    plan.assumptions.ssCola = { mode: 'matchInflation' }
    const earnings = Array.from({ length: 40 }, (_, i) => ({ year: 1982 + i, amount: 50_000 }))
    plan.incomes = [{ type: 'socialSecurity', id: id(), personId: 'p1', piaMonthly: null, earnings, claimAge: { years: 67, months: 0 } }]
    return parsePlanOk(plan)
  }

  it('raises an earnings-derived PIA by the cost-of-living increases since eligibility (3,364.40, not 2,846.40)', () => {
    const plan = earningsPlan()
    const r = resolvePia(plan.household.people[0]!, ssStreamFor(plan, 'p1')!, piaAsOfPlan(plan, 2026))
    expect(r.detail?.piaMonthly).toBeCloseTo(2_846.4, 6)
    expect(r.detail?.eligibilityYear).toBe(2022)
    expect(r.piaMonthly).toBeCloseTo(3_364.4, 6)
    expect(r.warning).toBeNull()
    expect(claimingPeople(plan, 2026)[0]!.pia).toBeCloseTo(3_364.4, 6)
  })

  it('agrees with the ledger, which pays 12 x 3,364.40 in 2027 with a 0% COLA', () => {
    const plan = earningsPlan()
    const resolved = resolvePia(plan.household.people[0]!, ssStreamFor(plan, 'p1')!, piaAsOfPlan(plan, 2026)).piaMonthly!
    const year2027 = simulatePlan(plan, { startYear: 2026, taxCalculator: taxCalculatorFor(plan) }).years.find((y) => y.year === 2027)!
    expect(year2027.incomes.socialSecurity).toBeCloseTo(resolved * 12, 6)
    expect(year2027.incomes.socialSecurity).toBeCloseTo(40_372.8, 6)
  })

  it('applies no increase before the eligibility year, and the plan COLA for years SSA has not announced', () => {
    const plan = earningsPlan()
    const person = plan.household.people[0]!
    const stream = ssStreamFor(plan, 'p1')!
    const early = resolvePia(person, stream, piaAsOfPlan(plan, 2022))
    expect(early.piaMonthly).toBeCloseTo(2_846.4, 6)
    expect(early.warning).toBeNull()
    // Case C: a projection starting in 2028 needs the 2026 and 2027 increases,
    // which the plan's fixed 2% stands in for: 3,431.60, then 3,500.20.
    const fixed = parsePlanOk({ ...plan, assumptions: { ...plan.assumptions, ssCola: { mode: 'fixed', annualPct: 2 } } })
    const late = resolvePia(person, stream, piaAsOfPlan(fixed, 2028))
    expect(late.piaMonthly).toBeCloseTo(3_500.2, 6)
    expect(late.warning).toContain('2026, 2027')
  })

  it('excludes people with no benefit', () => {
    const plan = singlePlan()
    plan.incomes = []
    expect(claimingPeople(parsePlanOk(plan))).toHaveLength(0)
  })
})

function parsePlanOk(plan: Plan): Plan {
  const r = parsePlan(plan)
  if (!r.ok) throw new Error(r.issues.join('; '))
  return r.plan
}

describe('benefitsOnlyRanking', () => {
  it('prefers delay at a low discount rate and early at a high one (single)', () => {
    const low = benefitsOnlyRanking(singlePlan(), 0, 2026)
    const high = benefitsOnlyRanking(singlePlan(), 0.1, 2026)
    expect(low.ranked[0]!.claimByPersonId['p1']).toBe(70)
    expect(high.ranked[0]!.claimByPersonId['p1']).toBe(62)
  })

  it('lifts a single low earner with a divorced-spousal benefit on an ex record', () => {
    const withoutEx = singlePlan()
    withoutEx.incomes = [{ type: 'socialSecurity', id: id(), personId: 'p1', piaMonthly: 800, earnings: null, claimAge: { years: 67, months: 0 } }]
    const withEx = parsePlanOk({
      ...withoutEx,
      incomes: [
        {
          type: 'socialSecurity',
          id: id(),
          personId: 'p1',
          piaMonthly: 800,
          earnings: null,
          claimAge: { years: 67, months: 0 },
          formerSpouses: [{ id: id(), relationship: 'divorced', dob: '1958-01-01', piaMonthly: 3_000, marriageYears: 12, remarriedAtAge: null }],
        },
      ],
    })
    const base = benefitsOnlyRanking(parsePlanOk(withoutEx), 0.02, 2026)
    const lifted = benefitsOnlyRanking(withEx, 0.02, 2026)
    const at67 = (r: ReturnType<typeof benefitsOnlyRanking>) => r.rows.find((x) => x.claimByPersonId['p1'] === 67)!.expectedPv
    // 50% of the $3,000 ex PIA (1,500) beats the own $800 → PV rises.
    expect(at67(lifted)).toBeGreaterThan(at67(base))
  })

  // The dual-entitlement-composition worksheet's case B: single, born
  // 1964-06-15, 800 PIA; the ex, born 1966-02-10 with a 2,000 PIA, is first 62
  // throughout in March 2028, when she is 765 months old. At a 62 claim she is
  // paid her own 560 plus (1,000 - 800) x 0.7375 = 707.50, the ledger's amount,
  // not max(560, 1,000 x 0.65) = 650 (the half reduced at her own claim age).
  function divorcedCaseB(claimYears: number): Plan {
    const plan = singlePlan()
    plan.household.people[0] = { ...plan.household.people[0]!, dob: '1964-06-15' }
    plan.incomes = [{
      type: 'socialSecurity', id: id(), personId: 'p1', piaMonthly: 800, earnings: null, claimAge: { years: claimYears, months: 0 },
      formerSpouses: [{ id: id(), relationship: 'divorced', dob: '1966-02-10', piaMonthly: 2_000, marriageYears: 12, remarriedAtAge: null }],
    }]
    return parsePlanOk(plan)
  }

  it('prices a divorced spouse as the ledger does: own benefit plus the reduced excess (707.50 at 62, not 650)', () => {
    // The engine's ranking prices the record with the ledger's own
    // maritalBenefitFor (the dual-entitlement composition) and pays it from the
    // year of the first month the ex is 62 throughout, 2028, as the ledger does.
    const plan = divorcedCaseB(62)
    const person = plan.household.people[0]!
    const stream = ssStreamFor(plan, 'p1')!
    const claimant = (claimYears: number) => ({
      dob: { year: 1964, month: 6, day: 15 },
      sex: person.sex,
      piaMonthly: 800,
      claimAge: { years: claimYears, months: 0 },
      formerSpouses: stream.formerSpouses ?? [],
    })
    expect(singleBenefitInYear(claimant(62), { single: true }, 2027)).toBe(560 * 12)
    expect(singleBenefitInYear(claimant(62), { single: true }, 2028) / 12).toBeCloseTo(707.5, 9)
    // At 67 both benefits start at FRA: 800 + 200 = 1,000.
    expect(singleBenefitInYear(claimant(67), { single: true }, 2031) / 12).toBeCloseTo(1_000, 9)
    expect(singleBenefitInYear(claimant(62), { single: false }, 2028)).toBe(560 * 12)
    const row = benefitsOnlyRanking(plan, 0.02, 2026).rows.find((x) => x.claimByPersonId['p1'] === 62)!
    expect(row.expectedPv).toBe(expectedPvSingle(claimant(62), { single: true }, { startYear: 2026, discountRate: 0.02, assumptions: plan.assumptions }))
  })

  it('does not grant divorced-spousal once remarried (couple household)', () => {
    const plan = couplePlan()
    plan.incomes = [
      { type: 'socialSecurity', id: id(), personId: 'p1', piaMonthly: 3_000, earnings: null, claimAge: { years: 67, months: 0 } },
      {
        type: 'socialSecurity',
        id: id(),
        personId: 'p2',
        piaMonthly: 1_200,
        earnings: null,
        claimAge: { years: 67, months: 0 },
        formerSpouses: [{ id: id(), relationship: 'divorced', dob: '1958-01-01', piaMonthly: 5_000, marriageYears: 15, remarriedAtAge: null }],
      },
    ]
    const withEx = benefitsOnlyRanking(parsePlanOk(plan), 0.02, 2026)
    const noEx = couplePlan()
    const baseline = benefitsOnlyRanking(noEx, 0.02, 2026)
    // p2 is remarried (couple) → the divorced ex record is ignored, PV unchanged.
    expect(withEx.ranked[0]!.expectedPv).toBeCloseTo(baseline.ranked[0]!.expectedPv, 6)
  })

  it('covers the full couple grid and ranks by expected PV', () => {
    const plan = couplePlan()
    const r = benefitsOnlyRanking(plan, 0.02, 2026)
    const expected =
      candidateClaimAges(plan.household.people[0]!, 2026).length *
      candidateClaimAges(plan.household.people[1]!, 2026).length
    expect(r.rows).toHaveLength(expected)
    for (let i = 1; i < r.ranked.length; i++) {
      expect(r.ranked[i - 1]!.expectedPv).toBeGreaterThanOrEqual(r.ranked[i]!.expectedPv)
    }
    // The higher earner (p1) should claim no earlier than the lower earner in the optimum.
    expect(r.ranked[0]!.claimByPersonId['p1']).toBeGreaterThanOrEqual(r.ranked[0]!.claimByPersonId['p2']!)
  })
})
