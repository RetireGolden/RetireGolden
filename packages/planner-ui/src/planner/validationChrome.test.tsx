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
import { focusIssueTarget } from './issueJump'
import { PlanCtx, type PlanContextValue } from './planContextCore'
import { SocialSecuritySection } from './SocialSecuritySection'
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

  const blur = async (input: HTMLInputElement) => {
    await act(async () => {
      // React's onBlur listens to focusout.
      input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
    })
  }

  it('a number outside the field range is flagged while typing, and is not kept on leaving (#476, #494)', async () => {
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
    // Leaving the field with an out-of-range value keeps the plan's value: a
    // blur is often a Tab, a rail link, or the save chip in the middle of an
    // edit, so committing the bound would store an age never typed.
    await typeInto(input, '150')
    expect(onCommit).toHaveBeenCalledTimes(1)
    expect(container.querySelector('.field-error')?.textContent).toBe('Must be at most 120')
    await blur(input)
    expect(onCommit).toHaveBeenCalledTimes(1)
    expect(input.value).toBe('90')
    // What is left is a note, not a fault: the control is valid and the chip's
    // jump passes it by. It is a status, since focus has already moved on.
    expect(container.querySelector('.field-error')).toBeNull()
    const note = container.querySelector('.field-note')!
    expect(note.textContent).toBe('Not kept: 150 is above the highest allowed, 120')
    expect(note.getAttribute('role')).toBe('status')
    expect(input.hasAttribute('aria-invalid')).toBe(false)
    expect(input.getAttribute('aria-describedby')).toContain(note.id)
    // Typing again clears the note.
    await typeInto(input, '100')
    expect(container.querySelector('.field-note')).toBeNull()
  })

  it('leaving mid-edit keeps the stored value rather than the bound: "9" on the way to "95" is not 60 (r2-2)', async () => {
    const onCommit = vi.fn()
    await act(async () => {
      root.render(<NumberField label="Planning age" value={90} min={60} max={120} onCommit={onCommit} />)
    })
    const input = container.querySelector<HTMLInputElement>('input')!
    await typeInto(input, '9')
    expect(onCommit).not.toHaveBeenCalled()
    await blur(input)
    expect(onCommit).not.toHaveBeenCalled()
    expect(input.value).toBe('90')
    expect(container.querySelector('.field-note')?.textContent).toBe('Not kept: 9 is below the lowest allowed, 60')
  })

  it('non-numeric text is flagged while it is on screen and goes back to the stored value on leaving (r1-13)', async () => {
    const onCommit = vi.fn()
    await act(async () => {
      root.render(<NumberField label="Claim age (years)" value={67} min={62} max={70} onCommit={onCommit} />)
    })
    const input = container.querySelector<HTMLInputElement>('input')!
    // A number input hands back "1e" as an empty value with badInput set (jsdom
    // sanitises it exactly as a browser does), which is what tells this apart
    // from a field the person cleared.
    Object.defineProperty(input, 'validity', { value: { badInput: true }, configurable: true })
    await typeInto(input, '1e')
    expect(onCommit).not.toHaveBeenCalled()
    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(container.querySelector('.field-error')?.textContent).toBe('Enter a number')
    await blur(input)
    expect(onCommit).not.toHaveBeenCalled()
    expect(input.value).toBe('67')
    expect(container.querySelector('.field-error')).toBeNull()
  })

  it('an emptied required number commits 0 where 0 is allowed, and holds its value where it is not (r1-11)', async () => {
    // The state effective tax override: 0 is the documented "off" state.
    const onCommit = vi.fn()
    await act(async () => {
      root.render(<NumberField label="State effective tax (override)" value={5} min={0} max={20} onCommit={onCommit} />)
    })
    const rate = container.querySelector<HTMLInputElement>('input')!
    await typeInto(rate, '')
    expect(onCommit).toHaveBeenLastCalledWith(0)
    expect(container.querySelector('.field-error')).toBeNull()
    await blur(rate)
    expect(rate.value).toBe('')
    expect(container.querySelector('.field-error')).toBeNull()

    // A claim age: there is no safe zero, so nothing is committed and it says so.
    const onAge = vi.fn()
    await act(async () => {
      root.render(<NumberField label="Claim age (years)" value={67} min={62} max={70} onCommit={onAge} />)
    })
    const age = container.querySelector<HTMLInputElement>('input')!
    await typeInto(age, '')
    expect(onAge).not.toHaveBeenCalled()
    expect(container.querySelector('.field-error')?.textContent).toBe('Enter a value')
    await blur(age)
    expect(onAge).not.toHaveBeenCalled()
    expect(age.value).toBe('67')
    expect(container.querySelector('.field-error')).toBeNull()
  })

  it('a money field refuses an amount the engine forbids, and keeps the plan’s value on leaving (r3-2)', async () => {
    const onCommit = vi.fn()
    await act(async () => {
      root.render(
        <PlanCtx.Provider value={contextFor(createSamplePlan(), [])}>
          <MoneyField label="QCD per year (today's $)" path="strategies.qcdAnnual" value={5000} onCommit={onCommit} />
        </PlanCtx.Provider>,
      )
    })
    const input = container.querySelector<HTMLInputElement>('input')!
    // strategies.qcdAnnual is nonNegative in the schema, so -100 is refused
    // here rather than stored and reported back as an engine issue.
    await typeInto(input, '-100')
    expect(onCommit).not.toHaveBeenCalled()
    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(container.querySelector('.field-error')?.textContent).toBe('Must be at least 0')
    await blur(input)
    expect(onCommit).not.toHaveBeenCalled()
    expect(container.querySelector('.field-note')?.textContent).toBe('Not kept: -100 is below the lowest allowed, 0')
    // An amount inside the range still commits as before.
    await typeInto(input, '250')
    expect(onCommit).toHaveBeenLastCalledWith(250)
    expect(container.querySelector('.field-error')).toBeNull()
  })

  it('a money field with no schema path is unbounded, as the import wizard and lever editors need (r3-2)', async () => {
    const onCommit = vi.fn()
    await act(async () => {
      root.render(<MoneyField label="Adjustment" value={0} onCommit={onCommit} />)
    })
    const input = container.querySelector<HTMLInputElement>('input')!
    await typeInto(input, '-100')
    expect(onCommit).toHaveBeenLastCalledWith(-100)
    expect(container.querySelector('.field-error')).toBeNull()
  })

  it('takes the engine’s range for a wired number field, so an engine-valid rate is not refused (r3-3)', async () => {
    const onCommit = vi.fn()
    await act(async () => {
      root.render(
        <PlanCtx.Provider value={contextFor(createSamplePlan(), [])}>
          <NumberField label="Safe withdrawal rate (SWR)" path="assumptions.safeWithdrawalRatePct" value={4} onCommit={onCommit} />
        </PlanCtx.Provider>,
      )
    })
    const input = container.querySelector<HTMLInputElement>('input')!
    // The schema says > 0; a hand-written min of 0.1 used to refuse this.
    await typeInto(input, '0.05')
    expect(onCommit).toHaveBeenLastCalledWith(0.05)
    expect(container.querySelector('.field-error')).toBeNull()
    // 0 itself is outside the engine's exclusive bound, and is refused; on
    // leaving, the note says the bound is one to be beyond, not the lowest
    // allowed value (r4-3).
    await typeInto(input, '0')
    expect(onCommit).toHaveBeenLastCalledWith(0.05)
    expect(container.querySelector('.field-error')?.textContent).toBe('Must be more than 0')
    await blur(input)
    expect(container.querySelector('.field-note')?.textContent).toBe('Not kept: 0 must be more than 0')
    expect(input.value).toBe('4')
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
    // Each wired control names its path, so the chip can land on the one the
    // first issue is about rather than the first invalid control in tree order.
    expect(floor!.getAttribute('data-path')).toBe('strategies.taxableSafetyNetFloor')
    expect(qcd!.getAttribute('data-path')).toBe('strategies.qcdAnnual')
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
    expectInvalid(name!, 'Enter a value')
    expectInvalid(dob!, 'Enter a valid date')
    expectInvalid(filing!, 'Choose one of the listed options')
    for (const clean of [charitable, sex]) {
      expect(clean!.hasAttribute('aria-invalid')).toBe(false)
      expect(clean!.closest('.field')?.querySelector('.field-error')).toBeNull()
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
    // The chip prefers an invalid control wherever the section list sits (it is above the cards now).
    expect(container.querySelector('[aria-invalid="true"]') ?? container.querySelector('.issue-list')).toBe(qcd)
    // A sibling money field stays clean; the card list still names the same issue in words.
    expect(labelledControl('Taxable safety-net floor').hasAttribute('aria-invalid')).toBe(false)
    expect(container.querySelector('.issue-list li')?.textContent).toBe("Strategy: QCD per year (today's $): Must be at least 0")
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
    // The caption sits in the same row structure as every field's label, so
    // the invalid tint rule applies to it too (r2-6).
    expect(block[0]!.querySelector(':scope > .field-label-row > .field-label')?.textContent).toBe('Cash-value schedule (age → value)')
    expect(block[0]!.getAttribute('data-path')).toBe('insurance.0.cashValueSchedule')
    const error = block[0]!.querySelector('.field-error')!
    expect(error.textContent).toBe('Add at least one schedule row, or grow cash value by a flat rate')
    expect(container.textContent).not.toContain('cashValueMode')
    const add = [...container.querySelectorAll('button')].find((b) => b.textContent === '+ Schedule row')!
    expect(add.getAttribute('aria-describedby')).toBe(error.id)
    // The block is the invalid control the chip's jump looks for, so the jump
    // lands on the schedule rather than on the card's list (r1-5).
    expect(block[0]!.getAttribute('aria-invalid')).toBe('true')
    expect(block[0]!.getAttribute('aria-describedby')).toBe(error.id)
    expect(block[0]!.tabIndex).toBe(-1)
    expect(container.querySelector('[aria-invalid="true"]')).toBe(block[0])
    focusIssueTarget(container, 'insurance')
    expect(document.activeElement).toBe(block[0])
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

  it('a stored SSDI onset age outside the engine’s range is flagged at the field, not only in the card list (#511)', async () => {
    // The field used to carry hand-written min/max and no path, so a plan
    // already holding an out-of-range onset age said nothing beside the
    // control. Wired to its schema path, the engine's own issue lands there.
    const plan = createSamplePlan()
    const index = plan.incomes.findIndex((s) => s.type === 'socialSecurity')
    expect(index, 'the example couple has a Social Security stream').toBeGreaterThanOrEqual(0)
    const stream = plan.incomes[index] as Extract<Plan['incomes'][number], { type: 'socialSecurity' }>
    stream.disability = { onsetAge: 12 }
    const path = `incomes.${index}.disability.onsetAge`
    await act(async () => {
      root.render(
        <MemoryRouter>
          <PlanCtx.Provider value={contextFor(plan, [`${path}: Too small: expected number to be >=40`])}>
            <SocialSecuritySection />
          </PlanCtx.Provider>
        </MemoryRouter>,
      )
    })
    const onset = container.querySelector<HTMLInputElement>(`input[data-path="${path}"]`)
    expect(onset, 'the onset-age control names its schema path').not.toBeNull()
    expect(onset!.value).toBe('12')
    expect(onset!.getAttribute('aria-invalid')).toBe('true')
    const error = onset!.closest('.field')!.querySelector('.field-error')!
    expect(error.textContent).toBe('Must be at least 40')
    expect(onset!.getAttribute('aria-describedby')).toContain(error.id)
    // The range the control enforces is the engine's, read from the path —
    // the literals the field used to hardcode are gone.
    expect(onset!.getAttribute('min')).toBe('40')
    expect(onset!.getAttribute('max')).toBe('75')
    // The other person's onset field is untouched: one issue, one field.
    expect(container.querySelectorAll('.field-error')).toHaveLength(1)
    // And the card still lists it in words, named for the person whose stream
    // it is rather than for its slot in the incomes array.
    expect([...container.querySelectorAll('li')].map((li) => li.textContent)).toContain(
      'Social Security (Alex): Disability onset age: Must be at least 40',
    )
  })
})
