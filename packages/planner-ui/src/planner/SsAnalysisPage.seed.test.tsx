/** @vitest-environment jsdom */
/**
 * The Social Security analysis runs its Monte Carlo comparisons on the
 * engine's default seed (decision D-MC-DEFAULT-SEED, 2026-09-28; review
 * finding M3, S09): the robustness check of the top claim ages and the
 * bridge comparison both pair their variants on it.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router'

import type { Plan } from '@retiregolden/engine/model/plan'

vi.mock('../mc/pool', async (importOriginal) => {
  const original = await importOriginal<typeof import('../mc/pool')>()
  return {
    ...original,
    runMonteCarlo: vi.fn((plan: Plan, opts: Parameters<typeof original.runMonteCarlo>[1]) =>
      original.runMonteCarlo(plan, { ...opts, pathCount: 4 }),
    ),
  }
})

import { runMonteCarlo } from '../mc/pool'
import { createSamplePlan } from '../testSupport/samplePlan'
import { waitFor } from '../testSupport/settle'
import { PlanCtx, type PlanContextValue } from './planContextCore'
import { SsAnalysisPage } from './SsAnalysisPage'

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  vi.mocked(runMonteCarlo).mockClear()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

function contextFor(plan: Plan): PlanContextValue {
  return { plan, update: () => {}, discardPendingSave: () => {}, saveState: 'saved', issues: [] }
}

const button = (text: string) => [...container.querySelectorAll('button')].find((b) => b.textContent === text)

describe('Social Security analysis Monte Carlo seed', () => {
  it('runs the robustness check and the bridge comparison on seed 6,221,293', async () => {
    // The robustness check is offered only on a ranking the page stands
    // behind (B2-P1 slice 5): the sample plan's Marketplace credit is
    // unpriced from 2028, which refuses the ranking; without the credit it
    // ranks, as workerErrors.test.tsx sets it up.
    const plan = createSamplePlan()
    plan.expenses.healthcare = { ...plan.expenses.healthcare, applyAcaCredit: false }
    await act(async () => {
      root.render(
        <MemoryRouter>
          <PlanCtx.Provider value={contextFor(plan)}>
            <SsAnalysisPage />
          </PlanCtx.Provider>
        </MemoryRouter>,
      )
    })
    await waitFor(
      () => button('Check robustness (Monte Carlo, top 5)') !== undefined && container.querySelector('.skeleton') === null,
      { what: 'the claim-age sweep', attempts: 600, intervalMs: 20 },
    )
    await act(async () => button('Check robustness (Monte Carlo, top 5)')!.click())
    await waitFor(() => vi.mocked(runMonteCarlo).mock.calls.length >= 1 && button('Running…') === undefined, {
      what: 'the robustness runs',
      attempts: 3_000,
      intervalMs: 20,
    })
    const robustness = vi.mocked(runMonteCarlo).mock.calls.length
    expect(robustness).toBeGreaterThan(0)

    // "Compare vs claiming at 62", or "... at the earliest open age" when a
    // claim is already past 62 (B2-P1 slice 5).
    const compare = [...container.querySelectorAll('button')].find((b) => b.textContent?.startsWith('Compare vs claiming at'))
    expect(compare, 'the bridge comparison is offered on the sample plan').toBeDefined()
    expect(compare!.disabled).toBe(false)
    await act(async () => compare!.click())
    await waitFor(() => vi.mocked(runMonteCarlo).mock.calls.length >= robustness + 3, {
      what: 'the bridge comparison runs',
      attempts: 3_000,
      intervalMs: 20,
    })
    const seeds = vi.mocked(runMonteCarlo).mock.calls.map(([, opts]) => opts.seed)
    expect(seeds.length).toBeGreaterThanOrEqual(robustness + 3)
    expect(new Set(seeds)).toEqual(new Set([6_221_293]))
  }, 120_000)
})
