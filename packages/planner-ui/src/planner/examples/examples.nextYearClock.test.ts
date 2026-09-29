/**
 * Every library example shows exactly the same thing on 15 January of the
 * year after the one it is set in as it does today (decision D-2027-ROLLOVER,
 * 2026-09-28; the check's spec 1 and its c02 whole-result comparison).
 *
 * Each of the 29 examples is opened through the app's own route
 * (`prepareExampleOpen` writes the stamped demo to the browser store,
 * `loadPlan` reads it back through the migration), projected from the year the
 * pages use (`projectionStartYear`), screened by every Insights detector as
 * the Insights page screens it, and given the headline Monte Carlo options
 * the KPI bar's Market success runs with. The JSON of all of it, the whole
 * `ProjectionResult` with every year and every warning included, is required
 * to be byte-identical under today's clock and under a clock faked to
 * 2027-01-15. Before the start year was pinned, 29 of 29 KPI bars moved, 10
 * money-lasts years and 16 Market success percentages moved, and every
 * example gained "Plan last saved in 2026".
 *
 * Only `Date` is faked; the store's timers run as usual.
 */
import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'

import { runScreen } from '@retiregolden/engine/insights/runInsights'
import { _resetPlanStoreForTests, loadPlan } from '../../data/planStore'
import { DEFAULT_PATH_COUNT } from '../../mc/pool'
import { projectPlan, projectionStartYear } from '../../projection'
import { insightDetectorContext } from '../insights/insightContext'
import { headlineMcRunOptions } from '../useMcSuccessRate'
import { EXAMPLE_FIXED_YEAR } from './exampleClock'
import { prepareExampleOpen } from './loadExample'
import { EXAMPLE_PLANS } from './registry'

/** What the workspace shows for one example, as one string. */
async function shown(exampleId: string): Promise<string> {
  globalThis.indexedDB = new IDBFactory()
  _resetPlanStoreForTests()
  const opened = await prepareExampleOpen(exampleId)
  if (!opened.ok) throw new Error(opened.reason)
  const loaded = await loadPlan(opened.planId)
  if (!loaded.ok) throw new Error(loaded.reason)
  const plan = loaded.plan
  const startYear = projectionStartYear(plan)
  const view = projectPlan(plan, startYear)
  return JSON.stringify({
    startYear,
    repairs: loaded.repairs,
    result: view.result,
    summary: view.summary,
    insights: runScreen(insightDetectorContext(plan, view)),
    headlineMonteCarlo: headlineMcRunOptions(plan, DEFAULT_PATH_COUNT, startYear),
  })
}

beforeEach(() => {
  vi.useRealTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('library examples under next year’s clock', () => {
  it('there are 29 examples, each set in EXAMPLE_FIXED_YEAR', () => {
    expect(EXAMPLE_PLANS).toHaveLength(29)
    expect(EXAMPLE_FIXED_YEAR).toBe(2026)
  })

  it.each(EXAMPLE_PLANS.map((example) => example.id))(
    '%s shows the same result, warnings, Insights and Market success options on 2027-01-15 as today',
    async (exampleId) => {
      const today = await shown(exampleId)
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(new Date('2027-01-15T12:00:00.000Z'))
      const nextYear = await shown(exampleId)
      vi.useRealTimers()
      expect(JSON.parse(today).startYear).toBe(EXAMPLE_FIXED_YEAR)
      expect(nextYear).toBe(today)
      expect(nextYear).not.toContain('Plan last saved in')
      expect(nextYear).not.toContain('example-contract-input-mismatch')
    },
    60_000,
  )
})
