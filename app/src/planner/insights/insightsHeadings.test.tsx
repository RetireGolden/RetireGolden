/** @vitest-environment jsdom */
/**
 * Step 5 (UI/UX round 2): Insights heading structure must not skip levels — the
 * category header is now a real heading and card titles sit under it, so a
 * screen reader gets a coherent h1 → h2 → h3 outline (the round-1 critique found
 * <h4> cards under a page with no h2/h3 ancestor).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'

import type { Plan } from '@retiregolden/engine/model/plan'
import { PlanCtx, type PlanContextValue } from '../planContextCore'
import { createSamplePlan } from '../../testSupport/samplePlan'
import { InsightsPage } from './InsightsPage'

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
  vi.restoreAllMocks()
})

function contextFor(plan: Plan): PlanContextValue {
  return { plan, update: () => {}, discardPendingSave: () => {}, saveState: 'saved', issues: [] }
}

describe('Insights heading order', () => {
  it('never skips a heading level', async () => {
    await act(async () => {
      root.render(
        <MemoryRouter>
          <PlanCtx.Provider value={contextFor(createSamplePlan())}>
            {/* PlanWorkspace provides the page's single sr-only h1 in the app;
                mirror it here so the heading-order assertion matches reality. */}
            <h1 className="sr-only">Insights — Example couple</h1>
            <InsightsPage />
          </PlanCtx.Provider>
        </MemoryRouter>,
      )
    })

    const headings = Array.from(container.querySelectorAll('h1, h2, h3, h4, h5, h6'))
    const levels = headings.map((h) => Number(h.tagName[1]))
    expect(levels.length).toBeGreaterThan(0)
    // Exactly one document title.
    expect(levels.filter((l) => l === 1)).toHaveLength(1)
    // No card heading is deeper than h3, and no step is skipped top-to-bottom.
    for (let i = 1; i < levels.length; i++) {
      expect(levels[i]! - levels[i - 1]!, `heading skip at index ${i}: ${levels.join(',')}`).toBeLessThanOrEqual(1)
    }
    // The category header is a real heading containing the toggle button.
    const categoryHeading = container.querySelector('h2.insight-category-heading button')
    expect(categoryHeading).not.toBeNull()
  })
})
