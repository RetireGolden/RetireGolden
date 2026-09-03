/** @vitest-environment jsdom */

/**
 * Spending-phase Multiplier inputs must accept the two-decimal values presets
 * write. `annualDeltaPhases` rounds the compounded multiplier to 2 decimals
 * (`packages/engine/src/spending/shapePresets.ts`); smirk (−1%/yr) and a
 * custom −1.5%/yr from retirement age 62 produce 0.78 at 87 and 0.64 at 92.
 * Those are not on a 0.05 grid, so a coarser HTML5 `step` shows
 * "Please enter a valid value. The two nearest valid values are …".
 */

import { afterEach, describe, expect, it } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router'

import { annualDeltaPhases, spendingShapePhases } from '@retiregolden/engine/spending/shapePresets'

import { PlanCtx } from '../planContextCore'
import { createSamplePlan } from '../../testSupport/samplePlan'
import { SpendingSection } from './SpendingSection'

let root: Root | null = null
let container: HTMLDivElement | null = null

afterEach(() => {
  if (root) act(() => root!.unmount())
  container?.remove()
  root = null
  container = null
})

/** Under-saved single retiree's retirement age — the hosted Free repro household. */
const UNDER_SAVED_RETIREMENT_AGE = 62

function mountWithPhases(phases: { fromAge: number; multiplier: number }[]) {
  const plan = createSamplePlan()
  plan.household.people[0].retirementAge = UNDER_SAVED_RETIREMENT_AGE
  plan.expenses.phases = phases
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => {
    root!.render(
      <MemoryRouter>
        <PlanCtx.Provider
          value={{
            plan,
            update: () => undefined,
            discardPendingSave: () => undefined,
            saveState: 'saved',
            issues: [],
          }}
        >
          <SpendingSection />
        </PlanCtx.Provider>
      </MemoryRouter>,
    )
  })
  return container
}

function multiplierInputs(rootEl: HTMLElement): HTMLInputElement[] {
  return Array.from(rootEl.querySelectorAll('label'))
    .filter((label) => label.textContent?.trim() === 'Multiplier')
    .map((label) => {
      const id = label.getAttribute('for')
      if (!id) throw new Error('Multiplier label has no for=')
      const input = rootEl.querySelector<HTMLInputElement>(`[id="${id.replace(/"/g, '\\"')}"]`)
      if (!input) throw new Error(`no Multiplier input for ${id}`)
      return input
    })
}

describe('Spending phase multiplier step', () => {
  it('accepts smirk-written two-decimal multipliers, including 0.78 from age 87', () => {
    const phases = spendingShapePhases('smirk', UNDER_SAVED_RETIREMENT_AGE)
    // Hand worksheet: (0.99)^(87 − 62) = 0.99^25 ≈ 0.777821, rounded to 2dp → 0.78.
    expect(phases).toContainEqual({ fromAge: 87, multiplier: 0.78 })

    const host = mountWithPhases(phases)
    const inputs = multiplierInputs(host)
    expect(inputs).toHaveLength(phases.length)

    const fromAge87 = inputs.find((input) => input.value === '0.78')
    expect(fromAge87).toBeDefined()
    expect(fromAge87!.step).toBe('0.01')
    expect(fromAge87!.validity.stepMismatch).toBe(false)

    for (const input of inputs) {
      expect(input.step).toBe('0.01')
      expect(input.validity.stepMismatch).toBe(false)
    }
  })

  it('accepts custom −1.5%/yr two-decimal multipliers, including 0.64 from age 92', () => {
    const phases = annualDeltaPhases(-1.5, UNDER_SAVED_RETIREMENT_AGE)
    // Hand worksheet: (0.985)^(92 − 62) = 0.985^30 ≈ 0.635447, rounded to 2dp → 0.64.
    expect(phases).toContainEqual({ fromAge: 92, multiplier: 0.64 })

    const host = mountWithPhases(phases)
    const inputs = multiplierInputs(host)
    expect(inputs).toHaveLength(phases.length)

    const fromAge92 = inputs.find((input) => input.value === '0.64')
    expect(fromAge92).toBeDefined()
    expect(fromAge92!.step).toBe('0.01')
    expect(fromAge92!.validity.stepMismatch).toBe(false)

    for (const input of inputs) {
      expect(input.step).toBe('0.01')
      expect(input.validity.stepMismatch).toBe(false)
    }
  })
})
