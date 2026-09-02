/** @vitest-environment jsdom */
/**
 * Design-QA cluster J, #570: the kind badge must not run into the row title.
 *
 * `.item-row-title` is a flex row with a gap, so a screenshot shows the badge
 * and the title apart — but the markup put them in adjacent nodes with no
 * separator, and everything that reads text rather than boxes glued them
 * together: "CashRiley consolidated…", "EventInheritance…", "GoalKitchen…",
 * "Permanent lifeWhole life", "CareRiley · age 85". A CSS pin cannot see this
 * (jsdom computes no layout, and the CSS was never wrong); a rendered pin on
 * the text layer can, which is why it lives here.
 */
import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it } from 'vitest'

import { parsePlan, type Plan } from '@retiregolden/engine/model/plan'

import { createSamplePlan } from '../testSupport/samplePlan'
import { PlanCtx } from './planContextCore'
import { AccountsSection } from './sections/AccountsSection'
import { HouseholdSection } from './sections/HouseholdSection'
import { IncomeSection } from './sections/IncomeSection'
import { InsuranceSection } from './sections/InsuranceSection'
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

function validPlan(mutate?: (plan: Plan) => void): Plan {
  const plan = createSamplePlan()
  mutate?.(plan)
  const parsed = parsePlan(plan)
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  return parsed.plan
}

async function mount(initialPlan: Plan, child: React.ReactNode) {
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
  await act(async () => root!.render(<MemoryRouter><Harness /></MemoryRouter>))
  return container
}

/** Everything that reads after this badge inside its own parent element. */
function textAfterChip(chip: Element): string {
  let text = ''
  for (let node = chip.nextSibling; node !== null; node = node.nextSibling) text += node.textContent ?? ''
  return text
}

/**
 * The rule, applied to whatever the section rendered: a badge either ends its
 * container or is followed by whitespace. Returns the offending glued strings
 * so a failure names them the way the walk did.
 */
function gluedBadges(host: HTMLElement): string[] {
  const glued: string[] = []
  for (const chip of host.querySelectorAll('.type-chip')) {
    const after = textAfterChip(chip)
    if (after !== '' && !/^\s/.test(after)) glued.push(`${chip.textContent ?? ''}${after.slice(0, 40)}`)
  }
  return glued
}

/** The `.item-row-title` whose badge reads `chip` (and, when given, whose row mentions `contains`). */
function titleWithChip(host: HTMLElement, chip: string, contains?: string): HTMLElement {
  const title = [...host.querySelectorAll<HTMLElement>('.item-row-title')].find(
    (t) =>
      t.querySelector('.type-chip')?.textContent === chip &&
      (contains === undefined || (t.textContent ?? '').includes(contains)),
  )
  if (!title) throw new Error(`no item-row-title badged "${chip}"${contains ? ` mentioning "${contains}"` : ''}`)
  return title
}

describe('cluster J: the kind badge is separate in the text layer too (#570)', () => {
  it('Accounts: a Cash account reads "Cash <name>", not "CashRiley…"', async () => {
    const host = await mount(
      validPlan((p) => {
        p.accounts.push({
          id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01',
          type: 'cash',
          name: 'Riley consolidated brokerage',
          ownerPersonId: null,
          annualReturnPct: null,
          balance: 25_000,
          annualContribution: 0,
        })
      }),
      <AccountsSection />,
    )
    const title = titleWithChip(host, 'Cash', 'Riley')
    expect(title.textContent).not.toContain('CashRiley')
    expect(title.textContent?.replace(/\s+/g, ' ').trim()).toBe('Cash Riley consolidated brokerage')
    expect(gluedBadges(host)).toEqual([])
  })

  it('Income: a one-time stream reads "One-time <label>", not "One-timeInheritance…"', async () => {
    const host = await mount(
      validPlan((p) => {
        p.incomes.push({
          id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa02',
          type: 'oneTime',
          label: 'Inheritance from grandparents',
          year: 2032,
          amount: 50_000,
          taxTreatment: 'none',
          inflationAdjusted: false,
        })
      }),
      <IncomeSection />,
    )
    const title = titleWithChip(host, 'One-time', 'Inheritance')
    expect(title.textContent).not.toContain('One-timeInheritance')
    expect(title.textContent?.replace(/\s+/g, ' ').trim()).toBe('One-time Inheritance from grandparents')
    expect(gluedBadges(host)).toEqual([])
  })

  // The sample library already carries a "Kitchen remodel" goal, so the added
  // row uses a label of its own; the walk's string was "GoalKitchen and…".
  it('Spending: a goal reads "Goal <label>", not "Goal<label>"', async () => {
    const host = await mount(
      validPlan((p) => {
        p.expenses.oneTimeGoals.push({
          id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa03',
          label: 'Bathroom and porch',
          year: 2033,
          amount: 60_000,
          flexibility: 'fixed',
        })
      }),
      <SpendingSection />,
    )
    const title = titleWithChip(host, 'Goal', 'Bathroom')
    expect(title.textContent).not.toContain('GoalBathroom')
    expect(title.textContent?.replace(/\s+/g, ' ').trim()).toBe('Goal Bathroom and porch')
    expect(gluedBadges(host)).toEqual([])
  })

  it('Insurance: policy and care rows keep the badge off the title', async () => {
    const host = await mount(validPlan(), <InsuranceSection />)
    // Whatever the sample library carries here, no badge may run into a title.
    expect(gluedBadges(host)).toEqual([])
  })

  it('Household and Strategy rows keep the badge off the title', async () => {
    const household = await mount(validPlan(), <HouseholdSection />)
    expect(gluedBadges(household)).toEqual([])
    await act(async () => root!.unmount())
    container?.remove()
    root = null
    const strategy = await mount(
      validPlan((p) => {
        p.strategies.rothConversion = { mode: 'manual', conversions: [{ year: 2031, amount: 20_000 }] }
      }),
      <StrategySection />,
    )
    const title = titleWithChip(strategy, 'Convert')
    expect(title.textContent).not.toMatch(/Convert\d/)
    expect(gluedBadges(strategy)).toEqual([])
  })
})
