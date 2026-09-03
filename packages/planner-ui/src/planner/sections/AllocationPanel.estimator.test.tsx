/** @vitest-environment jsdom */
/**
 * The return estimator prices its blend with the plan's own asset-class
 * parameters, not with numbers restated in the component.
 *
 * Before this, the modal carried `ASSET_RETURN = { stocks: 7, bonds: 4, cash:
 * 2.5 }` and blended by hand, so a household that lowered US-stock returns in
 * Assumptions saw the override honored in the allocation panel below and
 * ignored in the estimator directly above it. The expected values here are the
 * engine's: `blendedReturnPct` over `resolveAssetClassParams`, which is what
 * the panel, the ledger, and Monte Carlo all price with.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'

import { blendedReturnPct, resolveAssetClassParams } from '@retiregolden/engine/allocation/assetClasses'
import { createEmptyPlan, type AssetClassParamOverrides, type Plan } from '@retiregolden/engine/model/plan'

import { ReturnEstimatorModal } from './AllocationPanel'

let root: Root | null = null
let container: HTMLDivElement | null = null

afterEach(() => {
  if (root) act(() => root!.unmount())
  container?.remove()
  root = null
  container = null
})

let n = 0

function renderEstimator(overrides?: AssetClassParamOverrides): HTMLDivElement {
  const plan: Plan = createEmptyPlan({ newId: () => `estimator-${++n}` })
  if (overrides) plan.assumptions.assetClassParams = overrides
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => {
    root!.render(
      <ReturnEstimatorModal plan={plan} initialPct={null} onApply={() => undefined} onClose={() => undefined} />,
    )
  })
  return container
}

/** The 60/30/10 mix the estimator opens on, in ASSET_CLASS_IDS order. */
const OPENING_WEIGHTS = [0.6, 0, 0.3, 0.1]

describe('the return estimator reads the plan’s asset-class returns', () => {
  it('quotes and blends the sourced defaults when Assumptions holds no override', () => {
    // The modal is a portal-free dialog rendered into document.body's tree.
    renderEstimator()
    const expected = blendedReturnPct(OPENING_WEIGHTS, resolveAssetClassParams(undefined))
    const hint = document.querySelector('.card-hint')!.textContent!
    expect(hint).toContain('stocks 7%')
    expect(hint).toContain('bonds 4%')
    expect(hint).toContain('cash 2.5%')
    expect(document.querySelector('.alloc-result strong')!.textContent).toBe(`${expected.toFixed(1)}%`)
  })

  it('honors an asset-class override in both the blend and the copy that explains it', () => {
    const overrides: AssetClassParamOverrides = { usStocks: { returnPct: 5 }, bonds: { returnPct: 2 } }
    renderEstimator(overrides)
    const expected = blendedReturnPct(OPENING_WEIGHTS, resolveAssetClassParams(overrides))
    // 0.6 × 5 + 0.3 × 2 + 0.1 × 2.5 = 3.85, against 5.65 on the defaults: the
    // override has to move the number, not merely be quoted beside it.
    expect(expected).toBeCloseTo(3.85, 10)
    expect(document.querySelector('.alloc-result strong')!.textContent).toBe('3.9%')
    const hint = document.querySelector('.card-hint')!.textContent!
    expect(hint).toContain('stocks 5%')
    expect(hint).toContain('bonds 2%')
    // Cash was not overridden, so it still reads the sourced default.
    expect(hint).toContain('cash 2.5%')
    // The apply button offers the same blended figure it displays.
    expect(document.querySelector('.btn-primary')!.textContent).toBe('Use 3.9%')
  })
})
