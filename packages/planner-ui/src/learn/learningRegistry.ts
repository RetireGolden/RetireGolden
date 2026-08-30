/**
 * Learning Center registry (V9 PR1).
 *
 * Articles are authored as structured TypeScript so prose, visuals, and
 * metadata stay type-safe and bundle for offline use. This module owns the
 * article metadata model, the category set, the topic inventory, and small
 * selectors used by the Learning Center pages.
 *
 * Metadata and body are separate modules. Everything here — and every link,
 * card, search, and category surface built on it — reads only the metadata in
 * ./articleIndex, which is why the registry is light enough to sit on the
 * landing critical path. An article's `blocks[]` body is a per-article
 * dynamic import behind {@link getArticleBody}, fetched when its page renders.
 */

import { hasArticleBody, loadArticleBody } from './articleBodies'
import { ARTICLE_INDEX } from './articleIndex'

export type LearningCategoryId =
  | 'start-here'
  | 'using-retiregolden'
  | 'example-plans'
  | 'accounts-saving'
  | 'taxes'
  | 'social-security'
  | 'healthcare'
  | 'withdrawals-roth'
  | 'risk-uncertainty'
  | 'insurance-estate'
  | 'early-investing-fire'
  | 'assumptions'
  | 'glossary'

export type ArticleStatus = 'stub' | 'draft' | 'ready' | 'needs-review'
export type ReviewCadence = 'annual' | 'rule-change' | 'stable'
export type Audience = 'beginner' | 'intermediate'
export type Priority = 'P0' | 'P1' | 'P2'

/** One variable in a {@link FormulaBlockData}: the symbol and what it means. */
export type FormulaVariable = { symbol: string; meaning: string }

/** One labelled assumption row in a {@link ScenarioBlockData}. */
export type ScenarioAssumption = { label: string; value: string }

/** A teaching figure: a registered chart or an image, with a text equivalent. */
export type FigureBlockData = {
  type: 'figure'
  /** Key into the chart registry (learn/components/charts). */
  chartId?: string
  /** Static image alternative to a chart. */
  image?: { src: string }
  /** Short descriptive caption shown under the figure. */
  caption: string
  /** Text equivalent of the figure for screen readers and no-image fallback. */
  alt: string
  /** Optional note when the figure is based on rules, data, or an assumption. */
  sourceNote?: string
}

export type FormulaBlockData = {
  type: 'formula'
  /** The formula itself, e.g. "real = nominal ÷ (1 + inflation)^years". */
  expression: string
  /** Each symbol used in the expression and its plain-language meaning. */
  where?: FormulaVariable[]
  /** Whether dollars in the formula are nominal or in today's dollars. */
  basis?: 'nominal' | 'today'
  /** What the simple formula leaves out. */
  note?: string
}

export type ScenarioBlockData = {
  type: 'scenario'
  /** A short name for the example household, e.g. "The Reyes household". */
  name: string
  assumptions: ScenarioAssumption[]
  /** Optional plain-language wrap-up of what the scenario shows. */
  summary?: string
}

export type TableBlockData = {
  type: 'table'
  caption?: string
  /** Column headers; the first column is treated as a row header. */
  columns: string[]
  /** Rows of cells, aligned to `columns`. Cells support inline markdown. */
  rows: string[][]
}

/**
 * Content blocks for a `ready` article. Text blocks render plain; the richer
 * blocks (figure, formula, scenario, table) render through dedicated components
 * in learn/components.
 */
export type ArticleBlock =
  | { type: 'prose'; md: string }
  | { type: 'heading'; text: string; level?: 2 | 3 }
  | { type: 'list'; ordered?: boolean; items: string[] }
  | { type: 'callout'; tone?: 'note' | 'warn'; md: string }
  | FigureBlockData
  | FormulaBlockData
  | ScenarioBlockData
  | TableBlockData

export type LearningArticle = {
  slug: string
  title: string
  description: string
  category: LearningCategoryId
  tags: string[]
  audience: Audience
  status: ArticleStatus
  /** ISO date (YYYY-MM-DD) the content was last reviewed. */
  lastReviewed: string
  reviewCadence: ReviewCadence
  sourceUrls: string[]
  /** Slugs of related articles. */
  relatedArticles: string[]
  /** Planner route patterns this article relates to (see KNOWN_PLANNER_ROUTES). */
  relatedPlannerRoutes: string[]
  /** True when the article leans on current-year dollar figures or rules. */
  currentYearSensitive: boolean
  priority?: Priority
  /** Surfaced in the Learning Center home "Featured" strip. */
  featured?: boolean
  /**
   * @deprecated Bodies no longer travel with metadata: the registry never
   * populates this, so it is always `undefined` on an article from
   * {@link getArticle} or {@link LEARNING_ARTICLES}. Await
   * {@link getArticleBody} instead. Kept on the type so the published
   * `@retiregolden/planner-ui/learn/learningRegistry` surface stays
   * compatible, and so a caller that assembles its own article (tests,
   * previews) can still carry blocks inline.
   */
  blocks?: ArticleBlock[]
  /** When set, ArticleShell offers "Open this example in the planner". */
  exampleId?: string
}

/**
 * An article's metadata: everything but the body. What ./articleIndex holds,
 * and all any listing, link, card, or search surface needs.
 */
export type LearningArticleMeta = Omit<LearningArticle, 'blocks'>

export type LearningCategory = {
  id: LearningCategoryId
  label: string
  blurb: string
  /** Glossary is browsed via /learn/glossary rather than per-article pages. */
  isGlossary?: boolean
}

export const LEARNING_CATEGORIES: LearningCategory[] = [
  { id: 'start-here', label: 'Start Here', blurb: 'Basics, vocabulary, and how to read a retirement plan.' },
  { id: 'using-retiregolden', label: 'Using RetireGolden', blurb: 'Tool-specific workflows and screen explanations.' },
  {
    id: 'assumptions',
    label: 'Assumptions',
    blurb: 'The forward-looking defaults behind your plan (inflation, returns, longevity) and the sources for each.',
  },
  {
    id: 'example-plans',
    label: 'Example Plans',
    blurb: 'Worked example households you can open in the planner.',
  },
  {
    id: 'accounts-saving',
    label: 'Accounts and Saving',
    blurb: 'Account types, contributions, savings order, and employer match.',
  },
  { id: 'taxes', label: 'Taxes', blurb: 'Brackets, deductions, MAGI, capital gains, state tax, and cliffs.' },
  {
    id: 'social-security',
    label: 'Social Security',
    blurb: 'PIA, claiming age, spousal and survivor benefits, and break-even.',
  },
  { id: 'healthcare', label: 'Healthcare', blurb: 'ACA, Medicare, IRMAA, HSAs, and long-term-care costs.' },
  {
    id: 'withdrawals-roth',
    label: 'Withdrawals and Roth',
    blurb: 'Withdrawal order, Roth conversions, the optimizer, RMDs, and QCDs.',
  },
  {
    id: 'risk-uncertainty',
    label: 'Risk and Uncertainty',
    blurb: 'Monte Carlo, sequence risk, inflation, and longevity.',
  },
  {
    id: 'insurance-estate',
    label: 'Insurance and Estate',
    blurb: 'LTC insurance, permanent life, survivor planning, and heirs.',
  },
  {
    id: 'early-investing-fire',
    label: 'Early Investing & FIRE',
    blurb: 'Saving in your 20s–40s, savings rate, the FI number, and early-retirement strategies.',
  },
  { id: 'glossary', label: 'Glossary', blurb: 'Plain-language definitions of terms used across the app.', isGlossary: true },
]

/**
 * Planner route patterns an article may reference. Used by the registry-integrity
 * test so `relatedPlannerRoutes` cannot drift from real app routes.
 */
export const KNOWN_PLANNER_ROUTES = [
  '/',
  '/compare',
  '/import',
  '/plan/:planId/household',
  '/plan/:planId/social-security',
  '/plan/:planId/accounts',
  '/plan/:planId/insurance',
  '/plan/:planId/income',
  '/plan/:planId/income-floor',
  '/plan/:planId/spending',
  '/plan/:planId/strategy',
  '/plan/:planId/assumptions',
  '/plan/:planId/insights',
  '/plan/:planId/social-security-analysis',
  '/plan/:planId/survivor',
  '/plan/:planId/results',
  '/plan/:planId/monte-carlo',
  '/plan/:planId/scenarios',
  '/plan/:planId/relocation',
  '/plan/:planId/optimize',
  '/plan/:planId/spending-solver',
  '/plan/:planId/report',
] as const

/** Every article in registry order, metadata only. */
export const LEARNING_ARTICLES: LearningArticle[] = ARTICLE_INDEX

const ARTICLES_BY_SLUG = new Map(LEARNING_ARTICLES.map((a) => [a.slug, a]))

export function getArticle(slug: string): LearningArticle | undefined {
  return ARTICLES_BY_SLUG.get(slug)
}

/**
 * The article's content blocks, fetched on first use.
 *
 * Resolves to `undefined` for a slug with no body module, which is the same
 * "nothing to render" answer the old inline `blocks` gave as `undefined`.
 */
export function getArticleBody(slug: string): Promise<ArticleBlock[] | undefined> {
  return loadArticleBody(slug)
}

/**
 * An article is browsable as its own page only once it has real content.
 *
 * Content now means "has a body module", which is the metadata-only form of
 * the old `blocks?.length > 0` check. An article assembled by a caller with
 * inline blocks still counts, so the published behavior is unchanged.
 */
export function isReadable(article: LearningArticle): boolean {
  if (article.status !== 'ready') return false
  return (article.blocks?.length ?? 0) > 0 || hasArticleBody(article.slug)
}

export function getCategory(id: LearningCategoryId): LearningCategory | undefined {
  return LEARNING_CATEGORIES.find((c) => c.id === id)
}

export function articlesInCategory(id: LearningCategoryId): LearningArticle[] {
  return LEARNING_ARTICLES.filter((a) => a.category === id)
}

/**
 * Readable articles that relate to a planner route, for contextual "Learn about
 * this screen" links. Derived from each article's `relatedPlannerRoutes` so the
 * planner↔article wiring has a single source of truth and a screen's links
 * light up automatically as content lands. Stubs are excluded so a contextual
 * link never dead-ends on a "Planned article" placeholder.
 */
export function articlesForRoute(routePattern: string): LearningArticle[] {
  return LEARNING_ARTICLES.filter((a) => isReadable(a) && a.relatedPlannerRoutes.includes(routePattern))
}

/** Non-glossary categories paired with their article counts, for the home grid. */
export function categorySummaries(): Array<{ category: LearningCategory; count: number }> {
  return LEARNING_CATEGORIES.filter((c) => !c.isGlossary).map((category) => ({
    category,
    count: articlesInCategory(category.id).length,
  }))
}

export function featuredArticles(): LearningArticle[] {
  return LEARNING_ARTICLES.filter((a) => a.featured)
}

/** Readable articles, most recently reviewed first. */
export function recentlyReviewed(limit = 5): LearningArticle[] {
  return LEARNING_ARTICLES.filter(isReadable)
    .slice()
    .sort((a, b) => b.lastReviewed.localeCompare(a.lastReviewed))
    .slice(0, limit)
}

const PRIORITY_ORDER: Record<Priority, number> = { P0: 0, P1: 1, P2: 2 }

/** Sort for listing: readable first, then by priority, then alphabetically. */
export function byListingOrder(a: LearningArticle, b: LearningArticle): number {
  const ra = isReadable(a) ? 0 : 1
  const rb = isReadable(b) ? 0 : 1
  if (ra !== rb) return ra - rb
  const pa = a.priority ? PRIORITY_ORDER[a.priority] : 3
  const pb = b.priority ? PRIORITY_ORDER[b.priority] : 3
  if (pa !== pb) return pa - pb
  return a.title.localeCompare(b.title)
}

/** Case-insensitive search across title, description, and tags. */
export function searchArticles(query: string): LearningArticle[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  return LEARNING_ARTICLES.filter((a) => {
    const haystack = [a.title, a.description, ...a.tags].join(' ').toLowerCase()
    return haystack.includes(q)
  }).sort(byListingOrder)
}
