/**
 * The "Social Security taxes vs. benefits" article describes the ratio the
 * paid-in panel computes (@retiregolden/engine
 * socialSecurity/analysis/oasdiReturn.ts, owner decision R8), not the retired
 * one (PR #757 review 2): both sides in today's dollars at each year's rate,
 * the projected work the benefit estimate counts, the benefits already
 * received, and a former spouse's benefit when it is larger. The panel's own
 * copy names the same parts (SsAnalysisPage.slice4.test.tsx renders it).
 */
import { describe, expect, it } from 'vitest'

import { blocks } from './content/social-security-taxes-vs-benefits'
import type { ArticleBlock } from './learningRegistry'

function blockText(block: ArticleBlock): string {
  switch (block.type) {
    case 'prose':
    case 'callout':
      return block.md
    case 'heading':
      return block.text
    case 'list':
      return block.items.join(' ')
    case 'table':
      return [block.caption ?? '', ...block.columns, ...block.rows.flat()].join(' ')
    default:
      return JSON.stringify(block)
  }
}

const text = blocks.map(blockText).join(' ').replace(/’/gu, "'")

describe('social-security-taxes-vs-benefits article', () => {
  it('describes the ratio the panel computes: today\'s dollars at each year\'s rate, the projected work, benefits received, a former spouse\'s benefit', () => {
    expect(text).toContain("in today's dollars")
    expect(text).toContain("at that year's rate")
    expect(text).toContain('paid in so far')
    expect(text).toContain('what your projected work will pay')
    expect(text).toContain('Benefits already received')
    expect(text).toContain("a former spouse's benefit when it is larger")
    expect(text).toContain('adding no interest')
  })

  it('no longer says the ratio leaves out spousal benefits or counts only the entered history and own benefits', () => {
    expect(text).not.toMatch(/excludes the value of disability and survivor insurance, spousal benefits/u)
    expect(text).not.toContain('Spousal, survivor, and disability protection')
    expect(text).not.toMatch(/summed over your earnings history in today's dollars',/u)
    expect(text).not.toMatch(/lifetime retirement benefits at your chosen claim age/u)
  })
})
