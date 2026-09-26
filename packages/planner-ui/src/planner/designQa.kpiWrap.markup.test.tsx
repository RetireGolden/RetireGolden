/** @vitest-environment jsdom */
/**
 * Design QA: the KPI bar's worded "Money lasts" value never paints past its
 * cell. "short from 2026" (a plan short in its first year, one wording on every
 * surface under owner decision R15) is 15 characters; the bar's cells are a
 * 10rem minimum track with a no-wrap value, and cluster J (#572) budgets 12
 * characters for one line of value there.
 *
 * jsdom computes no layout, so, as in cluster I, the pins hold what decides
 * the geometry. This markup half: the value carries `kpi-value--wrap` and every
 * word of it fits cluster J's one-line budget, so a wrapped value is never
 * wider than a cell. The stylesheet half (designQa.kpiWrap.test.ts): that class
 * wraps between words, and breaks a word only if one alone could not fit.
 * The measurements that chose the rule were
 * taken in Chromium on the real planner.css with the bar's five KPIs, sweeping
 * the bar from 300px to the viewport width in 4px steps:
 *
 *   viewport  value font  before (no wrap)                 after (wrap)
 *   1024      22.5px      172px of text in 160-171px cells, 0 overflows
 *                         40 overflows, worst 11px
 *   1440      24px        62 overflows, worst 23px          0 overflows
 *   768       18.4px      0 overflows (the text fits)       0 overflows
 *
 * With the wrap the value takes two lines only in the narrow cells that could
 * not hold it (bars up to 936px wide at 1024) and one line everywhere else.
 */
import 'fake-indexeddb/auto'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router'
import { IDBFactory } from 'fake-indexeddb'

import { cashAccount, singlePersonPlan, validatePlan } from '@retiregolden/engine/testing/planFixtures'
import { _resetPlanStoreForTests, savePlan } from '../data/planStore'
import { waitFor } from '../testSupport/settle'
import { PlanWorkspace } from './PlanWorkspace'

vi.mock('./useMcSuccessRate', () => ({
  useMcSuccessRateState: () => ({ rate: 0.4, status: 'done', pathCount: 1_000 }),
}))

/** Cluster J's budget: the characters of value one line of a 10rem KPI cell holds (designQa.clusterJ.kpi). */
const KPI_VALUE_LINE_BUDGET = 12

let root: Root | null = null
let container: HTMLDivElement | null = null

beforeAll(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-07-01T12:00:00Z'))
})

afterAll(() => {
  vi.useRealTimers()
})

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory()
  _resetPlanStoreForTests()
  localStorage.clear()
})

afterEach(async () => {
  if (root !== null) await act(async () => root!.unmount())
  container?.remove()
  root = null
  container = null
})

describe('design QA: the worded Money lasts value wraps instead of overflowing its KPI cell', () => {
  it('a plan short in its first year shows "short from 2026" as a wrapping value whose every word fits one line', async () => {
    const plan = singlePersonPlan({ dob: '1960-01-01', planningAge: 90 })
    plan.accounts = [cashAccount('cash', 1_000)]
    plan.expenses.baseAnnual = 60_000
    const valid = validatePlan(plan)
    const saved = await savePlan(valid)
    if (!saved.ok) throw new Error('seed save failed')
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    await act(async () => {
      root!.render(
        <MemoryRouter initialEntries={[`/plan/${valid.id}/household`]}>
          <Routes>
            <Route path="/plan/:planId/*" element={<PlanWorkspace />}>
              <Route path="household" element={<div>Household section</div>} />
            </Route>
          </Routes>
        </MemoryRouter>,
      )
    })
    await waitFor(() => {
      const bar = container!.querySelector('[aria-label="Plan headline results"]')
      return Boolean(bar && !bar.classList.contains('kpi-bar--incomplete') && bar.querySelector('.kpi-label'))
    })
    const kpis = [...container.querySelectorAll('[aria-label="Plan headline results"] .kpi')]
    const lasts = kpis.find((kpi) => kpi.querySelector('.kpi-label')?.textContent === 'Money lasts')!
    const value = lasts.querySelector('.kpi-value')!
    const text = value.textContent ?? ''
    expect(text).toBe('short from 2026')
    // Longer than one line of the cell, so it must be the wrapping kind...
    expect(text.length).toBeGreaterThan(KPI_VALUE_LINE_BUDGET)
    expect(value.classList.contains('kpi-value--wrap')).toBe(true)
    // ...and wrapped between words, no line is longer than the budget.
    for (const word of text.split(/\s+/)) expect(word.length, word).toBeLessThanOrEqual(KPI_VALUE_LINE_BUDGET)
    // Numbers keep the no-wrap rule: a money figure must never split.
    for (const kpi of kpis) {
      if (kpi === lasts) continue
      expect(kpi.querySelector('.kpi-value')!.classList.contains('kpi-value--wrap'), kpi.textContent ?? '').toBe(false)
    }
  })
})
