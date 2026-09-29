/**
 * B2-P1 slice 3 parity for the Compare page on the example library: every
 * ordered pair of the examples, as the app opens them, compared by the
 * engine's comparePlanHeadlines against the planner functions it retired
 * (kept here, nowhere else).
 *
 * - Money lasts, Success % and Depletion age: the engine reproduces the
 *   retired moneyLastsDelta, deterministicSuccessPct and ageDelta/primaryAgeIn
 *   on every pair, reading two full plans as the page reads them (no number,
 *   "same" or "both full plan", no colour).
 * - The four money rows: on a pair that ends in one year the engine's figures
 *   are the retired nominal subtraction bit for bit; on a pair that ends in
 *   different years they are in the start year's dollars (R13), each side
 *   divided by its own published factor.
 *
 * The tests pin each pair, not how many pairs of the library fall in each
 * group: those counts are measurements at a commit (staging addendum).
 */
import { describe, expect, it } from 'vitest'

import type { Plan } from '@retiregolden/engine/model/plan'
import { lastFundedYear } from '@retiregolden/engine/projection/moneyLasts'
import { comparePlanHeadlines } from '@retiregolden/engine/scenarios/planHeadlines'
import { projectPlan, type ProjectionView } from '../projection'
import { appExamplePlans } from '../testSupport/appExamples'
import { formatDelta } from './compareDeltas'
import { EXAMPLE_FIXED_YEAR } from './examples/buildContext'

// ------------------------------------------------ the retired planner functions (compareDeltas.ts, ComparePlansPage.tsx at 4a80669e)
function retiredDeterministicSuccessPct(depletionYear: number | null): number {
  return depletionYear === null ? 100 : 0
}
function retiredMoneyLastsDelta(
  a: { depletionYear: number | null; endYear: number },
  b: { depletionYear: number | null; endYear: number },
): { value: number; bothFull: boolean; bound: '≥' | '≤' | null } {
  const value = lastFundedYear(b) - lastFundedYear(a)
  const aFull = a.depletionYear === null
  const bFull = b.depletionYear === null
  if (aFull && bFull) return { value: 0, bothFull: true, bound: null }
  if (!aFull && !bFull) return { value, bothFull: false, bound: null }
  return { value, bothFull: false, bound: bFull ? '≥' : '≤' }
}
function retiredPrimaryAgeIn(plan: Plan, year: number | null): number | null {
  if (year === null) return null
  const dobYear = Number(plan.household.people[0]?.dob.slice(0, 4))
  return Number.isFinite(dobYear) ? year - dobYear : null
}
function retiredAgeDelta(a: number | null, b: number | null): number | null {
  if (a === null || b === null) return null
  return b - a
}

describe('comparePlanHeadlines on every ordered pair of the example library', () => {
  const sides = appExamplePlans().map(({ id, plan }) => ({ id, plan, view: projectPlan(plan, EXAMPLE_FIXED_YEAR) }))
  const pairs: [(typeof sides)[number], (typeof sides)[number]][] = []
  for (const a of sides) for (const b of sides) if (a !== b) pairs.push([a, b])
  const compared = (a: { plan: Plan; view: ProjectionView }, b: { plan: Plan; view: ProjectionView }) =>
    comparePlanHeadlines(
      { plan: a.plan, result: a.view.result, summary: a.view.summary },
      { plan: b.plan, result: b.view.result, summary: b.view.summary },
    )

  it('reproduces the retired Money lasts, Success % and Depletion age readings on every pair', () => {
    let checked = 0
    for (const [a, b] of pairs) {
      const label = `${a.id} vs ${b.id}`
      const headline = compared(a, b)
      const l = a.view.summary
      const r = b.view.summary
      const lasts = retiredMoneyLastsDelta(
        { depletionYear: l.depletionYear, endYear: a.view.result.endYear },
        { depletionYear: r.depletionYear, endYear: b.view.result.endYear },
      )
      if (lasts.bothFull) {
        expect(headline.moneyLasts.bound, label).toBe('bothFull')
        expect(headline.moneyLasts.delta, label).toBeNull()
      } else {
        expect(headline.moneyLasts.delta, label).toBe(lasts.value)
        expect(headline.moneyLasts.bound, label).toBe(lasts.bound === '≥' ? 'atLeast' : lasts.bound === '≤' ? 'atMost' : null)
      }
      expect(headline.endYear.delta === 0, label).toBe(a.view.result.endYear === b.view.result.endYear)
      expect(headline.deterministicSuccessPct.baseline, label).toBe(retiredDeterministicSuccessPct(l.depletionYear))
      expect(headline.deterministicSuccessPct.proposal, label).toBe(retiredDeterministicSuccessPct(r.depletionYear))
      expect(headline.deterministicSuccessPct.delta, label).toBe(
        retiredDeterministicSuccessPct(r.depletionYear) - retiredDeterministicSuccessPct(l.depletionYear),
      )
      const ageA = retiredPrimaryAgeIn(a.plan, l.depletionYear)
      const ageB = retiredPrimaryAgeIn(b.plan, r.depletionYear)
      expect(headline.depletionAgePrimary, label).toEqual({ baseline: ageA, proposal: ageB, delta: retiredAgeDelta(ageA, ageB) })
      checked += 1
    }
    expect(checked).toBe(pairs.length)
  })

  it('keeps the retired nominal money rows on a pair ending in one year, and states start-year dollars otherwise', () => {
    let sameEnd = 0
    let differentEnd = 0
    for (const [a, b] of pairs) {
      const label = `${a.id} vs ${b.id}`
      const headline = compared(a, b)
      const l = a.view.summary
      const r = b.view.summary
      const rows = [
        ['endingNetWorth', l.endingNetWorth, r.endingNetWorth],
        ['endingInvestable', l.endingInvestable, r.endingInvestable],
        ['endingAfterTaxEstate', l.endingAfterTaxEstate, r.endingAfterTaxEstate],
      ] as const
      if (a.view.result.endYear === b.view.result.endYear) {
        sameEnd += 1
        expect(headline.moneyBasis, label).toBe('nominal')
        for (const [key, left, right] of rows) {
          expect(Object.is(headline[key].delta, right - left), `${label} ${key}`).toBe(true)
        }
        expect(
          Object.is(headline.lifetimeTaxesAndPenalties.delta, r.lifetimeTaxesAndPenalties - l.lifetimeTaxesAndPenalties),
          `${label} lifetime`,
        ).toBe(true)
      } else {
        differentEnd += 1
        expect(headline.moneyBasis, label).toBe('today')
        expect(headline.startYear, label).toBe(EXAMPLE_FIXED_YEAR)
        for (const [key, left, right] of rows) {
          // Each side's ending figure in the start year's dollars, by the
          // run's own published factor for its own end year (the page's own
          // projection view deflates the same way).
          expect(headline[key].baseline, `${label} ${key}`).toBe(a.view.deflate(a.view.result.endYear, left))
          expect(headline[key].proposal, `${label} ${key}`).toBe(b.view.deflate(b.view.result.endYear, right))
        }
        const lifetime = (view: ProjectionView) =>
          view.result.years.reduce((total, year) => total + view.deflate(year.year, year.tax + year.penalties), 0)
        expect(headline.lifetimeTaxesAndPenalties.baseline, `${label} lifetime`).toBe(lifetime(a.view))
        expect(headline.lifetimeTaxesAndPenalties.proposal, `${label} lifetime`).toBe(lifetime(b.view))
      }
    }
    expect(sameEnd + differentEnd).toBe(pairs.length)
    expect(sameEnd).toBeGreaterThan(0)
    expect(differentEnd).toBeGreaterThan(0)
  })

  it('pins the worksheet sample: example-couple against hsa-stealth-retirement flips from +$329k to −$466k', () => {
    const a = sides.find((s) => s.id === 'example-couple')!
    const b = sides.find((s) => s.id === 'hsa-stealth-retirement')!
    const headline = compared(a, b)
    expect(headline.endYear).toEqual({ baseline: 2059, proposal: 2076, delta: 17 })
    // The worksheet measured +$330k; the published 2027 HSA limit lowers
    // hsa-stealth-retirement's nominal estate by $240, and it now rounds to +$329k.
    expect(formatDelta(b.view.summary.endingAfterTaxEstate - a.view.summary.endingAfterTaxEstate, 'money')).toBe('+$329k')
    expect(formatDelta(headline.endingAfterTaxEstate.delta, 'money')).toBe('−$466k')
  })
})
