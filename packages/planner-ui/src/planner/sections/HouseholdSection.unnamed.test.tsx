/** @vitest-environment jsdom */
/**
 * Unnamed people (#523): clearing a name stores the role ("Partner" /
 * "Primary") rather than a literal "Person", the Name field says so, and the
 * card header does not read "Partner Partner".
 */
import { afterEach, describe, expect, it } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router'

import type { Plan } from '@retiregolden/engine/model/plan'
import { PlanCtx } from '../planContextCore'
import { createSamplePlan } from '../../testSupport/samplePlan'
import { HouseholdSection } from './HouseholdSection'
import { fallbackPersonName } from './sectionHelpers'

let root: Root | null = null
let container: HTMLDivElement | null = null

afterEach(() => {
  if (root) act(() => root!.unmount())
  container?.remove()
  root = null
  container = null
})

function mount(plan: Plan) {
  const applied: Plan[] = []
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => {
    root!.render(
      <MemoryRouter initialEntries={['/plan/x/household']}>
        <PlanCtx.Provider
          value={{
            plan,
            update: (mutate) => {
              const draft = structuredClone(plan)
              mutate(draft)
              applied.push(draft)
            },
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
  return { el: container, applied }
}

function nameInputs(el: HTMLElement): HTMLInputElement[] {
  return Array.from(el.querySelectorAll('label'))
    .filter((l) => l.textContent?.trim() === 'Name')
    .map((l) => el.ownerDocument.getElementById(l.htmlFor) as HTMLInputElement)
}

function typeInto(input: HTMLInputElement, text: string) {
  act(() => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
    setter.call(input, text)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

describe('Household unnamed people (#523)', () => {
  it('names the fallback after the role, not "Person"', () => {
    expect(fallbackPersonName(0)).toBe('Primary')
    expect(fallbackPersonName(1)).toBe('Partner')
  })

  it('a cleared Partner name is stored as "Partner", and the field hint says so', () => {
    const plan = createSamplePlan()
    expect(plan.household.people).toHaveLength(2)
    const { el, applied } = mount(plan)
    const [primary, partner] = nameInputs(el)
    expect(partner).toBeDefined()
    typeInto(partner!, '')
    expect(applied.at(-1)!.household.people[1]!.name).toBe('Partner')
    typeInto(primary!, '')
    expect(applied.at(-1)!.household.people[0]!.name).toBe('Primary')
    // No draft ever stored the old placeholder.
    for (const p of applied) expect(p.household.people.map((x) => x.name)).not.toContain('Person')
    expect(el.textContent).toContain('Blank = shown as Partner.')
    expect(el.textContent).toContain('Blank = shown as Primary.')
  })

  it('the card header does not repeat the role when the person carries the fallback name', () => {
    const plan = createSamplePlan()
    plan.household.people[1]!.name = 'Partner'
    const { el } = mount(plan)
    const titles = Array.from(el.querySelectorAll('.item-row-title')).map((t) => t.textContent?.trim())
    const partnerTitle = titles.find((t) => t?.startsWith('Partner'))
    expect(partnerTitle).toBe('Partner')
    // A real name still shows beside the chip.
    expect(titles.some((t) => t === `Primary${plan.household.people[0]!.name}`)).toBe(true)
  })
})
