/** @vitest-environment jsdom */
/**
 * Validation for people (#452, #459, #476, #491, #494): the engine still decides
 * what is valid; the chrome names the field, states the fix, keeps it in the
 * right card, and never hands the engine a value a field's own range forbids.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router'

import type { Plan } from '@retiregolden/engine/model/plan'
import { createSamplePlan } from '../testSupport/samplePlan'
import { DateField, MoneyField, NumberField, SelectField, TextField } from './fields'
import { PlanCtx, type PlanContextValue } from './planContextCore'
import { InsuranceSection } from './sections/InsuranceSection'
import { Issues } from './sections/shared'
import { StrategySection } from './sections/StrategySection'

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

  it('money, text, date, and select fields show the engine issue for their path the same way (#489–#531)', async () => {
    const plan = createSamplePlan()
    const issues = [
      'strategies.qcdAnnual: Too small: expected number to be >=0',
      'household.people.0.name: Too small: expected string to have >=1 characters',
      'household.people.0.dob: Invalid date',
      'household.filingStatus: Invalid option: expected one of "single"|"marriedFilingJointly"',
    ]
    await act(async () => {
      root.render(
        <PlanCtx.Provider value={contextFor(plan, issues)}>
          <MoneyField label="QCD per year (today's $)" path="strategies.qcdAnnual" value={-5000} onCommit={() => undefined} />
          <MoneyField label="Charitable gifts" path="strategies.itemizedDeductions.charitable" value={100} onCommit={() => undefined} />
          <TextField label="Name" path="household.people.0.name" value="" onCommit={() => undefined} />
          <DateField label="Date of birth" path="household.people.0.dob" value="" onCommit={() => undefined} />
          <SelectField
            label="Filing status"
            path="household.filingStatus"
            value="single"
            options={[{ value: 'single', label: 'Single' }]}
            onCommit={() => undefined}
          />
          <SelectField label="Sex" path="household.people.0.sex" value="female" options={[{ value: 'female', label: 'Female' }]} onCommit={() => undefined} />
        </PlanCtx.Provider>,
      )
    })
    const controls = [...container.querySelectorAll<HTMLInputElement | HTMLSelectElement>('input, select')]
    const [qcd, charitable, name, dob, filing, sex] = controls
    const expectInvalid = (control: HTMLElement, advice: string) => {
      expect(control.getAttribute('aria-invalid')).toBe('true')
      const field = control.closest('.field')!
      expect(field.classList.contains('field--invalid')).toBe(true)
      const error = field.querySelector('.field-error')!
      expect(error.textContent).toBe(advice)
      expect(control.getAttribute('aria-describedby')?.split(' ')).toContain(error.id)
    }
    expectInvalid(qcd!, 'Must be at least 0')
    expectInvalid(name!, 'Add at least one entry')
    expectInvalid(dob!, 'Enter a valid date')
    expectInvalid(filing!, 'Choose one of the listed options')
    for (const clean of [charitable!, sex!]) {
      expect(clean.hasAttribute('aria-invalid')).toBe(false)
      expect(clean.closest('.field')?.querySelector('.field-error')).toBeNull()
    }
  })

  const labelledControl = (label: string): HTMLElement => {
    const el = [...container.querySelectorAll<HTMLLabelElement>('label')].find((l) => l.textContent === label)
    expect(el, label).toBeDefined()
    return document.getElementById(el!.htmlFor)!
  }

  it('the Strategy screen flags the QCD input itself, so the card list is no longer the only locator (#531)', async () => {
    const plan = createSamplePlan()
    plan.strategies.qcdAnnual = -5000
    await act(async () => {
      root.render(
        <PlanCtx.Provider value={contextFor(plan, ['strategies.qcdAnnual: Too small: expected number to be >=0'])}>
          <MemoryRouter initialEntries={['/plan/example/strategy']}>
            <StrategySection />
          </MemoryRouter>
        </PlanCtx.Provider>,
      )
    })
    const qcd = labelledControl("QCD per year (today's $)")
    expect(qcd.getAttribute('aria-invalid')).toBe('true')
    const error = qcd.closest('.field')!.querySelector('.field-error')!
    expect(error.textContent).toBe('Must be at least 0')
    expect(qcd.getAttribute('aria-describedby')).toContain(error.id)
    // The only invalid control on the screen is the QCD input, and the header
    // chip's locator finds it ahead of the card-level list.
    expect([...container.querySelectorAll('[aria-invalid="true"]')]).toEqual([qcd])
    expect(container.querySelector('[aria-invalid="true"], .issue-list')).toBe(qcd)
    // A sibling money field stays clean; the card list still names the same issue in words.
    expect(labelledControl('Taxable safety-net floor').hasAttribute('aria-invalid')).toBe(false)
    expect(container.querySelector('.issue-list li')?.textContent).toBe('Strategy: QCD annual amount: Must be at least 0')
  })

  it('an empty illustration schedule shows its issue on the schedule block, in words (#489)', async () => {
    const plan = createSamplePlan()
    plan.careEvents = []
    plan.insurance = [
      {
        kind: 'permanentLife',
        id: 'policy-1',
        name: 'Whole life',
        insured: plan.household.people[0]!.id,
        beneficiary: 'estate',
        annualPremium: 1200,
        premiumMode: 'lifetime',
        deathBenefit: 100_000,
        cashValue: 10_000,
        cashValueMode: 'schedule',
      },
    ]
    await act(async () => {
      root.render(
        <PlanCtx.Provider value={contextFor(plan, ["insurance.0.cashValueSchedule: cashValueSchedule is required when cashValueMode is 'schedule'"])}>
          <MemoryRouter initialEntries={['/plan/example/insurance']}>
            <InsuranceSection />
          </MemoryRouter>
        </PlanCtx.Provider>,
      )
    })
    const block = [...container.querySelectorAll<HTMLElement>('.field--invalid')]
    expect(block).toHaveLength(1)
    expect(block[0]!.textContent).toContain('Cash-value schedule (age → value)')
    const error = block[0]!.querySelector('.field-error')!
    expect(error.textContent).toBe('Add at least one schedule row, or grow cash value by a flat rate')
    expect(container.textContent).not.toContain('cashValueMode')
    const add = [...container.querySelectorAll('button')].find((b) => b.textContent === '+ Schedule row')!
    expect(add.getAttribute('aria-describedby')).toBe(error.id)
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
