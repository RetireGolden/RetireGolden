/** @vitest-environment jsdom */
/**
 * The Assumptions card prints a group's note under its heading (#555): for a
 * Single plan with two people the household group's reading appears above
 * both people's rows with no provenance chip, and a joint plan prints none.
 * Mounted, so the wiring from snapshot to card is what is pinned.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router'

import type { Plan } from '@retiregolden/engine/model/plan'
import { AssumptionsCardPage } from './AssumptionsCardPage'
import { SINGLE_WITH_PARTNER_NOTE } from './filingStatusNotice'
import { PlanCtx } from './planContextCore'
import { createSamplePlan } from '../testSupport/samplePlan'

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
      <MemoryRouter>
        <PlanCtx.Provider value={{ plan, update: () => undefined, discardPendingSave: () => undefined, saveState: 'saved', issues: [] }}>
          <AssumptionsCardPage />
        </PlanCtx.Provider>
      </MemoryRouter>,
    )
  })
  return container
}

const note = (el: HTMLElement) => el.querySelector('[data-testid="assumption-group-note-longevity"]')

describe('AssumptionsCardPage: Single filing status with two people (#555)', () => {
  it('prints the household reading under the group heading, before the rows, with no provenance chip', () => {
    const plan = createSamplePlan()
    plan.household.filingStatus = 'single'
    const el = mount(plan)
    const box = note(el)
    expect(box).not.toBeNull()
    expect(box!.textContent).toBe(`Two people on a Single-filing plan: ${SINGLE_WITH_PARTNER_NOTE}`)
    // Under the heading and above the table of rows.
    const card = box!.closest('.card')!
    expect(card.querySelector('h3')!.textContent).toBe('Household & longevity')
    const order = Array.from(card.children).map((c) => c.tagName)
    expect(order.indexOf('P')).toBeGreaterThan(order.indexOf('H3'))
    expect(order.indexOf('P')).toBeLessThan(order.indexOf('TABLE'))
    // Not a row: nothing in the table carries the sentence or a chip for it.
    expect(card.querySelector('table')!.textContent).not.toContain(SINGLE_WITH_PARTNER_NOTE)
  })

  it('prints no note for a joint plan', () => {
    const plan = createSamplePlan()
    plan.household.filingStatus = 'marriedFilingJointly'
    expect(note(mount(plan))).toBeNull()
  })
})
