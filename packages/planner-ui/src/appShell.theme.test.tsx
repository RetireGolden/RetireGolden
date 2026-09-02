/** @vitest-environment jsdom */
/**
 * Theme persistence (#434): the selected mode is applied to the document on
 * mount from storage, and a change written by another tab (or another
 * session on the same box) is picked up here without a reload, so the
 * control and the page never drift apart.
 */
import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router'

import { App } from './App.tsx'
import type { PlanStore } from './data/planStoreContext'

const emptyStore: PlanStore = {
  listPlans: async () => [],
  loadPlan: async () => null,
  savePlan: async () => undefined,
  deletePlan: async () => undefined,
}

describe('theme persistence (#434)', () => {
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
    delete document.documentElement.dataset.theme
  })

  const mount = async () => {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/examples']}>
          <App planStore={emptyStore} />
        </MemoryRouter>,
      )
    })
  }
  const pressed = () =>
    [...container.querySelectorAll<HTMLButtonElement>('.theme-switcher-button')]
      .filter((b) => b.getAttribute('aria-pressed') === 'true')
      .map((b) => b.textContent)

  it('applies the stored mode on mount and keeps the control in step', async () => {
    localStorage.setItem('retiregolden.theme', 'dark')
    await mount()
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(pressed()).toEqual(['Dark'])
  })

  it('follows a theme change written by another tab without a reload', async () => {
    localStorage.setItem('retiregolden.theme', 'dark')
    await mount()
    expect(document.documentElement.dataset.theme).toBe('dark')
    await act(async () => {
      localStorage.setItem('retiregolden.theme', 'light')
      window.dispatchEvent(new StorageEvent('storage', { key: 'retiregolden.theme', newValue: 'light' }))
    })
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(pressed()).toEqual(['Light'])
    // A write to some other key, or an invalid value, changes nothing.
    await act(async () => {
      window.dispatchEvent(new StorageEvent('storage', { key: 'retiregolden.theme', newValue: 'purple' }))
      window.dispatchEvent(new StorageEvent('storage', { key: 'other', newValue: 'dark' }))
    })
    expect(document.documentElement.dataset.theme).toBe('light')
  })
})
