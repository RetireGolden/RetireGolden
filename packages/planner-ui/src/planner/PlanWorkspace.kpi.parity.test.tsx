/** @vitest-environment jsdom */
/**
 * B2-P1 slice 1 parity, rendered: the workspace KPI bar shows the engine's
 * figures.
 * - "Money lasts" reads `moneyLasts(result)`: "through L" (the last funded
 *   year, D - 1) with "steady markets · short in D" beneath it; a plan short
 *   from its first year says "short from S", the printed report's wording,
 *   rather than naming the year before the plan. It used to read "until D" /
 *   "depletes".
 * - "Ending net worth" shows today's dollars by the run's own factor,
 *   `toTodayDollars(basis, endYear, endingNetWorth)`.
 */
import 'fake-indexeddb/auto'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router'
import { IDBFactory } from 'fake-indexeddb'

import type { Plan } from '@retiregolden/engine/model/plan'
import { toTodayDollars } from '@retiregolden/engine/projection/dollarBasis'
import { moneyLasts } from '@retiregolden/engine/projection/moneyLasts'
import { cashAccount, singlePersonPlan, validatePlan } from '@retiregolden/engine/testing/planFixtures'
import { _resetPlanStoreForTests, savePlan } from '../data/planStore'
import { projectPlan } from '../projection'
import { waitFor } from '../testSupport/settle'
import { getExampleById } from './examples/registry'
import { fmtMoneyCompact } from './format'
import { PlanWorkspace } from './PlanWorkspace'

vi.mock('./useMcSuccessRate', () => ({
  useMcSuccessRateState: () => ({ rate: null, status: 'running', pathCount: 1_000 }),
}))

const START_YEAR = 2026

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

interface Kpi {
  value: string
  sub: string
}

async function kpisOf(plan: Plan): Promise<Record<string, Kpi>> {
  const saved = await savePlan(plan)
  if (!saved.ok) throw new Error('seed save failed')
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  try {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={[`/plan/${plan.id}/household`]}>
          <Routes>
            <Route path="/plan/:planId/*" element={<PlanWorkspace />}>
              <Route path="household" element={<div>Household section</div>} />
            </Route>
          </Routes>
        </MemoryRouter>,
      )
    })
    await waitFor(() => {
      const bar = container.querySelector('[aria-label="Plan headline results"]')
      return Boolean(bar && !bar.classList.contains('kpi-bar--incomplete') && bar.querySelector('.kpi-label'))
    })
    const out: Record<string, Kpi> = {}
    for (const kpi of container.querySelectorAll('[aria-label="Plan headline results"] .kpi')) {
      out[kpi.querySelector('.kpi-label')?.textContent ?? ''] = {
        value: kpi.querySelector('.kpi-value')?.textContent ?? '',
        sub: kpi.querySelector('.kpi-sub')?.textContent ?? '',
      }
    }
    return out
  } finally {
    await act(async () => root.unmount())
    container.remove()
  }
}

describe('KPI bar: Money lasts and ending net worth are the engine figures', () => {
  it('under-saved-single: through 2045, short in 2046 (it read "until 2046")', async () => {
    const plan = getExampleById('under-saved-single')!.build()
    const view = projectPlan(plan, START_YEAR)
    const lasts = moneyLasts(view.result)
    expect(lasts.lastFundedYear).toBe(2045)
    const kpis = await kpisOf(plan)
    expect(kpis['Money lasts']).toEqual({ value: 'through 2045', sub: 'steady markets · short in 2046' })
    const today = fmtMoneyCompact(toTodayDollars(view.basis, view.result.endYear, view.result.endingNetWorth))
    expect(kpis['Ending net worth']!.sub).toBe(`${today} today's $ · ${view.result.endYear}`)
  })

  it('example-couple: full plan, and the ending net worth in today dollars by the run factor', async () => {
    const plan = getExampleById('example-couple')!.build()
    const view = projectPlan(plan, START_YEAR)
    const kpis = await kpisOf(plan)
    expect(kpis['Money lasts']).toEqual({ value: 'full plan', sub: `steady markets · ${view.result.endYear}` })
    expect(kpis['Ending net worth']).toEqual({
      value: fmtMoneyCompact(view.result.endingNetWorth),
      sub: `${fmtMoneyCompact(toTodayDollars(view.basis, view.result.endYear, view.result.endingNetWorth))} today's $ · ${view.result.endYear}`,
    })
  })

  it('a plan short from its first year does not name the year before the plan', async () => {
    const plan = singlePersonPlan({ dob: '1960-01-01', planningAge: 90 })
    plan.accounts = [cashAccount('cash', 1_000)]
    plan.expenses.baseAnnual = 60_000
    const valid = validatePlan(plan)
    expect(moneyLasts(projectPlan(valid, START_YEAR).result).lastFundedYear).toBe(2025)
    const kpis = await kpisOf(valid)
    expect(kpis['Money lasts']).toEqual({ value: 'short from 2026', sub: 'steady markets · short in 2026' })
    expect(kpis['Money lasts']!.value).not.toContain('2025')
  })
})
