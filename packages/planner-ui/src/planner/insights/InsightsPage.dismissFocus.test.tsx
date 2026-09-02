/** @vitest-environment jsdom */
/**
 * Insights dismissal (#505): every Dismiss control names its insight, and
 * dismissing moves keyboard focus onto the page (next card, previous card,
 * group heading, or Restore) instead of dropping it to <body>.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router'

import type { Plan } from '@retiregolden/engine/model/plan'
import { PlanCtx, type PlanContextValue } from '../planContextCore'
import { createSamplePlan } from '../../testSupport/samplePlan'
import { InsightsPage } from './InsightsPage'

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  localStorage.clear()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

function contextFor(plan: Plan): PlanContextValue {
  return { plan, update: () => {}, discardPendingSave: () => {}, saveState: 'saved', issues: [] }
}

async function mount(plan: Plan) {
  await act(async () => {
    root.render(
      <MemoryRouter>
        <PlanCtx.Provider value={contextFor(plan)}>
          <InsightsPage />
        </PlanCtx.Provider>
      </MemoryRouter>,
    )
  })
}

const dismissButtons = () =>
  [...container.querySelectorAll<HTMLButtonElement>('button.insight-dismiss')]

describe('Insights dismissal (#505)', () => {
  it('names each Dismiss control after its insight, so no two share a name', async () => {
    await mount(createSamplePlan())
    const buttons = dismissButtons()
    expect(buttons.length, 'the sample plan surfaces dismissable insights').toBeGreaterThan(0)
    const names = buttons.map((b) => b.getAttribute('aria-label'))
    for (const b of buttons) {
      const title = b.closest('.insight-card')!.querySelector('.insight-card-title')!.textContent
      expect(b.getAttribute('aria-label')).toBe(`Dismiss insight: ${title}`)
    }
    expect(new Set(names).size).toBe(names.length)
    expect(names).not.toContain('Dismiss this insight')
  })

  it('keeps focus on the page after every dismissal, never on <body>', async () => {
    await mount(createSamplePlan())
    let remaining = dismissButtons().length
    expect(remaining).toBeGreaterThan(0)
    // Dismiss from the top until the list is empty: focus has to land on the
    // next card in reading order — across a group boundary when the card was
    // the last of its group — and on Restore only once nothing is left.
    let crossedGroup = false
    while (remaining > 0) {
      const first = dismissButtons()[0]!
      const card = first.closest<HTMLElement>('.insight-card')!
      const all = [...container.querySelectorAll<HTMLElement>('.insight-card')]
      const next = all[all.indexOf(card) + 1] ?? null
      if (next && next.closest('.insight-category-group') !== card.closest('.insight-category-group')) crossedGroup = true
      first.focus()
      await act(async () => first.click())
      const active = document.activeElement as HTMLElement
      expect(active, 'focus is not dropped to body').not.toBe(document.body)
      expect(container.contains(active)).toBe(true)
      if (next) {
        expect(active).toBe(next.querySelector('.insight-dismiss'))
      } else {
        expect(active.hasAttribute('data-insight-restore')).toBe(true)
      }
      remaining = dismissButtons().length
    }
    expect(crossedGroup, 'the sample plan has more than one group, so a hand-off across groups was exercised').toBe(true)
    expect(container.textContent).toContain('No opportunities found right now')
    expect(container.querySelector('[data-insight-restore]')).not.toBeNull()
  })
})
