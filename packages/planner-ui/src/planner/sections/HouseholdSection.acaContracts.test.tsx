/** @vitest-environment jsdom */
/**
 * What a household or premium edit does to an example's premium-credit
 * contracts (decision D-EXAMPLE-SOURCE-SWITCH; review findings M2 and M3,
 * K08). early-retiree-aca carries 'premiumField' contracts for 2026 to 2028.
 * They are derived from the household and the premium on every run, so
 * moving Casey from Florida to Georgia, or changing the premium, keeps them
 * and the credit is priced on the edited plan, as do a date of birth, a
 * planning age and a move. Adding or removing a partner, or a new filing
 * status, can falsify their stored assertions, so it removes them, and the
 * planner names that edit when it says why the credit is not counted.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router'

import type { Plan } from '@retiregolden/engine/model/plan'
import { projectPlan } from '../../projection'
import { appExamplePlanById } from '../../testSupport/appExamples'
import { guardrailPreviewUnpricedCreditRefusal } from '../acaVetoCopy'
import { acaReportStatus } from '../acaReportStatus'
import { EXAMPLE_FIXED_YEAR } from '../examples/buildContext'
import { PlanCtx } from '../planContextCore'
import { HouseholdSection } from './HouseholdSection'
import { SpendingSection } from './SpendingSection'

let root: Root | null = null
let container: HTMLDivElement | null = null

afterEach(() => {
  if (root) act(() => root!.unmount())
  container?.remove()
  root = null
  container = null
})

/** Mounts `child` over a plan whose `update` applies the draft, recording each edited plan. */
function mount(initial: Plan, child: React.ReactNode): { host: HTMLDivElement; latest: () => Plan } {
  let current = initial
  function Harness() {
    const [plan, setPlan] = useState(initial)
    return (
      <PlanCtx.Provider
        value={{
          plan,
          update: (mutator) =>
            setPlan((previous) => {
              const next = structuredClone(previous)
              mutator(next)
              current = next
              return next
            }),
          discardPendingSave: () => undefined,
          saveState: 'saved',
          issues: [],
        }}
      >
        {child}
      </PlanCtx.Provider>
    )
  }
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => root!.render(<MemoryRouter initialEntries={['/plan/x/household']}><Harness /></MemoryRouter>))
  return { host: container, latest: () => current }
}

function control(host: HTMLElement, label: string): HTMLInputElement | HTMLSelectElement {
  const found = [...host.querySelectorAll('label')].find((l) => l.textContent?.trim() === label)
  if (!found) throw new Error(`no field labelled ${label}`)
  const id = found.getAttribute('for')!
  return host.querySelector<HTMLInputElement | HTMLSelectElement>(`[id="${id}"]`)!
}

function select(el: HTMLSelectElement, value: string) {
  act(() => {
    Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value')!.set!.call(el, value)
    el.dispatchEvent(new Event('change', { bubbles: true }))
  })
}

function type(el: HTMLInputElement, value: string) {
  act(() => {
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!.call(el, value)
    el.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

const credits = (plan: Plan) => {
  const years = projectPlan(plan, EXAMPLE_FIXED_YEAR).result.years
  return Object.fromEntries(
    [2026, 2027].map((year) => {
      const aca = years.find((row) => row.year === year)!.aca!
      return [year, { readiness: aca.readiness, credit: aca.modeledAllowablePtc }]
    }),
  )
}

describe('early-retiree-aca: household and premium edits and the premium-credit contracts', () => {
  it('keeps its credits when Casey moves from Florida to Georgia', () => {
    const plan = appExamplePlanById('early-retiree-aca')
    expect(plan.household.state).toBe('FL')
    const before = credits(plan)
    expect(before[2026]!.readiness).toBe('actionable')
    expect(before[2027]!.readiness).toBe('actionable')

    const { host, latest } = mount(plan, <HouseholdSection />)
    select(control(host, 'State (starting residence)') as HTMLSelectElement, 'GA')
    const moved = latest()
    expect(moved.household.state).toBe('GA')
    expect(moved.expenses.healthcare.acaYears).toEqual(plan.expenses.healthcare.acaYears)
    expect(moved.expenses.healthcare.acaYearsRemoved).toBeUndefined()
    const after = credits(moved)
    expect(after[2026]!.readiness).toBe('actionable')
    expect(after[2027]!.readiness).toBe('actionable')
    expect(after[2026]!.credit!).toBeGreaterThan(10_000)
    expect(after[2027]!.credit!).toBeGreaterThan(10_000)
  })

  it('keeps them through a premium edit on the Spending card, and prices the new premium', () => {
    const plan = appExamplePlanById('early-retiree-aca')
    const { host, latest } = mount(plan, <SpendingSection />)
    type(control(host, 'Pre-65 premium / person / month') as HTMLInputElement, '1300')
    const edited = latest()
    expect(edited.expenses.healthcare.pre65MonthlyPremiumPerPerson).toBe(1_300)
    expect(edited.expenses.healthcare.acaYears).toEqual(plan.expenses.healthcare.acaYears)
    const years = projectPlan(edited, EXAMPLE_FIXED_YEAR).result.years
    const aca2026 = years.find((row) => row.year === 2026)!.aca!
    expect(aca2026.readiness).toBe('actionable')
    expect(aca2026.grossEnrollmentPremium).toBe(15_600)
  })

  it('keeps them through a date of birth, a planning age and a move', () => {
    const plan = appExamplePlanById('early-retiree-aca')
    const { host, latest } = mount(plan, <HouseholdSection />)
    type(control(host, 'Date of birth') as HTMLInputElement, '1964-06-01')
    expect(latest().household.people[0]!.dob).toBe('1964-06-01')
    type(control(host, 'Planning age') as HTMLInputElement, '94')
    expect(latest().household.people[0]!.longevity.planningAge).toBe(94)
    const addMove = [...host.querySelectorAll('button')].find((b) => b.textContent?.includes('Add a move'))!
    act(() => addMove.click())
    const edited = latest()
    expect(edited.household.stateMoves).toHaveLength(1)
    expect(edited.expenses.healthcare.acaYears).toEqual(plan.expenses.healthcare.acaYears)
    expect(edited.expenses.healthcare.acaYearsRemoved).toBeUndefined()
  })

  it('removes them on a new filing status, and names that edit', () => {
    const plan = appExamplePlanById('early-retiree-aca')
    const { host, latest } = mount(plan, <HouseholdSection />)
    select(control(host, 'Filing status') as HTMLSelectElement, 'marriedFilingJointly')
    const edited = latest()
    expect(edited.household.filingStatus).toBe('marriedFilingJointly')
    expect(edited.expenses.healthcare.acaYears).toBeUndefined()
    expect(edited.expenses.healthcare.acaYearsRemoved).toEqual([{ edit: 'filingStatusChanged', years: [2026, 2027, 2028] }])
  })

  it('removes them when the partner is removed, and names that edit', () => {
    const plan = appExamplePlanById('early-retiree-aca')
    const couple = structuredClone(plan)
    couple.household.people.push({
      id: 'partner-test',
      name: 'Partner',
      dob: '1965-01-01',
      sex: 'average',
      retirementAge: 65,
      longevity: { planningAge: 95, source: 'manual' },
    })
    couple.household.filingStatus = 'marriedFilingJointly'
    const { host, latest } = mount(couple, <HouseholdSection />)
    const remove = [...host.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Remove')!
    act(() => remove.click())
    const edited = latest()
    expect(edited.household.people).toHaveLength(1)
    expect(edited.expenses.healthcare.acaYears).toBeUndefined()
    expect(edited.expenses.healthcare.acaYearsRemoved).toEqual([{ edit: 'partnerRemoved', years: [2026, 2027, 2028] }])
  })

  it('removes them when a partner is added, and every explanation names that edit', () => {
    const plan = appExamplePlanById('early-retiree-aca')
    const { host, latest } = mount(plan, <HouseholdSection />)
    const add = [...host.querySelectorAll('button')].find((b) => b.textContent?.includes('Add partner'))!
    act(() => add.click())
    const edited = latest()
    expect(edited.household.people).toHaveLength(2)
    expect(edited.expenses.healthcare.acaYears).toBeUndefined()
    expect(edited.expenses.healthcare.acaYearsRemoved).toEqual([{ edit: 'partnerAdded', years: [2026, 2027, 2028] }])

    const years = projectPlan(edited, EXAMPLE_FIXED_YEAR).result.years
    // 2026 to 2028 had contracts, which the edit removed. The partner (born
    // 1965) is also covered in 2029, which never had one: that year keeps the
    // planner's own reason.
    const removedYears = years.filter((row) => row.year <= 2028)
    const refusal = guardrailPreviewUnpricedCreditRefusal(removedYears, [], edited.expenses.healthcare)!
    expect(refusal).toContain('the details the credit needs were removed when a partner was added')
    expect(refusal).not.toContain("the planner doesn't yet collect")
    const withLater = guardrailPreviewUnpricedCreditRefusal(years, [], edited.expenses.healthcare)!
    expect(withLater).toContain('the details the credit needs were removed when a partner was added')
    expect(withLater).toContain("the planner doesn't yet collect the household details the credit needs")
    expect(acaReportStatus(edited, years)).toContain('the credit details were removed by adding a partner')
  })
})
