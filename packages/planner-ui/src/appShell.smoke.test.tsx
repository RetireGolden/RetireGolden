/** @vitest-environment jsdom */
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { act } from 'react'
import { renderToString } from 'react-dom/server'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router'
import { IDBFactory } from 'fake-indexeddb'

import { createEmptyPlan } from '@retiregolden/engine/model/plan'

import { App } from './App.tsx'
import { _resetPlanStoreForTests, savePlan } from './data/planStore'
import type { PlanStore } from './data/planStoreContext'

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory()
  _resetPlanStoreForTests()
})

describe('App shell smoke', () => {
  it('renders the planner navigation and plan picker without throwing', () => {
    const html = renderToString(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    )
    expect(html).toContain('RetireGolden')
    expect(html).toContain('class="brand-wordmark"')
    expect(html).toContain('class="brand-mark"')
    expect(html).toContain('Skip to content')
    expect(html).toContain('Theme')
    expect(html).toContain('theme-switcher-label')
    expect(html).toContain('Planner')
    expect(html).toContain('Examples')
    expect(html).toContain('Disclaimer')
    expect(html).toContain('Clear all data')
    expect(html).not.toContain('Legacy v1')
    expect(html).not.toContain('retiregolden-logo-lockup')
  })

  it('accepts a host reportBranding prop without changing the chrome', () => {
    // The prop only affects downloaded reports (threaded via context to the
    // report pages); the shell itself must render identically with it set.
    const html = renderToString(
      <MemoryRouter>
        <App reportBranding={{ productName: 'Acme Wealth', accentColor: '#123456' }} />
      </MemoryRouter>,
    )
    expect(html).toContain('RetireGolden')
    expect(html).not.toContain('Acme Wealth')
  })

  it('titles first-run home RetireGolden immediately, not after the plan list', async () => {
    let resolveList: ((value: never[]) => void) | undefined
    const hangingStore: PlanStore = {
      listPlans: () =>
        new Promise((resolve) => {
          resolveList = resolve
        }),
      loadPlan: async () => null,
      savePlan: async () => undefined,
      deletePlan: async () => undefined,
    }
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/learn']}>
          <App planStore={hangingStore} />
        </MemoryRouter>,
      )
    })
    expect(document.title).toBe('Learn · RetireGolden')

    await act(async () => {
      ;(container.querySelector('a[href="/"]') as HTMLAnchorElement).click()
    })
    // Must not stay on Learn while the home skeleton waits on IndexedDB.
    expect(document.title).toBe('RetireGolden')
    expect(document.title).not.toMatch(/Your plans|Learn/)
    resolveList?.([])
    await act(async () => root.unmount())
  })

  it('titles an empty library RetireGolden and a non-empty library Your plans', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/']}>
          <App />
        </MemoryRouter>,
      )
    })
    expect(document.title).toBe('RetireGolden')
    for (let attempt = 0; attempt < 50 && document.title !== 'RetireGolden'; attempt++) {
      await act(async () => {
        await new Promise((r) => setTimeout(r, 10))
      })
    }
    expect(document.title).toBe('RetireGolden')
    expect(container.querySelector('#theme-switcher-label')?.textContent).toBe('Theme')
    expect(container.querySelector('.skip-link')?.textContent).toMatch(/Skip to content/)
    expect(container.querySelector('.brand-wordmark')?.textContent).toBe('RetireGolden')
    await act(async () => root.unmount())

    await savePlan(createEmptyPlan({ name: 'Saved plan' }))
    const returning = document.createElement('div')
    document.body.appendChild(returning)
    const returningRoot = createRoot(returning)
    await act(async () => {
      returningRoot.render(
        <MemoryRouter initialEntries={['/']}>
          <App />
        </MemoryRouter>,
      )
    })
    for (let attempt = 0; attempt < 50 && document.title !== 'Your plans · RetireGolden'; attempt++) {
      await act(async () => {
        await new Promise((r) => setTimeout(r, 10))
      })
    }
    expect(document.title).toBe('Your plans · RetireGolden')
    await act(async () => returningRoot.unmount())
  })

  it('renders the examples page', async () => {
    // /examples is a lazy route, so it needs a client render (renderToString
    // would only emit the Suspense fallback).
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/examples']}>
          <App />
        </MemoryRouter>,
      )
    })
    for (let attempt = 0; attempt < 100 && !container.innerHTML.includes('Example library'); attempt++) {
      await act(async () => {
        await new Promise((r) => setTimeout(r, 10))
      })
    }
    expect(container.innerHTML).toContain('Example library')
    expect(container.innerHTML).toContain('← Your plans')
    await act(async () => root.unmount())
  })

  it('renders the disclaimer page', () => {
    const html = renderToString(
      <MemoryRouter initialEntries={['/disclaimer']}>
        <App />
      </MemoryRouter>,
    )
    expect(html).toContain('Educational use only')
    expect(html).toContain('Your data stays with you')
  })
})
