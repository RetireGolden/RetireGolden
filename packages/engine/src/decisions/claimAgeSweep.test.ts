import { describe, expect, it } from 'vitest'

import { createEmptyPlan, parsePlan, type Account, type Plan } from '../model/plan.js'
import { simulatePlan } from '../projection/simulate.js'
import { createFederalTaxCalculator } from '../tax/federalTax.js'
import { setAcaYearContract } from '../testing/planFixtures.js'
import { benefitsOnlyRanking, expectedPvCouple, type ExpectedValueClaimant } from '../socialSecurity/analysis/expectedValue.js'
import type { ProjectionResult } from '../projection/types.js'
import {
  claimYearOf,
  earliestOpenClaimAge,
  gridClaimAges,
  isClaimAlreadyMade,
  openClaims,
} from '../socialSecurity/openClaims.js'
import { claimAgeSweepVerdict, refineClaimAgeMonthly, sweepClaimAges, unpricedAcaYears } from './claimAgeSweep.js'
import { createDecisionContext, evaluateCandidate } from './evaluateCandidate.js'
import { socialSecurityClaimGenerator, socialSecurityClaimGridGenerator } from './generators.js'
import { hasSurvivorYears, maximizeAfterTaxEstate, rankedMetricBasis } from './objectives.js'
import { rankEvaluations } from './tournament.js'

let counter = 0
const id = () => `sweep-${++counter}`
const taxCalculator = createFederalTaxCalculator()

function taxable(balance: number): Account {
  return { type: 'taxable', id: id(), name: 'Brokerage', ownerPersonId: null, annualReturnPct: null, balance, costBasis: balance, annualContribution: 0 }
}

function parsePlanOk(plan: Plan): Plan {
  const r = parsePlan(plan)
  if (!r.ok) throw new Error(r.issues.join('; '))
  return r.plan
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
  return parsePlanOk(plan)
}

function couplePlan(): Plan {
  const plan = singlePlan()
  plan.household.filingStatus = 'marriedFilingJointly'
  plan.household.people = [
    { id: 'p1', name: 'High', dob: '1962-06-15', sex: 'male', retirementAge: null, longevity: { planningAge: 90, source: 'manual' } },
    { id: 'p2', name: 'Low', dob: '1963-03-10', sex: 'female', retirementAge: null, longevity: { planningAge: 94, source: 'manual' } },
  ]
  plan.incomes = [
    { type: 'socialSecurity', id: 'ss-high', personId: 'p1', piaMonthly: 3_000, earnings: null, claimAge: { years: 67, months: 0 } },
    { type: 'socialSecurity', id: 'ss-low', personId: 'p2', piaMonthly: 1_200, earnings: null, claimAge: { years: 67, months: 0 } },
  ]
  return parsePlanOk(plan)
}

const options = (objectivePolicyId: Parameters<typeof sweepClaimAges>[1]['objectivePolicyId'] = 'max-after-tax-estate') => ({
  startYear: 2026,
  taxCalculator,
  objectivePolicyId,
})

describe('openClaims: a claim year before the start year is already made', () => {
  it('splits the claim streams by birth year plus claim years against the start year', () => {
    const plan = couplePlan()
    plan.household.people[0]!.dob = '1953-06-15' // 67 in 2020
    const split = openClaims(parsePlanOk(plan), 2026)
    expect(split.alreadyClaimed).toEqual([{ personId: 'p1', streamId: 'ss-high', claimAge: { years: 67, months: 0 }, claimYear: 2020 }])
    expect(split.open.map((c) => [c.personId, c.claimYear])).toEqual([['p2', 2030]])
  })

  it('treats a claim in the start year as open, whatever its month', () => {
    const person = { dob: '1964-11-30' }
    expect(claimYearOf(person, { years: 62, months: 0 })).toBe(2026)
    expect(isClaimAlreadyMade(person, { years: 62, months: 0 }, 2026)).toBe(false)
    expect(isClaimAlreadyMade(person, { years: 62, months: 0 }, 2027)).toBe(true)
  })

  it('sends a start-year claim through openClaims as open, and the next year as made, months never rounding the year up', () => {
    const plan = singlePlan() // born 1964-06-15
    plan.incomes = [{ ...plan.incomes[0]!, claimAge: { years: 62, months: 6 } } as Plan['incomes'][number]]
    const clean = parsePlanOk(plan)
    // 1964 + 62 = 2026: open in 2026 whatever the months, made from 2027.
    expect(openClaims(clean, 2026).open.map((c) => c.claimYear)).toEqual([2026])
    expect(openClaims(clean, 2026).alreadyClaimed).toEqual([])
    expect(openClaims(clean, 2027).alreadyClaimed.map((c) => c.claimYear)).toEqual([2026])
    expect(openClaims(clean, 2027).open).toEqual([])
  })

  it('offers no grid age below the age reached, and none past 70', () => {
    expect(gridClaimAges({ dob: '1958-06-15' }, 2026)).toEqual([68, 69, 70])
    expect(gridClaimAges({ dob: '1950-06-15' }, 2026)).toEqual([])
    expect(earliestOpenClaimAge({ dob: '1962-06-15' }, 2026)).toBe(64)
    expect(earliestOpenClaimAge({ dob: '1968-06-15' }, 2026)).toBe(62)
    expect(earliestOpenClaimAge({ dob: '1950-06-15' }, 2026)).toBeNull()
  })

  it('drops past claims from both generators', () => {
    const plan = couplePlan()
    plan.household.people[0]!.dob = '1953-06-15' // claimed at 67 in 2020
    const ctx = createDecisionContext(parsePlanOk(plan), { startYear: 2026, taxCalculator })
    const grid = socialSecurityClaimGridGenerator.generate(ctx)
    expect(grid).toHaveLength(8) // one axis: Low, 63 in 2026, at 63 to 70
    expect(grid.every((c) => Object.keys(c.metadata!['claimByPersonId'] as object).join() === 'p2')).toBe(true)
    const canonical = socialSecurityClaimGenerator.generate(ctx)
    // High's claim is history; Low (born 1963) already claims at her full retirement age, 67, and 62 would be 2025.
    expect(canonical.map((c) => c.id)).toEqual(['ss-claim-ss-low-70-0'])
  })
})

/** A couple with one claim made (High, born 1963-06-15, at 62 in 2025) and one open (Low, born 1966-01-01, at 70). */
function partlyClaimedCouple(): Plan {
  const plan = couplePlan()
  plan.household.people[0]!.dob = '1963-06-15'
  plan.household.people[1]!.dob = '1966-01-01'
  plan.incomes = [
    { type: 'socialSecurity', id: 'ss-high', personId: 'p1', piaMonthly: 3_000, earnings: null, claimAge: { years: 62, months: 0 } },
    { type: 'socialSecurity', id: 'ss-low', personId: 'p2', piaMonthly: 1_200, earnings: null, claimAge: { years: 70, months: 0 } },
  ]
  return parsePlanOk(plan)
}

describe('a couple with one claim made and one open (M4)', () => {
  it('splits the claims, and neither generator moves the claim already made', () => {
    const plan = partlyClaimedCouple()
    const split = openClaims(plan, 2026)
    expect(split.alreadyClaimed).toEqual([{ personId: 'p1', streamId: 'ss-high', claimAge: { years: 62, months: 0 }, claimYear: 2025 }])
    expect(split.open.map((c) => c.personId)).toEqual(['p2'])
    const ctx = createDecisionContext(plan, { startYear: 2026, taxCalculator })
    // Low, born 1966-01-01, counts as born in 1965 (the January 1 rule): full retirement age 67; 62 in 2028.
    expect(socialSecurityClaimGenerator.generate(ctx).map((c) => c.label)).toEqual([
      'Low claims Social Security at 62',
      'Low claims Social Security at 67 (FRA)',
    ])
    const grid = socialSecurityClaimGridGenerator.generate(ctx)
    expect(grid).toHaveLength(9)
    expect(grid.every((c) => Object.keys(c.metadata!['claimByPersonId'] as object).join() === 'p2')).toBe(true)
  })

  it('sweeps the open claim alone and holds the one already made', () => {
    const sweep = sweepClaimAges(partlyClaimedCouple(), options())
    expect(sweep.personIds).toEqual(['p2'])
    expect(sweep.alreadyClaimed.map((c) => [c.personId, c.claimYear])).toEqual([['p1', 2025]])
    expect(sweep.rows).toHaveLength(9)
    expect(sweep.verdict).not.toBe('already-claimed')
  })

  it('prices the claim already made at its own age in the benefits-only ranking', () => {
    const plan = partlyClaimedCouple()
    const ranking = benefitsOnlyRanking(plan, 0.02, 2026)
    expect(ranking.personIds).toEqual(['p2'])
    const claimant = (personId: 'p1' | 'p2', years: number): ExpectedValueClaimant => {
      const person = plan.household.people.find((p) => p.id === personId)!
      const [y, m, d] = person.dob.split('-').map(Number) as [number, number, number]
      const stream = plan.incomes.find((i) => i.type === 'socialSecurity' && i.personId === personId) as Extract<Plan['incomes'][number], { type: 'socialSecurity' }>
      return { dob: { year: y, month: m, day: d }, sex: person.sex, piaMonthly: stream.piaMonthly!, claimAge: { years, months: 0 }, formerSpouses: [] }
    }
    const opts = { startYear: 2026, discountRate: 0.02, assumptions: plan.assumptions }
    for (const row of ranking.rows) {
      const lowAge = row.claimByPersonId['p2']!
      expect(row.expectedPv, `Low at ${lowAge}`).toBe(expectedPvCouple(claimant('p1', 62), claimant('p2', lowAge), opts))
    }
    // At 70 instead of its own 62 the held claim would price differently.
    expect(ranking.rows[0]!.expectedPv).not.toBe(expectedPvCouple(claimant('p1', 70), claimant('p2', ranking.rows[0]!.claimByPersonId['p2']!), opts))
  })
})

describe('sweepClaimAges', () => {
  it('runs the 9-age grid for a single person and ranks by after-tax estate', () => {
    const plan = singlePlan() // born 1964 -> age 62 in 2026, full 62–70 grid
    const sweep = sweepClaimAges(plan, options())
    expect(sweep.personIds).toEqual(['p1'])
    expect(sweep.agesByPersonId).toEqual({ p1: [62, 63, 64, 65, 66, 67, 68, 69, 70] })
    expect(sweep.rows).toHaveLength(9)
    for (let i = 1; i < sweep.ranked.length; i++) {
      expect(sweep.ranked[i - 1]!.endingAfterTaxEstate).toBeGreaterThanOrEqual(sweep.ranked[i]!.endingAfterTaxEstate)
    }
    expect(sweep.estateYear).toBe(simulatePlan(plan, { startYear: 2026, taxCalculator }).endYear)
  })

  it('runs the full grid for a couple, the axes in household order', () => {
    const sweep = sweepClaimAges(couplePlan(), options())
    expect(sweep.personIds).toEqual(['p1', 'p2'])
    expect(sweep.rows).toHaveLength(sweep.agesByPersonId['p1']!.length * sweep.agesByPersonId['p2']!.length)
  })

  it('publishes the winner\'s signed estate change against the plan as entered', () => {
    const sweep = sweepClaimAges(singlePlan(), options())
    expect(sweep.verdict).toBe('winner')
    expect(sweep.winnerEstateChangeVsCurrent).toBe(sweep.winner!.endingAfterTaxEstate - sweep.current!.endingAfterTaxEstate)
    const current = sweep.rows.find((r) => r.isCurrent)!
    expect(current.claimByPersonId).toEqual({ p1: 67 })
    expect(current.estateChangeVsCurrent).toBe(0)
  })

  it('compares with the plan\'s own claim months, and never calls a whole-year row "current" then', () => {
    const plan = singlePlan()
    plan.incomes = [{ ...plan.incomes[0]!, claimAge: { years: 67, months: 6 } } as Plan['incomes'][number]]
    const sweep = sweepClaimAges(parsePlanOk(plan), options())
    expect(sweep.current!.claimByPersonId).toEqual({ p1: { years: 67, months: 6 } })
    expect(sweep.rows.some((r) => r.isCurrent)).toBe(false)
    const baseline = createDecisionContext(parsePlanOk(plan), { startYear: 2026, taxCalculator }).baselineSummary
    expect(sweep.current!.endingAfterTaxEstate).toBe(baseline.endingAfterTaxEstate)
  })

  it('ranks through the selected objective policy', () => {
    const sweep = sweepClaimAges(singlePlan(), options('max-spending-durability'))
    expect(sweep.objectivePolicyId).toBe('max-spending-durability')
    expect(sweep.primaryMetricLabel).toBe('Money-lasts delta (years)')
    expect(sweep.ranked.every((row) => Number.isFinite(row.primaryValue) && row.rankedOn === 'objective')).toBe(true)
  })

  it('crowns nothing on an asset-free plan, where every estate is $0', () => {
    const plan = singlePlan()
    plan.accounts = []
    const sweep = sweepClaimAges(parsePlanOk(plan), options())
    expect(sweep.ranked.every((row) => row.endingAfterTaxEstate === 0)).toBe(true)
    expect(sweep.winner).toBeNull()
    expect(['flat', 'ineligible']).toContain(sweep.verdict)
  })

  it('refuses when every claim was already made, naming who claimed and when', () => {
    const plan = couplePlan()
    plan.household.people[0]!.dob = '1953-06-15'
    plan.household.people[1]!.dob = '1955-03-10'
    const sweep = sweepClaimAges(parsePlanOk(plan), options())
    expect(sweep.verdict).toBe('already-claimed')
    expect(sweep.rows).toEqual([])
    expect(sweep.alreadyClaimed.map((c) => [c.personId, c.claimYear])).toEqual([['p1', 2020], ['p2', 2022]])
  })

  it('holds a disability benefit as the ledger pays it and ranks the other claim (L5)', () => {
    const plan = couplePlan()
    plan.incomes = plan.incomes.map((income) =>
      income.type === 'socialSecurity' && income.personId === 'p2' ? ({ ...income, disability: { onsetAge: 55 } } as Plan['incomes'][number]) : income,
    )
    const clean = parsePlanOk(plan)
    const sweep = sweepClaimAges(clean, options())
    expect(sweep.verdict).not.toBe('disability')
    expect(sweep.disabilityPersonIds).toEqual(['p2'])
    expect(sweep.personIds).toEqual(['p1'])
    expect(sweep.rows).toHaveLength(sweep.agesByPersonId['p1']!.length)
    expect(sweep.rows.every((r) => Object.keys(r.claimByPersonId).join() === 'p1')).toBe(true)
    const refined = refineClaimAgeMonthly(clean, sweep, { startYear: 2026, taxCalculator })
    if (refined !== null) expect(Object.keys(refined.claimByPersonId)).toEqual(['p1'])
  })

  it('refuses a disability benefit, which a claim age does not start', () => {
    const plan = singlePlan()
    plan.incomes = [{ ...plan.incomes[0]!, disability: { onsetAge: 55 } } as Plan['incomes'][number]]
    const sweep = sweepClaimAges(parsePlanOk(plan), options())
    expect(sweep.verdict).toBe('disability')
    expect(sweep.disabilityPersonIds).toEqual(['p1'])
    expect(sweep.rows).toEqual([])
  })

  it('reports an empty plan', () => {
    const plan = singlePlan()
    plan.incomes = []
    expect(sweepClaimAges(parsePlanOk(plan), options()).verdict).toBe('empty')
  })
})

describe('refineClaimAgeMonthly', () => {
  it('never does worse on the objective than the whole-year pick and stays within a year, valid months', () => {
    const plan = singlePlan()
    const sweep = sweepClaimAges(plan, options())
    const refined = refineClaimAgeMonthly(plan, sweep, { startYear: 2026, taxCalculator })!
    expect(refined.primaryValue).toBeGreaterThanOrEqual(sweep.winner!.primaryValue)
    expect(refined.estateChangeVsWinner).toBe(refined.endingAfterTaxEstate - sweep.winner!.endingAfterTaxEstate)
    const claim = refined.claimByPersonId['p1']!
    expect(Math.abs(claim.years - sweep.winner!.claimByPersonId['p1']!)).toBeLessThanOrEqual(1)
    expect(claim.months).toBeGreaterThanOrEqual(0)
    expect(claim.months).toBeLessThanOrEqual(11)
    if (claim.years === 70) expect(claim.months).toBe(0)
    expect(refined.moved).toBe(claim.years !== sweep.winner!.claimByPersonId['p1'] || claim.months !== 0)
  })

  it('refines both spouses for a couple', () => {
    const plan = couplePlan()
    const sweep = sweepClaimAges(plan, options())
    const refined = refineClaimAgeMonthly(plan, sweep, { startYear: 2026, taxCalculator })!
    expect(Object.keys(refined.claimByPersonId).sort()).toEqual(['p1', 'p2'])
    expect(refined.primaryValue).toBeGreaterThanOrEqual(sweep.winner!.primaryValue)
  })

  it('has nothing to refine without a winner', () => {
    const plan = singlePlan()
    plan.accounts = []
    const clean = parsePlanOk(plan)
    expect(refineClaimAgeMonthly(clean, sweepClaimAges(clean, options()), { startYear: 2026, taxCalculator })).toBeNull()
  })
})

describe('benefits-only ranking and the shared test', () => {
  it('holds a claim already made at its own age and ranks only the open one', () => {
    const plan = couplePlan()
    plan.household.people[0]!.dob = '1953-06-15'
    const ranking = benefitsOnlyRanking(parsePlanOk(plan), 0.02, 2026)
    expect(ranking.personIds).toEqual(['p2'])
    expect(ranking.alreadyClaimed.map((c) => c.personId)).toEqual(['p1'])
    expect(ranking.rows.every((r) => Object.keys(r.claimByPersonId).join() === 'p2')).toBe(true)
  })

  it('ranks nothing when every claim was made', () => {
    const plan = singlePlan()
    plan.household.people[0]!.dob = '1953-06-15'
    plan.incomes = [{ ...plan.incomes[0]!, claimAge: { years: 70, months: 0 } } as Plan['incomes'][number]]
    const ranking = benefitsOnlyRanking(parsePlanOk(plan), 0.02, 2026)
    expect(ranking.ranked).toEqual([])
    expect(ranking.alreadyClaimed).toEqual([{ personId: 'p1', streamId: plan.incomes[0]!.id, claimAge: { years: 70, months: 0 }, claimYear: 2023 }])
  })
})

describe('objective facts the sweep publishes', () => {
  it('says which rows a bridge ranking read on the estate instead of bridge years', () => {
    const plan = singlePlan()
    const ctx = createDecisionContext(plan, { startYear: 2026, taxCalculator })
    const candidate = socialSecurityClaimGridGenerator.generate(ctx)[0]!
    expect(candidate.metadata!['claimByPersonId']).toEqual({ p1: 62 })
    const evaluation = evaluateCandidate(ctx, candidate)
    // Pat (born 1964) claims at 67 in 2031: 2026 to 2030 are bridge years. Claiming at 62 pays from 2026, so that row has none.
    expect(rankedMetricBasis('max-after-tax-estate', evaluation, ctx)).toBe('objective')
    expect(rankedMetricBasis('bridge-durability', evaluation, ctx)).toBe('estate-fallback-row')
    // One adult: no survivor years in the plan as entered, so survivor liquidity falls back for every row, on the plan's account.
    expect(hasSurvivorYears(ctx.baselineResult)).toBe(false)
    expect(rankedMetricBasis('protect-survivor-liquidity', evaluation, ctx)).toBe('estate-fallback-plan')
  })

  it('pins the ranked basis of every sweep row: the claim at 62 alone falls back under bridge durability', () => {
    const basis = (objective: Parameters<typeof options>[0], plan = singlePlan()) =>
      Object.fromEntries(sweepClaimAges(plan, options(objective)).rows.map((r) => [r.claimByPersonId['p1'], r.rankedOn]))
    expect(basis('bridge-durability')).toEqual({
      62: 'estate-fallback-row', 63: 'objective', 64: 'objective', 65: 'objective', 66: 'objective',
      67: 'objective', 68: 'objective', 69: 'objective', 70: 'objective',
    })
    expect(new Set(Object.values(basis('protect-survivor-liquidity')))).toEqual(new Set(['estate-fallback-plan']))
    expect(new Set(Object.values(basis('max-after-tax-estate')))).toEqual(new Set(['objective']))
  })

  it('blames the plan, not the claim age, when the plan as entered has no bridge years (L1)', () => {
    // The review's case: claiming at 62y0m in 2026 leaves the plan as entered no bridge year, though 63 to 70 would have 1 to 8.
    const plan = singlePlan()
    plan.incomes = [{ ...plan.incomes[0]!, claimAge: { years: 62, months: 0 } } as Plan['incomes'][number]]
    const sweep = sweepClaimAges(parsePlanOk(plan), options('bridge-durability'))
    expect(sweep.rows.every((r) => r.rankedOn === 'estate-fallback-plan')).toBe(true)
    expect(sweep.winner!.claimByPersonId).toEqual({ p1: 70 })
    expect(sweep.winner!.rankedOn).toBe('estate-fallback-plan')
  })

  it('reads two eligible rows exactly half a unit apart as flat, and a hair more as current-best', () => {
    expect(claimAgeSweepVerdict([{ eligible: true, primaryValue: 0 }, { eligible: true, primaryValue: -0.5 }], false, 0)).toBe('flat')
    expect(claimAgeSweepVerdict([{ eligible: true, primaryValue: 0 }, { eligible: true, primaryValue: -0.5000001 }], false, 0)).toBe('current-best')
  })

  it('gives an unpriced year only its blocking codes as reasons, never an informational one', () => {
    const result = {
      years: [
        { year: 2027, aca: { readiness: 'actionable', supportCodes: ['actionable'] } },
        { year: 2028, aca: { readiness: 'nonActionable', supportCodes: ['income-tax-parameters-projected', 'tax-year-parameters-unsupported', 'tax-exempt-interest-plan-derived'] } },
        { year: 2029 },
      ],
    } as unknown as ProjectionResult
    expect(unpricedAcaYears(result)).toEqual([{ year: 2028, reasons: ['tax-year-parameters-unsupported'] }])
  })

  it('names the diagnostic a refused row actually raised', () => {
    const plan = singlePlan()
    const ctx = createDecisionContext(plan, { startYear: 2026, taxCalculator })
    const invalid = evaluateCandidate(ctx, { id: 'bad', source: 'heuristic', category: 'social-security', label: 'bad', explanation: 'bad', planPatch: { incomes: 'not an array' } })
    expect(invalid.recommendationState).toBe('diagnostic')
    const [row] = rankEvaluations([invalid], ctx, maximizeAfterTaxEstate, 0).ranked
    expect(row!.lossReason).toContain("diagnostic-only evaluation: This candidate can't be applied to the plan")
    expect(row!.lossReason).not.toContain('materially unexecuted schedule')
  })

  it('names the baseline’s own unpriced years as a cause, beside the row’s', () => {
    // Marketplace coverage from 2026 on a plan like the sweep evidence's S-H: its credits from 2028 cannot be priced.
    const draft = singlePlan()
    draft.household.people[0]!.dob = '1966-06-15'
    draft.household.people[0]!.longevity.planningAge = 90
    draft.accounts = [{ type: 'cash', id: 'cash', name: 'Cash', ownerPersonId: null, annualReturnPct: null, balance: 300_000, annualContribution: 0 }]
    draft.incomes.push({ type: 'recurring', id: 'work', label: 'Work', annualAmount: 40_000, startYear: 2026, endYear: null, inflationAdjusted: false, taxTreatment: 'ordinary' })
    for (const year of [2026, 2027, 2028]) setAcaYearContract(draft, { year })
    const plan = parsePlanOk(draft)
    const ctx = createDecisionContext(plan, { startYear: 2026, taxCalculator })
    const evaluation = evaluateCandidate(ctx, socialSecurityClaimGridGenerator.generate(ctx)[0]!)
    expect(evaluation.recommendationState).toBe('diagnostic')
    expect(evaluation.diagnosticCauses).toContain(
      'ACA evidence from the full projection is non-actionable in the baseline for 2028, 2029, 2030, 2031; no candidate can be applied as executable.',
    )
  })

  it('lists no unpriced credit year on a plan without Marketplace coverage', () => {
    expect(unpricedAcaYears(simulatePlan(singlePlan(), { startYear: 2026, taxCalculator }))).toEqual([])
  })
})
