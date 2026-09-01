/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest'
import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import type { ArticleBlock } from './learningRegistry'
import { ArticleBody } from './ArticleBody'
import { SourceList } from './components/SourceList'
import { ExternalLink } from './components/ExternalLink'
import { sourceLabel } from './components/sourceLabel'
import { LearnAboutScreen } from './LearnAboutScreen'
import { RelatedArticles } from './components/RelatedArticles'

function renderBlocks(blocks: ArticleBlock[]): string {
  return renderToString(
    <MemoryRouter>
      <ArticleBody blocks={blocks} />
    </MemoryRouter>,
  )
}

describe('ArticleFigure', () => {
  it('exposes a chart as an accessible image with a text equivalent', () => {
    const html = renderBlocks([
      {
        type: 'figure',
        chartId: 'purchasing-power',
        caption: 'Buying power over time.',
        alt: 'A falling line showing buying power shrinking.',
        sourceNote: 'Illustrative, about 3% inflation.',
      },
    ])
    expect(html).toContain('role="img"')
    expect(html).toContain('aria-label="A falling line showing buying power shrinking."')
    expect(html).toContain('<figcaption')
    expect(html).toContain('Buying power over time.')
    expect(html).toContain('Illustrative, about 3% inflation.')
  })

  it('renders an image alternative with alt text', () => {
    const html = renderBlocks([
      { type: 'figure', image: { src: '/x.svg' }, caption: 'A diagram.', alt: 'Account flow diagram.' },
    ])
    expect(html).toContain('src="/x.svg"')
    expect(html).toContain('alt="Account flow diagram."')
  })

  it('falls back to the text equivalent when there is no media', () => {
    const html = renderBlocks([{ type: 'figure', caption: 'Cap.', alt: 'Text equivalent only.' }])
    expect(html).toContain('Text equivalent only.')
  })
})

describe('FormulaBlock', () => {
  it('renders the expression, variable definitions, basis, and note', () => {
    const html = renderBlocks([
      {
        type: 'formula',
        expression: 'real = nominal / (1 + i)^t',
        where: [{ symbol: 'i', meaning: 'inflation rate' }],
        basis: 'today',
        note: 'Ignores varying inflation.',
      },
    ])
    expect(html).toContain('real = nominal / (1 + i)^t')
    expect(html).toContain('inflation rate')
    expect(html).toContain('Amounts are in today&#x27;s dollars.') // apostrophe is HTML-escaped
    expect(html).toContain('Ignores varying inflation.')
  })
})

describe('ScenarioCard', () => {
  it('renders a named, labelled scenario region', () => {
    const html = renderBlocks([
      {
        type: 'scenario',
        name: 'The Rivera household',
        assumptions: [{ label: 'Spending', value: '$50,000' }],
        summary: 'Same lifestyle, **more** dollars.',
      },
    ])
    expect(html).toContain('aria-label="Scenario: The Rivera household"')
    expect(html).toContain('The Rivera household')
    expect(html).toContain('Spending')
    expect(html).toContain('$50,000')
    expect(html).toContain('<strong>more</strong>')
  })
})

describe('ComparisonTable', () => {
  it('renders a captioned table with column and row header scopes', () => {
    const html = renderBlocks([
      {
        type: 'table',
        caption: 'Two ways.',
        columns: ['Framing', 'Meaning'],
        rows: [['Today', 'Inflation removed']],
      },
    ])
    expect(html).toContain('<caption')
    expect(html).toContain('Two ways.')
    expect(html).toContain('scope="col"')
    expect(html).toContain('scope="row"')
  })
})

describe('SourceList', () => {
  it('renders nothing when there are no sources', () => {
    expect(renderToString(<SourceList urls={[]} />)).toBe('')
  })

  it('renders external links for each source', () => {
    const html = renderToString(<SourceList urls={['https://www.irs.gov/']} />)
    expect(html).toContain('href="https://www.irs.gov/"')
    expect(html).toContain('Sources')
  })

  it('labels each source host + path with the new-tab cue, not the bare URL (#418)', () => {
    const url =
      'https://www.irs.gov/retirement-plans/plan-participant-employee/rollovers-of-retirement-plan-and-ira-distributions'
    const html = renderToString(<SourceList urls={[url]} />)
    expect(html).toContain(`href="${url}"`)
    expect(html).toContain(`title="${url}"`)
    expect(html).toContain('irs.gov/…/rollovers-of-retirement-plan-and-ira-distributions')
    expect(html).not.toContain(`>${url}<`)
    expect(html).toContain('target="_blank"')
    expect(html).toContain('↗')
    expect(html).toContain('opens in a new tab')
  })
})

describe('LearnAboutScreen', () => {
  it('drops slugs the screen already links inline, and renders nothing when none remain (#429)', () => {
    const route = '/plan/:planId/relocation'
    const withAll = renderToString(
      <MemoryRouter>
        <LearnAboutScreen route={route} />
      </MemoryRouter>,
    )
    const hrefs = (html: string) => [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1])
    expect(hrefs(withAll)).toContain('/learn/what-changes-when-you-move-states')
    const excluded = renderToString(
      <MemoryRouter>
        <LearnAboutScreen route={route} exclude={['what-changes-when-you-move-states']} />
      </MemoryRouter>,
    )
    // Only the excluded slug goes; every other related article (none today) stays.
    expect(hrefs(excluded)).toEqual(hrefs(withAll).filter((h) => h !== '/learn/what-changes-when-you-move-states'))
    // With nothing left to list, the cluster renders nothing rather than an empty aside.
    if (hrefs(excluded).length === 0) expect(excluded).toBe('')
  })
})

describe('ExternalLink', () => {
  it('opens in a new tab with a visible ↗ and a screen-reader cue', () => {
    const html = renderToString(<ExternalLink href="https://www.ssa.gov/">SSA</ExternalLink>)
    expect(html).toContain('href="https://www.ssa.gov/"')
    expect(html).toContain('target="_blank"')
    expect(html).toContain('rel="noopener noreferrer"')
    expect(html).toContain('<span aria-hidden="true"> ↗</span>')
    expect(html).toContain('<span class="sr-only"> (opens in a new tab)</span>')
  })

  it('derives short labels: host + short path, host + last segment for long paths', () => {
    expect(sourceLabel('https://www.irs.gov/')).toBe('irs.gov')
    expect(sourceLabel('https://www.irs.gov/retirement-plans/roth-iras')).toBe('irs.gov/retirement-plans/roth-iras')
    expect(sourceLabel('https://www.ssa.gov/benefits/retirement/planner/agereduction.html')).toBe(
      'ssa.gov/…/agereduction.html',
    )
    expect(sourceLabel('not a url')).toBe('not a url')
    // Query strings survive, so two editions of one page stay distinguishable.
    expect(sourceLabel('https://www.ssa.gov/oact/cola/Benefits.html?year=2026')).toBe(
      'ssa.gov/oact/cola/Benefits.html?year=2026',
    )
    expect(sourceLabel('https://www.ssa.gov/benefits/retirement/planner/agereduction.html?year=2027')).toBe(
      'ssa.gov/…/agereduction.html?year=2027',
    )
  })
})

describe('RelatedArticles', () => {
  it('shows readable related articles', () => {
    const html = renderToString(
      <MemoryRouter>
        <RelatedArticles slugs={['about-retiregolden', 'rule-of-55-and-72t']} />
      </MemoryRouter>,
    )
    expect(html).toContain('About RetireGolden')
    expect(html).toContain('Rule of 55 and 72(t) basics')
  })

  it('renders nothing when no related article is readable', () => {
    const html = renderToString(
      <MemoryRouter>
        <RelatedArticles slugs={['no-such-article']} />
      </MemoryRouter>,
    )
    expect(html).toBe('')
  })
})
