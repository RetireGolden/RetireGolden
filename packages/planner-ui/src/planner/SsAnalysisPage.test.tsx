/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router'

import type { Plan } from '@retiregolden/engine/model/plan'
import { createSamplePlan } from '../testSupport/samplePlan'
import { SsAnalysisPage } from './SsAnalysisPage'
import { PlanCtx, type PlanContextValue } from './planContextCore'

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

function contextFor(plan: Plan, update: PlanContextValue['update']): PlanContextValue {
  return { plan, update, discardPendingSave: () => {}, saveState: 'saved', issues: [] }
}

describe('SsAnalysisPage claim-age heatmap', () => {
  it('focuses native cell buttons and applies a choice with Enter or Space', async () => {
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

    for (const key of ['Enter', ' ']) {
      const button = buttons[updates.length]!
      expect(button.type).toBe('button')
      expect(button.getAttribute('aria-label')).toMatch(/Apply claim ages: Alex at \d+, Sam at \d+; after-tax estate \$/)
      button.focus()
      expect(document.activeElement).toBe(button)

      // JSDOM does not perform the browser's native keyboard-to-click default
      // action, so invoke that default after proving the focused native target.
      await act(async () => {
        button.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
        button.click()
      })
    }

    expect(updates).toHaveLength(2)
    await act(async () => root.unmount())
    container.remove()
  })
})
