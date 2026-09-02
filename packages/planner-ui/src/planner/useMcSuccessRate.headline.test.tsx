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
import { seedFromPlanId } from './useProjection'
import { isHeadlineMcConfig, publishMcHeadline, publishedMcSummary, registerMcHeadlineRun, useMcSuccessRateState } from './useMcSuccessRate'

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
    await act(async () => publishMcHeadline(plan, tenK))
    expect(container.textContent).toBe('done|0.42|10000')
    expect(publishedMcSummary(plan)).toBe(tenK)

    // A later coarser run never trades the precision away; an equal or finer
    // one replaces it.
    await act(async () => publishMcHeadline(plan, summaryOf(0.41, 1_000)))
    expect(container.textContent).toBe('done|0.42|10000')
    await act(async () => publishMcHeadline(plan, summaryOf(0.43, 10_000)))
    expect(container.textContent).toBe('done|0.43|10000')

    // An edit is a new plan object: the published run belongs to the old one.
    const edited = structuredClone(plan)
    expect(publishedMcSummary(edited)).toBeUndefined()
    await act(async () => root.render(<Probe plan={edited} />))
    expect(container.textContent).toBe('running|null|1000')
  })

  it('starts no default run of its own once a run is published for the plan', async () => {
    const plan = createSamplePlan()
    publishMcHeadline(plan, summaryOf(0.5, 10_000))
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
    registerMcHeadlineRun(plan, new Promise<MonteCarloSummary>((resolve) => { settle = resolve }))
    await act(async () => root.render(<Probe plan={plan} />))
    expect(container.textContent).toBe('running|null|1000')
    // The page's run is in flight, so the hook attaches at once (no debounce) and starts nothing.
    await act(async () => settle(summaryOf(0.37, 10_000)))
    expect(container.textContent).toBe('done|0.37|1000')
    expect(mockedRunMc).not.toHaveBeenCalled()
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
