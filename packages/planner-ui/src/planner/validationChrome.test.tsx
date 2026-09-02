/** @vitest-environment jsdom */
/**
 * Validation for people (#452, #459, #476, #491, #494): the engine still decides
 * what is valid; the chrome names the field, states the fix, keeps it in the
 * right card, and never hands the engine a value a field's own range forbids.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'

import type { Plan } from '@retiregolden/engine/model/plan'
import { createSamplePlan } from '../testSupport/samplePlan'
import { NumberField } from './fields'
import { PlanCtx, type PlanContextValue } from './planContextCore'
import { Issues } from './sections/shared'

function contextFor(plan: Plan, issues: string[]): PlanContextValue {
  return { plan, update: () => undefined, discardPendingSave: () => undefined, saveState: 'invalid', issues }
}

describe('validation chrome', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
  })

  const typeInto = async (input: HTMLInputElement, value: string) => {
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
      setter.call(input, value)
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
  }

  const blur = async (input: HTMLInputElement) => {
    await act(async () => {
      // React's onBlur listens to focusout.
      input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
    })
  }

  it('a number outside the field range is flagged while typing and commits nothing until the field is left (#476, #494)', async () => {
    const onCommit = vi.fn()
    await act(async () => {
      root.render(<NumberField label="Planning age" value={90} min={60} max={120} onCommit={onCommit} />)
    })
    const input = container.querySelector<HTMLInputElement>('input')!
    // Typing "95" one key at a time: "9" is below 60 but must not store 60.
    await typeInto(input, '9')
    expect(onCommit).not.toHaveBeenCalled()
    expect(input.getAttribute('aria-invalid')).toBe('true')
    const error = container.querySelector('.field-error')!
    expect(error.textContent).toBe('Must be at least 60')
    expect(input.getAttribute('aria-describedby')).toContain(error.id)
    await typeInto(input, '95')
    expect(onCommit).toHaveBeenLastCalledWith(95)
    expect(container.querySelector('.field-error')).toBeNull()
    expect(input.hasAttribute('aria-invalid')).toBe(false)
    // Leaving the field with an out-of-range value commits the nearest allowed one and says so.
    await typeInto(input, '150')
    expect(onCommit).toHaveBeenCalledTimes(1)
    expect(container.querySelector('.field-error')?.textContent).toBe('Must be at most 120')
    await blur(input)
    expect(onCommit).toHaveBeenLastCalledWith(120)
    expect(input.value).toBe('120')
    expect(container.querySelector('.field-error')?.textContent).toBe('Adjusted to 120, the highest allowed')
  })

  it('an emptied required number commits nothing and goes back to its value on leaving (#476)', async () => {
    const onCommit = vi.fn()
    await act(async () => {
      root.render(<NumberField label="Claim age (years)" value={67} min={62} max={70} onCommit={onCommit} />)
    })
    const input = container.querySelector<HTMLInputElement>('input')!
    await typeInto(input, '')
    expect(onCommit).not.toHaveBeenCalled()
    expect(container.querySelector('.field-error')?.textContent).toBe('Enter a value')
    await blur(input)
    expect(onCommit).not.toHaveBeenCalled()
    expect(input.value).toBe('67')
    expect(container.querySelector('.field-error')).toBeNull()
  })

  it('a field with a schema path shows the engine issue for that path inline (#491)', async () => {
    const plan = createSamplePlan()
    await act(async () => {
      root.render(
        <PlanCtx.Provider value={contextFor(plan, ['strategies.taxableSafetyNetFloor: Too small: expected number to be >=0'])}>
          <NumberField label="Taxable safety-net floor" path="strategies.taxableSafetyNetFloor" value={-5000} onCommit={() => undefined} />
          <NumberField label="QCD annual amount" path="strategies.qcdAnnual" value={1000} onCommit={() => undefined} />
        </PlanCtx.Provider>,
      )
    })
    const [floor, qcd] = [...container.querySelectorAll<HTMLInputElement>('input')]
    expect(floor!.getAttribute('aria-invalid')).toBe('true')
    expect(floor!.closest('.field')?.querySelector('.field-error')?.textContent).toBe('Must be at least 0')
    expect(qcd!.hasAttribute('aria-invalid')).toBe(false)
  })

  it('a section lists only its own issues, in words, with the raw path kept as a title (#452)', async () => {
    const plan = createSamplePlan()
    const issues = [
      'strategies.qcdAnnual: Too small: expected number to be >=0',
      'strategies.itemizedDeductions.stateAndLocalTaxes: Too small: expected number to be >=0',
      'household.people.0.longevity.planningAge: Too small: expected number to be >=60',
    ]
    await act(async () => {
      root.render(
        <PlanCtx.Provider value={contextFor(plan, issues)}>
          <section data-card="strategy">
            <Issues section="strategy" />
          </section>
          <section data-card="spending">
            <Issues section="spending" />
          </section>
        </PlanCtx.Provider>,
      )
    })
    const strategy = [...container.querySelectorAll('[data-card="strategy"] li')]
    expect(strategy.map((li) => li.textContent)).toEqual([
      "Strategy: QCD per year (today's $): Must be at least 0",
      'Itemized deductions: State & local taxes (SALT): Must be at least 0',
    ])
    expect(strategy[0]!.getAttribute('title')).toBe('strategies.qcdAnnual: Too small: expected number to be >=0')
    expect(container.querySelector('[data-card="spending"] li')).toBeNull()
    expect(container.querySelector('[data-card="strategy"] ul')?.getAttribute('tabindex')).toBe('-1')
  })
})
