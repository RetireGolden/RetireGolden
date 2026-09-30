/**
 * B2-P1 slice 4 parity on the 29 example plans: the Social Security analysis
 * page now reads the engine's models, and this pins, row by row, what that
 * changed and what it did not, against copies of the retired planner-ui
 * functions kept here (socialSecurity/breakEven.ts#computeBreakEven and
 * socialSecurity/expectedPv.ts#expectedPvSingle, whose survival curve, the
 * identity on the 2022 table's e(x), is replaced by one read off SSA's
 * published q since D-LIFE-TABLE-2023).
 *
 * - Break-even (owner decision R6): every crossing callout the retired chart
 *   printed is unchanged, and every cumulative value is the retired one times
 *   (1 + c)^(62 - age in the start year), the plan's dollars.
 * - Benefits only (R7): a single claimant with no former-spouse record prices
 *   within 1e-12 of the retired model's sum at all 17 slider rates, on a
 *   survival curve read straight off SSA's published q (since D-LIFE-TABLE-2023;
 *   an 'average' single is exactly the mean of a man and a woman); couples
 *   price on the ledger's spouse and survivor rules, and their 2% headlines are
 *   pinned.
 * - The couple primer's PIA x 12 is unchanged.
 *
 * @see DOCS/calculations/social-security/social-security-claim-break-even.md
 * @see DOCS/calculations/social-security/social-security-expected-value.md
 */
import { describe, expect, it } from 'vitest'

import type { Plan } from '@retiregolden/engine/model/plan'
import type { Sex } from '@retiregolden/engine/longevity/types'
import { SSA_PERIOD_LIFE_TABLE } from '@retiregolden/engine/longevity/ssaPeriodLifeTable'
import { claimFactor } from '@retiregolden/engine/socialSecurity/claimFactor'
import { breakEvenClaimAges, claimBreakEven } from '@retiregolden/engine/socialSecurity/analysis/breakEven'
import { benefitsOnlyRanking } from '@retiregolden/engine/socialSecurity/analysis/expectedValue'
import { EXAMPLE_PLANS } from './examples/registry'
import { fmtMoneyCompact } from './format'
import { claimingPeople, dobParts } from './ssAnalysis'

const START = 2026
const RATES = Array.from({ length: 17 }, (_, i) => i * 0.5)

// ---------------------------------------------------------------- the retired functions
/** The retired break-even: COLA from 62 on the start-year PIA, running totals unrounded here. */
function retiredBreakEvenSeries(dob: { year: number; month: number; day: number }, pia: number, claimAges: number[], colaPct: number, growthPct: number, throughAge: number) {
  const cola = colaPct / 100
  const g = growthPct / 100
  const factors: Record<number, number> = {}
  for (const a of claimAges) factors[a] = claimFactor(dob.year, dob.month, dob.day, { years: a, months: 0 })
  const balance: Record<number, number> = {}
  for (const a of claimAges) balance[a] = 0
  const series: { age: number; cumulative: Record<number, number> }[] = []
  for (let age = 62; age <= throughAge; age++) {
    const cumulative: Record<number, number> = {}
    for (const a of claimAges) {
      balance[a] = balance[a]! * (1 + g) + (age < a ? 0 : pia * factors[a]! * 12 * Math.pow(1 + cola, age - 62))
      cumulative[a] = balance[a]!
    }
    series.push({ age, cumulative })
  }
  return series
}

/** The retired crossing, on the whole-dollar totals the retired chart used, printed to a tenth. */
function retiredCallouts(series: { age: number; cumulative: Record<number, number> }[], claimAges: number[], throughAge: number): string[] {
  const rounded = series.map((point) => ({ age: point.age, cumulative: Object.fromEntries(Object.entries(point.cumulative).map(([k, v]) => [k, Math.round(v)])) }))
  const sorted = [...claimAges].sort((a, b) => a - b)
  const out: string[] = []
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const early = sorted[i]!
      const late = sorted[j]!
      let cross: number | null = null
      let previous: number | null = null
      for (const point of rounded) {
        if (point.cumulative[early]! <= 0) continue
        const difference = point.cumulative[late]! - point.cumulative[early]!
        if (difference >= 0) {
          cross = previous !== null && previous < 0 ? point.age - 1 + -previous / (difference - previous) : point.age
          break
        }
        previous = difference
      }
      out.push(callout(early, late, cross === null ? null : Math.round(cross * 10) / 10, throughAge))
    }
  }
  return out
}

function callout(early: number, late: number, age: number | null, throughAge: number): string {
  return age === null ? `${early} vs ${late}: never by ${throughAge}` : `${early} vs ${late}: around age ${age}`
}

/**
 * The survival curve read straight off SSA's published q(x) (the 2023 period
 * table the engine carries), independently of the engine's curve: the product
 * of (1 - q) over the whole ages from `from` to `to` - 1, with the table's last
 * row closed (q = 1 from 119); for 'average', the mean of the man's and the
 * woman's products. Until D-LIFE-TABLE-2023 this was the retired planner-ui
 * curve, the half-year identity on the 2022 table's printed e(x).
 */
function publishedSurvival(sex: Sex): (from: number, to: number) => number {
  const product = (column: readonly number[], from: number, to: number): number => {
    let s = 1
    for (let age = from; age < to; age++) s *= age >= 119 ? 0 : 1 - column[age]!
    return s
  }
  return (from, to) => {
    if (to <= from) return 1
    const male = product(SSA_PERIOD_LIFE_TABLE.male.q, from, to)
    const female = product(SSA_PERIOD_LIFE_TABLE.female.q, from, to)
    return sex === 'average' ? (male + female) / 2 : sex === 'male' ? male : female
  }
}

/** The retired single expected PV (no floor: none of the examples has a former-spouse record), on the published survival. */
function retiredExpectedPvSingle(currentAge: number, dob: { year: number; month: number; day: number }, sex: Sex, pia: number, claimYears: number, rate: number): number {
  const survival = publishedSurvival(sex)
  const benefit = pia * claimFactor(dob.year, dob.month, dob.day, { years: claimYears, months: 0 }) * 12
  let pv = 0
  for (let age = Math.max(currentAge, claimYears); age <= SSA_PERIOD_LIFE_TABLE.male.q.length - 1; age++) {
    pv += survival(currentAge, age) * benefit * Math.pow(1 + rate, -(age - currentAge))
  }
  return pv
}

// ---------------------------------------------------------------- the examples
const examples: { id: string; plan: Plan }[] = EXAMPLE_PLANS.map((example) => ({ id: example.id, plan: example.build() }))

describe('B2-P1 slice 4 on the 29 example plans', () => {
  it('break-even: the callouts are unchanged and every dollar is the retired one in the plan\'s dollars', () => {
    let people = 0
    let values = 0
    for (const { id, plan } of examples) {
      if (plan.assumptions.ssHaircut !== null) throw new Error(`${id} sets a haircut, which moves the crossings; this check assumes none`)
      const colaPct = plan.assumptions.ssCola.mode === 'fixed' ? plan.assumptions.ssCola.annualPct : plan.assumptions.inflationPct
      for (const { person, pia } of claimingPeople(plan, START)) {
        const { y, m, d } = dobParts(person)
        const dob = { year: y, month: m, day: d }
        const claimAges = breakEvenClaimAges(dob, START)
        if (claimAges.length < 2) continue
        people += 1
        const throughAge = person.longevity.planningAge
        const anchor = Math.pow(1 + colaPct / 100, 62 - (START - y))
        for (const growthPct of [0, 3, 5, 7]) {
          const retired = retiredBreakEvenSeries(dob, pia, claimAges, colaPct, growthPct, throughAge)
          const engine = claimBreakEven({ dob, piaMonthly: pia, claimAges, startYear: START, assumptions: plan.assumptions, growthPct, throughAge })
          const engineCallouts = engine.crossings.map((c) => callout(c.early, c.late, c.age === null ? null : Math.round(c.age * 10) / 10, throughAge))
          expect(engineCallouts, `${id} ${person.id} at ${growthPct}%`).toEqual(retiredCallouts(retired, claimAges, throughAge))
          engine.series.forEach((point, index) => {
            for (const a of claimAges) {
              values += 1
              const expected = retired[index]!.cumulative[a]! * anchor
              const actual = point.cumulative[a]!
              expect(Math.abs(actual - expected) <= 1e-9 * Math.max(1, Math.abs(expected)), `${id} ${person.id} ${growthPct}% age ${point.age} claim ${a}: ${actual} against ${expected}`).toBe(true)
            }
          })
        }
      }
    }
    expect(people).toBeGreaterThan(0)
    expect(values).toBeGreaterThan(0)
  })

  it('benefits only: a single claimant with no former spouse prices within 1e-12 of the retired sum on SSA\'s published q (for \'average\', the mean of a man and a woman) at every rate', () => {
    let rows = 0
    for (const { id, plan } of examples) {
      const people = claimingPeople(plan, START)
      if (people.length !== 1) continue
      const { person, pia, stream } = people[0]!
      if ((stream.formerSpouses ?? []).length > 0) throw new Error(`${id} has a former-spouse record; this check assumes none`)
      const { y, m, d } = dobParts(person)
      for (const rate of RATES) {
        for (const row of benefitsOnlyRanking(plan, rate / 100, START).rows) {
          rows += 1
          const expected = retiredExpectedPvSingle(START - y, { year: y, month: m, day: d }, person.sex, pia, row.claimByPersonId[person.id]!, rate / 100)
          expect(Math.abs(row.expectedPv - expected) <= 1e-12 * Math.abs(expected), `${id} ${rate}% claim ${row.claimByPersonId[person.id]}: ${row.expectedPv} against ${expected}`).toBe(true)
        }
      }
    }
    expect(rows).toBeGreaterThan(0)
  })

  it("benefits only: couples price on the ledger's spouse and survivor rules (the 2% headlines)", () => {
    const headline = (id: string): string => {
      const plan = examples.find((example) => example.id === id)!.plan
      const ranking = benefitsOnlyRanking(plan, 0.02, START)
      const best = ranking.ranked[0]!
      return `${ranking.personIds.map((personId) => best.claimByPersonId[personId]).join('/')} ${fmtMoneyCompact(best.expectedPv)}`
    }
    // On SSA's 2023 period table (D-LIFE-TABLE-2023); on the 2022 table's
    // identity they were 70/62 $841k, 64/69 $853k, 70/63 $784k twice and
    // 70/62 $425k twice. The two 401(k) couples are two 'average' people each.
    // Example-couple's 70/62 was $865k until the earnings test was counted
    // (D-SS-ANALYSIS-EARNINGS-TEST): Sam's claims at 62 and 63 are withheld from
    // their first month of entitlement while she works, the months of the claim
    // year before it paid in full (403(f)(1)(A)).
    expect(headline('example-couple')).toBe('70/63 $860k')
    expect(headline('survivor-years')).toBe('64/70 $876k')
    expect(headline('annuity-purchases-estate')).toBe('70/63 $805k')
    expect(headline('no-annuity-brokerage')).toBe('70/63 $805k')
    expect(headline('all-401k-no-bridge')).toBe('70/62 $442k')
    expect(headline('brokerage-bridge-401k')).toBe('70/62 $442k')
  })

  it("the couple primer's PIA x 12 is the resolved PIA, unchanged", () => {
    const primer = (id: string): string =>
      [...claimingPeople(examples.find((example) => example.id === id)!.plan, START)]
        .sort((a, b) => b.pia - a.pia)
        .map((p) => fmtMoneyCompact(p.pia * 12))
        .join(' / ')
    expect(primer('example-couple')).toBe('$35k / $23k')
    expect(primer('bracket-fill-roth')).toBe('$30k / $22k')
    expect(primer('survivor-years')).toBe('$36k / $12k')
    expect(primer('annuity-purchases-estate')).toBe('$32k / $21k')
    expect(primer('all-401k-no-bridge')).toBe('$31k / $23k')
  })
})
