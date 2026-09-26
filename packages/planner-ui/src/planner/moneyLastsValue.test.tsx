/** @vitest-environment jsdom */
/**
 * One wording for one fact (owner decision R15): every "Money lasts" value
 * reads the engine's last funded year. "through L" names the last fully funded
 * year, "short from S" a plan short in its first year, "full plan" one that
 * never runs short; no surface says "until" the first short year any more.
 */
import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { parsePlan, type Plan } from '@retiregolden/engine/model/plan'
import { compareLtcStress } from '@retiregolden/engine/projection/compare'
import { moneyLasts } from '@retiregolden/engine/projection/moneyLasts'
import { cashAccount, singlePersonPlan, validatePlan } from '@retiregolden/engine/testing/planFixtures'

import { PlanStoreProvider } from '../data/PlanStoreProvider'
import type { PlanStore, PlanSummary } from '../data/planStoreContext'
import { renderStandaloneReportHtml } from '../report/reportHtml'
import { buildReportModel } from '../report/reportModel'
import { createSamplePlan } from '../testSupport/samplePlan'
import { settle, waitFor } from '../testSupport/settle'
import { ComparePlansPage } from './ComparePlansPage'
import { getExampleById } from './examples/registry'
import { moneyLastsValue } from './format'
import { PlanCtx } from './planContextCore'
import { InsuranceSection } from './sections/InsuranceSection'
import { projectPlan, taxCalculatorFor } from './useProjection'

const START_YEAR = 2026

beforeAll(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-07-01T12:00:00Z'))
})

afterAll(() => {
  vi.useRealTimers()
})

describe('moneyLastsValue', () => {
  it('names the last funded year, the first year when it is already short, or the full plan', () => {
    expect(moneyLastsValue({ depletionYear: null, lastFundedYear: 2052 }, 2026)).toBe('full plan')
    expect(moneyLastsValue({ depletionYear: 2046, lastFundedYear: 2045 }, 2026)).toBe('through 2045')
    expect(moneyLastsValue({ depletionYear: 2026, lastFundedYear: 2025 }, 2026)).toBe('short from 2026')
  })
})

let root: Root | null = null
let container: HTMLDivElement | null = null

afterEach(async () => {
  if (root !== null) await act(async () => root!.unmount())
  container?.remove()
  root = null
  container = null
})

async function mount(initialPlan: Plan, child: React.ReactNode) {
  function Harness() {
    const [plan] = useState(initialPlan)
    return (
      <PlanCtx.Provider value={{ plan, update: () => undefined, discardPendingSave: () => undefined, saveState: 'saved', issues: [] }}>
        {child}
      </PlanCtx.Provider>
    )
  }
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => root!.render(<MemoryRouter><Harness /></MemoryRouter>))
  return container
}

describe('the LTC stress table prints the engine last funded years', () => {
  it('a care episode the savings cannot carry reads "through L", never "until D"', async () => {
    const sample = createSamplePlan()
    sample.careEvents = sample.careEvents.map((event) => ({ ...event, annualCost: 1_000_000, durationYears: 10 }))
    const parsed = parsePlan(sample)
    if (!parsed.ok) throw new Error(parsed.issues.join('; '))
    const plan = parsed.plan
    const cmp = compareLtcStress(plan, { startYear: START_YEAR, taxCalculator: taxCalculatorFor(plan) })
    expect(cmp.lasts.careUninsured.depletionYear).not.toBeNull()
    const host = await mount(plan, <InsuranceSection />)
    const rows = [...host.querySelectorAll('table.compare-table tbody tr')]
    const cells = rows.map((row) => row.querySelectorAll('td')[1]!.textContent)
    expect(cells).toEqual([
      moneyLastsValue(cmp.lasts.noCare, START_YEAR),
      moneyLastsValue(cmp.lasts.careUninsured, START_YEAR),
      moneyLastsValue(cmp.lasts.careInsured, START_YEAR),
    ])
    expect(cells[1]).toBe(`through ${cmp.careUninsured.depletionYear! - 1}`)
    expect(cells.join(' ')).not.toMatch(/until/u)
  })
})

describe('the downloadable HTML report names the same years', () => {
  function html(plan: Plan): string {
    const { result, summary } = projectPlan(plan, START_YEAR)
    return renderStandaloneReportHtml(
      buildReportModel({ plan, result, summary, startYear: START_YEAR, generatedAtIso: '2026-07-11T00:00:00.000Z' }),
    )
  }

  it('under-saved-single: "Through 2045 (runs short in 2046)", where it used to say "Depletes in 2046"', () => {
    const plan = getExampleById('under-saved-single')!.build()
    expect(moneyLasts(projectPlan(plan, START_YEAR).result)).toMatchObject({ depletionYear: 2046, lastFundedYear: 2045 })
    const text = html(plan)
    expect(text).toContain('Through 2045 (runs short in 2046)')
    expect(text).not.toContain('Depletes in')
  })

  it('a plan short from its first year says so', () => {
    const plan = singlePersonPlan({ dob: '1960-01-01', planningAge: 90 })
    plan.accounts = [cashAccount('cash', 1_000)]
    plan.expenses.baseAnnual = 60_000
    const text = html(validatePlan(plan))
    expect(text).toContain('Short from 2026')
    expect(text).not.toContain('Through 2025')
  })
})

describe('Compare Plans names the same years', () => {
  function store(plans: Plan[]): PlanStore {
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

  it('the Money lasts row reads "through 2045" and "short from 2026", where it used to say "Depletes in"', async () => {
    const underSaved = getExampleById('under-saved-single')!.build()
    underSaved.id = 'plan-under-saved'
    underSaved.name = 'Under-saved'
    const shortPlan = singlePersonPlan({ dob: '1960-01-01', planningAge: 90 })
    shortPlan.accounts = [cashAccount('cash', 1_000)]
    shortPlan.expenses.baseAnnual = 60_000
    const firstYear = validatePlan(shortPlan)
    firstYear.id = 'plan-first-year'
    firstYear.name = 'Short at once'
    const expected: Record<string, string> = {}
    for (const plan of [underSaved, firstYear]) {
      const lasts = moneyLasts(projectPlan(plan, START_YEAR).result)
      expected[plan.name] = moneyLastsValue(lasts, START_YEAR)
    }
    expect(expected).toEqual({ 'Under-saved': 'through 2045', 'Short at once': 'short from 2026' })

    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    await act(async () =>
      root!.render(
        <MemoryRouter>
          <PlanStoreProvider store={store([underSaved, firstYear])}>
            <ComparePlansPage />
          </PlanStoreProvider>
        </MemoryRouter>,
      ),
    )
    await settle()
    await waitFor(() => container!.querySelector('.compare-table tbody') !== null, { what: 'compare table' })
    const names = [...container.querySelectorAll('.compare-table thead .compare-table-plan-name')].map((th) => th.textContent ?? '')
    const row = [...container.querySelectorAll('.compare-table tbody tr')].find((tr) => tr.querySelector('th')?.textContent === 'Money lasts')!
    const cells = [...row.querySelectorAll('td')].map((td) => td.textContent ?? '')
    expect(names).toHaveLength(2)
    expect(cells[0]).toBe(expected[names[0]!])
    expect(cells[1]).toBe(expected[names[1]!])
    expect(cells.join(' ')).not.toMatch(/Depletes|until/u)
  })
})
