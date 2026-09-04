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
      const first = dismissButtons()[0]
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

  it('hands off to a collapsed neighbour group\'s heading toggle, not to Restore', async () => {
    await mount(createSamplePlan())
    const groups = [...container.querySelectorAll<HTMLElement>('.insight-category-group')]
    expect(groups.length, 'the sample plan surfaces more than one group').toBeGreaterThan(1)
    // Collapse every group but the first: their cards unmount.
    for (const group of groups.slice(1)) {
      const toggle = group.querySelector<HTMLButtonElement>('.insight-category-header')!
      await act(async () => toggle.click())
      expect(toggle.getAttribute('aria-expanded')).toBe('false')
      expect(group.querySelector('.insight-card')).toBeNull()
    }
    // Dismiss the first group's cards until it is gone; the last dismissal
    // has a next card in reading order, but it lives in a collapsed group.
    let first = groups[0]
    while (first.querySelector('.insight-card')) {
      const button = first.querySelector<HTMLButtonElement>('.insight-dismiss')!
      const lastInGroup = first.querySelectorAll('.insight-card').length === 1
      button.focus()
      await act(async () => button.click())
      const active = document.activeElement as HTMLElement
      expect(container.contains(active)).toBe(true)
      if (lastInGroup) {
        // The neighbour is unmounted, so its group's heading takes focus —
        // near where the reader was, and one Enter away from the cards.
        expect(active.classList.contains('insight-category-header')).toBe(true)
        expect(active.closest('.insight-category-group')).toBe(groups[1])
        expect(active.hasAttribute('data-insight-restore')).toBe(false)
      }
      first = container.querySelector<HTMLElement>('.insight-category-group')!
      if (first === groups[1]) break
    }
    // Other insights remain; Restore was never the fallback here.
    expect(container.querySelectorAll('.insight-category-group').length).toBeGreaterThan(0)
  })
})
