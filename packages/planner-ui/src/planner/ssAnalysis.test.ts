import { describe, expect, it } from 'vitest'

import { createEmptyPlan, parsePlan, type Account, type Plan } from '@retiregolden/engine/model/plan'
import { benefitsOnlyRanking, candidateClaimAges, claimingPeople, refineClaimingMonthly, resolvePia, ssStreamFor, sweepClaimingStrategies } from './ssAnalysis'

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
    expect(resolvePia(plan.household.people[0]!, stream).piaMonthly).toBe(2_500)
    expect(claimingPeople(plan)).toHaveLength(1)
  })

  it('derives a PIA from an earnings history', () => {
    const plan = singlePlan()
    const earnings = Array.from({ length: 35 }, (_, i) => ({ year: 1990 + i, amount: 60_000 }))
    plan.incomes = [{ type: 'socialSecurity', id: id(), personId: 'p1', piaMonthly: null, earnings, claimAge: { years: 67, months: 0 } }]
    const stream = ssStreamFor(plan, 'p1')!
    const r = resolvePia(plan.household.people[0]!, stream)
    expect(r.piaMonthly).not.toBeNull()
    expect(r.piaMonthly!).toBeGreaterThan(1_000)
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

describe('sweepClaimingStrategies', () => {
  it('runs the 9-age grid for a single person and ranks by after-tax estate', () => {
    const plan = singlePlan() // born 1964 -> age 62 in 2026, full 62–70 grid
    const result = sweepClaimingStrategies(plan, 2026)
    expect(result.personIds).toEqual(['p1'])
    expect(result.rows).toHaveLength(candidateClaimAges(plan.household.people[0]!, 2026).length)
    for (let i = 1; i < result.ranked.length; i++) {
      expect(result.ranked[i - 1]!.summary.endingAfterTaxEstate).toBeGreaterThanOrEqual(
        result.ranked[i]!.summary.endingAfterTaxEstate,
      )
    }
  })

  it('runs the full claim-age grid for a couple', () => {
    const plan = couplePlan()
    const result = sweepClaimingStrategies(plan, 2026)
    expect(result.personIds).toHaveLength(2)
    const expected =
      candidateClaimAges(plan.household.people[0]!, 2026).length *
      candidateClaimAges(plan.household.people[1]!, 2026).length
    expect(result.rows).toHaveLength(expected)
    expect(result.ranked[0]!.summary.endingAfterTaxEstate).toBeGreaterThan(0)
  })

  it('ranks whole-plan claim candidates through the selected objective policy', () => {
    const result = sweepClaimingStrategies(singlePlan(), 2026, 'max-spending-durability')
    expect(result.objectivePolicyId).toBe('max-spending-durability')
    expect(result.primaryMetricLabel).toBe('Money-lasts delta (years)')
    expect(result.ranked.every((row) => Number.isFinite(row.primaryValue))).toBe(true)
  })

  it('only offers claim ages at or beyond the current age', () => {
    const older = singlePlan()
    older.household.people[0] = { ...older.household.people[0]!, dob: '1958-06-15' } // 68 in 2026
    expect(candidateClaimAges(older.household.people[0]!, 2026)).toEqual([68, 69, 70])
  })

  it('returns no rows when nobody claims Social Security', () => {
    const plan = singlePlan()
    plan.incomes = []
    const result = sweepClaimingStrategies(parsePlanOk(plan), 2026)
    expect(result.rows).toHaveLength(0)
  })
})

describe('refineClaimingMonthly', () => {
  it('never does worse than the whole-year best and stays within ±1 year, valid months', () => {
    const plan = singlePlan()
    const sweep = sweepClaimingStrategies(plan, 2026)
    const bestYear = sweep.ranked[0]!
    const refined = refineClaimingMonthly(plan, bestYear.claimByPersonId, 2026)

    expect(refined.summary.endingAfterTaxEstate).toBeGreaterThanOrEqual(bestYear.summary.endingAfterTaxEstate)
    const claim = refined.claimByPersonId['p1']!
    expect(Math.abs(claim.years - bestYear.claimByPersonId['p1']!)).toBeLessThanOrEqual(1)
    expect(claim.months).toBeGreaterThanOrEqual(0)
    expect(claim.months).toBeLessThanOrEqual(11)
    if (claim.years === 70) expect(claim.months).toBe(0) // engine caps at 70y0m
  })

  it('refines both spouses for a couple', () => {
    const plan = couplePlan()
    const sweep = sweepClaimingStrategies(plan, 2026)
    const refined = refineClaimingMonthly(plan, sweep.ranked[0]!.claimByPersonId, 2026)
    expect(Object.keys(refined.claimByPersonId).sort()).toEqual(['p1', 'p2'])
    expect(refined.summary.endingAfterTaxEstate).toBeGreaterThanOrEqual(sweep.ranked[0]!.summary.endingAfterTaxEstate)
  })
})

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
    expect(r.ranked[0]!.claimByPersonId['p1']!).toBeGreaterThanOrEqual(r.ranked[0]!.claimByPersonId['p2']!)
  })
})
