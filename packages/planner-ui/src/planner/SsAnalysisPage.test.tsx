/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router'

import type { Plan } from '@retiregolden/engine/model/plan'
import { createSamplePlan } from '../testSupport/samplePlan'
import { waitFor } from '../testSupport/settle'
import { WorkspaceReadOnlyContext } from '../data/workspaceReadOnly'
import { SsAnalysisPage } from './SsAnalysisPage'
import { PlanCtx, type PlanContextValue } from './planContextCore'

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

function contextFor(plan: Plan, update: PlanContextValue['update']): PlanContextValue {
  return { plan, update, discardPendingSave: () => {}, saveState: 'saved', issues: [] }
}

/** The claim-age sweep is debounced 200 ms off the render path. */
function sweepSettled(host: HTMLElement): Promise<void> {
  return waitFor(() => host.querySelector('.skeleton') === null, {
    what: 'the claim-age sweep',
    attempts: 600,
    intervalMs: 20,
    describe: () => host.textContent ?? '',
  })
}

describe('SsAnalysisPage claim-age heatmap', () => {
  it('exposes focusable native cell buttons that apply their labelled claim ages', async () => {
    const plan = createSamplePlan()
    const updates: Record<string, number>[] = []
    const update: PlanContextValue['update'] = (mutator) => {
      const draft = structuredClone(plan)
      mutator(draft)
      const claimAges = Object.fromEntries(
        draft.incomes
          .filter((income) => income.type === 'socialSecurity')
          .map((income) => [income.personId, income.claimAge.years]),
      )
      updates.push(claimAges)
    }

    await act(async () => {
      root.render(
        <MemoryRouter>
          <PlanCtx.Provider value={contextFor(plan, update)}>
            <SsAnalysisPage />
          </PlanCtx.Provider>
        </MemoryRouter>,
      )
    })
    await sweepSettled(container)

    const buttons = Array.from(container.querySelectorAll<HTMLButtonElement>('.heatmap-cell-button'))
    expect(buttons.length).toBeGreaterThan(0)

    expect(container.querySelector<HTMLAnchorElement>('a[href="#ss-claim-age-heatmap-actions"]')?.textContent).toBe('Skip claim-age choices')

    for (const button of buttons.slice(0, 2)) {
      expect(button.type).toBe('button')
      const label = button.getAttribute('aria-label')
      const matches = label?.match(/Apply claim ages: Alex at (\d+), Sam at (\d+); after-tax estate \$/)
      expect(matches).not.toBeNull()
      button.focus()
      expect(document.activeElement).toBe(button)

      await act(async () => {
        button.click()
      })
      const [alexAge, samAge] = matches!.slice(1).map(Number)
      expect(updates.at(-1)).toMatchObject({
        [plan.household.people[0].id]: alexAge,
        [plan.household.people[1].id]: samAge,
      })
    }

    expect(updates).toHaveLength(2)
  })

  it('keeps read-only claim-age options disabled and identifies the current choice', async () => {
    const plan = createSamplePlan()
    await act(async () => {
      root.render(
        <MemoryRouter>
          <WorkspaceReadOnlyContext.Provider value>
            <PlanCtx.Provider value={contextFor(plan, () => {})}>
              <SsAnalysisPage />
            </PlanCtx.Provider>
          </WorkspaceReadOnlyContext.Provider>
        </MemoryRouter>,
      )
    })
    await sweepSettled(container)

    const buttons = Array.from(container.querySelectorAll<HTMLButtonElement>('.heatmap-cell-button'))
    expect(buttons.length).toBeGreaterThan(0)
    expect(buttons.every((button) => button.disabled)).toBe(true)
    expect(buttons.some((button) => button.getAttribute('aria-current') === 'true')).toBe(true)
    expect(buttons[0].parentElement?.getAttribute('title')).toMatch(/Alex \d+ \/ Sam \d+: \$/)
    expect(container.textContent).toContain('claim-age choices are read-only in this workspace.')
  })
})

describe('the claim-age sweep is not run in the render path', () => {
  it('shows a skeleton first, then the swept results', async () => {
    const plan = createSamplePlan()
    await act(async () => {
      root.render(
        <MemoryRouter>
          <PlanCtx.Provider value={contextFor(plan, () => {})}>
            <SsAnalysisPage />
          </PlanCtx.Provider>
        </MemoryRouter>,
      )
    })

    // Before the debounce fires there is a labelled skeleton and no sweep
    // output: 81 full ledger simulations used to run synchronously here.
    const skeleton = container.querySelector('.skeleton')
    expect(skeleton).not.toBeNull()
    expect(skeleton!.getAttribute('aria-label')).toBe('Comparing claim ages')
    expect(container.querySelectorAll('.heatmap-cell-button')).toHaveLength(0)

    // The ranking control stays usable while the sweep is pending, so the
    // skeleton never takes the page away.
    expect(container.textContent).toContain('Rank claim ages by')

    await sweepSettled(container)
    expect(container.querySelectorAll('.heatmap-cell-button').length).toBeGreaterThan(0)
    expect(container.querySelector('.skeleton')).toBeNull()
  })
})

describe('flat objective (#454)', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  it('shows a note and no Best, Apply, or best-strategy chrome when every claim age scores the same', async () => {
    const plan = createSamplePlan()
    plan.accounts = []
    await act(async () => {
      root.render(
        <MemoryRouter>
          <WorkspaceReadOnlyContext.Provider value={false}>
            <PlanCtx.Provider value={contextFor(plan, () => undefined)}>
              <SsAnalysisPage />
            </PlanCtx.Provider>
          </WorkspaceReadOnlyContext.Provider>
        </MemoryRouter>,
      )
    })
    await sweepSettled(container)
    const note = container.querySelector('.callout--note[role="note"]')
    expect(note?.textContent).toMatch(/No best claim age to recommend|No claim age meets this ranking/)
    expect(container.textContent).not.toMatch(/Best by /)
    const applies = [...container.querySelectorAll('button')].filter((b) => /^Apply /.test(b.textContent ?? ''))
    expect(applies).toHaveLength(0)
    expect(container.querySelector('[aria-label*="best strategy"]')).toBeNull()
    expect(container.querySelector('.claim-row--best')).toBeNull()
  })
})

