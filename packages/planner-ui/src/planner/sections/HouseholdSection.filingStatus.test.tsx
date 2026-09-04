/** @vitest-environment jsdom */
/**
 * Filing status vs household membership (#555): two people on a Single plan
 * is a shape the schema allows, so the partner is neither removed nor
 * disabled — but the section says how the ledger reads it, and names the
 * partner it is talking about. One person, or a joint plan, gets no notice.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router'

import type { Plan } from '@retiregolden/engine/model/plan'
import { PlanCtx } from '../planContextCore'
import { createSamplePlan } from '../../testSupport/samplePlan'
import { SINGLE_WITH_PARTNER_NOTE } from '../filingStatusNotice'
import { HouseholdSection } from './HouseholdSection'

let root: Root | null = null
let container: HTMLDivElement | null = null

afterEach(() => {
  if (root) act(() => root!.unmount())
  container?.remove()
  root = null
  container = null
})

function mount(plan: Plan) {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => {
    root!.render(
      <MemoryRouter initialEntries={['/plan/x/household']}>
        <PlanCtx.Provider
          value={{
            plan,
            update: () => undefined,
            discardPendingSave: () => undefined,
            saveState: 'saved',
            issues: [],
          }}
        >
          <HouseholdSection />
        </PlanCtx.Provider>
      </MemoryRouter>,
    )
  })
  return container
}

const notice = (el: HTMLElement) => el.querySelector('[data-testid="single-with-partner-notice"]')

describe('Household: Single filing status with a partner (#555)', () => {
  it('a Single plan with two people shows the consistency notice, names the partner, and keeps the partner card', () => {
    const plan = createSamplePlan()
    expect(plan.household.people).toHaveLength(2)
    plan.household.filingStatus = 'single'
    const el = mount(plan)
    const box = notice(el)
    expect(box).not.toBeNull()
    expect(box!.classList.contains('callout')).toBe(true)
    expect(box!.textContent).toContain('Two people on a Single-filing plan.')
    expect(box!.textContent).toContain(SINGLE_WITH_PARTNER_NOTE)
    expect(box!.textContent).toContain(`remove ${plan.household.people[1]!.name}`)
    // The partner is still there to edit or remove; nothing was disabled.
    const titles = Array.from(el.querySelectorAll('.item-row-title')).map((t) => t.textContent)
    expect(titles.some((t) => t?.includes(plan.household.people[1]!.name))).toBe(true)
    const removeButtons = Array.from(el.querySelectorAll('button')).filter((b) => b.textContent === 'Remove')
    expect(removeButtons.length).toBeGreaterThan(0)
    expect(removeButtons.every((b) => !b.disabled)).toBe(true)
    // The joint-only control is gone under Single, as before.
    expect(el.textContent).not.toContain('Qualifying surviving spouse')
  })

  it('the notice sits inside a status region that is mounted before it has anything to say', () => {
    // A live region inserted together with its text is not reliably announced;
    // the container is always there, so the text that arrives on a filing
    // status change lands in a region assistive tech already tracks.
    const joint = createSamplePlan()
    joint.household.filingStatus = 'marriedFilingJointly'
    const quiet = mount(joint)
    const region = quiet.querySelector('[data-testid="single-with-partner-status"]')
    expect(region).not.toBeNull()
    expect(region!.getAttribute('role')).toBe('status')
    expect(region!.textContent).toBe('')
    expect(notice(quiet)).toBeNull()

    const single = createSamplePlan()
    single.household.filingStatus = 'single'
    const loud = mount(single)
    const box = notice(loud)
    expect(box!.closest('[role="status"]')).toBe(loud.querySelector('[data-testid="single-with-partner-status"]'))
    expect(box!.getAttribute('role')).toBeNull()
  })

  it('a joint plan with two people shows no notice', () => {
    const plan = createSamplePlan()
    plan.household.filingStatus = 'marriedFilingJointly'
    expect(notice(mount(plan))).toBeNull()
  })

  it('a Single plan with one person shows no notice', () => {
    const plan = createSamplePlan()
    plan.household.filingStatus = 'single'
    plan.household.people = [plan.household.people[0]!]
    expect(notice(mount(plan))).toBeNull()
  })
})
