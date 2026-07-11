/** @vitest-environment jsdom */
/**
 * Step 3 (UI/UX round 2): the downside card speaks plain language, statistical
 * terms live only inside HelpTips, and the gauge no longer paints a high-60s/70s
 * plan as failure-red. Banding is display-only — the success number is untouched.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'

import type { Plan } from '@retiregolden/engine/model/plan'
import { PlanCtx, type PlanContextValue } from './planContextCore'
import { createSamplePlan } from '../testSupport/samplePlan'
import { MonteCarloPage } from './MonteCarloPage'
import { successBand } from './successBand'

vi.mock('../mc/pool', async (importOriginal) => {
  const original = await importOriginal<typeof import('../mc/pool')>()
  return { ...original, runMonteCarlo: vi.fn(original.runMonteCarlo) }
})

import * as pool from '../mc/pool'
const actualPool = await vi.importActual<typeof import('../mc/pool')>('../mc/pool')
const mockedRunMc = vi.mocked(pool.runMonteCarlo)

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  vi.clearAllMocks()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.restoreAllMocks()
})

function contextFor(plan: Plan): PlanContextValue {
  return { plan, update: () => {}, discardPendingSave: () => {}, saveState: 'saved', issues: [] }
}

describe('successBand', () => {
  it('reserves failure-red for genuinely failing plans', () => {
    // The critique's headline defect: a 74% plan rendered failure-red.
    expect(successBand(0.74).color).toBe('var(--warn)')
    expect(successBand(0.74).color).not.toBe('var(--bad)')
    expect(successBand(0.6).color).toBe('var(--warn)')
    expect(successBand(0.59).color).toBe('var(--bad)')
    expect(successBand(0.5).color).toBe('var(--bad)')
  })

  it('bands 75–90 as qualified-good and >90 as good', () => {
    expect(successBand(0.75).color).toBe('var(--good)')
    expect(successBand(0.89).color).toBe('var(--good)')
    expect(successBand(0.89).severity).toMatch(/most markets/)
    expect(successBand(0.92).color).toBe('var(--good)')
    expect(successBand(0.92).severity).toBe('on track')
  })
})

describe('Monte Carlo downside copy', () => {
  it('keeps p90/decile out of visible labels — only inside HelpTip bubbles', async () => {
    mockedRunMc.mockImplementation((plan, opts) => actualPool.runMonteCarlo(plan, { ...opts, pathCount: 8 }))
    await act(async () => {
      root.render(
        <MemoryRouter>
          <PlanCtx.Provider value={contextFor(createSamplePlan())}>
            <MonteCarloPage />
          </PlanCtx.Provider>
        </MemoryRouter>,
      )
    })
    await act(async () => {
      await new Promise((r) => setTimeout(r, 400)) // past the 250 ms auto-run debounce
    })

    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT)
    let leaks = 0
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!/p90|decile/i.test(node.textContent ?? '')) continue
      let el = node.parentElement
      let insideBubble = false
      while (el && el !== container) {
        if (el.classList.contains('help-tip-bubble')) {
          insideBubble = true
          break
        }
        el = el.parentElement
      }
      if (!insideBubble) leaks += 1
    }
    expect(leaks, 'p90/decile leaked into a visible label outside a HelpTip').toBe(0)
    // Sanity: the downside card rendered and its HelpTips carry the terms.
    expect(container.querySelector('.help-tip-bubble')).not.toBeNull()
    expect(container.textContent).toContain('In the worst 10% of markets')
  })
})
