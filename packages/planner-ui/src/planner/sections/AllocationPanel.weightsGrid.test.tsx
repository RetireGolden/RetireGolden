/** @vitest-environment jsdom */
/**
 * `allocationWeightsSchema.refine` (engine/model/plan.ts) refuses a plan whose
 * weights sum outside ±0.5 of 100 — the same tolerance `WeightsGrid` checks
 * locally to choose its chrome. A mismatch is therefore never a value
 * `PlanContext.update` accepts: it sets `saveState: 'invalid'` and does not
 * autosave. Before this fix the mismatch line wore `.field-warning` — the
 * token documented (planner.css) as "a value the engine accepts" — which told
 * a household nothing was wrong. This pins the danger chrome instead.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'

import { createEmptyPlan, type AllocationWeights, type Plan } from '@retiregolden/engine/model/plan'
import { taxableAccount } from '@retiregolden/engine/testing/planFixtures'

import { AllocationPanel } from './AllocationPanel'
import type { AllocatableAccount } from './sectionHelpers'

let root: Root | null = null
let container: HTMLDivElement | null = null

afterEach(() => {
  if (root) act(() => root!.unmount())
  container?.remove()
  root = null
  container = null
})

function renderPanel(weights: AllocationWeights): HTMLDivElement {
  const plan: Plan = createEmptyPlan({ newId: () => 'weights-grid-test' })
  const account = {
    ...taxableAccount('acct-1', 10_000, 8_000),
    allocation: { mode: 'static', rebalancing: 'annual', weights },
  } as AllocatableAccount
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => {
    root!.render(<AllocationPanel account={account} plan={plan} onCommit={() => undefined} />)
  })
  return container
}

describe('WeightsGrid mismatch chrome', () => {
  it('reads as a status, not an error, when the weights sum to 100', () => {
    const host = renderPanel({ usStocks: 60, intlStocks: 0, bonds: 30, cash: 10 })
    const total = host.querySelector('.field-error, .field-warning, .muted.small')!
    expect(total.className).toContain('muted')
    expect(total.getAttribute('role')).toBe('status')
    expect(total.textContent).toBe('Total 100%')
  })

  it('refuses a mismatched sum with the danger token, not the accepted-value warning token', () => {
    const host = renderPanel({ usStocks: 60, intlStocks: 0, bonds: 30, cash: 20 })
    // 110%: the same ±0.5 tolerance `allocationWeightsSchema.refine` enforces,
    // so the engine refuses this plan — PlanContext.update sets
    // `saveState: 'invalid'` and does not autosave it.
    const total = [...host.querySelectorAll('p')].find((p) => p.textContent?.startsWith('Total '))!
    expect(total.className).toBe('field-error')
    expect(total.className).not.toContain('field-warning')
    expect(total.getAttribute('role')).toBe('alert')
    expect(total.textContent).toBe('Total 110% (weights must sum to 100% — not saved until they do)')
  })
})
