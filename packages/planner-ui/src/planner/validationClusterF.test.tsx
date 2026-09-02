/** @vitest-environment jsdom */
/**
 * Rendered behaviour for the "absurd value accepted silently" Design QA
 * cluster (#492, #496, #503, #516, #524, #526, #540, #545): the engine's
 * issue reaches the field the walk cited, a share stored as an engine-bounded
 * percent is flagged while typing, and a premium end age the schema no longer
 * wants is cleared when its mode changes.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router'

import { createEmptyPlan, parsePlan, type Account, type Plan } from '@retiregolden/engine/model/plan'
import { createSamplePlan } from '../testSupport/samplePlan'
import { PlanCtx, type PlanContextValue } from './planContextCore'
import { AccountFields } from './sections/AccountFields'
import { IncomeSection } from './sections/IncomeSection'
import { InsuranceSection } from './sections/InsuranceSection'
import { SpendingSection } from './sections/SpendingSection'

let n = 0
const testIds = () => `cf-${++n}`

function contextFor(plan: Plan, issues: string[], update: PlanContextValue['update'] = () => undefined): PlanContextValue {
  return { plan, update, discardPendingSave: () => undefined, saveState: issues.length > 0 ? 'invalid' : 'saved', issues }
}

function planWithAccount(account: Account): Plan {
  const plan = createEmptyPlan({ newId: testIds })
  plan.accounts = [account]
  return plan
}

describe('validation cluster F', () => {
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

  const render = async (node: ReactNode) => {
    await act(async () => {
      root.render(<MemoryRouter initialEntries={['/plan/example/accounts']}>{node}</MemoryRouter>)
    })
  }

  const typeInto = async (input: HTMLInputElement, value: string) => {
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
      setter.call(input, value)
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
  }

  const blur = async (input: HTMLInputElement) => {
    await act(async () => {
      input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
    })
  }

  const choose = async (select: HTMLSelectElement, value: string) => {
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!
      setter.call(select, value)
      select.dispatchEvent(new Event('change', { bubbles: true }))
    })
  }

  const labelledControl = <T extends HTMLElement = HTMLInputElement>(label: string): T => {
    const el = [...container.querySelectorAll<HTMLLabelElement>('label')].find((l) => l.textContent === label)
    expect(el, label).toBeDefined()
    return document.getElementById(el!.htmlFor) as T
  }

  const expectInvalid = (control: HTMLElement, advice: string) => {
    expect(control.getAttribute('aria-invalid')).toBe('true')
    const error = control.closest('.field')!.querySelector('.field-error')!
    expect(error.textContent).toBe(advice)
    expect(control.getAttribute('aria-describedby')?.split(' ')).toContain(error.id)
  }

  it('a stored Charity share the engine rejects shows at the field, and typing one is flagged before it is stored (#540)', async () => {
    const plan = planWithAccount({
      type: 'cash',
      id: 'cash',
      name: 'Cash',
      ownerPersonId: null,
      annualReturnPct: null,
      balance: 10_000,
      annualContribution: 0,
      estateBeneficiary: { destination: 'charity', charityPct: 250 },
    })
    const parsed = parsePlan(plan)
    expect(parsed.ok).toBe(false)
    const issues = parsed.ok ? [] : parsed.issues
    expect(issues.some((i) => i.startsWith('accounts.0.estateBeneficiary.charityPct: '))).toBe(true)
    const update = vi.fn()
    await render(
      <PlanCtx.Provider value={contextFor(plan, issues, update)}>
        <AccountFields account={plan.accounts[0]!} index={0} />
      </PlanCtx.Provider>,
    )
    const share = labelledControl('Charity share')
    expectInvalid(share, 'Must be at most 100')
    expect(share.getAttribute('max')).toBe('100')
    // The header chip's locator now finds this control.
    expect(container.querySelector('[aria-invalid="true"]')).toBe(share)
    // A fresh out-of-range keystroke is flagged and commits nothing; leaving
    // does not keep it either (the field never clamps for the person), so the
    // stored 250 comes back still carrying the engine's message.
    await typeInto(share, '150')
    expect(update).not.toHaveBeenCalled()
    expect(share.closest('.field')!.querySelector('.field-error')!.textContent).toBe('Must be at most 100')
    await blur(share)
    expect(update).not.toHaveBeenCalled()
    expect(share.value).toBe('250')
    expectInvalid(share, 'Must be at most 100')
    // An in-range entry is what commits.
    await typeInto(share, '60')
    expect(update).toHaveBeenCalledTimes(1)
    const draft = structuredClone(plan)
    update.mock.calls[0]![0](draft)
    expect(draft.accounts[0]!.estateBeneficiary).toEqual({ destination: 'charity', charityPct: 60 })
  })

  it('an Annuity taxable share the engine rejects shows at the field with the engine bound (#516)', async () => {
    const plan = planWithAccount({
      type: 'annuity',
      id: 'annuity',
      name: 'Annuity',
      ownerPersonId: null,
      annualReturnPct: null,
      startAge: 70,
      monthlyAmount: 1000,
      colaPct: 0,
      taxablePct: 99_999,
    })
    const parsed = parsePlan(plan)
    expect(parsed.ok).toBe(false)
    const issues = parsed.ok ? [] : parsed.issues
    expect(issues).toContain('accounts.0.taxablePct: Too big: expected number to be <=100')
    await render(
      <PlanCtx.Provider value={contextFor(plan, issues)}>
        <AccountFields account={plan.accounts[0]!} index={0} />
      </PlanCtx.Provider>,
    )
    const share = labelledControl('Taxable share')
    expectInvalid(share, 'Must be at most 100')
    expect(share.getAttribute('min')).toBe('0')
    expect(share.getAttribute('max')).toBe('100')
    expect([...container.querySelectorAll('[aria-invalid="true"]')]).toEqual([share])
  })

  it('Brokerage Qualified dividends flags 999% while typing instead of clamping silently (#496)', async () => {
    const plan = planWithAccount({
      type: 'taxable',
      id: 'brokerage',
      name: 'Brokerage',
      ownerPersonId: null,
      annualReturnPct: null,
      balance: 100_000,
      costBasis: 80_000,
      annualContribution: 0,
      dividendYieldPct: 2,
      qualifiedRatio: 0.85,
    })
    const update = vi.fn()
    await render(
      <PlanCtx.Provider value={contextFor(plan, [], update)}>
        <AccountFields account={plan.accounts[0]!} index={0} />
      </PlanCtx.Provider>,
    )
    const qualified = labelledControl('Qualified dividends')
    expect(qualified.getAttribute('min')).toBe('0')
    expect(qualified.getAttribute('max')).toBe('100')
    await typeInto(qualified, '999')
    expect(update).not.toHaveBeenCalled()
    expectInvalid(qualified, 'Must be at most 100')
    await typeInto(qualified, '60')
    expect(update).toHaveBeenCalledTimes(1)
    const draft = structuredClone(plan)
    update.mock.calls[0]![0](draft)
    expect((draft.accounts[0] as Extract<Account, { type: 'taxable' }>).qualifiedRatio).toBeCloseTo(0.6)
    expect(qualified.hasAttribute('aria-invalid')).toBe(false)
  })

  it('leaving "Until an age" clears the premium end age the schema no longer wants; entering it stores the shown default (#503)', async () => {
    const plan = createSamplePlan()
    plan.careEvents = []
    plan.insurance = [
      {
        kind: 'ltc',
        id: 'ltc-1',
        name: 'LTC policy',
        owner: plan.household.people[0]!.id,
        annualPremium: 3000,
        premiumMode: 'untilAge',
        premiumEndAge: 5,
        benefitMonthly: 6000,
        benefitPeriodYears: 3,
        eliminationPeriodDays: 90,
      },
    ]
    const parsed = parsePlan(plan)
    expect(parsed.ok).toBe(false)
    const issues = parsed.ok ? [] : parsed.issues
    expect(issues).toContain('insurance.0.premiumEndAge: Too small: expected number to be >=40')
    const update = vi.fn()
    await render(
      <PlanCtx.Provider value={contextFor(plan, issues, update)}>
        <InsuranceSection />
      </PlanCtx.Provider>,
    )
    // The stale value is presented at the field while the mode still applies.
    expectInvalid(labelledControl('Premiums end at age'), 'Must be at least 40')
    await choose(labelledControl<HTMLSelectElement>('Premium'), 'lifetime')
    expect(update).toHaveBeenCalledTimes(1)
    const cleared = structuredClone(plan)
    update.mock.calls[0]![0](cleared)
    expect(cleared.insurance[0]!.premiumMode).toBe('lifetime')
    expect(cleared.insurance[0]!).not.toHaveProperty('premiumEndAge')
    expect(parsePlan(cleared).ok).toBe(true)
    // Coming back stores the age the field already shows, so the schema's
    // "required when untilAge" never fires on a field that displays 65.
    cleared.insurance[0]!.premiumMode = 'paidUp'
    await act(async () => {
      root.render(
        <MemoryRouter>
          <PlanCtx.Provider value={contextFor(cleared, [], update)}>
            <InsuranceSection />
          </PlanCtx.Provider>
        </MemoryRouter>,
      )
    })
    await choose(labelledControl<HTMLSelectElement>('Premium'), 'untilAge')
    const seeded = structuredClone(cleared)
    update.mock.calls[1]![0](seeded)
    expect(seeded.insurance[0]!).toMatchObject({ premiumMode: 'untilAge', premiumEndAge: 65 })
    expect(parsePlan(seeded).ok).toBe(true)
  })

  it('leaving "Until an age" keeps a premium end age the schema accepts, so the round trip does not lose it (#503)', async () => {
    const plan = createSamplePlan()
    plan.careEvents = []
    plan.insurance = [
      {
        kind: 'permanentLife',
        id: 'life-1',
        name: 'Whole life',
        insured: plan.household.people[0]!.id,
        beneficiary: 'estate',
        annualPremium: 1200,
        premiumMode: 'untilAge',
        premiumEndAge: 72,
        deathBenefit: 100_000,
        cashValue: 10_000,
        cashValueMode: 'flatRate',
        cashValueGrowthPct: 4,
      },
    ]
    expect(parsePlan(plan).ok).toBe(true)
    const update = vi.fn()
    await render(
      <PlanCtx.Provider value={contextFor(plan, [], update)}>
        <InsuranceSection />
      </PlanCtx.Provider>,
    )
    await choose(labelledControl<HTMLSelectElement>('Premium'), 'paidUp')
    const kept = structuredClone(plan)
    update.mock.calls[0]![0](kept)
    expect(kept.insurance[0]!).toMatchObject({ premiumMode: 'paidUp', premiumEndAge: 72 })
    expect(parsePlan(kept).ok).toBe(true)
    await act(async () => {
      root.render(
        <MemoryRouter>
          <PlanCtx.Provider value={contextFor(kept, [], update)}>
            <InsuranceSection />
          </PlanCtx.Provider>
        </MemoryRouter>,
      )
    })
    await choose(labelledControl<HTMLSelectElement>('Premium'), 'untilAge')
    const back = structuredClone(kept)
    update.mock.calls[1]![0](back)
    expect(back.insurance[0]!).toMatchObject({ premiumMode: 'untilAge', premiumEndAge: 72 })
  })

  it('Spending: a rejected goal amount and phase multiplier show at their fields, and From age 200 is flagged while typing (#492, #526, #545)', async () => {
    const plan = createSamplePlan()
    plan.expenses.phases = [{ fromAge: 75, multiplier: 99.5 }]
    plan.expenses.oneTimeGoals = [{ id: 'goal-1', label: 'Trip', year: 2030, amount: -9999 }]
    const parsed = parsePlan(plan)
    expect(parsed.ok).toBe(false)
    const issues = parsed.ok ? [] : parsed.issues
    expect(issues).toContain('expenses.phases.0.multiplier: Too big: expected number to be <=3')
    expect(issues).toContain('expenses.oneTimeGoals.0.amount: Too small: expected number to be >=0')
    const update = vi.fn()
    await render(
      <PlanCtx.Provider value={contextFor(plan, issues, update)}>
        <SpendingSection />
      </PlanCtx.Provider>,
    )
    expectInvalid(labelledControl('Multiplier'), 'Must be at most 3')
    expectInvalid(labelledControl("Amount (today's $)"), 'Must be at least 0')
    const fromAge = labelledControl('From age')
    expect(fromAge.hasAttribute('aria-invalid')).toBe(false)
    await typeInto(fromAge, '200')
    expect(update).not.toHaveBeenCalled()
    expectInvalid(fromAge, 'Must be at most 110')
    // Goal year 1999 is inside the engine's calendar range, so it is not flagged here (a product range, see the PR).
    const year = labelledControl('Year')
    await typeInto(year, '1999')
    expect(update).toHaveBeenCalledTimes(1)
    expect(year.hasAttribute('aria-invalid')).toBe(false)
  })

  it('Income: a rejected recurring amount, wages gross, and stop age show at their fields (#500, #524)', async () => {
    const plan = createSamplePlan()
    const person = plan.household.people[0]!.id
    plan.incomes = [
      { type: 'wages', id: 'w', personId: person, annualGross: -500, endAge: 200, realGrowthPct: 0 },
      { type: 'recurring', id: 'r', label: 'Rental', annualAmount: -1, startYear: 2050, endYear: 2020, inflationAdjusted: true, taxTreatment: 'ordinary' },
    ]
    const parsed = parsePlan(plan)
    expect(parsed.ok).toBe(false)
    const issues = parsed.ok ? [] : parsed.issues
    await render(
      <PlanCtx.Provider value={contextFor(plan, issues)}>
        <IncomeSection />
      </PlanCtx.Provider>,
    )
    expectInvalid(labelledControl('Annual gross'), 'Must be at least 0')
    expectInvalid(labelledControl('Stop age'), 'Must be at most 80')
    expectInvalid(labelledControl("Annual amount (today's $)"), 'Must be at least 0')
    // The engine has no start-before-end rule for a recurring stream, so the
    // inverted years are not an issue it can report (a product range, see the PR).
    expect(issues.some((i) => i.includes('endYear'))).toBe(false)
    expect(labelledControl('End year').hasAttribute('aria-invalid')).toBe(false)
  })
})
