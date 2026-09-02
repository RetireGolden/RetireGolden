/** @vitest-environment jsdom */
/**
 * Headline Monte Carlo count (#497): a higher-precision run published by the
 * Monte Carlo page is what every headline surface reports, with its own path
 * count; a lower-precision publish never replaces it; a new plan object
 * starts over. The publish predicate accepts only the headline configuration.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'

import type { Plan } from '@retiregolden/engine/model/plan'
import { createSamplePlan } from '../testSupport/samplePlan'
import { seedFromPlanId } from './useProjection'
import { isHeadlineMcConfig, publishMcHeadline, useMcSuccessRateState } from './useMcSuccessRate'

function Probe({ plan }: { plan: Plan }) {
  const s = useMcSuccessRateState(plan, true)
  return <output>{`${s.status}|${s.rate ?? 'null'}|${s.pathCount}`}</output>
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
  it('adopts a published 10,000-path run and its count, and keeps it over a later coarser one', async () => {
    const plan = createSamplePlan()
    await act(async () => root.render(<Probe plan={plan} />))
    expect(container.textContent).toBe('running|null|1000')

    await act(async () => publishMcHeadline(plan, { rate: 0.42, pathCount: 10_000 }))
    expect(container.textContent).toBe('done|0.42|10000')

    await act(async () => publishMcHeadline(plan, { rate: 0.5, pathCount: 1_000 }))
    expect(container.textContent).toBe('done|0.42|10000')

    // An edit is a new plan object: the published run belongs to the old one.
    const edited = structuredClone(plan)
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
