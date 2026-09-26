/** @vitest-environment jsdom */
/**
 * Monte Carlo model controls (owner decision 2026-09-25): picking a model
 * shows the one slider its config reads, Return volatility or Equity weight,
 * and neither for the models buildModel passes neither value. The kind-by-kind
 * table itself is pinned in marketModelPicker.test.ts; this checks the page
 * renders what modelControlOf names. The historical stress windows have their
 * own stock-share control (review round 1 of #746), shown for every model,
 * because the model's equity weight is hidden for the models that ignore it.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router'

import type { Plan } from '@retiregolden/engine/model/plan'
import { PlanCtx, type PlanContextValue } from './planContextCore'
import { createSamplePlan } from '../testSupport/samplePlan'
import { waitFor } from '../testSupport/settle'
import { MonteCarloPage } from './MonteCarloPage'
import { MODEL_CATALOG, modelControlOf, type ModelKind } from './marketModelPicker'

// Monte Carlo auto-runs after a debounce; keep that run tiny, since this
// test reads the controls, not the results.
vi.mock('../mc/pool', async (importOriginal) => {
  const original = await importOriginal<typeof import('../mc/pool')>()
  return {
    ...original,
    runMonteCarlo: vi.fn(original.runMonteCarlo),
    runHistoricalStressSuiteViews: vi.fn(original.runHistoricalStressSuiteViews),
  }
})

import * as pool from '../mc/pool'
const actualPool = await vi.importActual<typeof import('../mc/pool')>('../mc/pool')
const mockedRunMc = vi.mocked(pool.runMonteCarlo)
const mockedRunStress = vi.mocked(pool.runHistoricalStressSuiteViews)

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  vi.clearAllMocks()
  mockedRunMc.mockImplementation((p, opts) => actualPool.runMonteCarlo(p, { ...opts, pathCount: 8 }))
  // The stress suite's own result is not under test here, only the stock share it is asked for.
  mockedRunStress.mockResolvedValue({ windowLengthYears: 30, suites: [] })
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

async function mount() {
  await act(async () => {
    root.render(
      <MemoryRouter>
        <PlanCtx.Provider value={contextFor(createSamplePlan())}>
          <MonteCarloPage />
        </PlanCtx.Provider>
      </MemoryRouter>,
    )
  })
}

async function pickModel(kind: ModelKind) {
  const select = container.querySelector<HTMLSelectElement>('#mc-advanced-model')!
  await act(async () => {
    Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value')!.set!.call(select, kind)
    select.dispatchEvent(new Event('change', { bubbles: true }))
  })
  expect(select.value).toBe(kind)
}

function sliders() {
  return {
    volatility: container.querySelector<HTMLInputElement>('input[type="range"][aria-label="Return volatility"]'),
    equity: container.querySelector<HTMLInputElement>('input[type="range"][aria-label="Equity weight"]'),
    stress: container.querySelector<HTMLInputElement>('input[type="range"][aria-label="Stock share for the stress windows"]'),
  }
}

async function slide(input: HTMLInputElement, value: number) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!.call(input, String(value))
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  expect(input.value).toBe(String(value))
}

/** The results area, the stress section with it, renders once the first run has completed. */
async function mountWithResults() {
  await mount()
  await waitFor(() => sliders().stress !== null, { what: 'the stress-window stock share' })
}

async function runStressSuite() {
  const button = [...container.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent === 'Run rolling/reversed suite')
  if (!button) throw new Error('the stress-suite button is missing')
  await act(async () => {
    button.click()
  })
}

describe('Monte Carlo model controls follow the chosen model', () => {
  it('GARCH shows Return volatility, history replay shows Equity weight, and regime switching shows neither', async () => {
    await mount()
    // The default (lognormal) opens on the volatility slider.
    expect(sliders().volatility).not.toBeNull()
    expect(sliders().equity).toBeNull()

    await pickModel('garch')
    expect(sliders().volatility).not.toBeNull()
    expect(sliders().equity).toBeNull()

    await pickModel('hist-sequence')
    expect(sliders().volatility).toBeNull()
    expect(sliders().equity).not.toBeNull()

    await pickModel('regime-switch')
    expect(sliders().volatility).toBeNull()
    expect(sliders().equity).toBeNull()
  })

  it('every catalog model renders exactly the slider modelControlOf names', async () => {
    await mount()
    for (const { kind } of MODEL_CATALOG) {
      await pickModel(kind)
      const control = modelControlOf(kind)
      const { volatility, equity } = sliders()
      expect(volatility !== null, `${kind}: Return volatility shown`).toBe(control === 'return-volatility')
      expect(equity !== null, `${kind}: Equity weight shown`).toBe(control === 'equity-weight')
    }
  })
})

describe('the historical stress windows have their own stock share', () => {
  it('shows the stress-window control for every catalog model, beside whichever model control applies', async () => {
    await mountWithResults()
    for (const { kind } of MODEL_CATALOG) {
      await pickModel(kind)
      expect(sliders().stress, `${kind}: stress-window stock share shown`).not.toBeNull()
    }
  })

  it('its value reaches runHistoricalStressSuiteViews, whatever the model and whatever the model\'s own equity weight', async () => {
    await mountWithResults()
    // A model that hides the equity slider: the stress control still sets the replayed mix.
    await pickModel('garch')
    await slide(sliders().stress!, 30)
    await runStressSuite()
    expect(mockedRunStress).toHaveBeenCalledTimes(1)
    expect(mockedRunStress.mock.calls[0]![1].equityWeightPct).toBe(30)

    // A model that reads its own equity weight: moving that slider does not move the stress windows.
    await pickModel('hist-iid')
    await slide(sliders().equity!, 80)
    await slide(sliders().stress!, 45)
    await runStressSuite()
    expect(mockedRunStress).toHaveBeenCalledTimes(2)
    expect(mockedRunStress.mock.calls[1]![1].equityWeightPct).toBe(45)
  })
})
