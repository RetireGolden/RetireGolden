/** @vitest-environment jsdom */
/**
 * ScrollRegion (#468, #480, #483): a wide-table wrap that keyboard and
 * assistive-tech users can reach. The visual scroll cue is CSS (pinned in
 * designQa.chrome.test.ts); this covers the markup contract.
 */
import { describe, expect, it } from 'vitest'
import { renderToString } from 'react-dom/server'

import { ScrollRegion } from './ScrollRegion'

describe('ScrollRegion', () => {
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
