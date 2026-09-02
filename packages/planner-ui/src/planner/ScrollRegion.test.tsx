/** @vitest-environment jsdom */
/**
 * ScrollRegion (#468, #480, #483): a wide-table wrap that keyboard and
 * assistive-tech users can reach. The visual scroll cue is CSS (pinned in
 * designQa.chrome.test.ts); this covers the markup contract.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'

import { ScrollRegion } from './ScrollRegion'

describe('ScrollRegion', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('drops the tab stop when nothing overflows and restores it when something does', async () => {
    // jsdom has no layout; stub the observer to fire on demand and fake the metrics.
    let fire = () => {}
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(cb: () => void) {
          fire = cb
        }
        observe() {}
        disconnect() {}
      },
    )
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    const metrics = { scrollWidth: 100, clientWidth: 100, scrollHeight: 50, clientHeight: 50 }
    for (const key of Object.keys(metrics) as (keyof typeof metrics)[]) {
      Object.defineProperty(HTMLDivElement.prototype, key, { configurable: true, get: () => metrics[key] })
    }
    try {
      await act(async () => {
        root.render(
          <ScrollRegion label="Fits">
            <table />
          </ScrollRegion>,
        )
      })
      const region = container.querySelector('[role="region"]')!
      expect(region.hasAttribute('tabindex'), 'a table that fits is not a tab stop').toBe(false)
      metrics.scrollWidth = 400
      await act(async () => fire())
      expect(region.getAttribute('tabindex'), 'overflow makes it reachable again').toBe('0')
    } finally {
      for (const key of Object.keys(metrics)) Reflect.deleteProperty(HTMLDivElement.prototype, key)
      await act(async () => root.unmount())
      container.remove()
    }
  })

  it('is a named, focusable region carrying the table-wrap chrome', () => {
    const html = renderToString(
      <ScrollRegion label="Year-by-year table">
        <table />
      </ScrollRegion>,
    )
    expect(html).toContain('class="year-table-wrap"')
    expect(html).toContain('role="region"')
    expect(html).toContain('aria-label="Year-by-year table"')
    expect(html).toContain('tabindex="0"')
  })

  it('can grow with its rows instead of capping height, and merges extra classes and styles', () => {
    const html = renderToString(
      <ScrollRegion label="Scenarios" grow className="extra" style={{ border: 'none' }}>
        <table />
      </ScrollRegion>,
    )
    expect(html).toContain('class="year-table-wrap year-table-wrap--grow extra"')
    expect(html).toContain('style="border:none"')
  })
})
