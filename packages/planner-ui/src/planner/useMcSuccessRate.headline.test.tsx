/** @vitest-environment jsdom */
/**
 * Headline Monte Carlo count (#497): the run the Monte Carlo page publishes is
 * what every headline surface reports, with its own path count; the latest
 * publish wins (the page shows its latest run, so the headline must too); a
 * new plan object starts over. The publish predicate accepts only the
 * headline configuration.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'

import type { Plan } from '@retiregolden/engine/model/plan'
import type { MonteCarloSummary } from '@retiregolden/engine/montecarlo/run'
import { createSamplePlan } from '../testSupport/samplePlan'
import { seedFromPlanId } from './useProjection'
import { isHeadlineMcConfig, publishMcHeadline, publishedMcSummary, useMcSuccessRateState } from './useMcSuccessRate'

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
  it('adopts a published 10,000-path run and its count, then the latest run whatever its count', async () => {
    const plan = createSamplePlan()
    await act(async () => root.render(<Probe plan={plan} />))
    expect(container.textContent).toBe('running|null|1000')

    const tenK = summaryOf(0.42, 10_000)
    await act(async () => publishMcHeadline(plan, tenK))
    expect(container.textContent).toBe('done|0.42|10000')
    expect(publishedMcSummary(plan)).toBe(tenK)

    // The Monte Carlo page would now be showing this 1,000-path run, so the
    // headline follows it: one run, one count, everywhere it is quoted.
    await act(async () => publishMcHeadline(plan, summaryOf(0.41, 1_000)))
    expect(container.textContent).toBe('done|0.41|1000')

    // An edit is a new plan object: the published run belongs to the old one.
    const edited = structuredClone(plan)
    expect(publishedMcSummary(edited)).toBeUndefined()
    await act(async () => root.render(<Probe plan={edited} />))
    expect(container.textContent).toBe('running|null|1000')
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
