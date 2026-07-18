/** @vitest-environment jsdom */
/**
 * Household map page: renders the topology from plan data with deep links,
 * the privacy toggle strips every dollar figure from the DOM, filters and
 * arrow-key navigation work, and the print/at-a-glance affordances ship.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

import type { Plan } from '@retiregolden/engine/model/plan'
import { PlanCtx } from '../planner/planContextCore'
import { buildExampleCouple } from '../planner/examples/buildExampleCouple'
import { HouseholdMapPage } from './HouseholdMapPage'

let root: Root | null = null
let container: HTMLDivElement | null = null

function renderPage(plan: Plan) {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => {
    root!.render(
      <MemoryRouter initialEntries={[`/plan/${plan.id}/household-map`]}>
        <PlanCtx.Provider
          value={{ plan, update: () => undefined, discardPendingSave: () => undefined, saveState: 'saved', issues: [] }}
        >
          {/* Mirror the app's nesting so relative deep links resolve like production. */}
          <Routes>
            <Route path="/plan/:planId">
              <Route path="household-map" element={<HouseholdMapPage />} />
            </Route>
          </Routes>
        </PlanCtx.Provider>
      </MemoryRouter>,
    )
  })
  return container
}

afterEach(() => {
  if (root) act(() => root!.unmount())
  container?.remove()
  root = null
  container = null
})

const nodeLinks = (el: HTMLElement) => Array.from(el.querySelectorAll<HTMLAnchorElement>('.map-node'))

describe('HouseholdMapPage', () => {
  it('renders every household entity as a deep-linking card', () => {
    const plan = buildExampleCouple()
    const el = renderPage(plan)
    const labels = nodeLinks(el).map((a) => a.querySelector('.map-node-label')?.textContent)
    for (const expected of ['Alex', 'Sam', 'Joint brokerage', 'Home', 'Mortgage', 'Alex whole life']) {
      expect(labels).toContain(expected)
    }
    // Deep links resolve to the owning planner section.
    const brokerage = nodeLinks(el).find((a) => a.textContent?.includes('Joint brokerage'))!
    expect(brokerage.getAttribute('href')).toBe(`/plan/${plan.id}/accounts`)
    const alex = nodeLinks(el).find((a) => a.querySelector('.map-node-label')?.textContent === 'Alex')!
    expect(alex.getAttribute('href')).toBe(`/plan/${plan.id}/household`)
  })

  it('privacy toggle: hiding amounts removes every dollar figure from the page', () => {
    const el = renderPage(buildExampleCouple())
    expect(el.querySelector('.household-map-stage')!.textContent).toContain('$')
    const toggle = Array.from(el.querySelectorAll('button')).find((b) => b.textContent === 'Hide amounts')!
    act(() => toggle.click())
    expect(toggle.getAttribute('aria-pressed')).toBe('true')
    // No dollar strings anywhere on the page — cards, totals, or text list.
    expect(el.textContent).not.toContain('$')
    expect(el.textContent).toContain('Amounts hidden')
  })

  it('group filters hide a column while people stay', () => {
    const el = renderPage(buildExampleCouple())
    expect(nodeLinks(el).some((a) => a.textContent?.includes('Mortgage'))).toBe(true)
    const filter = Array.from(el.querySelectorAll<HTMLInputElement>('.map-filter-group input')).find((i) =>
      i.parentElement?.textContent?.includes('Property & debt'),
    )!
    act(() => filter.click())
    expect(nodeLinks(el).some((a) => a.textContent?.includes('Mortgage'))).toBe(false)
    expect(nodeLinks(el).some((a) => a.querySelector('.map-node-label')?.textContent === 'Alex')).toBe(true)
  })

  it('arrow keys move focus between cards', () => {
    const el = renderPage(buildExampleCouple())
    const stage = el.querySelector<HTMLElement>('.household-map-stage')!
    const links = nodeLinks(el)
    const first = links.find((a) => a.dataset.nodeId?.startsWith('person:'))!
    act(() => first.focus())
    act(() => {
      stage.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    })
    const focused = document.activeElement as HTMLElement
    expect(focused.dataset.nodeId).toBeDefined()
    expect(focused).not.toBe(first)
  })

  it('surfaces missing facts and out-of-model relationships honestly', () => {
    const el = renderPage(buildExampleCouple())
    // The example couple's investable accounts carry no estate destination.
    expect(el.textContent).toContain('What needs attention')
    expect(el.textContent).toContain('No estate destination set')
    expect(el.textContent).toContain('Not in the model')
    expect(el.textContent).toContain('Trusts, LLCs, and other entities')
  })

  it('ships a text-list equivalent and Letter-landscape print rules', () => {
    const el = renderPage(buildExampleCouple())
    expect(el.textContent).toContain('Text list of this map')
    expect(el.querySelectorAll('.map-details tbody tr').length).toBeGreaterThan(5)
    const style = el.querySelector('style')!.textContent!
    expect(style).toContain('letter landscape')
    expect(style).toContain('@media print')
  })

  it('completeness badges are symbols with described meaning, not color alone', () => {
    const el = renderPage(buildExampleCouple())
    const flag = el.querySelector('.map-node-flag')!
    expect(flag.textContent).toBe('!')
    expect(flag.getAttribute('title')).toContain('needs attention')
  })
})
