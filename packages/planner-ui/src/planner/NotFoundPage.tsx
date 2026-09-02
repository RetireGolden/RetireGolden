/**
 * Not-found chrome (#442, #464): the same card family as the plan-load error
 * card, so an unmatched URL never leaves the main region blank. Two shapes:
 * the site-level page for an unknown route, and the workspace variant that
 * renders inside the plan shell for an unknown section segment (the rail,
 * KPI bar, and breadcrumb stay up, and the way back is the plan's first
 * section rather than the site home).
 */

import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'

import { useImportAvailability } from '../import/importAvailability'
import { routeTitleOf } from '../routeTitles'
import { usePlannerEdition } from './editionContext'
import { loadLearningRegistry } from './learnRegistryLoader'

export function NotFoundPage() {
  const { homeLabel } = usePlannerEdition()
  return (
    <div className="page">
      <div className="card empty-state">
        {/* The site-level page owns its document, so its heading is the h1;
            the workspace variant below sits under the plan's h1. */}
        <h1>Page not found</h1>
        <p className="muted">
          There is nothing at this address. It may be an old bookmark, a mistyped link, or a page that has moved.
        </p>
        <div className="picker-actions">
          <Link to="/" className="btn btn-primary">
            {homeLabel}
          </Link>
          <Link to="/examples" className="btn btn-secondary">
            Browse examples
          </Link>
          <Link to="/learn" className="btn btn-secondary">
            Learning Center
          </Link>
        </div>
      </div>
    </div>
  )
}

/**
 * Site-level pages a plan URL is likely to be guessed for (#536): the rail's
 * "Compare plans" sits among the plan links, so `/plan/:id/compare` is a
 * natural miss, and `/plan/:id/import` the same for the import wizard.
 * Every escape lands on a mounted route, never on a path that renders
 * nothing: Compare, Import, and Examples are single pages, so anything after
 * their segment is dropped (`/plan/:id/compare/foo` escapes to `/compare`);
 * Learn mounts exactly one segment under it (`glossary`, `sources`, or an
 * article slug — routes/LearnRoutes.tsx), so that segment is kept and any
 * further ones are dropped (`/plan/:id/learn/glossary/foo` escapes to
 * `/learn/glossary`); and `/sources`, which the site redirects, escapes to
 * where it lands. The label is the destination's own tab title from the
 * shared table, or, for an article, the article's title from the index.
 */
const SITE_LEVEL_SINGLE_PAGES: ReadonlySet<string> = new Set(['compare', 'import', 'examples'])
const SITE_LEVEL_ESCAPE_ALIASES: Readonly<Record<string, string>> = { '/sources': '/learn/sources' }

type Escape = { to: string; label: string }

/**
 * The site-level path a plan-scoped splat was reaching for, or null when it
 * names no such page. An article escape carries the slug so the caller can
 * resolve its title (and its existence) from the registry.
 */
function siteLevelEscapeOf(splat: string | undefined): (Escape & { articleSlug?: string }) | null {
  const parts = (splat ?? '').split('/').filter(Boolean)
  const path = `/${parts.join('/')}`
  const root = parts[0]
  if (root === undefined) return null
  if (SITE_LEVEL_ESCAPE_ALIASES[path]) {
    const to = SITE_LEVEL_ESCAPE_ALIASES[path]
    return { to, label: routeTitleOf(to) ?? to.slice(1) }
  }
  if (SITE_LEVEL_SINGLE_PAGES.has(root)) return { to: `/${root}`, label: routeTitleOf(`/${root}`) ?? root }
  if (root !== 'learn') return null
  const sub = parts[1]
  if (sub === undefined) return { to: '/learn', label: routeTitleOf('/learn') ?? 'Learning Center' }
  if (sub === 'glossary' || sub === 'sources') return { to: `/learn/${sub}`, label: routeTitleOf(`/learn/${sub}`) ?? sub }
  return { to: `/learn/${sub}`, label: routeTitleOf('/learn') ?? 'Learning Center', articleSlug: sub }
}

/**
 * The escape with an article slug resolved against the Learning Center
 * index: the article's own title when it exists, the landing page when it
 * does not, and the landing page again when the index cannot be loaded at
 * all (a chunk that fails offline or after a deploy replaced it), so the
 * card never stays busy for good. The registry stays out of this chunk (as
 * it does for the tab title in App.tsx), so the answer arrives
 * asynchronously; undefined while it is pending.
 */
function useResolvedEscape(candidate: (Escape & { articleSlug?: string }) | null): Escape | null | undefined {
  const slug = candidate?.articleSlug
  const [resolved, setResolved] = useState<{ slug: string; escape: Escape } | null>(null)
  useEffect(() => {
    if (slug === undefined) return
    let cancelled = false
    const landing: Escape = { to: '/learn', label: routeTitleOf('/learn') ?? 'Learning Center' }
    loadLearningRegistry().then(
      (m) => {
        if (cancelled) return
        const article = m.getArticle(slug)
        setResolved({ slug, escape: article ? { to: `/learn/${slug}`, label: article.title } : landing })
      },
      () => {
        // The index did not load: the landing page is a mounted route the
        // reader can still reach, and it beats a card that never settles.
        if (!cancelled) setResolved({ slug, escape: landing })
      },
    )
    return () => {
      cancelled = true
    }
  }, [slug])
  if (candidate === null) return null
  if (slug === undefined) return { to: candidate.to, label: candidate.label }
  return resolved?.slug === slug ? resolved.escape : undefined
}

export function WorkspaceNotFound() {
  const { planId, '*': splat } = useParams()
  const importAvailability = useImportAvailability()
  // The import wizard is a host capability: once the host has said it is
  // switched off, the plain copy applies instead of a primary action into an
  // unavailable page. While the host is still resolving the switch (every
  // cold load on the web host) the escape is offered: import is on in the
  // normal case, and a card that repaints from generic to import-specific on
  // every first hit is the worse outcome. Whether a host mounts a route at
  // all is not knowable from here; the same is true of every /import and
  // /learn link in the package (routes/groups.tsx states the contract: a
  // host mounts or redirects those paths), and a host without a route
  // answers with its own not-found.
  const importWithheld = importAvailability.resolved && !importAvailability.enabled
  const resolved = useResolvedEscape(siteLevelEscapeOf(splat))
  // An article escape whose title is still loading: the heading and the
  // plan links stay (a hung chunk must never leave the card without a way
  // back), the copy is neutral, and no button is primary until the escape
  // can be named, so nothing is painted that the resolved card contradicts.
  const pending = resolved === undefined
  const escape = !pending && resolved && (!resolved.to.startsWith('/import') || !importWithheld) ? resolved : undefined
  return (
    <div className="card empty-state" aria-busy={pending ? true : undefined}>
      <h2>This plan has no such section</h2>
      {pending ? (
        <p className="muted">Finding the page this address was reaching for…</p>
      ) : escape ? (
        <p className="muted">
          {escape.label} is not a section of this plan; it has its own page outside the plan workspace.
        </p>
      ) : (
        <p className="muted">
          The address names a section that is not part of the planner. Every section is listed in the rail; Household
          is the first.
        </p>
      )}
      <div className="picker-actions">
        {escape ? (
          <Link to={escape.to} className="btn btn-primary">
            Go to {escape.label}
          </Link>
        ) : null}
        <Link to={`/plan/${planId}/household`} className={escape || pending ? 'btn btn-secondary' : 'btn btn-primary'}>
          Go to Household
        </Link>
        <Link to={`/plan/${planId}/results`} className="btn btn-secondary">
          Go to Results
        </Link>
      </div>
    </div>
  )
}
