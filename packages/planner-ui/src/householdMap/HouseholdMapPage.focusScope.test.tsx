/** @vitest-environment jsdom */
/**
 * Household map scoping (#506): Focus on a person, or hiding a group, scopes
 * the whole view — the "As entered" totals and the What-needs-attention list
 * describe the items shown, and say so — not only the diagram.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router'

import type { Plan } from '@retiregolden/engine/model/plan'
import { PlanCtx } from '../planner/planContextCore'
import { PrivacyProvider } from '../planner/privacyContext'
import { buildExampleCouple } from '../planner/examples/buildExampleCouple'
import { buildHouseholdGraph, sumEnteredTotals } from './householdGraph'
import { buildMapViewModel } from './mapViewModel'
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
          <PrivacyProvider>
            <Routes>
              <Route path="/plan/:planId">
                <Route path="household-map" element={<HouseholdMapPage />} />
              </Route>
            </Routes>
          </PrivacyProvider>
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

const nodeLabels = (el: HTMLElement) =>
  Array.from(el.querySelectorAll('.map-node .map-node-label')).map((n) => n.textContent)
const attentionLabels = (el: HTMLElement) =>
  Array.from(el.querySelectorAll('.map-attention-list li a')).map((a) => a.textContent)
const totalsText = (el: HTMLElement) => el.querySelector('.map-totals')!.textContent!

function selectFocus(el: HTMLElement, value: string) {
  const select = Array.from(el.querySelectorAll('label.map-control'))
    .find((l) => l.textContent?.includes('Focus on'))!
    .querySelector('select')!
  act(() => {
    select.value = value
    select.dispatchEvent(new Event('change', { bubbles: true }))
  })
}

describe('view model scope', () => {
  it('totals follow the person focus and the flag says the view is scoped', () => {
    const graph = buildHouseholdGraph(buildExampleCouple())
    const whole = buildMapViewModel(graph)
    expect(whole.scope).toBe('household')
    const sam = graph.nodes.find((n) => n.kind === 'person' && n.label === 'Sam')!
    const focused = buildMapViewModel(graph, { focusPersonId: sam.id.replace(/^person:/, '') })
    expect(focused.scope).toBe('shown')
    // The scoped totals are the same reading of stored figures, over the
    // nodes left on the map — never the whole-household number.
    const shownGraphNodes = graph.nodes.filter((n) => focused.nodes.some((v) => v.id === n.id))
    const expected = sumEnteredTotals(shownGraphNodes)
    expect(focused.totals!.assetsText).not.toBe(whole.totals!.assetsText)
    expect(expected.assets).toBeLessThan(graph.totals.assets)
    // Alex's own accounts are out; the joint ones and Sam's stay.
    expect(focused.nodes.map((n) => n.label)).not.toContain('Alex 401(k)')
    expect(focused.nodes.map((n) => n.label)).toContain('Sam IRA')
    expect(focused.nodes.map((n) => n.label)).toContain('Joint brokerage')
  })

  it('the graph totals equal the node-based sum, so both readings agree', () => {
    const graph = buildHouseholdGraph(buildExampleCouple())
    expect(sumEnteredTotals(graph.nodes)).toEqual(graph.totals)
  })
})

describe('HouseholdMapPage scoping (#506)', () => {
  it('Focus on a person scopes the totals line and the attention panel, with copy that says so', () => {
    const plan = buildExampleCouple()
    const el = renderPage(plan)
    const wholeTotals = totalsText(el)
    expect(wholeTotals).toMatch(/^As entered: assets/)
    expect(attentionLabels(el)).toContain('Alex 401(k)')

    const sam = plan.household.people.find((p) => p.name === 'Sam')!
    selectFocus(el, sam.id)

    expect(nodeLabels(el)).not.toContain('Alex 401(k)')
    expect(totalsText(el)).toMatch(/^As entered for Sam: assets/)
    expect(totalsText(el)).not.toBe(wholeTotals)
    // Every attention item is something on the map; Alex's items are gone.
    const shown = new Set(nodeLabels(el))
    const attention = attentionLabels(el)
    expect(attention.length).toBeGreaterThan(0)
    for (const label of attention) expect(shown.has(label), `${label} is on the map`).toBe(true)
    expect(attention).not.toContain('Alex 401(k)')
    expect(el.textContent).toContain('Listed for Sam; clear Focus and the group filters')

    selectFocus(el, '')
    expect(totalsText(el)).toBe(wholeTotals)
    expect(attentionLabels(el)).toContain('Alex 401(k)')
  })

  it('hiding a group scopes the attention panel too', () => {
    const el = renderPage(buildExampleCouple())
    const filter = Array.from(el.querySelectorAll<HTMLInputElement>('.map-filter-group input')).find((i) =>
      i.parentElement?.textContent?.includes('Accounts'),
    )!
    act(() => filter.click())
    expect(nodeLabels(el)).not.toContain('Sam IRA')
    expect(attentionLabels(el)).not.toContain('Sam IRA')
    expect(totalsText(el)).toMatch(/^As entered for the items shown: assets/)
  })
})
