/** @vitest-environment jsdom */
import 'fake-indexeddb/auto'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import { MemoryRouter, Route, Routes, type InitialEntry, useNavigate } from 'react-router-dom'
import { App } from '../App.tsx'
import LearnRoutes from '../routes/LearnRoutes'
import {
  KNOWN_PLANNER_ROUTES,
  LEARNING_ARTICLES,
  LEARNING_CATEGORIES,
  articlesInCategory,
  articlesForRoute,
  getArticle,
  isReadable,
  searchArticles,
} from './learningRegistry'
import { LEARN } from '../planner/learnLinks'
import { GLOSSARY_TERMS } from './glossary'
import { renderInline } from './inlineMarkdown'
import { LEARN_CHART_IDS } from './components/charts'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const CATEGORY_IDS = new Set(LEARNING_CATEGORIES.map((c) => c.id))
const KNOWN_ROUTES = new Set<string>(KNOWN_PLANNER_ROUTES)
const ASSUMPTION_DEEP_DIVES = [
  'assumption-general-inflation',
  'assumption-healthcare-inflation',
  'assumption-investment-returns',
  'assumption-social-security-cola',
  'assumption-social-security-trust-fund',
  'assumption-longevity-planning-age',
  'assumption-state-tax-override',
  'assumption-recent-magi',
  'assumption-heir-tax-rate',
]

beforeEach(() => {
  Object.defineProperty(window, 'scrollTo', { value: vi.fn(), writable: true })
})

async function renderAt(path: string, entry: InitialEntry = path): Promise<string> {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)

  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[entry]}>
        <App />
      </MemoryRouter>,
    )
  })

  for (let attempt = 0; attempt < 100; attempt++) {
    if (!container.querySelector('.route-loading')) break
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10))
    })
  }

  const html = container.innerHTML
  await act(async () => {
    root.unmount()
  })
  document.body.removeChild(container)
  return html
}

describe('learning registry integrity', () => {
  it('has the first content batch available as readable articles', () => {
    const batchA = [
      'how-to-read-a-retirement-projection',
      'todays-dollars-vs-future-dollars',
      'what-retiregolden-models',
      'reading-the-results-page',
      'understanding-monte-carlo-success-rate',
    ]

    for (const slug of batchA) {
      const article = getArticle(slug)
      expect(article, slug).toBeDefined()
      expect(article ? isReadable(article) : false, slug).toBe(true)
    }
  })

  it('has the second content batch available as readable articles', () => {
    const batchB = [
      'roth-conversion-basics',
      'filling-a-tax-bracket-with-roth-conversions',
      'how-the-optimizer-values-after-tax-estate',
      'marginal-vs-effective-tax-rate',
      'why-roth-conversions-raise-other-costs',
    ]

    for (const slug of batchB) {
      const article = getArticle(slug)
      expect(article, slug).toBeDefined()
      expect(article ? isReadable(article) : false, slug).toBe(true)
    }
  })

  it('has the third content batch available as readable articles', () => {
    const batchC = [
      'social-security-claiming-age-basics',
      'pia-aime-and-bend-points',
      'break-even-useful-lens',
      'spousal-and-survivor-benefits',
      'earnings-test-before-fra',
    ]

    for (const slug of batchC) {
      const article = getArticle(slug)
      expect(article, slug).toBeDefined()
      expect(article ? isReadable(article) : false, slug).toBe(true)
    }
  })

  it('has the fourth content batch available as readable articles', () => {
    const batchD = [
      'irmaa-two-year-lookback',
      'aca-premium-tax-credits-and-magi',
      'agi-magi-and-taxable-income',
      'healthcare-before-65',
      'healthcare-after-65',
    ]

    for (const slug of batchD) {
      const article = getArticle(slug)
      expect(article, slug).toBeDefined()
      expect(article ? isReadable(article) : false, slug).toBe(true)
    }
  })

  it('has the fifth content batch available as readable articles', () => {
    const batchE = [
      'withdrawal-order-basics',
      'rmds-required-minimum-distributions',
      'qcds-qualified-charitable-distributions',
      'widows-penalty-and-survivor-brackets',
      'paying-conversion-taxes-taxable-vs-ira',
    ]

    for (const slug of batchE) {
      const article = getArticle(slug)
      expect(article, slug).toBeDefined()
      expect(article ? isReadable(article) : false, slug).toBe(true)
    }
  })

  it('has the sixth content batch available as readable articles', () => {
    const batchF = [
      'account-types-overview',
      'traditional-vs-roth-contributions',
      'employer-match-and-contribution-order',
      'hsas-as-retirement-accounts',
      'taxable-brokerage-basis-and-capital-gains',
    ]

    for (const slug of batchF) {
      const article = getArticle(slug)
      expect(article, slug).toBeDefined()
      expect(article ? isReadable(article) : false, slug).toBe(true)
    }
  })

  it('has the seventh content batch available as readable articles', () => {
    const batchG = [
      'sequence-of-returns-risk',
      'what-monte-carlo-proves',
      'historical-vs-random-return-models',
      'inflation-risk',
      'longevity-risk',
    ]

    for (const slug of batchG) {
      const article = getArticle(slug)
      expect(article, slug).toBeDefined()
      expect(article ? isReadable(article) : false, slug).toBe(true)
    }
  })

  it('has the dynamic spending guardrails article with the current RetireGolden modeling boundary', () => {
    const article = getArticle('dynamic-spending-guardrails')
    expect(article ? isReadable(article) : false).toBe(true)
    const content = JSON.stringify(article!.blocks ?? [])
    expect(content).toContain('models guardrails directly inside the same annual ledger')
    expect(article!.relatedPlannerRoutes).toContain('/plan/:planId/insights')
  })

  it('has the eighth content batch available as readable articles', () => {
    const batchH = [
      'three-big-questions-spending-time-risk',
      'planner-overview',
      'using-scenarios-to-compare-choices',
      'how-the-optimizer-thinks',
      'ordinary-income-vs-capital-gains',
    ]

    for (const slug of batchH) {
      const article = getArticle(slug)
      expect(article, slug).toBeDefined()
      expect(article ? isReadable(article) : false, slug).toBe(true)
    }
  })

  it('has the ninth content batch available as readable articles', () => {
    const batchI = [
      'how-assumptions-change-the-answer',
      'planning-for-couples-and-survivor-years',
      'why-small-tax-cliffs-can-matter',
      'why-95-percent-is-not-a-guarantee',
      'sensitivity-testing-what-changes-the-answer',
    ]

    for (const slug of batchI) {
      const article = getArticle(slug)
      expect(article, slug).toBeDefined()
      expect(article ? isReadable(article) : false, slug).toBe(true)
    }
  })

  it('has the tenth content batch available as readable articles', () => {
    const batchJ = [
      'reading-the-social-security-analysis-page',
      'using-assumptions-and-provenance',
      'reports-csv-exports-and-sharing',
      'privacy-what-stays-in-your-browser',
      'troubleshooting-surprising-results',
    ]

    for (const slug of batchJ) {
      const article = getArticle(slug)
      expect(article, slug).toBeDefined()
      expect(article ? isReadable(article) : false, slug).toBe(true)
    }
  })

  it('has the eleventh content batch available as readable articles', () => {
    const batchK = [
      'pensions-and-annuities',
      'real-estate-home-equity-and-debt',
      'rsus-and-espp',
      'fees-expense-ratios-and-compounding-drag',
    ]

    for (const slug of batchK) {
      const article = getArticle(slug)
      expect(article, slug).toBeDefined()
      expect(article ? isReadable(article) : false, slug).toBe(true)
    }
  })

  it('has the twelfth content batch available as readable articles', () => {
    const batchL = [
      'standard-deduction-senior-deduction-and-itemizing',
      'how-social-security-is-taxed',
      'niit-high-income-investment-tax',
      'state-income-taxes-in-retirement',
      'what-changes-when-you-move-states',
      'tax-cliffs-and-bracket-edges',
      'tax-loss-and-gain-harvesting',
    ]

    for (const slug of batchL) {
      const article = getArticle(slug)
      expect(article, slug).toBeDefined()
      expect(article ? isReadable(article) : false, slug).toBe(true)
    }
  })

  it('has the thirteenth content batch available as readable articles', () => {
    const batchM = [
      'cola-and-inflation-protection',
      'divorced-spousal-and-survivor-records',
      'trust-fund-haircut-scenarios',
      'mortality-weighted-social-security',
    ]

    for (const slug of batchM) {
      const article = getArticle(slug)
      expect(article, slug).toBeDefined()
      expect(article ? isReadable(article) : false, slug).toBe(true)
    }
  })

  it('has the fourteenth content batch available as readable articles', () => {
    const batchN = [
      'hsas-and-qualified-medical-expenses',
      'long-term-care-costs-and-insurance',
      'medicare-part-b-vs-part-d-irmaa',
    ]

    for (const slug of batchN) {
      const article = getArticle(slug)
      expect(article, slug).toBeDefined()
      expect(article ? isReadable(article) : false, slug).toBe(true)
    }
  })

  it('has the final content batch available as readable articles', () => {
    const batchO = [
      'rule-of-55-and-72t',
      'inherited-ira-10-year-rule',
      'long-term-care-insurance-as-risk-transfer',
      'permanent-life-insurance-in-a-plan',
      'survivor-planning-for-couples',
      'after-tax-estate',
      'step-up-in-basis',
      'beneficiaries-and-account-titling',
    ]

    for (const slug of batchO) {
      const article = getArticle(slug)
      expect(article, slug).toBeDefined()
      expect(article ? isReadable(article) : false, slug).toBe(true)
    }
  })

  it('has the Strategy, Spending, and Insurance audit articles available as readable articles', () => {
    const slugs = [
      'building-a-retirement-spending-budget',
      'what-retirement-healthcare-really-costs',
      'insurance-in-your-retirement-plan',
    ]

    for (const slug of slugs) {
      const article = getArticle(slug)
      expect(article, slug).toBeDefined()
      expect(article ? isReadable(article) : false, slug).toBe(true)
      expect(article!.relatedPlannerRoutes.length, slug).toBeGreaterThan(0)
      expect(
        article!.blocks?.some((block) => ['figure', 'formula', 'scenario', 'table'].includes(block.type)),
        `${slug} has a rich teaching block`,
      ).toBe(true)
    }
  })

  it('has the sustainable-spending follow-up articles available as readable articles', () => {
    const slugs = [
      'spending-profiles-and-the-retirement-smile',
      'survivor-spending-in-couple-plans',
      'how-much-can-i-spend',
    ]

    for (const slug of slugs) {
      const article = getArticle(slug)
      expect(article, slug).toBeDefined()
      expect(article ? isReadable(article) : false, slug).toBe(true)
      expect(article!.relatedPlannerRoutes).toContain('/plan/:planId/spending')
      expect(
        article!.blocks?.some((block) => ['figure', 'formula', 'scenario', 'table'].includes(block.type)),
        `${slug} has a rich teaching block`,
      ).toBe(true)
    }

    expect(getArticle('how-much-can-i-spend')!.relatedPlannerRoutes).toContain('/plan/:planId/spending-solver')
  })

  it('keeps retirement healthcare cost guidance source-backed and annual-reviewable', () => {
    const article = getArticle('what-retirement-healthcare-really-costs')
    expect(article ? isReadable(article) : false).toBe(true)
    expect(article!.currentYearSensitive).toBe(true)
    expect(article!.reviewCadence).toBe('annual')
    expect(article!.sourceUrls).toEqual(
      expect.arrayContaining([
        expect.stringContaining('cms.gov'),
        expect.stringContaining('medicare.gov'),
        expect.stringContaining('kff.org'),
        expect.stringContaining('healthcare.gov'),
        expect.stringContaining('fidelity'),
      ]),
    )
    const content = JSON.stringify(article!.blocks ?? [])
    expect(content).toContain('$202.90')
    expect(content).toContain('$625')
    expect(content).toContain('3%')
  })

  it('has the Assumptions category available as nine readable deep dives', () => {
    const slugs = articlesInCategory('assumptions').map((a) => a.slug)
    expect(slugs).toEqual(ASSUMPTION_DEEP_DIVES)
    for (const slug of ASSUMPTION_DEEP_DIVES) {
      const article = getArticle(slug)
      expect(article ? isReadable(article) : false, slug).toBe(true)
    }
  })

  it('uses the overview hub as an index to every assumption deep dive', () => {
    const hub = getArticle('understanding-your-plan-assumptions')
    expect(hub ? isReadable(hub) : false).toBe(true)
    const content = JSON.stringify(hub!.blocks ?? [])
    for (const slug of ASSUMPTION_DEEP_DIVES) {
      expect(content, `hub links ${slug}`).toContain(`/learn/${slug}`)
    }
  })

  it('gives every assumption deep dive a teaching block and watch-outs', () => {
    for (const slug of ASSUMPTION_DEEP_DIVES) {
      const article = getArticle(slug)
      const blocks = article?.blocks ?? []
      expect(
        blocks.some((block) => ['figure', 'formula', 'scenario', 'table'].includes(block.type)),
        `${slug} has a rich teaching block`,
      ).toBe(true)
      expect(
        blocks.some((block) => block.type === 'heading' && /watch|mistake/i.test(block.text)),
        `${slug} has watch-outs`,
      ).toBe(true)
    }
  })

  it('has no planned stub articles remaining', () => {
    expect(LEARNING_ARTICLES.filter((a) => a.status === 'stub')).toHaveLength(0)
  })

  it('has unique slugs', () => {
    const slugs = LEARNING_ARTICLES.map((a) => a.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it('uses kebab-case slugs', () => {
    for (const a of LEARNING_ARTICLES) {
      expect(a.slug, a.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
    }
  })

  it('only references valid category ids', () => {
    for (const a of LEARNING_ARTICLES) {
      expect(CATEGORY_IDS.has(a.category), `${a.slug} -> ${a.category}`).toBe(true)
    }
  })

  it('only references related articles that exist', () => {
    for (const a of LEARNING_ARTICLES) {
      for (const slug of a.relatedArticles) {
        expect(getArticle(slug), `${a.slug} relates to missing ${slug}`).toBeDefined()
      }
    }
  })

  it('only references known planner routes', () => {
    for (const a of LEARNING_ARTICLES) {
      for (const route of a.relatedPlannerRoutes) {
        expect(KNOWN_ROUTES.has(route), `${a.slug} -> unknown route ${route}`).toBe(true)
      }
    }
  })

  it('has an ISO last-reviewed date on every article', () => {
    for (const a of LEARNING_ARTICLES) {
      expect(a.lastReviewed, a.slug).toMatch(ISO_DATE)
    }
  })

  it('gives ready articles a title, description, and non-empty content', () => {
    for (const a of LEARNING_ARTICLES.filter((x) => x.status === 'ready')) {
      expect(a.title.length, a.slug).toBeGreaterThan(0)
      expect(a.description.length, a.slug).toBeGreaterThan(0)
      expect(a.blocks?.length ?? 0, a.slug).toBeGreaterThan(0)
    }
  })

  it('requires sources for current-year-sensitive content-bearing articles', () => {
    // Stubs are exempt (no content yet); enforce once an article has content.
    for (const a of LEARNING_ARTICLES.filter((x) => x.status !== 'stub' && x.currentYearSensitive)) {
      expect(a.sourceUrls.length, a.slug).toBeGreaterThan(0)
    }
  })

  it('ships at least one readable article so /learn/:slug is exercised', () => {
    expect(LEARNING_ARTICLES.some(isReadable)).toBe(true)
  })

  it('never embeds a literal :planId route pattern in article content', () => {
    // Inline links to "/plan/:planId/..." would route to a plan literally named
    // ":planId" and dead-end at "Plan not found". Plan-aware links belong in the
    // planner (via LearnLink), not baked into static article body content.
    for (const a of LEARNING_ARTICLES) {
      const content = JSON.stringify(a.blocks ?? [])
      expect(content.includes(':planId'), `${a.slug} embeds a :planId route pattern in its content`).toBe(false)
    }
  })

  it('only references chart ids that exist in the chart registry', () => {
    const knownCharts = new Set<string>(LEARN_CHART_IDS)
    for (const a of LEARNING_ARTICLES) {
      for (const block of a.blocks ?? []) {
        if (block.type === 'figure' && block.chartId) {
          expect(knownCharts.has(block.chartId), `${a.slug} -> unknown chart ${block.chartId}`).toBe(true)
        }
      }
    }
  })
})

describe('glossary', () => {
  it('has unique ids and definitions', () => {
    const ids = GLOSSARY_TERMS.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const t of GLOSSARY_TERMS) {
      expect(t.id, t.term).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
      expect(t.definition.length, t.term).toBeGreaterThan(0)
    }
  })
})

describe('searchArticles', () => {
  it('returns nothing for an empty query', () => {
    expect(searchArticles('   ')).toHaveLength(0)
  })

  it('matches title, description, and tags case-insensitively', () => {
    const hits = searchArticles('roth')
    expect(hits.some((a) => a.slug === 'roth-conversion-basics')).toBe(true)
  })
})

describe('inline markdown renderer', () => {
  it('renders bold, code, and external links', () => {
    const html = renderToString(<>{renderInline('A **bold** word, `code`, and a [link](https://example.com).')}</>)
    expect(html).toContain('<strong>bold</strong>')
    expect(html).toContain('<code>code</code>')
    expect(html).toContain('href="https://example.com"')
  })

  it('renders internal links via the router', () => {
    const html = renderToString(<MemoryRouter>{renderInline('Open the [planner](/).')}</MemoryRouter>)
    expect(html).toContain('href="/"')
  })
})

describe('Learning Center routes', () => {
  it('renders the home with featured topics and categories', async () => {
    const html = await renderAt('/learn')
    expect(html).toContain('Learning Center')
    expect(html).toContain('Featured topics')
    expect(html).toContain('Browse by category')
    expect(html).toContain('Start Here')
    expect(html).not.toContain('aria-label="Start here"')
  })

  it('exposes a Learn nav item', async () => {
    expect(await renderAt('/')).toContain('Learn')
  })

  it('renders the finished About article', async () => {
    const html = await renderAt('/learn/about-retiregolden')
    expect(html).toContain('About RetireGolden')
    expect(html).toContain('Quick takeaways')
    expect(html).toContain('Last reviewed')
  })

  it('renders the final batch Rule of 55 article', async () => {
    const html = await renderAt('/learn/rule-of-55-and-72t')
    expect(html).toContain('Rule of 55 and 72(t) basics')
    expect(html).toContain('Quick takeaways')
    expect(html).not.toContain('planned')
  })

  it('renders a not-found state for unknown slugs', async () => {
    expect(await renderAt('/learn/no-such-article')).toContain('Article not found')
  })

  it('renders the glossary', async () => {
    const html = await renderAt('/learn/glossary')
    expect(html).toContain('Glossary')
    expect(html).toContain('MAGI')
  })

  it('renders the sources page', async () => {
    const html = await renderAt('/learn/sources')
    expect(html).toContain('review methodology')
    expect(html).toContain('irs.gov')
  })

  it('renders the rich-block demo article (figure, formula, scenario, table)', async () => {
    const html = await renderAt('/learn/todays-dollars-vs-future-dollars')
    expect(html).toContain('dollars vs future dollars') // title (apostrophe is HTML-escaped)
    expect(html).toContain('Buying power of a fixed') // figure caption
    expect(html).toContain('= future dollars ÷ (1 + inflation)^years') // formula expression
    expect(html).toContain('The Rivera household') // scenario name
    expect(html).toContain('The same retirement, shown two ways.') // table caption
    expect(html).toContain('Last reviewed')
  })

  it('scrolls to the top when navigating between learning pages', async () => {
    const scrollTo = vi.fn()
    Object.defineProperty(window, 'scrollTo', { value: scrollTo, writable: true })
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    function LearnNavigationHarness() {
      const navigate = useNavigate()
      return (
        <>
          <button type="button" onClick={() => navigate('/learn/rule-of-55-and-72t')}>
            Next article
          </button>
          <Routes>
            <Route path="/learn/*" element={<LearnRoutes />} />
          </Routes>
        </>
      )
    }

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/learn/roth-conversion-basics']}>
          <LearnNavigationHarness />
        </MemoryRouter>,
      )
    })
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 0, left: 0, behavior: 'auto' })
    scrollTo.mockClear()

    const button = container.querySelector('button')
    if (!button) throw new Error('navigation button was not rendered')

    await act(async () => {
      button.click()
    })

    expect(scrollTo).toHaveBeenCalledTimes(1)
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 0, left: 0, behavior: 'auto' })

    await act(async () => {
      root.unmount()
    })
    document.body.removeChild(container)
  })
})

describe('planner learn-link wiring', () => {
  it('every LEARN hook targets a readable article (broken-slug guard)', () => {
    for (const hook of Object.values(LEARN)) {
      const article = getArticle(hook.slug)
      expect(article, hook.slug).toBeDefined()
      expect(article ? isReadable(article) : false, hook.slug).toBe(true)
    }
  })

  it('articlesForRoute only ever returns readable articles', () => {
    for (const route of KNOWN_PLANNER_ROUTES) {
      for (const article of articlesForRoute(route)) {
        expect(isReadable(article), `${route} -> ${article.slug}`).toBe(true)
      }
    }
  })

  it('lights up the doc-named screens that have ready content', () => {
    for (const route of [
      '/plan/:planId/social-security',
      '/plan/:planId/social-security-analysis',
      '/plan/:planId/results',
      '/plan/:planId/monte-carlo',
      '/plan/:planId/spending',
      '/plan/:planId/strategy',
      '/plan/:planId/insurance',
      '/plan/:planId/insights',
      '/plan/:planId/relocation',
      '/plan/:planId/optimize',
      '/plan/:planId/spending-solver',
    ]) {
      expect(articlesForRoute(route).length, route).toBeGreaterThan(0)
    }
  })
})

describe('article back link', () => {
  it('returns to the planner screen the reader came from', async () => {
    const html = await renderAt('/learn/roth-conversion-basics', {
      pathname: '/learn/roth-conversion-basics',
      state: { learnFrom: '/plan/abc/optimize', learnFromLabel: 'Roth & Tax Optimizer' },
    })
    expect(html).toContain('Back to Roth &amp; Tax Optimizer')
  })

  it('falls back to the Learning Center when there is no return path', async () => {
    expect(await renderAt('/learn/roth-conversion-basics')).toContain('← Learning Center')
  })
})
