/** @vitest-environment jsdom */
/**
 * Markup half of Design-QA cluster H (#489, #511, #512, #523, #526, #553):
 * the six walks that each paired a raw engine issue with a layout or copy
 * item. The validation chrome (#539, #543, #547) already places what the
 * engine rejects at its field; these pin that for every value the walks
 * typed, with real `parsePlan` issues rather than hand-written strings, and
 * cover the one field the chrome missed (the capital-loss carryforward, #553).
 * The stylesheet half is designQa.clusterH.test.ts.
 */
import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it } from 'vitest'

import { parsePlan, type Plan } from '@retiregolden/engine/model/plan'

import { createSamplePlan } from '../testSupport/samplePlan'
import { PlanCtx } from './planContextCore'
import { SocialSecuritySection } from './SocialSecuritySection'
import { HouseholdSection } from './sections/HouseholdSection'
import { IncomeFloorSection } from './sections/IncomeFloorSection'
import { SpendingSection } from './sections/SpendingSection'
import { StrategySection } from './sections/StrategySection'

let root: Root | null = null
let container: HTMLDivElement | null = null

afterEach(async () => {
  if (root !== null) await act(async () => root!.unmount())
  container?.remove()
  root = null
  container = null
})

type SocialSecurityStream = Extract<Plan['incomes'][number], { type: 'socialSecurity' }>

const isSocialSecurity = (s: Plan['incomes'][number]): s is SocialSecurityStream => s.type === 'socialSecurity'

function validPlan(mutate?: (plan: Plan) => void): Plan {
  const plan = createSamplePlan()
  mutate?.(plan)
  const parsed = parsePlan(plan)
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  return parsed.plan
}

/** The plan as the editor would hold it after the walk's entry, and what the engine says about it. */
function invalidPlan(mutate: (plan: Plan) => void): { plan: Plan; issues: string[] } {
  const plan = createSamplePlan()
  mutate(plan)
  const parsed = parsePlan(plan)
  if (parsed.ok) throw new Error('expected the engine to reject the plan')
  return { plan, issues: parsed.issues }
}

/** Mounts `child` under a live plan context whose `update` re-renders, like the workspace does. */
async function mount(initialPlan: Plan, child: React.ReactNode, issues: string[] = []) {
  function Harness() {
    const [plan, setPlan] = useState(initialPlan)
    return (
      <PlanCtx.Provider
        value={{
          plan,
          update: (mutator) =>
            setPlan((previous) => {
              const next = structuredClone(previous)
              mutator(next)
              return next
            }),
          discardPendingSave: () => undefined,
          saveState: issues.length > 0 ? 'invalid' : 'saved',
          issues,
        }}
      >
        {child}
      </PlanCtx.Provider>
    )
  }
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => root!.render(<MemoryRouter><Harness /></MemoryRouter>))
  return container
}

async function typeInto(input: HTMLInputElement, value: string) {
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
    setter.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

async function leave(input: HTMLInputElement) {
  // React's onBlur listens to focusout.
  await act(async () => input.dispatchEvent(new FocusEvent('focusout', { bubbles: true })))
}

/** The control wired to a schema path (every field component stamps `data-path`). */
function controlAt(host: HTMLElement, path: string): HTMLInputElement {
  const input = host.querySelector<HTMLInputElement>(`[data-path="${path}"]`)
  if (!input) throw new Error(`no control wired to ${path}`)
  return input
}

function errorOf(input: HTMLElement): string | null {
  return input.closest('.field')?.querySelector('.field-error')?.textContent ?? null
}

function noteOf(input: HTMLElement): string | null {
  return input.closest('.field')?.querySelector('.field-note')?.textContent ?? null
}

/** The one issue the engine reported, which must be at `path`. */
function onlyIssueAt(issues: string[], path: string): void {
  expect(issues).toHaveLength(1)
  expect(issues[0]!.startsWith(`${path}: `), issues[0]).toBe(true)
}

describe('Social Security (#511)', () => {
  const streamOf = (plan: Plan) => {
    const stream = plan.incomes.find(isSocialSecurity)
    if (!stream) throw new Error('the example couple has no Social Security stream')
    return { stream, path: `incomes.${plan.incomes.indexOf(stream)}.claimAge.months` }
  }

  it('a stored claim age of 67 years and 18 months is refused at the months field, in words', async () => {
    const { plan, issues } = invalidPlan((p) => {
      streamOf(p).stream.claimAge = { years: 67, months: 18 }
    })
    const { path } = streamOf(plan)
    onlyIssueAt(issues, path)
    const host = await mount(plan, <SocialSecuritySection />, issues)
    const months = controlAt(host, path)
    expect(months.getAttribute('aria-invalid')).toBe('true')
    expect(errorOf(months)).toBe('Must be at most 11')
    // The section's own list names the field as the card labels it, so the
    // header chip has somewhere to land; the schema path stays out of the copy.
    const list = host.querySelector('#plan-issues-social-security')!
    expect(list.textContent).toContain('Claim age (+ months)')
    expect(list.textContent).toContain('Must be at most 11')
    expect(list.textContent).not.toContain('claimAge')
  })

  it('typing 18 months is flagged at once and stores nothing; leaving restores the stored months', async () => {
    const plan = validPlan()
    const { stream, path } = streamOf(plan)
    const host = await mount(plan, <SocialSecuritySection />)
    const months = controlAt(host, path)
    await typeInto(months, '18')
    expect(months.getAttribute('aria-invalid')).toBe('true')
    expect(errorOf(months)).toBe('Must be at most 11')
    await leave(months)
    expect(months.value).toBe(String(stream.claimAge.months))
    expect(months.hasAttribute('aria-invalid')).toBe(false)
    expect(noteOf(months)).toBe('Not kept: 18 is above the highest allowed, 11')
  })
})

describe('Income floor (#512)', () => {
  function withInvertedLadder(plan: Plan) {
    const year = new Date().getFullYear()
    plan.incomeFloor = {
      ladders: [
        {
          id: 'ladder-h',
          name: 'Bridge',
          purpose: 'bridge',
          startYear: year + 6,
          endYear: year + 2,
          annualRealAmount: 24_000,
          purchase: { year: year + 1, fundingAccountId: plan.accounts.find((a) => a.type === 'cash')!.id },
        },
      ],
    }
  }

  it('a last payout year before the first is refused at that field on the ladder card, and the priced panels pause', async () => {
    const { plan, issues } = invalidPlan(withInvertedLadder)
    onlyIssueAt(issues, 'incomeFloor.ladders.0.endYear')
    const host = await mount(plan, <IncomeFloorSection />, issues)
    const endYear = controlAt(host, 'incomeFloor.ladders.0.endYear')
    expect(endYear.getAttribute('aria-invalid')).toBe('true')
    // The engine's own sentence passes through: it is already written for people.
    expect(errorOf(endYear)).toBe('a ladder must end in or after its first payout year')
    expect(endYear.closest('.item-row'), 'the message sits on the ladder card').not.toBeNull()
    // Neither derived panel quotes a stale number for a plan the engine will not store.
    expect(host.textContent).not.toContain('Quoted cost')
    expect(host.textContent).toContain('Quote paused')
    expect(host.textContent).toContain('Paused while the plan has an issue')
    expect(host.querySelector('.stat-value')).toBeNull()
  })
})

describe('Household (#523)', () => {
  it('a stored partner retirement age of 999 is refused at the partner field, in words', async () => {
    const { plan, issues } = invalidPlan((p) => {
      p.household.people[1]!.retirementAge = 999
    })
    onlyIssueAt(issues, 'household.people.1.retirementAge')
    const host = await mount(plan, <HouseholdSection />, issues)
    const age = controlAt(host, 'household.people.1.retirementAge')
    expect(age.getAttribute('aria-invalid')).toBe('true')
    expect(errorOf(age)).toBe('Must be at most 80')
    const list = host.querySelector('#plan-issues-household')!
    expect(list.textContent).toContain('Person 2: Retirement age')
    expect(list.textContent).not.toContain('Invalid input')
  })

  it('typing 999 is flagged while typing and commits nothing', async () => {
    const plan = validPlan()
    const host = await mount(plan, <HouseholdSection />)
    const age = controlAt(host, 'household.people.1.retirementAge')
    await typeInto(age, '999')
    expect(errorOf(age)).toBe('Must be at most 80')
    await leave(age)
    expect(age.value).toBe(String(plan.household.people[1]!.retirementAge))
    expect(noteOf(age)).toBe('Not kept: 999 is above the highest allowed, 80')
  })

  it('clearing the partner name stores a placeholder that says so, never "Person"', async () => {
    const host = await mount(validPlan(), <HouseholdSection />)
    const names = [...host.querySelectorAll<HTMLLabelElement>('label.field-label')]
      .filter((l) => l.textContent?.trim() === 'Name')
      .map((l) => host.querySelector<HTMLInputElement>(`#${l.htmlFor}`)!)
    expect(names).toHaveLength(2)
    await typeInto(names[1]!, '')
    const titles = [...host.querySelectorAll<HTMLElement>('.item-row-title')].map((t) => t.textContent?.trim())
    expect(titles).toContain('Unnamed partner')
    expect(titles.some((t) => /\bPerson\b/.test(t ?? ''))).toBe(false)
  })
})

describe('Spending (#526)', () => {
  it('a stored phase multiplier of 99.5 is refused at the phase field, in words', async () => {
    const { plan, issues } = invalidPlan((p) => {
      p.expenses.phases[0]!.multiplier = 99.5
    })
    onlyIssueAt(issues, 'expenses.phases.0.multiplier')
    const host = await mount(plan, <SpendingSection />, issues)
    const multiplier = controlAt(host, 'expenses.phases.0.multiplier')
    expect(multiplier.getAttribute('aria-invalid')).toBe('true')
    expect(errorOf(multiplier)).toBe('Must be at most 3')
    expect(host.querySelector('#plan-issues-spending')!.textContent).not.toContain('Invalid input')
  })

  it('typing 99.5 is flagged while typing and commits nothing', async () => {
    const host = await mount(validPlan(), <SpendingSection />)
    const multiplier = controlAt(host, 'expenses.phases.0.multiplier')
    await typeInto(multiplier, '99.5')
    expect(errorOf(multiplier)).toBe('Must be at most 3')
  })

  it('a long goal label stays in the row title, with Remove its only sibling in the head', async () => {
    const label = 'Replace the roof, the gutters, and the back deck before the grandchildren start visiting every summer'
    const plan = validPlan((p) => {
      p.expenses.oneTimeGoals[0]!.label = label
    })
    const host = await mount(plan, <SpendingSection />)
    const title = [...host.querySelectorAll<HTMLElement>('.item-row-title')].find((t) => t.textContent?.includes(label))
    expect(title, 'the goal row is titled with the whole label').toBeTruthy()
    const head = title!.parentElement!
    expect(head.classList.contains('item-row-head')).toBe(true)
    // Title then Remove, and nothing else: the stylesheet keeps Remove on the
    // first line's baseline when the title wraps (designQa.clusterH.test.ts).
    expect(head.children).toHaveLength(2)
    expect(head.lastElementChild?.textContent?.trim()).toBe('Remove')
    // The Label field holds the same text, unshortened.
    expect(controlAt(host, 'expenses.oneTimeGoals.0.label').value).toBe(label)
  })
})

describe('Strategy itemized deductions and capital loss (#553)', () => {
  const itemized = (p: Plan, mortgageInterest: number) => {
    p.strategies.itemizedDeductions = { stateAndLocalTaxes: 10_000, mortgageInterest, charitable: 2_000 }
  }

  it('a stored negative mortgage interest is refused at its field, in words', async () => {
    const { plan, issues } = invalidPlan((p) => itemized(p, -1))
    onlyIssueAt(issues, 'strategies.itemizedDeductions.mortgageInterest')
    const host = await mount(plan, <StrategySection />, issues)
    const mortgage = controlAt(host, 'strategies.itemizedDeductions.mortgageInterest')
    expect(mortgage.getAttribute('aria-invalid')).toBe('true')
    expect(errorOf(mortgage)).toBe('Must be at least 0')
    const list = host.querySelector('#plan-issues-strategy')!
    expect(list.textContent).toContain('Itemized deductions: Mortgage interest')
    expect(list.textContent).not.toContain('Invalid input')
  })

  it('typing a negative mortgage interest is flagged while typing and commits nothing', async () => {
    const host = await mount(validPlan((p) => itemized(p, 8_000)), <StrategySection />)
    const mortgage = controlAt(host, 'strategies.itemizedDeductions.mortgageInterest')
    await typeInto(mortgage, '-500')
    expect(errorOf(mortgage)).toBe('Must be at least 0')
    await leave(mortgage)
    expect(mortgage.value).toBe('8,000')
    expect(noteOf(mortgage)).toBe('Not kept: -500 is below the lowest allowed, 0')
  })

  it('SALT has a floor and no ceiling in the engine, so 99,999,999 is accepted as typed (a range is a product decision, #495)', async () => {
    const accepted = parsePlan(validPlan((p) => itemized(p, 0)))
    expect(accepted.ok).toBe(true)
    const plan = createSamplePlan()
    plan.strategies.itemizedDeductions = { stateAndLocalTaxes: 99_999_999, mortgageInterest: 0, charitable: 0 }
    expect(parsePlan(plan).ok).toBe(true)
    const host = await mount(validPlan((p) => itemized(p, 0)), <StrategySection />)
    const salt = controlAt(host, 'strategies.itemizedDeductions.stateAndLocalTaxes')
    await typeInto(salt, '99999999')
    expect(errorOf(salt)).toBeNull()
    await typeInto(salt, '-1')
    expect(errorOf(salt)).toBe('Must be at least 0')
  })

  it('a negative capital-loss carryforward is flagged while typing and not kept, rather than silently stored as 0', async () => {
    const host = await mount(validPlan(), <StrategySection />)
    const carryforward = controlAt(host, 'household.capitalLossCarryforward')
    await typeInto(carryforward, '-9999999')
    expect(carryforward.getAttribute('aria-invalid')).toBe('true')
    expect(errorOf(carryforward)).toBe('Must be at least 0')
    await leave(carryforward)
    expect(carryforward.value).toBe('0')
    expect(carryforward.hasAttribute('aria-invalid')).toBe(false)
    expect(noteOf(carryforward)).toBe('Not kept: -9999999 is below the lowest allowed, 0')
  })

  it('a stored negative carryforward (an import) is refused at the field, in words', async () => {
    const { plan, issues } = invalidPlan((p) => {
      p.household.capitalLossCarryforward = -5
    })
    onlyIssueAt(issues, 'household.capitalLossCarryforward')
    const host = await mount(plan, <StrategySection />, issues)
    const carryforward = controlAt(host, 'household.capitalLossCarryforward')
    expect(carryforward.getAttribute('aria-invalid')).toBe('true')
    expect(errorOf(carryforward)).toBe('Must be at least 0')
  })
})
