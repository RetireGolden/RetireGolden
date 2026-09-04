/** @vitest-environment jsdom */
import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router'
import { IDBFactory } from 'fake-indexeddb'

import { _resetPlanStoreForTests, listUserPlanSummaries, savePlan } from '../../data/planStore'
import { createEmptyPlan } from '@retiregolden/engine/model/plan'
import {
  _resetRefreshHistoryForTests,
  listRefreshManualMappings,
  listRefreshSnapshots,
  saveRefreshManualMapping,
  saveRefreshSnapshot,
} from '../../import/refreshHistory'
import { getArticle } from '../../learn/learningRegistry'
import { isPlanIncomplete } from '../planCompleteness'
import { PlanStoreProvider } from '../../data/PlanStoreProvider'
import type { PlanStore } from '../../data/planStoreContext'
import { ImportAvailabilityProvider } from '../../import/ImportAvailabilityProvider'
import { PlanPickerPage } from '../PlanPickerPage'
import { PlanWorkspace } from '../PlanWorkspace'
import { START_HERE_SLUGS } from './startHereSlugs'
import {
  deriveHomeMode,
  isWelcomeExpanded,
  WELCOME_DISMISSED_KEY,
  type HomeMode,
} from './useHomeMode'

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory()
  _resetPlanStoreForTests()
  _resetRefreshHistoryForTests()
  localStorage.clear()
})

describe('useHomeMode derivation', () => {
  it('treats empty plans as first-run regardless of welcome flag', () => {
    expect(deriveHomeMode([])).toBe('first-run')
    expect(deriveHomeMode(null)).toBe('returning')
    expect(isWelcomeExpanded('first-run', true)).toBe(true)
  })

  it('treats saved plans as returning with welcome collapsed by default', () => {
    const plans = [{ id: 'a', name: 'Mine', updatedAtIso: '2026-01-01T00:00:00.000Z', origin: 'user' as const }]
    expect(deriveHomeMode(plans)).toBe('returning')
    expect(isWelcomeExpanded('returning', true)).toBe(false)
  })

  it('expands welcome for returning users when the flag is false', () => {
    expect(isWelcomeExpanded('returning', false)).toBe(true)
  })
})

describe('start-here slugs', () => {
  it('every curated slug resolves to a readable article', () => {
    for (const slug of START_HERE_SLUGS) {
      expect(getArticle(slug), slug).toBeDefined()
    }
  })
})

describe('planner home adaptive layout', () => {
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

  async function renderHome(initialPath = '/', importEnabled = true) {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={[initialPath]}>
          <ImportAvailabilityProvider enabled={importEnabled}>
            <Routes>
              <Route path="/" element={<PlanPickerPage />} />
              <Route path="/examples" element={<div data-testid="examples-page">Examples</div>} />
              <Route path="/plan/:planId/*" element={<PlanWorkspace />} />
            </Routes>
          </ImportAvailabilityProvider>
        </MemoryRouter>,
      )
    })
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50))
    })
  }

  it('shows the welcome hero and path cards when there are no saved plans', async () => {
    await renderHome()
    expect(container.querySelector('.home-hero h1')?.textContent).toContain('Plan your retirement')
    expect(container.querySelectorAll('.home-path-card')).toHaveLength(4)
    expect(container.querySelector('.home-paths-grid')).not.toBeNull()
    expect(container.querySelector('.home-start-here')).not.toBeNull()
    expect(container.querySelectorAll('h1')).toHaveLength(1)
    expect(container.querySelector('.home-getting-started-reopener')).toBeNull()
    expect(container.querySelector('#example-library-heading')).toBeNull()
  })

  it('hides only the import path when the host disables imports', async () => {
    await renderHome('/', false)
    expect(container.querySelectorAll('.home-path-card')).toHaveLength(3)
    expect(container.textContent).not.toContain('Import from a file')
    expect(container.textContent).toContain('Build your own plan')
  })

  it('does not write document.title — hosts mounting plannerHomeRoutes own the tab', async () => {
    document.title = 'Host chrome title'
    await renderHome()
    expect(document.title).toBe('Host chrome title')
  })

  it('names why Download plan backup is disabled on first-run', async () => {
    await renderHome()
    const exportBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'Download plan backup',
    ) as HTMLButtonElement
    expect(exportBtn.disabled).toBe(true)
    expect(container.querySelector('#home-export-why')?.textContent).toMatch(/No plan to export yet/)
    expect(exportBtn.getAttribute('aria-describedby')).toBe('home-export-why')
  })

  it('does not claim there is no plan to export while the library is still loading', async () => {
    const hangingStore: PlanStore = {
      listPlans: () => new Promise(() => {}),
      loadPlan: async () => null,
      savePlan: async () => undefined,
      deletePlan: async () => undefined,
    }
    await act(async () => {
      root.render(
        <MemoryRouter>
          <PlanStoreProvider store={hangingStore}>
            <PlanPickerPage />
          </PlanStoreProvider>
        </MemoryRouter>,
      )
    })
    expect(container.querySelector('[aria-label="Loading plans"]')).not.toBeNull()
    const exportBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'Download plan backup',
    ) as HTMLButtonElement
    expect(exportBtn.disabled).toBe(true)
    expect(exportBtn.getAttribute('aria-describedby')).toBeNull()
    expect(container.querySelector('#home-export-why')).toBeNull()
  })

  it('does not read a failed list as a first-run empty library', async () => {
    const refusingStore: PlanStore = {
      listPlans: () => Promise.reject(new Error('storage refused')),
      loadPlan: async () => null,
      savePlan: async () => undefined,
      deletePlan: async () => undefined,
    }
    await act(async () => {
      root.render(
        <MemoryRouter>
          <PlanStoreProvider store={refusingStore}>
            <PlanPickerPage />
          </PlanStoreProvider>
        </MemoryRouter>,
      )
    })

    // The newcomer welcome over someone's plans is the wrong reading, and a
    // disabled backup with "No plan to export yet" is a false statement.
    expect(container.querySelector('.home-hero h1')).toBeNull()
    expect(container.querySelector('#home-export-why')).toBeNull()
    const exportBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'Download plan backup',
    ) as HTMLButtonElement
    expect(exportBtn.disabled).toBe(false)
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('could not be read')
  })

  it('lists Start here articles as a column of full phrases', async () => {
    await renderHome()
    const items = container.querySelectorAll('.home-start-here-list li')
    expect(items.length).toBe(START_HERE_SLUGS.length)
    const overview = Array.from(items).find((li) => li.textContent?.includes('Planner overview'))
    expect(overview?.textContent).toMatch(/from household to results/)
    expect(overview?.textContent).not.toMatch(/^\s*results/)
  })

  it('marks plan-card Delete as ghost-danger and Duplicate as ghost', async () => {
    await savePlan(createEmptyPlan({ name: 'Styled plan' }))
    localStorage.setItem(WELCOME_DISMISSED_KEY, 'true')
    await renderHome()
    const duplicate = Array.from(container.querySelectorAll('.plan-card button')).find(
      (b) => b.textContent === 'Duplicate',
    )
    const del = Array.from(container.querySelectorAll('.plan-card button')).find(
      (b) => b.textContent === 'Delete',
    )
    expect(duplicate).toBeTruthy()
    expect(del).toBeTruthy()
    expect(duplicate!.classList.contains('btn-ghost')).toBe(true)
    expect(duplicate!.classList.contains('btn-ghost-danger')).toBe(false)
    expect(del!.classList.contains('btn-ghost')).toBe(true)
    expect(del!.classList.contains('btn-ghost-danger')).toBe(true)
  })

  it('titles the welcome dismiss with Getting started casing', async () => {
    await savePlan(createEmptyPlan({ name: 'My plan' }))
    localStorage.setItem(WELCOME_DISMISSED_KEY, 'false')
    await renderHome()
    const dismiss = container.querySelector('.home-hero-cta button.btn-ghost')
    expect(dismiss?.textContent).toBe('Hide Getting started')
  })

  it('shows getting started above plans with a collapsed reopener for returning users', async () => {
    await savePlan(createEmptyPlan({ name: 'My plan' }))
    localStorage.setItem(WELCOME_DISMISSED_KEY, 'true')
    await renderHome()
    const reopener = container.querySelector('.home-reopener-btn')
    const plansHeading = container.querySelector('.home-your-plans h1')
    expect(reopener).not.toBeNull()
    expect(plansHeading).not.toBeNull()
    expect(reopener!.compareDocumentPosition(plansHeading!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(plansHeading?.textContent).toBe('Your plans')
    expect(container.querySelector('.home-hero')).toBeNull()
    expect(reopener?.getAttribute('aria-expanded')).toBe('false')
    expect(container.querySelectorAll('h1')).toHaveLength(1)
    expect(container.querySelector('.home-your-plans .home-returning-actions')).not.toBeNull()
    expect(container.querySelector('#home-export-why')).toBeNull()
    const exportBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'Download plan backup',
    ) as HTMLButtonElement
    expect(exportBtn.disabled).toBe(false)
  })

  it('reveals getting started when the reopener is expanded', async () => {
    await savePlan(createEmptyPlan({ name: 'My plan' }))
    localStorage.setItem(WELCOME_DISMISSED_KEY, 'true')
    await renderHome()
    const reopener = container.querySelector('.home-reopener-btn') as HTMLButtonElement
    await act(async () => {
      reopener.click()
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    expect(reopener.getAttribute('aria-expanded')).toBe('true')
    expect(container.querySelector('.home-hero h2')).not.toBeNull()
    expect(container.querySelectorAll('h1')).toHaveLength(1)
    expect(localStorage.getItem(WELCOME_DISMISSED_KEY)).toBe('false')
  })

  it('has no interactive controls nested inside other interactive controls', async () => {
    await savePlan(createEmptyPlan({ name: 'My plan' }))
    localStorage.setItem(WELCOME_DISMISSED_KEY, 'true')
    await renderHome()
    expect(container.querySelectorAll('.plan-card').length).toBeGreaterThan(0)
    const interactive = Array.from(container.querySelectorAll('button, a[href], [role="button"]'))
    expect(interactive.length).toBeGreaterThan(0)
    for (const el of interactive) {
      const nested = el.querySelectorAll('button, a[href], [role="button"], input, select, textarea')
      expect(nested, `${el.tagName}.${el.className} contains nested interactive content`).toHaveLength(0)
    }
  })

  it('navigates to the examples page when Try an example is clicked', async () => {
    await renderHome()
    const tryBtn = container.querySelector('.home-hero-cta .btn-primary') as HTMLButtonElement
    await act(async () => {
      tryBtn.click()
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    expect(container.querySelector('[data-testid="examples-page"]')).not.toBeNull()
  })

  it('clears the welcome flag when Clear all data is confirmed via the typed gate', async () => {
    await savePlan(createEmptyPlan({ name: 'My plan' }))
    localStorage.setItem(WELCOME_DISMISSED_KEY, 'false')
    await renderHome()
    const clearBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Clear all data')
    await act(async () => {
      clearBtn?.click()
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    // The native confirm is gone: a modal with a typed-confirmation gate opens.
    const eraseBtn = Array.from(document.querySelectorAll<HTMLButtonElement>('.modal-panel button')).find(
      (b) => b.textContent === 'Erase everything',
    )
    expect(eraseBtn).toBeTruthy()
    expect(eraseBtn!.disabled).toBe(true)

    const gate = document.querySelector<HTMLInputElement>('.modal-panel input[type="text"]')!
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!
    await act(async () => {
      setter.call(gate, 'delete')
      gate.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await act(async () => {
      Array.from(document.querySelectorAll<HTMLButtonElement>('.modal-panel button'))
        .find((b) => b.textContent === 'Erase everything')!
        .click()
      await new Promise((resolve) => setTimeout(resolve, 50))
    })
    expect(localStorage.getItem(WELCOME_DISMISSED_KEY)).toBeNull()
  })

  it('offers an undo toast after deleting a plan and restores it on Undo', async () => {
    await savePlan(createEmptyPlan({ name: 'Doomed plan' }))
    localStorage.setItem(WELCOME_DISMISSED_KEY, 'true')
    await renderHome()

    const deleteBtn = Array.from(container.querySelectorAll('.plan-card button')).find(
      (b) => b.textContent === 'Delete',
    )
    expect(deleteBtn).toBeTruthy()
    await act(async () => {
      ;(deleteBtn as HTMLButtonElement).click()
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    // The typed/danger confirm modal opens; confirm the delete.
    const confirmBtn = Array.from(document.querySelectorAll<HTMLButtonElement>('.modal-panel button')).find(
      (b) => b.textContent === 'Delete plan',
    )
    expect(confirmBtn).toBeTruthy()
    await act(async () => {
      confirmBtn!.click()
      await new Promise((resolve) => setTimeout(resolve, 50))
    })

    // An undo toast appears in a live region; the plan is gone from the list.
    const toast = container.querySelector('.undo-toast')
    expect(toast).not.toBeNull()
    expect(toast!.closest('[role="status"]')).not.toBeNull()
    expect(toast!.textContent).toContain('Doomed plan')
    expect(await listUserPlanSummaries()).toHaveLength(0)

    // Undo restores it fully.
    const undoBtn = Array.from(toast!.querySelectorAll('button')).find((b) => b.textContent === 'Undo')
    await act(async () => {
      undoBtn!.click()
      await new Promise((resolve) => setTimeout(resolve, 50))
    })
    const restored = await listUserPlanSummaries()
    expect(restored).toHaveLength(1)
    expect(restored[0]!.name).toBe('Doomed plan')
  })

  it('keeps refresh history during the delete undo window, then purges it on final dismissal', async () => {
    const plan = createEmptyPlan({ name: 'History plan' })
    await savePlan(plan)
    await saveRefreshSnapshot({
      id: 'history-plan-snapshot',
      planId: plan.id,
      appliedAtIso: '2026-07-15T12:00:00.000Z',
      sourceLabel: 'Schwab — positions.csv',
      sourceSha256: '',
      changes: [],
    })
    await saveRefreshManualMapping({
      planId: plan.id,
      normalizedBrokerLabel: 'schwab:brokerage 789',
      accountId: 'acct-brokerage',
      assignedAtIso: '2026-07-15T12:00:00.000Z',
    })
    await renderHome()

    const deleteBtn = Array.from(container.querySelectorAll('.plan-card button')).find((button) => button.textContent === 'Delete')!
    await act(async () => {
      ;(deleteBtn as HTMLButtonElement).click()
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    await act(async () => {
      Array.from(document.querySelectorAll<HTMLButtonElement>('.modal-panel button'))
        .find((button) => button.textContent === 'Delete plan')!
        .click()
      await new Promise((resolve) => setTimeout(resolve, 50))
    })

    // The plan is absent from the picker, but Undo can still resurrect it, so
    // its operational snapshot and remembered mapping must remain available.
    expect(await listRefreshSnapshots(plan.id)).toHaveLength(1)
    expect(await listRefreshManualMappings(plan.id)).toHaveLength(1)

    const dismiss = container.querySelector<HTMLButtonElement>('button[aria-label="Dismiss"]')!
    await act(async () => {
      dismiss.click()
      await new Promise((resolve) => setTimeout(resolve, 50))
    })

    expect(await listRefreshSnapshots(plan.id)).toEqual([])
    expect(await listRefreshManualMappings(plan.id)).toEqual([])
  })
})

describe('workspace back-navigation', () => {
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

  it('renders breadcrumb and rail back-link that navigate to the home page', async () => {
    const saved = await savePlan(createEmptyPlan({ name: 'Test plan' }))
    expect(saved.ok).toBe(true)
    if (!saved.ok) return

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={[`/plan/${saved.plan.id}/household`]}>
          <Routes>
            <Route path="/" element={<div data-testid="home-page">Home</div>} />
            <Route path="/plan/:planId/*" element={<PlanWorkspace />}>
              <Route path="household" element={<div>Household section</div>} />
            </Route>
          </Routes>
        </MemoryRouter>,
      )
    })
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100))
    })

    const breadcrumb = container.querySelector('nav[aria-label="Breadcrumb"]')
    expect(breadcrumb).not.toBeNull()
    expect(breadcrumb?.textContent).toContain('Your plans')
    expect(breadcrumb?.querySelector('[aria-current="page"]')?.textContent).toBe('Test plan')

    const railBack = container.querySelector('.rail-link--back')
    expect(railBack?.textContent).toContain('Your plans')

    // A freshly created empty plan never shows a red depletion verdict:
    // the KPI bar soft-frames as "Getting started" until income sources or
    // funded accounts exist.
    expect(container.querySelector('.kpi-bar--incomplete')).not.toBeNull()
    expect(container.querySelector('.kpi-value--bad')).toBeNull()
    expect(container.querySelector('.kpi-bar')?.textContent).toContain('Getting started')

    await act(async () => {
      ;(breadcrumb?.querySelector('a') as HTMLAnchorElement).click()
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    expect(container.querySelector('[data-testid="home-page"]')).not.toBeNull()
  })
})

describe('KPI plan-completeness heuristic', () => {
  const base = { id: 'a1', name: 'X', ownerPersonId: null, annualReturnPct: null }

  it('debts and zero-value payment/value accounts do not count as funding', () => {
    const incomes: never[] = []
    // A debt's balance is money owed — still "getting started".
    expect(
      isPlanIncomplete({
        incomes,
        accounts: [{ ...base, type: 'debt', balance: 5_000, interestPct: 20, monthlyPayment: 100 }],
      }),
    ).toBe(true)
    // Freshly added pension/property rows default to zero amounts.
    expect(
      isPlanIncomplete({
        incomes,
        accounts: [
          { ...base, type: 'pension', startAge: 65, monthlyAmount: 0, colaPct: 0, survivorPct: 0 },
        ],
      }),
    ).toBe(true)
    expect(
      isPlanIncomplete({
        incomes,
        accounts: [
          { ...base, type: 'property', value: 0, plannedSaleYear: null, expectedNetProceeds: null },
        ],
      }),
    ).toBe(true)
  })

  it('positive balances, payments, or property values count as funding', () => {
    const incomes: never[] = []
    expect(
      isPlanIncomplete({
        incomes,
        accounts: [{ ...base, type: 'cash', balance: 1_000, annualContribution: 0 }],
      }),
    ).toBe(false)
    expect(
      isPlanIncomplete({
        incomes,
        accounts: [
          { ...base, type: 'pension', startAge: 65, monthlyAmount: 500, colaPct: 0, survivorPct: 0 },
        ],
      }),
    ).toBe(false)
    expect(
      isPlanIncomplete({
        incomes,
        accounts: [
          { ...base, type: 'property', value: 300_000, plannedSaleYear: null, expectedNetProceeds: null },
        ],
      }),
    ).toBe(false)
  })
})

describe('useHomeMode localStorage safety', () => {
  it('defaults to collapsed welcome when localStorage throws', () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    const mode: HomeMode = deriveHomeMode([
      { id: 'a', name: 'X', updatedAtIso: '2026-01-01T00:00:00.000Z' },
    ])
    expect(mode).toBe('returning')
    expect(isWelcomeExpanded(mode, true)).toBe(false)
    getItem.mockRestore()
  })
})
