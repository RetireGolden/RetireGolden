/** @vitest-environment jsdom */
import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router'
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
      /Show all \d+ examples/.test(b.textContent ?? ''),
    )
    expect(browse, 'a Show-all control should be one interaction away').toBeDefined()
    expect(browse!.getAttribute('aria-expanded')).toBe('false')
    // Collapsed, the controlled region is still in the DOM (hidden, no cards
    // mounted), so aria-controls always resolves (#519; #445 had dropped it).
    expect(browse!.getAttribute('aria-controls')).toBe('examples-full-grid')
    const region = container.querySelector<HTMLElement>('#examples-full-grid')!
    expect(region).not.toBeNull()
    expect(region.hidden).toBe(true)
    expect(region.querySelectorAll('.example-card')).toHaveLength(0)
  })

  it('renders cards as a labelled list with headings and per-example action names (#478)', async () => {
    await renderExamples()
    const grid = container.querySelector('ul.plan-grid[role="list"][aria-labelledby="examples-featured-heading"]')!
    expect(grid).not.toBeNull()
    expect(container.querySelector('#examples-featured-heading')?.textContent).toBe('Featured examples')
    const cards = [...grid.querySelectorAll(':scope > li.example-card')]
    expect(cards).toHaveLength(3)
    // Under the page h1 and the group h2, a card title is an h3 (#519).
    const titles = cards.map((c) => c.querySelector('h3.plan-card-name')?.textContent)
    expect(titles.every(Boolean)).toBe(true)
    // Every action names its example, so no two cards share an accessible name,
    // and the visible label stays a contiguous prefix of that name (Label in Name).
    const names = actionNames(cards)
    expect(new Set(names).size).toBe(names.length)
    expect(names).toContain(`Open ${titles[0]}`)
    expect(names).toContain(`Save to my plans: ${titles[0]}`)
    expect(names).toContain(`Learn about this example: ${titles[0]}`)
    // Expanding announces the change to assistive tech.
    const status = container.querySelector('[role="status"][aria-live="polite"]')!
    expect(status.textContent).toBe('Showing 3 featured examples.')
    const browse = Array.from(container.querySelectorAll('button')).find((b) =>
      /Show all \d+ examples/.test(b.textContent ?? ''),
    )!
    await act(async () => {
      browse.click()
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    expect(status.textContent).toMatch(/^Showing all \d+ examples\.$/)
    expect(container.querySelector('#examples-full-grid ul[role="list"][aria-labelledby="examples-rest-heading"]')).not.toBeNull()
    expect(container.querySelector('#examples-rest-heading')?.textContent).toBe('All other examples')
    // Uniqueness holds across the whole expanded library, not just the three starters.
    const allNames = actionNames([...container.querySelectorAll('.example-card')])
    expect(allNames).toHaveLength(EXAMPLE_PLANS.length * 3)
    expect(new Set(allNames).size).toBe(allNames.length)
  })

  it('keeps the toggle after the rows it controls and keeps focus on it across a collapse (#445)', async () => {
    await renderExamples()
    const browse = Array.from(container.querySelectorAll('button')).find((b) =>
      /Show all \d+ examples/.test(b.textContent ?? ''),
    )!
    await act(async () => {
      browse.click()
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    const grid = container.querySelector('#examples-full-grid')!
    expect(grid).not.toBeNull()
    expect(browse.getAttribute('aria-controls')).toBe('examples-full-grid')
    // The control follows the grid it expands, never sits between the two grids.
    expect(grid.compareDocumentPosition(browse) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(browse.textContent).toBe('Show fewer examples')
    browse.focus()
    await act(async () => {
      browse.click()
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    // The region stays (hidden) so aria-controls keeps a valid target (#519).
    const collapsed = container.querySelector<HTMLElement>('#examples-full-grid')!
    expect(collapsed.hidden).toBe(true)
    expect(collapsed.querySelector('.example-card')).toBeNull()
    expect(document.activeElement).toBe(browse)
    expect(browse.getAttribute('aria-controls')).toBe('examples-full-grid')
  })

  it('keeps one outline: h1 section, h2 groups, h3 cards, and no skipped level (#519)', async () => {
    await renderExamples()
    const browse = Array.from(container.querySelectorAll('button')).find((b) =>
      /Show all \d+ examples/.test(b.textContent ?? ''),
    )!
    await act(async () => {
      browse.click()
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    const levels = [...container.querySelectorAll('h1, h2, h3, h4, h5, h6')].map((h) => Number(h.tagName[1]))
    expect(levels.filter((l) => l === 1)).toHaveLength(1)
    expect(levels.filter((l) => l === 2)).toHaveLength(2)
    expect(levels.filter((l) => l === 3)).toHaveLength(EXAMPLE_PLANS.length)
    for (let i = 1; i < levels.length; i++) {
      expect(levels[i]! - levels[i - 1]!, `heading skip at ${i}: ${levels.join(',')}`).toBeLessThanOrEqual(1)
    }
  })

  it('reveals all examples one click away and remembers the preference', async () => {
    await renderExamples()
    const browse = Array.from(container.querySelectorAll('button')).find((b) =>
      /Show all \d+ examples/.test(b.textContent ?? ''),
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

  it('Learn about this example keeps a word-space before the arrow on every card (#329)', async () => {
    await renderExamples()
    const featured = container.querySelectorAll('.example-card a.learn-link')
    expect(featured.length).toBe(3)
    for (const link of featured) {
      expectLearnArrowSharesLabelBox(link)
    }

    const browse = Array.from(container.querySelectorAll('button')).find((b) =>
      /Show all \d+ examples/.test(b.textContent ?? ''),
    )!
    await act(async () => {
      browse.click()
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    const all = container.querySelectorAll('.example-card a.learn-link')
    expect(all.length).toBe(EXAMPLE_PLANS.length)
    for (const card of container.querySelectorAll('.example-card')) {
      const actions = card.querySelector('.plan-card-actions')
      expect(actions?.querySelector('button.btn-primary')?.textContent).toBe('Open')
      expect(actions?.querySelector('button.btn-secondary')?.textContent).toBe('Save to my plans')
      const learn = actions?.querySelector('a.learn-link')
      expect(learn, 'each card has a Learn control').not.toBeNull()
      expectLearnArrowSharesLabelBox(learn!)
    }
  })
})

/**
 * The accessible names of a card's actions. Asserts along the way that each
 * name starts with the control's visible text (minus the decorative arrow),
 * which is what lets a speech-input user activate it by reading the label.
 */
function actionNames(cards: Element[]): string[] {
  return cards.flatMap((card) =>
    [...card.querySelectorAll('button, a')].map((el) => {
      const name = el.getAttribute('aria-label')
      const clone = el.cloneNode(true) as Element
      for (const hidden of clone.querySelectorAll('[aria-hidden="true"]')) hidden.remove()
      const visible = clone.textContent.trim()
      expect(name, `${visible} has an accessible name`).toBeTruthy()
      expect(name!.startsWith(visible), `"${name}" starts with its visible label "${visible}"`).toBe(true)
      return name!
    }),
  )
}

/** Label + ` →` must share one inline box so `.btn` flex cannot collapse the space. */
function expectLearnArrowSharesLabelBox(link: Element) {
  expect(link.textContent).toBe('Learn about this example →')
  const arrow = link.querySelector('span[aria-hidden="true"]')
  expect(arrow?.textContent).toBe(' →')
  expect(arrow?.parentElement).not.toBe(link)
  expect(arrow?.parentElement?.textContent).toBe('Learn about this example →')
}
