/**
 * B2-P1 slice 5 parity on the 29 example plans: the survivor-transition page
 * now reads the engine's analysis (@retiregolden/engine/projection/
 * survivorTransition), and this pins, row by row, what that changed and what
 * it did not, against a copy of the retired planner-ui function kept here
 * (survivorAnalysis.ts#buildTimingRow, whose convert-early lever replaced the
 * plan's conversion strategy with a 12% fill).
 *
 * - Every figure but the lever is bit-identical on all 56 timing rows of the
 *   seven couples, and the shortfall facts, now read on required spending,
 *   equal the total the retired facts read on every one of them.
 * - The lever is bit-identical on the 24 rows of the three plans that convert
 *   nothing, where adding and replacing coincide (owner decision R16).
 * - On the four converting plans the lever adds to the plan's conversions:
 *   32 rows change, and 20 rows raise no year and say why.
 *
 * @see DOCS/calculations/social-security/survivor-convert-early-lever.md
 */
import { describe, expect, it } from 'vitest'

import type { Plan } from '@retiregolden/engine/model/plan'
import { summarizeProjection } from '@retiregolden/engine/projection/compare'
import { simulatePlan } from '@retiregolden/engine/projection/simulate'
import {
  conversionLeverPatch,
  survivorTransitionAnalysis,
  withSurvivorSsa44,
  type SurvivorTimingRow,
} from '@retiregolden/engine/projection/survivorTransition'
import { applyScenarioPatch } from '@retiregolden/engine/scenarios/scenarios'
import { EXAMPLE_PLANS } from './examples/registry'
import { demoPlanId } from './examples/loadExample'
import { fmtMoneyCompact } from './format'
import { taxCalculatorFor } from './useProjection'

const START = 2026

/** The retired lever and shortfall facts for one engine timing row, as survivorAnalysis.ts#buildTimingRow priced them. */
function retiredTiming(plan: Plan, row: SurvivorTimingRow) {
  const simOpts = { startYear: START, taxCalculator: taxCalculatorFor(plan), deathAgeByPersonId: { [row.deceasedPersonId]: row.deathAge } }
  const planUsesSsa44 = plan.expenses.healthcare.ssa44?.survivorYears === true
  const without = simulatePlan(withSurvivorSsa44(plan, false), simOpts)
  const withRelief = simulatePlan(withSurvivorSsa44(plan, true), simOpts)
  const base = planUsesSsa44 ? withRelief : without
  const baseSummary = summarizeProjection(plan, base)
  let ssa44PremiumSavings = 0
  for (const y of without.years) {
    const on = withRelief.years.find((x) => x.year === y.year)
    if (on) ssa44PremiumSavings += y.medicarePremiums - on.medicarePremiums
  }
  const patched = applyScenarioPatch(plan, conversionLeverPatch(START, row.deathYear))
  if (!patched.ok) throw new Error(patched.issues.join('; '))
  const lever = summarizeProjection(patched.plan, simulatePlan(patched.plan, simOpts))
  return {
    estateDelta: lever.endingAfterTaxEstate - baseSummary.endingAfterTaxEstate,
    lifetimeTaxDelta: lever.lifetimeTaxesAndPenalties - baseSummary.lifetimeTaxesAndPenalties,
    baseEndingAfterTaxEstate: baseSummary.endingAfterTaxEstate,
    baseLifetimeTax: baseSummary.lifetimeTaxesAndPenalties,
    ssa44PremiumSavings,
    survivorShortfallYears: base.years.filter((y) => y.year > row.deathYear && y.people.some((p) => p.alive)).filter((y) => y.requiredShortfall > 0.005).length,
    lastJointShortfall: base.years.find((y) => y.year === row.deathYear)!.shortfall,
    firstSurvivorShortfall: base.years.find((y) => y.year === row.deathYear + 1)!.shortfall,
  }
}

const leverText = (v: number) => `${v > 0 ? '+' : ''}${fmtMoneyCompact(v)}`
const examples = EXAMPLE_PLANS.map((ex) => ({ id: ex.id, plan: { ...ex.build(), id: demoPlanId(ex.id), origin: 'example' as const, exampleSourceId: ex.id } }))
const couples = examples.filter(({ plan }) => plan.household.filingStatus === 'marriedFilingJointly' && plan.household.people.length === 2)

/** The new lever cells on the converting plans (estate by timing; the tax cell is one value per plan side). */
const LEVER = {
  'example-couple': { estate: ['$0'], tax: ['$0'] },
  'bracket-fill-roth': { estate: ['$0'], tax: ['$0'] },
  'annuity-purchases-estate': { estate: ['+$135k', '+$105k'], tax: ['−$32k'] },
  'no-annuity-brokerage': { estate: ['+$104k', '+$81k'], tax: ['−$20k'] },
} as const

/**
 * What the lever did in each window year, as runs by reason in year order (the review's M1: executed dollars,
 * year by year). example-couple has no room while both work, converts at least the fill through 2032, and is
 * short from 2033 because Sam has no Roth account for Sam's share; bracket-fill-roth converts at least the fill
 * until its pre-tax balance is gone.
 */
const REASONS: Record<'example-couple' | 'bracket-fill-roth', Record<string, string>> = {
  'example-couple': {
    'alex@70': 'no-room 2026-2027; covered 2028-2032',
    'alex@75': 'no-room 2026-2027; covered 2028-2032; short 2033-2037',
    'alex@80': 'no-room 2026-2027; covered 2028-2032; short 2033-2041; no-balance 2042',
    'alex@85': 'no-room 2026-2027; covered 2028-2032; short 2033-2041; no-balance 2042-2047',
    'alex@90': 'no-room 2026-2027; covered 2028-2032; short 2033-2041; no-balance 2042-2052',
    'sam@70': 'no-room 2026-2027; covered 2028-2032; short 2033-2034',
    'sam@75': 'no-room 2026-2027; covered 2028-2032; short 2033-2039',
    'sam@80': 'no-room 2026-2027; covered 2028-2032; short 2033-2041; no-balance 2042-2044',
    'sam@85': 'no-room 2026-2027; covered 2028-2032; short 2033-2041; no-balance 2042-2049',
  },
  'bracket-fill-roth': {
    'p1@75': 'covered 2026-2028',
    'p1@80': 'covered 2026-2030; no-balance 2031-2033',
    'p1@85': 'covered 2026-2030; no-balance 2031-2038',
    'p1@90': 'covered 2026-2030; no-balance 2031-2043',
    'p2@75': 'covered 2026-2030',
    'p2@80': 'covered 2026-2030; no-balance 2031-2035',
    'p2@85': 'covered 2026-2030; no-balance 2031-2040',
  },
}

function reasonRuns(years: readonly { year: number; reason: string }[]): string {
  const groups = new Map<string, number[]>()
  for (const y of years) groups.set(y.reason, [...(groups.get(y.reason) ?? []), y.year])
  const runs = (ys: number[]) => {
    const out: string[] = []
    for (let i = 0; i < ys.length; ) {
      let j = i
      while (j + 1 < ys.length && ys[j + 1] === ys[j]! + 1) j++
      out.push(i === j ? `${ys[i]}` : `${ys[i]}-${ys[j]}`)
      i = j + 1
    }
    return out.join(',')
  }
  return [...groups].map(([reason, ys]) => `${reason} ${runs(ys)}`).join('; ')
}

describe('B2-P1 slice 5: the survivor transition on the 29 example plans', () => {
  it('has seven couples and 56 death timings', () => {
    expect(couples.map((c) => c.id).sort()).toEqual([
      'all-401k-no-bridge', 'annuity-purchases-estate', 'bracket-fill-roth', 'brokerage-bridge-401k', 'example-couple', 'no-annuity-brokerage', 'survivor-years',
    ])
  })

  let rows = 0
  let changed = 0
  let noAddedYear = 0
  it.each(couples.map((c) => [c.id, c.plan] as const))('%s: every figure but the lever is unchanged, and the lever adds to the plan\'s conversions', (id, plan) => {
    const analysis = survivorTransitionAnalysis(plan, { startYear: START, taxCalculator: taxCalculatorFor(plan) })
    expect(analysis.failedTimings).toBe(0)
    const converts = plan.strategies.rothConversion.mode !== 'none'
    for (const row of analysis.rows) {
      rows++
      const retired = retiredTiming(plan, row)
      expect(Object.is(row.baseEndingAfterTaxEstate, retired.baseEndingAfterTaxEstate)).toBe(true)
      expect(Object.is(row.baseLifetimeTax, retired.baseLifetimeTax)).toBe(true)
      expect(Object.is(row.ssa44PremiumSavings, retired.ssa44PremiumSavings)).toBe(true)
      expect(row.survivorShortfallYears).toBe(retired.survivorShortfallYears)
      // R16's second part changes nothing on the examples: in both fact years the required-spending
      // shortfall is the total within the ledger's funding tolerance (example-couple carries a
      // 3e-11 residue where the total is 0), so no degenerate verdict moves.
      expect(Math.abs(row.lastJointYear.requiredShortfall - retired.lastJointShortfall)).toBeLessThanOrEqual(0.005)
      expect(Math.abs(row.firstSurvivorYear.requiredShortfall - retired.firstSurvivorShortfall)).toBeLessThanOrEqual(0.005)
      expect(row.lastJointYear.requiredShortfall > 0.5).toBe(retired.lastJointShortfall > 0.5)
      // The SSA-44 total is the retired sum, and the relief-year part is all of it on every example.
      expect(Math.abs(row.ssa44PremiumSavings - row.ssa44ReliefYearSavings)).toBeLessThan(1)
      if (row.conversionLever.raisedYears.length === 0) noAddedYear++
      const same = Object.is(row.conversionLever.estateDelta, retired.estateDelta) && Object.is(row.conversionLever.lifetimeTaxDelta, retired.lifetimeTaxDelta)
      if (!converts) {
        expect(same, `${id} ${row.deceasedPersonId}@${row.deathAge}`).toBe(true)
        continue
      }
      if (!same) changed++
      const expected = LEVER[id as keyof typeof LEVER]
      expect(expected.estate as readonly string[]).toContain(leverText(row.conversionLever.estateDelta))
      expect(expected.tax as readonly string[]).toContain(leverText(row.conversionLever.lifetimeTaxDelta))
      if (id === 'example-couple' || id === 'bracket-fill-roth') {
        // The lever raises no year; why, year by year, is pinned in REASONS.
        expect(row.conversionLever.raisedYears).toEqual([])
        const key = `${row.deceasedPersonId.split('--')[1]}@${row.deathAge}`
        expect(reasonRuns(row.conversionLever.years), `${id} ${key}`).toBe(REASONS[id][key])
      }
    }
    if (id === 'survivor-years') {
      // Cash only: no pre-tax balance, so nothing is raised or covered.
      expect(analysis.rows.every((r) => r.conversionLever.raisedYears.length === 0 && r.conversionLever.coveredYears.length === 0)).toBe(true)
    }
  }, 300_000)

  it('counts 56 rows, 32 changed levers and 20 that raise no year', () => {
    expect(rows).toBe(56)
    expect(changed).toBe(32)
    expect(noAddedYear).toBe(20)
  })
})
