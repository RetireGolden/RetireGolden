/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest'
import { act } from 'react'
import { renderToString } from 'react-dom/server'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { App } from './App.tsx'

describe('App shell smoke', () => {
  it('renders the planner navigation and plan picker without throwing', () => {
    const html = renderToString(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    )
    expect(html).toContain('RetireGolden')
    expect(html).toContain('Planner')
    expect(html).toContain('Examples')
    expect(html).toContain('Disclaimer')
    expect(html).toContain('Clear all data')
    expect(html).not.toContain('Legacy v1')
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
