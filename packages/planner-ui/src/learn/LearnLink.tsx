/**
 * LearnLink (V9 PR3) — the single, consistent way the planner links out to the
 * Learning Center.
 *
 * Every contextual "Learn more" in the app should go through this component so
 * links behave the same everywhere: the slug is validated against the registry,
 * an optional in-article anchor is supported, the look is consistent per
 * variant, and the originating planner path is preserved so the article's back
 * link can return the reader to the screen they came from instead of the
 * Learning Center home.
 *
 * The slug is intentionally typed `string`: most call sites pass a hook from
 * `planner/learnLinks.ts` (validated by a broken-slug test) or a registry slug
 * (validated by the registry-integrity tests). An unknown slug renders nothing
 * and logs in dev rather than producing a dead link.
 */

import { Link, useLocation } from 'react-router-dom'
import { getArticle } from './learningRegistry'

export type LearnHook = {
  /** Article slug in the Learning Center registry. */
  slug: string
  /** Link text. Defaults to "Learn more". */
  label?: string
  /** Optional anchor (without `#`) to jump to within the article. */
  anchor?: string
}

type LearnLinkProps = LearnHook & {
  /**
   * - `inline`: a quiet inline link (default), e.g. inside a screen cluster.
   * - `tip`: sized and spaced to sit at the bottom of a help bubble.
   * - `button`: a compact pill for page headers/callouts.
   */
  variant?: 'inline' | 'tip' | 'button'
  className?: string
}

/** Title-case a single planner route segment into a human label for the back link. */
const SEGMENT_LABELS: Record<string, string> = {
  household: 'Household',
  'social-security': 'Social Security',
  accounts: 'Accounts',
  insurance: 'Insurance',
  income: 'Income',
  spending: 'Spending',
  strategy: 'Strategy',
  assumptions: 'Assumptions',
  'assumptions-card': 'Your assumptions',
  insights: 'Insights',
  'social-security-analysis': 'Social Security Optimizer',
  results: 'Results',
  'monte-carlo': 'Monte Carlo',
  scenarios: 'Scenarios',
  survivor: 'Survivor transition',
  optimize: 'Roth & Tax Optimizer',
  report: 'Report',
}

/** A short, human label for where a return path points (planner screen name). */
function originLabel(pathname: string): string | undefined {
  const segment = pathname.match(/\/plan\/[^/]+\/([^/]+)/)?.[1]
  return segment ? SEGMENT_LABELS[segment] : undefined
}

export function LearnLink({ slug, label = 'Learn more', anchor, variant = 'inline', className }: LearnLinkProps) {
  const location = useLocation()
  const article = getArticle(slug)
  if (!article) {
    if (import.meta.env.DEV) console.error(`LearnLink: unknown article slug "${slug}"`)
    return null
  }

  const to = anchor ? `/learn/${slug}#${anchor}` : `/learn/${slug}`
  // Preserve an internal-only return path so the article can offer "← Back to …".
  const from = location.pathname + location.search
  const safeFrom = from.startsWith('/') && !from.startsWith('//') ? from : undefined
  const classes = ['learn-link', `learn-link--${variant}`, className].filter(Boolean).join(' ')

  return (
    <Link
      to={to}
      className={classes}
      state={safeFrom ? { learnFrom: safeFrom, learnFromLabel: originLabel(location.pathname) } : undefined}
    >
      {label}
      <span aria-hidden="true"> →</span>
    </Link>
  )
}
