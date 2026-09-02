/** @vitest-environment jsdom */
/**
 * Unnamed people (#523): clearing a name stores a placeholder that reads as
 * one ("Unnamed partner" / "Unnamed primary") rather than a literal "Person",
 * and the Name field says so. The header always shows the stored name — a
 * person really called that is never hidden.
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
  it('the fallback reads as a placeholder that states the role, not "Person"', () => {
    expect(fallbackPersonName(0)).toBe('Unnamed primary')
    expect(fallbackPersonName(1)).toBe('Unnamed partner')
  })

  it('a cleared name is stored as the placeholder, and the field hint says so', () => {
    const plan = createSamplePlan()
    expect(plan.household.people).toHaveLength(2)
    const { el, applied } = mount(plan)
    const [primary, partner] = nameInputs(el)
    expect(partner).toBeDefined()
    typeInto(partner!, '')
    expect(applied.at(-1)!.household.people[1]!.name).toBe('Unnamed partner')
    typeInto(primary!, '')
    expect(applied.at(-1)!.household.people[0]!.name).toBe('Unnamed primary')
    // No draft ever stored the old placeholder.
    for (const p of applied) expect(p.household.people.map((x) => x.name)).not.toContain('Person')
    expect(el.textContent).toContain('Blank = shown as Unnamed partner.')
    expect(el.textContent).toContain('Blank = shown as Unnamed primary.')
  })

  it('the card header always shows the stored name, and drops the role chip only when the name already states the role', () => {
    const plan = createSamplePlan()
    plan.household.people[1]!.name = 'Unnamed partner'
    const { el } = mount(plan)
    const titles = Array.from(el.querySelectorAll('.item-row-title')).map((t) => t.textContent?.trim())
    // Placeholder: the name is shown, the chip is not, so the role reads once.
    expect(titles).toContain('Unnamed partner')
    expect(titles).not.toContain('PartnerUnnamed partner')
    // A real name keeps its chip.
    expect(titles).toContain(`Primary${plan.household.people[0]!.name}`)
    const chips = Array.from(el.querySelectorAll('.item-row-title .type-chip')).map((c) => c.textContent)
    expect(chips).toEqual(['Primary'])
  })
})
