/** @vitest-environment jsdom */
/**
 * Headline Monte Carlo count (#497): the run the Monte Carlo page publishes is
 * what every headline surface reports, with its own path count; a coarser
 * later publish never replaces a finer one (the Monte Carlo page shows the
 * published run, so the two agree); once a run is published the hook starts
 * no default run of its own; a new plan object starts over. The publish
 * predicate accepts only the headline configuration.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'

import type { Plan } from '@retiregolden/engine/model/plan'
import type { MonteCarloSummary } from '@retiregolden/engine/montecarlo/run'
import { createSamplePlan } from '../testSupport/samplePlan'
import { currentStartYear, seedFromPlanId } from './useProjection'
import {
  headlineMcRun,
  isHeadlineMcConfig,
  publishMcHeadline,
  publishedMcSummary,
  registerMcHeadlineRun,
  useMcSuccessRateState,
} from './useMcSuccessRate'

vi.mock('../mc/pool', async (importOriginal) => {
  const original = await importOriginal<typeof import('../mc/pool')>()
  return { ...original, runMonteCarlo: vi.fn(original.runMonteCarlo) }
})

import * as pool from '../mc/pool'
const mockedRunMc = vi.mocked(pool.runMonteCarlo)

function Probe({ plan }: { plan: Plan }) {
  const s = useMcSuccessRateState(plan, true)
  return <output>{`${s.status}|${s.rate ?? 'null'}|${s.pathCount}`}</output>
}

/** Only the two fields the headline reads; the page-level test uses a real summary. */
function summaryOf(successRate: number, pathCount: number): MonteCarloSummary {
  return { successRate, pathCount } as MonteCarloSummary
}

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  vi.clearAllMocks()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(async () => {
  // Unmounted well inside the 1,200 ms debounce, so no default run ever starts.
  await act(async () => root.unmount())
  container.remove()
})

describe('Monte Carlo headline (#497)', () => {
  it('adopts a published 10,000-path run and its count, and keeps it over a later coarser run', async () => {
    const plan = createSamplePlan()
    await act(async () => root.render(<Probe plan={plan} />))
    expect(container.textContent).toBe('running|null|1000')

    const tenK = summaryOf(0.42, 10_000)
    await act(async () => publishMcHeadline(plan, tenK, currentStartYear()))
    expect(container.textContent).toBe('done|0.42|10000')
    expect(publishedMcSummary(plan)).toBe(tenK)

    // A later coarser run never trades the precision away; an equal or finer
    // one replaces it.
    await act(async () => publishMcHeadline(plan, summaryOf(0.41, 1_000), currentStartYear()))
    expect(container.textContent).toBe('done|0.42|10000')
    await act(async () => publishMcHeadline(plan, summaryOf(0.43, 10_000), currentStartYear()))
    expect(container.textContent).toBe('done|0.43|10000')

    // An edit is a new plan object: the published run belongs to the old one.
    const edited = structuredClone(plan)
    expect(publishedMcSummary(edited)).toBeUndefined()
    await act(async () => root.render(<Probe plan={edited} />))
    expect(container.textContent).toBe('running|null|1000')
  })

  it('starts no default run of its own once a run is published for the plan', async () => {
    const plan = createSamplePlan()
    publishMcHeadline(plan, summaryOf(0.5, 10_000), currentStartYear())
    await act(async () => root.render(<Probe plan={plan} />))
    expect(container.textContent).toBe('done|0.5|10000')
    // Past the 1,200 ms debounce: nothing was scheduled, so nothing runs.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 1400))
    })
    expect(mockedRunMc).not.toHaveBeenCalled()
  })

  it('attaches to a Monte Carlo page run registered for the plan instead of launching its own', async () => {
    const plan = createSamplePlan()
    let settle: (s: MonteCarloSummary) => void = () => {}
    registerMcHeadlineRun(plan, new Promise<MonteCarloSummary>((resolve) => { settle = resolve }), 10_000, currentStartYear())
    await act(async () => root.render(<Probe plan={plan} />))
    // Busy copy names the run in flight, not the default (#497 review round 5).
    expect(container.textContent).toBe('running|null|10000')
    // The page's run is in flight, so the hook attaches at once (no debounce) and starts nothing.
    // The count rides with the rate: the attached run was 10,000 paths, and
    // the KPI says so even though nothing has been published yet.
    await act(async () => settle(summaryOf(0.37, 10_000)))
    expect(container.textContent).toBe('done|0.37|10000')
    expect(mockedRunMc).not.toHaveBeenCalled()
  })

  // PR #754 findings 1 and 2: a headline run carries the start year its
  // paths begin in, which outlives a New Year with the plan object.
  it('keeps each headline run\'s own start year across a New Year, published or in flight', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    try {
      vi.setSystemTime(new Date('2026-12-31T12:00:00.000Z'))
      const published = createSamplePlan()
      publishMcHeadline(published, summaryOf(0.42, 10_000), currentStartYear())
      const inFlight = createSamplePlan()
      let settle: (s: MonteCarloSummary) => void = () => {}
      registerMcHeadlineRun(inFlight, new Promise<MonteCarloSummary>((resolve) => { settle = resolve }), 10_000, currentStartYear())

      vi.setSystemTime(new Date('2027-01-02T12:00:00.000Z'))
      expect(currentStartYear()).toBe(2027)
      await expect(headlineMcRun(published)).resolves.toEqual({ successRate: 0.42, pathCount: 10_000, startYear: 2026 })
      const pending = headlineMcRun(inFlight)
      settle(summaryOf(0.37, 10_000))
      await expect(pending).resolves.toEqual({ successRate: 0.37, pathCount: 10_000, startYear: 2026 })

      // A run from the new year replaces a finer one from the old year: it is
      // a different simulation, not a coarser copy of the same one.
      publishMcHeadline(published, summaryOf(0.4, 1_000), currentStartYear())
      await expect(headlineMcRun(published)).resolves.toEqual({ successRate: 0.4, pathCount: 1_000, startYear: 2027 })
      expect(mockedRunMc).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })

  it('only the headline configuration may publish: same model, vol, weight, seed, no shocks', () => {
    const plan = createSamplePlan()
    const headline = {
      modelKind: 'lognormal' as const,
      returnVolPct: 12,
      equityWeightPct: 60,
      seed: seedFromPlanId(plan.id),
      stochasticLongevity: false,
      ltcShock: false,
    }
    expect(isHeadlineMcConfig(plan, headline)).toBe(true)
    expect(isHeadlineMcConfig(plan, { ...headline, modelKind: 'hist-iid' })).toBe(false)
    expect(isHeadlineMcConfig(plan, { ...headline, returnVolPct: 15 })).toBe(false)
    expect(isHeadlineMcConfig(plan, { ...headline, equityWeightPct: 80 })).toBe(false)
    expect(isHeadlineMcConfig(plan, { ...headline, seed: headline.seed + 1 })).toBe(false)
    expect(isHeadlineMcConfig(plan, { ...headline, stochasticLongevity: true })).toBe(false)
    expect(isHeadlineMcConfig(plan, { ...headline, ltcShock: true })).toBe(false)
  })
})
