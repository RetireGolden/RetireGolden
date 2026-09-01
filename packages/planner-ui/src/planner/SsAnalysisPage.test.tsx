/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router'

import type { Plan } from '@retiregolden/engine/model/plan'
import { createSamplePlan } from '../testSupport/samplePlan'
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

    const buttons = Array.from(container.querySelectorAll<HTMLButtonElement>('.heatmap-cell-button'))
    expect(buttons.length).toBeGreaterThan(0)

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
        [plan.household.people[0]!.id]: alexAge,
        [plan.household.people[1]!.id]: samAge,
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

    const buttons = Array.from(container.querySelectorAll<HTMLButtonElement>('.heatmap-cell-button'))
    expect(buttons.length).toBeGreaterThan(0)
    expect(buttons.every((button) => button.disabled)).toBe(true)
    expect(buttons.some((button) => button.getAttribute('aria-current') === 'true')).toBe(true)
    expect(container.textContent).toContain('claim-age choices are read-only in this workspace.')
  })
})
