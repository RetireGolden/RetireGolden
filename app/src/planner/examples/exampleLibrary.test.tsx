/** @vitest-environment jsdom */
import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { IDBFactory } from 'fake-indexeddb'

import { _resetPlanStoreForTests, listUserPlanSummaries, loadPlan } from '../../data/planStore'
import { ExamplesPage } from './ExamplesPage'
import { demoPlanId } from './loadExample'
import { EXAMPLE_PLANS } from './registry'

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory()
  _resetPlanStoreForTests()
  localStorage.clear()
})

describe('example library page', () => {
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

  async function renderExamples() {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/examples']}>
          <Routes>
            <Route path="/examples" element={<ExamplesPage />} />
            <Route path="/plan/:planId/*" element={<div data-testid="workspace-opened" />} />
          </Routes>
        </MemoryRouter>,
      )
    })
  }

  it('features three starters on first visit, not the whole wall', async () => {
    await renderExamples()
    expect(container.querySelector('#example-library-heading')?.textContent).toBe('Example library')
    expect(container.querySelector('#example-library-heading')?.tagName).toBe('H1')
    // A confused first-timer faces a handful of choices, not 24.
    expect(container.querySelectorAll('.example-card')).toHaveLength(3)
    expect(container.textContent).toContain('Example couple')
    const browse = Array.from(container.querySelectorAll('button')).find((b) =>
      /Browse all \d+ examples/.test(b.textContent ?? ''),
    )
    expect(browse, 'a Browse-all control should be one interaction away').toBeDefined()
    expect(browse!.getAttribute('aria-expanded')).toBe('false')
  })

  it('reveals all examples one click away and remembers the preference', async () => {
    await renderExamples()
    const browse = Array.from(container.querySelectorAll('button')).find((b) =>
      /Browse all \d+ examples/.test(b.textContent ?? ''),
    )!
    await act(async () => {
      browse.click()
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    for (const example of EXAMPLE_PLANS) {
      expect(container.textContent).toContain(example.title)
    }
    expect(container.querySelectorAll('.example-card')).toHaveLength(EXAMPLE_PLANS.length)
    // The preference persists so a returning visitor keeps the full grid.
    expect(localStorage.getItem('retiregolden.examples.expanded')).toBe('true')

    await act(async () => root.unmount())
    root = createRoot(container)
    await renderExamples()
    expect(container.querySelectorAll('.example-card')).toHaveLength(EXAMPLE_PLANS.length)
  })

  it('opens a demo without adding it to Your plans', async () => {
    await renderExamples()
    const coupleCard = Array.from(container.querySelectorAll('.example-card')).find((card) =>
      card.textContent?.includes('Example couple'),
    )
    const openButton = coupleCard?.querySelector('button.btn-primary')
    expect(openButton?.textContent).toBe('Open')

    await act(async () => {
      ;(openButton as HTMLButtonElement).click()
      await new Promise((resolve) => setTimeout(resolve, 50))
    })

    expect(container.querySelector('[data-testid="workspace-opened"]')).not.toBeNull()
    expect(await listUserPlanSummaries()).toHaveLength(0)

    const demo = await loadPlan(demoPlanId('example-couple'))
    expect(demo.ok).toBe(true)
    if (demo.ok) expect(demo.plan.origin).toBe('example')
  })
})
