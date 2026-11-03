/** @vitest-environment jsdom */
/**
 * Design-QA cluster K, rendered half (#767, #777, #778). The Example couple
 * plan is the one the Design QA walks used, so these mount it.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router'

import type { Plan } from '@retiregolden/engine/model/plan'
import { settle, waitFor } from '../testSupport/settle'
import { HouseholdMapPage } from '../householdMap/HouseholdMapPage'
import { buildExampleCouple } from './examples/buildExampleCouple'
import { ExamplesPage } from './examples/ExamplesPage'
import { PlanCtx, type PlanContextValue } from './planContextCore'
import { startYearDollarsWord } from './useProjection'
import { StrategySection } from './sections/StrategySection'

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

async function mountWithPlan(plan: Plan, node: React.ReactNode) {
  const value: PlanContextValue = { plan, update: () => {}, discardPendingSave: () => {}, saveState: 'saved', issues: [] }
  await act(async () => {
    root.render(
      <MemoryRouter>
        <PlanCtx.Provider value={value}>{node}</PlanCtx.Provider>
      </MemoryRouter>,
    )
  })
  await settle()
}

function iraRowTitles(): string[] {
  return [...container.querySelectorAll('[data-eligibility-ira] > .item-row-head > .item-row-title')].map((el) =>
    (el.textContent ?? '').replace(el.querySelector('.type-chip')?.textContent ?? '', '').trim(),
  )
}

describe('Strategy copy (#777)', () => {
  it('the IRA facts row is titled with the account name, not its id', async () => {
    const plan = buildExampleCouple()
    await mountWithPlan(plan, <StrategySection />)
    await waitFor(() => iraRowTitles().length > 0, { what: 'the lazy IRA facts rows' })
    const sam = plan.accounts.find((a) => a.name === 'Sam IRA')!
    expect(iraRowTitles()).toContain('Sam IRA')
    expect(container.textContent).not.toContain(sam.id)
    expect(container.textContent).not.toContain('(ID ')
  })

  it('suffixes only IRAs whose names collide, never with the id', async () => {
    const plan = buildExampleCouple()
    const sam = plan.accounts.find((a) => a.name === 'Sam IRA')!
    plan.accounts.push({ ...sam, id: `${sam.id}-second` })
    await mountWithPlan(plan, <StrategySection />)
    await waitFor(() => iraRowTitles().length > 1, { what: 'both IRA facts rows' })
    expect(iraRowTitles().filter((t) => t.startsWith('Sam IRA')).sort()).toEqual(['Sam IRA (1 of 2)', 'Sam IRA (2 of 2)'])
    expect(container.textContent).not.toContain('(ID ')
  })

  it('the itemized-deductions hint has a space before the year', async () => {
    const plan = buildExampleCouple()
    await mountWithPlan(plan, <StrategySection />)
    const card = [...container.querySelectorAll('.card')].find((c) => c.querySelector('h2')?.textContent === 'Itemized deductions')!
    const hint = card.querySelector('p.card-hint')!
    // "2026 dollars" or "today's dollars", depending on the clock; never "Enter2026".
    expect((hint.textContent ?? '').endsWith(`Enter ${startYearDollarsWord(plan)} dollars.`)).toBe(true)
    expect(hint.textContent).not.toMatch(/Enter\S/)
  })
})

describe('Household map text list (#778)', () => {
  it('the table sits in a named scroll region inside the disclosure, with a measured Connected to column', async () => {
    await mountWithPlan(buildExampleCouple(), <HouseholdMapPage />)
    await waitFor(() => container.querySelector('.map-details') !== null, { what: 'the map disclosure' })
    const region = container.querySelector('.map-details > [role="region"]')!
    expect(region).not.toBeNull()
    expect(region.getAttribute('aria-label')).toBe('Text list of this map')
    expect(region.className).toContain('year-table-wrap')
    expect(region.className).toContain('year-table-wrap--grow')
    const table = region.querySelector(':scope > table.map-details-table')!
    expect(table).not.toBeNull()
    const headers = [...table.querySelectorAll('thead th')]
    expect(headers.map((th) => th.className)).toEqual([
      'map-details-item',
      '',
      '',
      'map-details-relations',
      'map-details-status',
    ])
  })
})

describe('Back links (#767)', () => {
  it("Examples' back link is the shared page-back style", async () => {
    await act(async () => {
      root.render(
        <MemoryRouter>
          <ExamplesPage />
        </MemoryRouter>,
      )
    })
    await settle()
    const back = container.querySelector('.examples-back a')!
    expect(back.className).toBe('page-back')
    expect(back.textContent).toBe('← Your plans')
  })
})
