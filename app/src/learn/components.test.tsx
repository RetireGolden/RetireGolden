/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest'
import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import type { ArticleBlock } from './learningRegistry'
import { ArticleBody } from './ArticleBody'
import { SourceList } from './components/SourceList'
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
