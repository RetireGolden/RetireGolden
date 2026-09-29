/** @vitest-environment jsdom */
/**
 * A library example's pages at a clock of 15 January 2027 (decision
 * D-2027-ROLLOVER; review L5, 2026-09-29).
 *
 * `examples.nextYearClock.test.ts` holds every example's result identical at
 * both clocks, but it calls the projection directly, so it cannot see a page
 * that asks for the wrong start year. The review's mutants B01 to B07 each
 * replaced one page's `projectionStartYear(plan)` with the clock's year
 * (`projectionStartYear({ origin: 'user' })`), and all seven survived the
 * whole suite run at 2027, because nothing rendered an example's pages then.
 * This renders them, as the check's c01 did, and requires each to read 2026:
 *
 * - the KPI bar (PlanWorkspace) prints the 2026-start ending net worth, not
 *   the 2027-start one (B01);
 * - its Market success run starts in 2026 (B02);
 * - Insights shows the cards of the 2026-start projection, not the 2027 one
 *   (B03);
 * - Results' year table starts in 2026 (B04);
 * - the Report's year appendix starts in 2026 (B05);
 * - Scenarios compares the example's scenarios from 2026 (B06);
 * - the Monte Carlo page runs from 2026 (B07).
 */
import 'fake-indexeddb/auto'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router'
import { IDBFactory } from 'fake-indexeddb'

import type { Plan } from '@retiregolden/engine/model/plan'
import { runScreen } from '@retiregolden/engine/insights/runInsights'

import { _resetPlanStoreForTests, loadPlan } from '../data/planStore'
import { projectPlan } from '../projection'
import { mountPlanPage, yearTable } from '../testSupport/resultsPageMount'
import { waitFor } from '../testSupport/settle'
import { prepareExampleOpen } from './examples/loadExample'
import { fmtMoneyCompact } from './format'
import { insightDetectorContext } from './insights/insightContext'
import { InsightsPage } from './insights/InsightsPage'
import { MonteCarloPage } from './MonteCarloPage'
import { PlanWorkspace } from './PlanWorkspace'
import { ReportPage } from './ReportPage'
import { ResultsPage } from './ResultsPage'
import { ScenariosPage } from './ScenariosPage'

const monteCarloStartYears: number[] = []
vi.mock('../mc/pool', async (importOriginal) => {
  const original = await importOriginal<typeof import('../mc/pool')>()
  return {
    ...original,
    // Record the year each run starts in, and keep the run tiny.
    runMonteCarlo: vi.fn((plan: Plan, options: Parameters<typeof original.runMonteCarlo>[1]) => {
      monteCarloStartYears.push(options.startYear)
      return original.runMonteCarlo(plan, { ...options, pathCount: 8 })
    }),
  }
})

const scenarioStartYears: number[] = []
vi.mock('@retiregolden/engine/scenarios/scenarios', async (importOriginal) => {
  const original = await importOriginal<typeof import('@retiregolden/engine/scenarios/scenarios')>()
  return {
    ...original,
    compareScenarios: vi.fn((...args: Parameters<typeof original.compareScenarios>) => {
      scenarioStartYears.push(args[1].startYear)
      return original.compareScenarios(...args)
    }),
  }
})

const EXAMPLE = 'example-couple'

beforeAll(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  // Local noon, so the local calendar reads 2027 in any zone.
  vi.setSystemTime(new Date(2027, 0, 15, 12))
})

afterAll(() => {
  vi.useRealTimers()
})

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory()
  _resetPlanStoreForTests()
  localStorage.clear()
  monteCarloStartYears.length = 0
  scenarioStartYears.length = 0
})

/** The example as the app opens it: stamped, stored, read back. */
async function openedExample(): Promise<Plan> {
  const opened = await prepareExampleOpen(EXAMPLE)
  if (!opened.ok) throw new Error(opened.reason)
  const loaded = await loadPlan(opened.planId)
  if (!loaded.ok) throw new Error(loaded.reason)
  expect(loaded.plan.origin).toBe('example')
  return loaded.plan
}

describe(`${EXAMPLE} at 15 January 2027 reads 2026 on every page`, () => {
  it('the projection from 2027 differs from the one from 2026, so every check below can tell them apart', async () => {
    const plan = await openedExample()
    const from2026 = projectPlan(plan, 2026).result
    const from2027 = projectPlan(plan, 2027).result
    expect(fmtMoneyCompact(from2026.endingNetWorth)).not.toBe(fmtMoneyCompact(from2027.endingNetWorth))
  })

  it('the KPI bar prints the 2026-start ending net worth, and its Market success run starts in 2026 (B01, B02)', async () => {
    const plan = await openedExample()
    const expected = fmtMoneyCompact(projectPlan(plan, 2026).result.endingNetWorth)
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
      const kpis = [...container.querySelectorAll('[aria-label="Plan headline results"] .kpi')]
      const ending = kpis.find((kpi) => kpi.querySelector('.kpi-label')?.textContent === 'Ending net worth')
      expect(ending?.querySelector('.kpi-value')?.textContent).toBe(expected)
      // The headline run starts after its debounce.
      await waitFor(() => monteCarloStartYears.length > 0, { what: 'the headline Monte Carlo run', attempts: 1_000 })
      expect(new Set(monteCarloStartYears)).toEqual(new Set([2026]))
    } finally {
      await act(async () => root.unmount())
      container.remove()
    }
  }, 30_000)

  it('Insights shows the cards of the 2026-start projection (B03)', async () => {
    const plan = await openedExample()
    const titles = (startYear: number) =>
      runScreen(insightDetectorContext(plan, projectPlan(plan, startYear))).map((card) => card.title)
    expect(titles(2026)).not.toEqual(titles(2027))
    const page = await mountPlanPage(plan, <InsightsPage />, `/plan/${plan.id}/insights`)
    try {
      const shown = [...page.container.querySelectorAll('h3')].map((heading) => heading.textContent ?? '')
      for (const title of titles(2026)) expect(shown).toContain(title)
      for (const title of titles(2027).filter((title) => !titles(2026).includes(title))) expect(shown).not.toContain(title)
    } finally {
      await page.unmount()
    }
  })

  it('Results’ year table starts in 2026 (B04)', async () => {
    const plan = await openedExample()
    const page = await mountPlanPage(plan, <ResultsPage />)
    try {
      await waitFor(() => page.container.querySelector('#year-table table.year-table') !== null, { what: 'the year table' })
      expect(yearTable(page.container).years[0]).toBe(2026)
    } finally {
      await page.unmount()
    }
  })

  it('the Report’s year appendix starts in 2026 (B05)', async () => {
    // The report page reads the stored plan by its route, as the app opens it.
    const plan = await openedExample()
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    try {
      await act(async () => {
        root.render(
          <MemoryRouter initialEntries={[`/plan/${plan.id}/report`]}>
            <Routes>
              <Route path="/plan/:planId/report" element={<ReportPage />} />
            </Routes>
          </MemoryRouter>,
        )
      })
      await waitFor(() => container.querySelector('.report-appendix table tbody tr') !== null, { what: 'the report appendix', attempts: 1_000 })
      const firstRow = container.querySelector('.report-appendix table tbody tr')!
      expect(firstRow.querySelector('td')?.textContent).toBe('2026')
    } finally {
      await act(async () => root.unmount())
      container.remove()
    }
  }, 30_000)

  it('Scenarios compares the example’s scenarios from 2026 (B06)', async () => {
    const plan = await openedExample()
    expect(plan.scenarios.length).toBeGreaterThan(0)
    const page = await mountPlanPage(plan, <ScenariosPage />, `/plan/${plan.id}/scenarios`)
    try {
      await waitFor(() => scenarioStartYears.length > 0, { what: 'the scenario overview', attempts: 1_000 })
      expect(new Set(scenarioStartYears)).toEqual(new Set([2026]))
    } finally {
      await page.unmount()
    }
  }, 30_000)

  it('the Monte Carlo page runs from 2026 (B07)', async () => {
    const plan = await openedExample()
    const page = await mountPlanPage(plan, <MonteCarloPage />, `/plan/${plan.id}/monte-carlo`)
    try {
      await waitFor(() => monteCarloStartYears.length > 0, { what: 'the Monte Carlo page run', attempts: 1_000 })
      expect(new Set(monteCarloStartYears)).toEqual(new Set([2026]))
    } finally {
      await page.unmount()
    }
  }, 30_000)
})
