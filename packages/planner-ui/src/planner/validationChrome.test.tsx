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

  it('a number outside the field range is flagged and the nearest allowed value is committed (#476, #494)', async () => {
    const onCommit = vi.fn()
    await act(async () => {
      root.render(<NumberField label="Claim age (years)" value={67} min={62} max={70} onCommit={onCommit} />)
    })
    const input = container.querySelector<HTMLInputElement>('input')!
    await typeInto(input, '50')
    // The engine never sees 50; the field says why.
    expect(onCommit).toHaveBeenLastCalledWith(62)
    expect(input.getAttribute('aria-invalid')).toBe('true')
    const error = container.querySelector('.field-error')!
    expect(error.textContent).toBe('Must be at least 62')
    expect(input.getAttribute('aria-describedby')).toContain(error.id)
    await typeInto(input, '75')
    expect(container.querySelector('.field-error')?.textContent).toBe('Must be at most 70')
    expect(onCommit).toHaveBeenLastCalledWith(70)
    await typeInto(input, '65')
    expect(onCommit).toHaveBeenLastCalledWith(65)
    expect(container.querySelector('.field-error')).toBeNull()
    expect(input.hasAttribute('aria-invalid')).toBe(false)
    // Leaving the field clears the note; the text then follows the stored value.
    await typeInto(input, '50')
    expect(container.querySelector('.field-error')).not.toBeNull()
    await act(async () => {
      // React's onBlur listens to focusout.
      input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
    })
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
      'Strategy: QCD annual amount: Must be at least 0',
      'Itemized deductions: State and local taxes: Must be at least 0',
    ])
    expect(strategy[0]!.getAttribute('title')).toBe('strategies.qcdAnnual: Too small: expected number to be >=0')
    expect(container.querySelector('[data-card="spending"] li')).toBeNull()
    expect(container.querySelector('[data-card="strategy"] ul')?.getAttribute('tabindex')).toBe('-1')
  })
})
