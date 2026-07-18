/** @vitest-environment jsdom */
/**
 * Household map page: renders the topology from plan data with deep links,
 * the privacy toggle strips every dollar figure from the DOM, filters and
 * arrow-key navigation work, and the print/at-a-glance affordances ship —
 * including that printing from inside the real workspace chrome never leaks
 * the KPI bar's dollar values.
 */
import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { IDBFactory } from 'fake-indexeddb'

import type { Plan } from '@retiregolden/engine/model/plan'
import { _resetPlanStoreForTests, savePlan } from '../data/planStore'
import { PlanCtx } from '../planner/planContextCore'
import { PlanWorkspace } from '../planner/PlanWorkspace'
import { buildExampleCouple } from '../planner/examples/buildExampleCouple'
import { HouseholdMapPage } from './HouseholdMapPage'

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory()
  _resetPlanStoreForTests()
  localStorage.clear()
})

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
    // The label now states the next action (no aria-pressed — a flipped label
    // plus a pressed state reads contradictory in screen readers).
    expect(toggle.textContent).toBe('Show amounts')
    expect(toggle.hasAttribute('aria-pressed')).toBe(false)
    // No dollar strings anywhere on the page — cards, totals, or text list.
    expect(el.textContent).not.toContain('$')
    expect(el.textContent).toContain('Amounts hidden')
  })

  it('hidden-amount placeholders appear only where a real amount is concealed', () => {
    const el = renderPage(buildExampleCouple())
    const toggle = Array.from(el.querySelectorAll('button')).find((b) => b.textContent === 'Hide amounts')!
    act(() => toggle.click())
    const cardText = (label: string) =>
      nodeLinks(el)
        .find((a) => a.querySelector('.map-node-label')?.textContent === label)!
        .textContent!
    expect(cardText('Joint brokerage')).toContain('•••')
    // A person never had an amount — no placeholder, no "hidden" cell.
    expect(cardText('Alex')).not.toContain('•••')
    const alexRow = Array.from(el.querySelectorAll('.map-details tbody tr')).find(
      (tr) => tr.querySelector('th a')?.textContent === 'Alex',
    )!
    expect(alexRow.textContent).not.toContain('hidden')
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

  it('ships a text-list equivalent with relationships, and Letter-landscape print rules', () => {
    const el = renderPage(buildExampleCouple())
    expect(el.textContent).toContain('Text list of this map')
    expect(el.querySelectorAll('.map-details tbody tr').length).toBeGreaterThan(5)
    // Topology is in the accessible list, not only the aria-hidden SVG.
    const headers = Array.from(el.querySelectorAll('.map-details thead th')).map((th) => th.textContent)
    expect(headers).toContain('Connected to')
    const brokerageRow = Array.from(el.querySelectorAll('.map-details tbody tr')).find(
      (tr) => tr.querySelector('th a')?.textContent === 'Joint brokerage',
    )!
    expect(brokerageRow.textContent).toContain('Owned by Alex (joint)')
    expect(brokerageRow.textContent).toContain('Owned by Sam (joint)')
    const style = el.querySelector('style')!.textContent!
    expect(style).toContain('letter landscape')
    expect(style).toContain('@media print')
  })

  it('joint annotations render on the diagram edges', () => {
    const el = renderPage(buildExampleCouple())
    const labels = Array.from(el.querySelectorAll('.map-edge-label')).map((t) => t.textContent)
    expect(labels).toContain('joint')
  })

  it('print scale is computed from the actual canvas size, not hard-coded', () => {
    const el = renderPage(buildExampleCouple())
    const canvas = el.querySelector<HTMLElement>('.household-map-canvas')!
    const width = Number.parseFloat(canvas.style.width)
    const height = Number.parseFloat(canvas.style.height)
    const expected = Math.min(1, (10 * 96) / width, (6 * 96) / height)
    const style = el.querySelector('style')!.textContent!
    const zoom = Number(style.match(/zoom: ([\d.]+)/)?.[1])
    expect(zoom).toBeCloseTo(expected, 5)
    expect(zoom).toBeLessThanOrEqual(1)
    // The on-screen explainer is condensed away in print, so the height
    // reserve stays honest about what actually prints above the canvas.
    expect(style).toMatch(/\.household-map-page \.card-hint[\s\S]*?display: none !important;/)
  })

  it('a worst-case tall map still scales to fit one Letter landscape page', () => {
    const plan = buildExampleCouple()
    // Force a 12-row accounts column — taller than the printable area.
    for (let i = 0; i < 12; i++) {
      plan.accounts.push({
        type: 'cash',
        id: `tall-${i}`,
        name: `Extra savings ${i}`,
        ownerPersonId: null,
        annualReturnPct: 1,
        balance: 1_000,
        annualContribution: 0,
      })
    }
    const el = renderPage(plan)
    const canvas = el.querySelector<HTMLElement>('.household-map-canvas')!
    const width = Number.parseFloat(canvas.style.width)
    const height = Number.parseFloat(canvas.style.height)
    expect(height).toBeGreaterThan(6 * 96)
    const zoom = Number(el.querySelector('style')!.textContent!.match(/zoom: ([\d.]+)/)?.[1])
    // Scaled dimensions fit the printable area on both axes.
    expect(zoom * height).toBeLessThanOrEqual(6 * 96 + 0.5)
    expect(zoom * width).toBeLessThanOrEqual(10 * 96 + 0.5)
  })

  it('arrow-key navigation survives hostile entity ids (quotes in plan ids)', () => {
    const plan = buildExampleCouple()
    const hostile: (typeof plan.accounts)[number] = {
      type: 'cash',
      id: 'we"ird\\id',
      name: 'Oddly named cash',
      ownerPersonId: null,
      annualReturnPct: 1,
      balance: 1_000,
      annualContribution: 0,
    }
    plan.accounts = [hostile]
    plan.incomes = []
    plan.insurance = []
    plan.careEvents = []
    plan.incomeFloor = undefined
    const el = renderPage(plan)
    const stage = el.querySelector<HTMLElement>('.household-map-stage')!
    const account = nodeLinks(el).find((a) => a.dataset.nodeId === 'acct:we"ird\\id')!
    const person = nodeLinks(el).find((a) => a.dataset.nodeId?.startsWith('person:'))!
    act(() => person.focus())
    act(() => {
      // Right from the person column lands on the hostile-id account card —
      // the selector must escape the quote/backslash instead of throwing.
      stage.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    })
    expect(document.activeElement).toBe(account)
  })

  it('property notes (HECM line of credit) render on the card and text list', () => {
    const plan = buildExampleCouple()
    const home = plan.accounts.find((a) => a.type === 'property')!
    if (home.type === 'property') {
      home.primaryResidence = true
      home.hecm = { openYear: 2031, growthRatePct: 7, drawPolicy: 'coordinated' }
    }
    const el = renderPage(plan)
    const homeCard = nodeLinks(el).find((a) => a.querySelector('.map-node-label')?.textContent === 'Home')!
    expect(homeCard.textContent).toContain('HECM line of credit (opened 2031)')
    const homeRow = Array.from(el.querySelectorAll('.map-details tbody tr')).find(
      (tr) => tr.querySelector('th a')?.textContent === 'Home',
    )!
    expect(homeRow.textContent).toContain('HECM line of credit')
  })

  it('completeness badges are symbols with described meaning, not color alone', () => {
    const el = renderPage(buildExampleCouple())
    const flag = el.querySelector('.map-node-flag')!
    expect(flag.textContent).toBe('!')
    expect(flag.getAttribute('title')).toContain('needs attention')
  })
})

describe('HouseholdMapPage inside the real workspace chrome', () => {
  it('print CSS hides the KPI bar and rail so hidden-amounts printing leaks no dollars', async () => {
    const plan = buildExampleCouple()
    const saved = await savePlan(plan)
    if (!saved.ok) throw new Error('seed save failed')

    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    await act(async () => {
      root!.render(
        <MemoryRouter initialEntries={[`/plan/${plan.id}/household-map`]}>
          <Routes>
            <Route path="/plan/:planId/*" element={<PlanWorkspace />}>
              <Route path="household-map" element={<HouseholdMapPage />} />
            </Route>
          </Routes>
        </MemoryRouter>,
      )
    })
    for (let attempt = 0; attempt < 100 && !container.querySelector('.household-map-stage'); attempt++) {
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10))
      })
    }

    // The workspace KPI bar with real dollar values IS on the page…
    const kpiBar = container.querySelector('.kpi-bar')
    expect(kpiBar).not.toBeNull()
    expect(container.querySelector('.workspace-rail')).not.toBeNull()
    // …and the page's print stylesheet removes it (and the rail) from print,
    // so a hidden-amounts printout is the map alone.
    const style = container.querySelector('.household-map-page style')!.textContent!
    const printBlock = style.slice(style.indexOf('@media print'))
    const hiddenRule = printBlock.match(/([^{}]+)\{[^}]*display: none !important;/)?.[1] ?? ''
    expect(hiddenRule).toContain('.kpi-bar')
    expect(hiddenRule).toContain('.workspace-rail')
    expect(hiddenRule).toContain('.workspace-head')
  })
})
