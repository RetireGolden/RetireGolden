/** @vitest-environment jsdom */
/**
 * The In-your-plan tab on the engine's claim-age sweep (B2-P1 slice 5): the
 * refusals say why in plain words (each unpriced credit year with its reason;
 * who claimed and when), a negative change prints red with its own sign, the
 * current claim includes its months, the refinement is held with the plan it
 * was computed for, and the benefits-only tab and the Optimize page's words
 * agree on a claim already made.
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createEmptyPlan, parsePlan, type Account, type Plan } from '@retiregolden/engine/model/plan'
import { getExampleById } from './examples/registry'
import { demoPlanId } from './examples/loadExample'
import { waitFor } from '../testSupport/settle'
import { SsAnalysisPage } from './SsAnalysisPage'
import { PlanCtx, type PlanContextValue } from './planContextCore'

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  // The page prices from the projection's first year, the current year.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-06-15T12:00:00Z'))
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.useRealTimers()
})

function example(id: string): Plan {
  const built = getExampleById(id)!.build()
  return { ...built, id: demoPlanId(id), origin: 'example', exampleSourceId: id }
}

async function render(plan: Plan): Promise<void> {
  const value: PlanContextValue = { plan, update: () => undefined, discardPendingSave: () => undefined, saveState: 'saved', issues: [] }
  await act(async () => {
    root.render(
      <MemoryRouter>
        <PlanCtx.Provider value={value}>
          <SsAnalysisPage />
        </PlanCtx.Provider>
      </MemoryRouter>,
    )
  })
}

function settled(): Promise<void> {
  return waitFor(() => container.querySelector('.skeleton') === null, {
    what: 'the claim-age sweep',
    attempts: 1500,
    intervalMs: 20,
    describe: () => container.textContent ?? '',
  })
}

const text = (): string => (container.textContent ?? '').replace(/\s+/gu, ' ')

async function rankBy(value: string): Promise<void> {
  const select = [...container.querySelectorAll<HTMLSelectElement>('select')].find((s) => [...s.options].some((o) => o.value === value))
  if (!select) throw new Error(`no ranking ${value}`)
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!
  await act(async () => {
    setter.call(select, value)
    select.dispatchEvent(new Event('change', { bubbles: true }))
  })
}

function single(claimAge: { years: number; months: number }): Plan {
  const draft = createEmptyPlan({ newId: (() => { let n = 0; return () => `sweep-page-${++n}` })() })
  draft.household.people[0] = { id: 'p1', name: 'Pat', dob: '1964-06-15', sex: 'average', retirementAge: null, longevity: { planningAge: 92, source: 'manual' } }
  draft.assumptions.inflationPct = 2
  draft.assumptions.defaultReturnPct = 5
  draft.expenses.baseAnnual = 45_000
  const taxable: Account = { type: 'taxable', id: 'brokerage', name: 'Brokerage', ownerPersonId: null, annualReturnPct: null, balance: 900_000, costBasis: 900_000, annualContribution: 0 }
  draft.accounts = [taxable]
  draft.incomes = [{ type: 'socialSecurity', id: 'ss', personId: 'p1', piaMonthly: 2_500, earnings: null, claimAge }]
  const parsed = parsePlan(draft)
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  return parsed.plan
}

describe('In your plan on the engine sweep', () => {
  it('refuses on an unpriced credit, naming each year and its reason, and still shows the claim ages', async () => {
    await render(example('example-couple'))
    await settled()
    const page = text()
    expect(page).toContain('No claim age is ranked.')
    expect(page).toContain("Your plan's premium tax credit can't be priced in 2028 and 2029 (RetireGolden doesn't have the credit's figures for those years yet).")
    expect(page).not.toContain("No claim age meets this ranking's constraints")
    expect(page).not.toMatch(/Best by /u)
    expect(container.querySelectorAll('.heatmap-cell-button').length).toBeGreaterThan(0)
    // The tab says how its search differs from the Optimize page's, and where its grid starts.
    expect(page).toContain('tries only 62, full retirement age and 70')
    expect(page).toContain('from 62 (or the age reached this year, if later) to 70')
    expect(page).not.toContain('from the age reached this year to 70')
    // The reason is the decided one: an unpriced credit can move the ranking either way.
    expect(page).toContain(
      'All of your Social Security counts in the income that credit depends on, in the years it is paid, so a credit left unpriced there could change which claim age comes out ahead, in either direction.',
    )
    // A refused ranking has no order to check for robustness (L6).
    expect([...container.querySelectorAll('button')].some((b) => /Check robustness/u.test(b.textContent ?? ''))).toBe(false)
  }, 120_000)

  it('names who claimed and when for claims already made, here and on the benefits-only tab', async () => {
    await render(example('bracket-fill-roth'))
    await settled()
    expect(text()).toContain('Every claim here is already made. Morgan claimed at 67 in 2020 and Riley at 67 in 2022, before the plan starts in 2026')
    expect(container.querySelectorAll('.heatmap-cell-button')).toHaveLength(0)
    expect([...container.querySelectorAll('button')].some((b) => /^Apply /u.test(b.textContent ?? ''))).toBe(false)
    const tab = [...container.querySelectorAll<HTMLButtonElement>('button[role="tab"]')].find((b) => b.textContent === 'Benefits only')!
    await act(async () => tab.click())
    const page = text()
    expect(page).toContain('Every claim here is already made.')
    expect(page).not.toContain('Highest expected value')
  }, 120_000)

  it('prints a negative change in red with its own sign, and hides survivor liquidity on a plan with no survivor years', async () => {
    await render(example('annuity-purchases-estate'))
    await settled()
    await rankBy('bridge-durability')
    await settled()
    const callout = container.querySelector('.callout--info')!
    expect(callout.textContent).toContain('(−$16k)')
    expect(callout.querySelector('.delta-neg')?.textContent).toBe('−$16k')
    expect(callout.textContent).not.toContain('+−')
    expect(callout.textContent).toContain('in 2056 dollars')

    await render(example('glidepath-allocation'))
    const options = [...container.querySelectorAll<HTMLSelectElement>('select')].flatMap((s) => [...s.options].map((o) => o.value))
    expect(options).toContain('bridge-durability')
    expect(options).not.toContain('protect-survivor-liquidity')
  }, 180_000)

  it('compares with the plan\'s own claim months and offers the whole-year pick', async () => {
    await render(single({ years: 67, months: 6 }))
    await settled()
    const callout = container.querySelector('.callout--info')!
    expect(callout.textContent).toContain('at your current 67y 6m')
    expect(callout.textContent).not.toContain('your current choice')
    expect([...callout.querySelectorAll('button')].some((b) => /^Apply \d+$/u.test(b.textContent ?? ''))).toBe(true)
  }, 120_000)

  it('holds a disability benefit and compares the partner\'s claim ages; the benefits-only ranking gives its own reason', async () => {
    const plan = example('example-couple')
    const sam = plan.household.people[1]!
    plan.incomes = plan.incomes.map((income) =>
      income.type === 'socialSecurity' && income.personId === sam.id ? { ...income, disability: { onsetAge: 55 } } : income,
    )
    await render(plan)
    await settled()
    // In your plan: Sam's benefit is held as the ledger pays it, and Alex's claim ages are compared (L5).
    expect(container.querySelector('[data-sweep-refusal="disability"]')).toBeNull()
    expect(container.querySelector('[data-sweep-held="disability"]')?.textContent).toBe(
      "Sam's benefit is a disability benefit, paid from the onset of the disability rather than from a claim age, so there is no claim age to compare here. It stays as your plan pays it in every claim age below.",
    )
    expect(container.querySelectorAll('.heatmap-cell-button')).toHaveLength(0)
    expect(text()).toContain('Alex')
    expect(text()).not.toContain('priced together')
    const tab = [...container.querySelectorAll<HTMLButtonElement>('button[role="tab"]')].find((b) => b.textContent === 'Benefits only')!
    await act(async () => tab.click())
    const refusal = container.querySelector('[data-benefits-only-refusal="disability"]')?.textContent ?? ''
    expect(refusal).toContain("Sam's benefit is a disability benefit, paid from the onset of the disability rather than from a claim age")
    expect(refusal).toContain(
      "This ranking prices the couple's claims as pairs of claim ages and cannot place a disability benefit on that grid, so it ranks no claim age for Alex either.",
    )
    expect(text()).not.toContain('Highest expected value')
  }, 120_000)

  it('blames the plan as entered, not the claim age, when that plan has no bridge years (L1)', async () => {
    // The review's case: born 1964-06-15, $900k brokerage, $45k spending, a $2,500 PIA, claiming at 62y0m from 2026.
    await render(single({ years: 62, months: 0 }))
    await settled()
    await rankBy('bridge-durability')
    await settled()
    const note = container.querySelector('[data-ranked-on]')!
    expect(note.getAttribute('data-ranked-on')).toBe('estate-fallback-plan')
    expect(note.textContent).toBe(
      'Your plan as entered has no bridge years to compare against, so this ranking compares every claim age on the after-tax estate change.',
    )
    const callout = container.querySelector('.callout--info')!.textContent ?? ''
    expect(callout).toContain('claim at 70')
    expect(callout).toContain('Your plan as entered has no bridge years to compare against, so this claim age was ranked on the after-tax estate change')
    expect(callout).not.toContain('This claim age leaves no bridge years')
    expect(text()).not.toContain('None of these claim ages')
  }, 120_000)

  it('names the one row a bridge ranking read on the estate, and ranks the winner on the bridge years (M3)', async () => {
    // Claiming at 67 leaves 2026 to 2030 as bridge years; only the claim at 62 has none.
    await render(single({ years: 67, months: 0 }))
    await settled()
    await rankBy('bridge-durability')
    await settled()
    const note = container.querySelector('[data-ranked-on]')!
    expect(note.getAttribute('data-ranked-on')).toBe('estate-fallback-row')
    expect(note.textContent).toBe(
      '1 of the 9 claim ages leave no bridge years, so this ranking compares those on the after-tax estate change, and the rest on the lowest balance in those years.',
    )
    const callout = container.querySelector('.callout--info')!.textContent ?? ''
    expect(callout).toContain('claim at 63')
    expect(callout).toContain('Ranked on minimum bridge-year investable delta (+$26k vs current)')
    expect(callout).not.toContain('was ranked on the after-tax estate change')
    // A ranking the page stands behind offers the robustness check.
    expect([...container.querySelectorAll('button')].some((b) => /Check robustness/u.test(b.textContent ?? ''))).toBe(true)
  }, 120_000)

  it('treats a claim with months as no whole-year row on the Benefits-only tab: 67y 6m is not the 67 row (PR #758 review 2)', async () => {
    const benefitsOnly = async () => {
      const tab = [...container.querySelectorAll<HTMLButtonElement>('button[role="tab"]')].find((b) => b.textContent === 'Benefits only')!
      await act(async () => tab.click())
      const row = [...container.querySelectorAll('tr')].find((tr) => tr.querySelector('td')?.textContent === '67')!
      return { row, use: row.querySelector('button')! }
    }
    await render(single({ years: 67, months: 6 }))
    await settled()
    const withMonths = await benefitsOnly()
    expect(withMonths.row.classList.contains('claim-row--current')).toBe(false)
    expect(withMonths.use.disabled).toBe(false)
    expect(container.querySelectorAll('tr.claim-row--current')).toHaveLength(0)
    // The whole-year claim at 67 is the 67 row.
    await render(single({ years: 67, months: 0 }))
    await settled()
    const whole = await benefitsOnly()
    expect(whole.row.classList.contains('claim-row--current')).toBe(true)
    expect(whole.use.disabled).toBe(true)
  }, 120_000)

  it('drops the refinement when the plan changes', async () => {
    const plan = single({ years: 67, months: 0 })
    await render(plan)
    await settled()
    const refine = [...container.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent === 'Refine to the month')!
    await act(async () => refine.click())
    expect(text()).toMatch(/To the month: claim at|No month within a year of the whole-year pick ranks higher/u)
    await render({ ...plan, expenses: { ...plan.expenses, baseAnnual: 46_000 } })
    // The new plan's sweep settles first, so the refinement is gone for its own reason, not hidden by the skeleton.
    await settled()
    expect(container.querySelector('.callout--info')).not.toBeNull()
    expect(text()).not.toMatch(/To the month: claim at|No month within a year of the whole-year pick ranks higher/u)
  }, 120_000)
})
