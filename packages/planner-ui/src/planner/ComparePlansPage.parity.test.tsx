/** @vitest-environment jsdom */
/**
 * B2-P1 slice 3 parity for the rendered Compare page on library examples: the
 * page prints the engine's comparePlanHeadlines, and the retired expressions
 * (kept here) show which cells stay and which move.
 *
 * - annuity-purchases-estate against no-annuity-brokerage (both end in 2056):
 *   the four money cells are the retired nominal subtraction, and the sentence
 *   and row labels say the rows are nominal.
 * - example-couple against hsa-stealth-retirement (2059 and 2076): the rows
 *   are in 2026 dollars (R13); the estate cell reads "−$466k" in red where the
 *   retired subtraction printed "+$330k" in green (a change, asserted); both
 *   plans run their full horizons, so Money lasts reads "both full plan" with
 *   no colour.
 * - The three non-money rows (Money lasts, Success % and Depletion age) on
 *   pairs where one plan depletes, both deplete, or both deplete in the same
 *   year: every cell (A, B, delta and its colour) is the retired page's
 *   (moneyLastsDelta, deterministicSuccessPct, ageDelta and primaryAgeIn, kept
 *   here), unchanged (PR #754 finding 3).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router'

import type { Plan } from '@retiregolden/engine/model/plan'
import { lastFundedYear, moneyLasts } from '@retiregolden/engine/projection/moneyLasts'
import { PlanStoreProvider } from '../data/PlanStoreProvider'
import type { PlanStore, PlanSummary } from '../data/planStoreContext'
import { projectPlan } from '../projection'
import { appExamplePlanById } from '../testSupport/appExamples'
import { settle, waitFor } from '../testSupport/settle'
import { formatDelta } from './compareDeltas'
import { moneyLastsValue } from './format'
import { EXAMPLE_FIXED_YEAR } from './examples/buildContext'
import { ComparePlansPage } from './ComparePlansPage'

function makeStore(plans: Plan[]): PlanStore {
  const docs = new Map<string, Plan>(plans.map((p) => [p.id, structuredClone(p)]))
  return {
    async listPlans(): Promise<PlanSummary[]> {
      return [...docs.values()].map((p) => ({ id: p.id, name: p.name, updatedAtIso: p.updatedAtIso }))
    },
    async loadPlan(id: string) {
      return docs.get(id) ?? null
    },
    async savePlan(plan: Plan) {
      docs.set(plan.id, structuredClone(plan))
    },
    async deletePlan(id: string) {
      docs.delete(id)
    },
  }
}

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  // The page projects both plans from the clock's year; pin it to the
  // examples' own start year.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(`${EXAMPLE_FIXED_YEAR}-07-01T12:00:00.000Z`))
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.useRealTimers()
})

/**
 * Example ids route to the browser's own example store, so the pair is saved
 * as two user plans (the ids play no part in a deterministic comparison).
 */
async function mountPair(a: Plan, b: Plan) {
  const left = { ...a, id: 'compare-plan-a', origin: 'user' as const }
  const right = { ...b, id: 'compare-plan-b', origin: 'user' as const }
  await act(async () => {
    root.render(
      <MemoryRouter>
        <PlanStoreProvider store={makeStore([left, right])}>
          <ComparePlansPage />
        </PlanStoreProvider>
      </MemoryRouter>,
    )
  })
  await settle()
  await waitFor(() => container.querySelector('.compare-table tbody') !== null, { what: 'compare table' })
}

/** Label, A, B and delta cells, and the delta cell's class, of each row. */
function rows(): { label: string; a: string; b: string; delta: string; deltaClass: string }[] {
  return [...container.querySelectorAll('.compare-table tbody tr')].map((tr) => {
    const cells = [...tr.querySelectorAll('td')]
    return {
      label: tr.querySelector('th')?.textContent ?? '',
      a: cells[0]?.textContent ?? '',
      b: cells[1]?.textContent ?? '',
      delta: cells[2]?.textContent ?? '',
      deltaClass: cells[2]?.className ?? '',
    }
  })
}

const row = (label: string) => {
  const found = rows().find((r) => r.label === label || r.label.startsWith(`${label} (`))
  expect(found, label).toBeDefined()
  return found!
}

// ------------------------------------------------ the retired page's non-money rows (ComparePlansPage.tsx and compareDeltas.ts at 4a80669e)
function retiredLastsLabel(plan: Plan): string {
  const view = projectPlan(plan, EXAMPLE_FIXED_YEAR)
  const lasts = moneyLasts(view.result)
  const value = moneyLastsValue(lasts, view.result.startYear)
  return lasts.depletionYear === null ? `${value} through ${lasts.endYear}` : value
}
function retiredPrimaryAgeIn(plan: Plan, year: number | null): number | null {
  if (year === null) return null
  const dobYear = Number(plan.household.people[0]?.dob.slice(0, 4))
  return Number.isFinite(dobYear) ? year - dobYear : null
}
function retiredDeltaClass(value: number | null): string {
  if (value === null || Math.abs(value) < 0.5) return ''
  return value > 0 ? 'delta-pos' : 'delta-neg'
}
const retiredSuccessPct = (depletionYear: number | null): number => (depletionYear === null ? 100 : 0)
function retiredMoneyLastsDelta(
  a: { depletionYear: number | null; endYear: number },
  b: { depletionYear: number | null; endYear: number },
): { value: number; label: string } {
  const value = lastFundedYear(b) - lastFundedYear(a)
  const aFull = a.depletionYear === null
  const bFull = b.depletionYear === null
  if (aFull && bFull) return { value: 0, label: a.endYear === b.endYear ? 'same' : 'both full plan' }
  if (!aFull && !bFull) return { value, label: formatDelta(value, 'years') }
  const bound = bFull ? '≥' : '≤'
  const years = formatDelta(value, 'years')
  return { value, label: years === 'same' ? `${bound} same` : `${bound} ${years}` }
}
/** The retired page's three non-money rows for Plan A against Plan B: A, B, delta text and class. */
function retiredNonMoneyRows(a: Plan, b: Plan) {
  const l = projectPlan(a, EXAMPLE_FIXED_YEAR)
  const r = projectPlan(b, EXAMPLE_FIXED_YEAR)
  const lasts = retiredMoneyLastsDelta(
    { depletionYear: l.summary.depletionYear, endYear: l.result.endYear },
    { depletionYear: r.summary.depletionYear, endYear: r.result.endYear },
  )
  const successA = retiredSuccessPct(l.summary.depletionYear)
  const successB = retiredSuccessPct(r.summary.depletionYear)
  const ageA = retiredPrimaryAgeIn(a, l.summary.depletionYear)
  const ageB = retiredPrimaryAgeIn(b, r.summary.depletionYear)
  const age = ageA === null || ageB === null ? null : ageB - ageA
  return {
    'Money lasts': { a: retiredLastsLabel(a), b: retiredLastsLabel(b), delta: lasts.label, deltaClass: retiredDeltaClass(lasts.value) },
    'Success % (deterministic)': {
      a: `${successA}%`,
      b: `${successB}%`,
      delta: formatDelta(successB - successA, 'pp'),
      deltaClass: retiredDeltaClass(successB - successA),
    },
    'Depletion age (primary)': {
      a: ageA === null ? '—' : String(ageA),
      b: ageB === null ? '—' : String(ageB),
      delta: age === null ? '—' : formatDelta(age, 'years'),
      deltaClass: retiredDeltaClass(age),
    },
  }
}

describe('Compare page on library examples (B2-P1 slice 3)', () => {
  it('prints the retired nominal money cells for two plans that end in the same year', async () => {
    const a = appExamplePlanById('annuity-purchases-estate')
    const b = appExamplePlanById('no-annuity-brokerage')
    await mountPair(a, b)
    const l = projectPlan(a, EXAMPLE_FIXED_YEAR).summary
    const r = projectPlan(b, EXAMPLE_FIXED_YEAR).summary
    expect(row('Ending net worth').delta).toBe(formatDelta(r.endingNetWorth - l.endingNetWorth, 'money'))
    expect(row('Ending investable').delta).toBe(formatDelta(r.endingInvestable - l.endingInvestable, 'money'))
    expect(row('After-tax estate').delta).toBe(formatDelta(r.endingAfterTaxEstate - l.endingAfterTaxEstate, 'money'))
    expect(row('Lifetime tax + penalties').delta).toBe(
      formatDelta(r.lifetimeTaxesAndPenalties - l.lifetimeTaxesAndPenalties, 'money'),
    )
    expect(row('After-tax estate').label).toBe('After-tax estate (2056 $)')
    expect(row('Lifetime tax + penalties').label).toBe('Lifetime tax + penalties (nominal)')
    expect(container.querySelector('.compare-basis')?.textContent).toBe(
      'Both plans end in 2056, so the dollar rows are nominal: the ending rows are in 2056 dollars and ' +
        "lifetime tax adds each year's own dollars. Each plan's dollars follow its own inflation assumption.",
    )
  })

  it('prints 2026 dollars for two plans that end in different years, and the estate cell changes sign', async () => {
    const a = appExamplePlanById('example-couple')
    const b = appExamplePlanById('hsa-stealth-retirement')
    await mountPair(a, b)
    const l = projectPlan(a, EXAMPLE_FIXED_YEAR).summary
    const r = projectPlan(b, EXAMPLE_FIXED_YEAR).summary
    // The retired subtraction of nominal figures of 2059 and 2076.
    expect(formatDelta(r.endingAfterTaxEstate - l.endingAfterTaxEstate, 'money')).toBe('+$330k')
    const estate = row('After-tax estate')
    expect(estate.label).toBe('After-tax estate (2026 $)')
    expect(estate.delta).toBe('−$466k')
    expect(estate.deltaClass).toBe('delta-neg')
    expect(row('Ending net worth').delta).toBe('−$331k')
    for (const label of ['Ending net worth', 'Ending investable', 'After-tax estate', 'Lifetime tax + penalties']) {
      expect(row(label).label, label).toBe(`${label} (2026 $)`)
    }
    expect(container.querySelector('.compare-basis')?.textContent).toBe(
      'Plan A ends in 2059 and Plan B in 2076, so every dollar row is in 2026 dollars: ' +
        "each plan's figures are divided by that plan's own inflation to the year they fall in. " +
        "The lifetime rows still cover each plan's own years.",
    )
    // Both plans run their full horizons: no difference is known, and the
    // cell carries no colour (the retired delta was 0, the horizon gap 17).
    const lasts = row('Money lasts')
    expect(lasts.delta).toBe('both full plan')
    expect(lasts.deltaClass).toBe('')
    expect(lasts.a).toBe('full plan through 2059')
    expect(lasts.b).toBe('full plan through 2076')
  })

  // PR #754 finding 3: the rendered Money lasts, Success % and Depletion age
  // rows against the retired page's own expressions, cell for cell.
  for (const [a, b, what, expected] of [
    ['example-couple', 'under-saved-single', 'only Plan B depletes', { lasts: '≤ −14 yrs', success: '−100 pp', age: '—' }],
    ['under-saved-single', 'ltc-shock', 'both deplete, in different years', { lasts: '−13 yrs', success: '0 pp', age: '−15 yrs' }],
    ['hsa-property-depth', 'brokerage-no-hsa', 'both deplete in the same year', { lasts: 'same', success: '0 pp', age: 'same' }],
  ] as const) {
    it(`prints the retired non-money rows when ${what} (${a} against ${b})`, async () => {
      const planA = appExamplePlanById(a)
      const planB = appExamplePlanById(b)
      await mountPair(planA, planB)
      const retired = retiredNonMoneyRows(planA, planB)
      for (const label of ['Money lasts', 'Success % (deterministic)', 'Depletion age (primary)'] as const) {
        const rendered = row(label)
        expect({ a: rendered.a, b: rendered.b, delta: rendered.delta, deltaClass: rendered.deltaClass }, label).toEqual(retired[label])
      }
      expect(row('Money lasts').delta).toBe(expected.lasts)
      expect(row('Success % (deterministic)').delta).toBe(expected.success)
      expect(row('Depletion age (primary)').delta).toBe(expected.age)
    })
  }
})
