/** @vitest-environment jsdom */
/**
 * The survivor page's convert-early lever after B2-P1 slice 5 (owner decision
 * R16): the lever adds a 12% fill to the plan's own conversions, its cell
 * names the year whose dollars it is in, and a lever that adds nothing says
 * why. Rendered DOM through the engine's analysis.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router'

import type { Plan } from '@retiregolden/engine/model/plan'
import { getExampleById } from './examples/registry'
import { demoPlanId } from './examples/loadExample'
import { waitFor } from '../testSupport/settle'
import { SurvivorTransitionPage } from './SurvivorTransitionPage'
import { PlanCtx, type PlanContextValue } from './planContextCore'

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-06-15T12:00:00Z'))
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.useRealTimers()
})

function example(id: string): Plan {
  return { ...getExampleById(id)!.build(), id: demoPlanId(id), origin: 'example', exampleSourceId: id }
}

async function mount(plan: Plan) {
  const value: PlanContextValue = { plan, update: () => {}, discardPendingSave: () => {}, saveState: 'saved', issues: [] }
  await act(async () => {
    root.render(
      <MemoryRouter>
        <PlanCtx.Provider value={value}>
          <SurvivorTransitionPage />
        </PlanCtx.Provider>
      </MemoryRouter>,
    )
  })
  await waitFor(() => container.querySelector('.skeleton') === null, {
    what: 'the death-timing sweep',
    attempts: 1500,
    intervalMs: 20,
    describe: () => container.textContent ?? '',
  })
}

const text = (): string => (container.textContent ?? '').replace(/\s+/gu, ' ')

describe('the convert-early lever', () => {
  it('says, year by year, why it adds nothing, with the ledger’s own words for a skipped conversion, and names its dollars', async () => {
    await mount(example('example-couple'))
    const page = text()
    const windows = [...container.querySelectorAll('[data-lever-window]')].map((cell) => (cell.textContent ?? '').replace(/\s+/gu, ' '))
    // Alex dies at 90 (2052): no room while both work, the plan's own conversions reach the fill through 2032, Sam's
    // share is skipped from 2033 (Sam has no Roth account), and the IRA is empty from 2042 (the review's M1).
    expect(windows).toContain(
      'no added conversions; no room left in the 12% bracket in 2026 and 2027; your plan already converts at or past the top of the 12% bracket in 2028 to 2032; ' +
        'the ledger converted less than the fill asked in 2033 to 2041; no pre-tax balance it can convert in 2042 to 2052',
    )
    const notes = [...container.querySelectorAll('[data-lever-notes]')].map((cell) => (cell.textContent ?? '').replace(/\s+/gu, ' '))
    expect(notes.length).toBe(windows.length)
    expect(new Set(notes)).toEqual(
      new Set(['The ledger: Sam has no Roth account, so Sam’s share of the Roth conversion was skipped — a conversion has to land in the same person’s own Roth. Opening a Roth IRA for Sam would let that share convert.']),
    )
    expect(page).not.toContain('already converts past the 12% bracket in these years')
    expect(page).toMatch(/adding a 12% bracket fill through \d{4}, in \d{4} dollars/u)
    expect(page).toContain('on top of any your plan already makes')
    expect(page).not.toContain('filling the 12% bracket through')
    expect(page).toContain('required spending covered')
  }, 120_000)

  it('adds to the plan\'s conversions where the fill is larger: annuity-purchases-estate gains +$135k', async () => {
    await mount(example('annuity-purchases-estate'))
    const cells = [...container.querySelectorAll('td span.delta-pos')].map((s) => s.textContent)
    expect(cells).toContain('+$135k')
    expect(cells).toContain('+$105k')
    expect(text()).not.toContain('no added conversions')
    const windows = [...container.querySelectorAll('[data-lever-window]')].map((cell) => (cell.textContent ?? '').replace(/\s+/gu, ' '))
    expect(windows).toContain(
      'adds conversions in 2026; your plan already converts at or past the top of the 12% bracket in 2027 and 2028; no pre-tax balance it can convert in 2029 to 2031',
    )
  }, 120_000)
})
