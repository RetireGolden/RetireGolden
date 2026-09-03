import { describe, expect, it } from 'vitest'
import learnRoutesSource from '@retiregolden/planner-ui/routes/LearnRoutes.tsx?raw'
import { plannerContentRoutes, plannerHomeRoutes } from '@retiregolden/planner-ui/routes/groups'

import { STATIC_ROUTES } from './sitemapRoutes.mjs'

/**
 * The sitemap's static list is hand-maintained (the planner's route table is
 * `RouteObject`s and JSX `<Route>`s, not a flat manifest), so `/how-tested`
 * shipped in #520-era work and stayed out of the sitemap for months. These
 * tests make the omission fail the suite instead: every public route the
 * planner mounts is either advertised or listed below with its reason.
 */

/** Routes deliberately absent from the sitemap, each with why. */
const NOT_CRAWLABLE = {
  import: 'wizard that acts on a local file the visitor picks; nothing to index',
  sources: 'alias that redirects to /learn/sources, which is listed',
  legacy: 'redirect to /, retired v1 route',
  longevity: 'redirect to /, retired v1 route',
  'social-security': 'redirect to /, retired v1 route',
}

/** `undefined` path = the index route; `learn/*` advertises its base URL. */
const urlOf = (path) => (path === undefined ? '/' : `/${path.replace(/\/\*$/, '')}`)

describe('sitemap static routes', () => {
  it('covers every public route in the home and content groups', () => {
    // The workspace group (/plan/:id/*, /compare) is excluded wholesale: those
    // pages render from the visitor's own IndexedDB, so there is no shared URL.
    const routes = [...plannerHomeRoutes, ...plannerContentRoutes]
    const missing = routes
      .filter((route) => route.path === undefined || !(route.path in NOT_CRAWLABLE))
      .map((route) => urlOf(route.path))
      .filter((url) => !STATIC_ROUTES.includes(url))
    expect(missing).toEqual([])
  })

  it('advertises the Learning Center pages that have fixed paths', () => {
    // ArticlePage's `:slug` is parameterized — generate-sitemap.mjs expands it
    // from learningRegistry.ts instead.
    const fixed = [...learnRoutesSource.matchAll(/path="([^"]+)"/g)]
      .map((m) => m[1])
      .filter((path) => !path.startsWith(':'))
    expect(fixed.length).toBeGreaterThan(0)
    for (const path of fixed) expect(STATIC_ROUTES).toContain(`/learn/${path}`)
  })

  it('lists no URL twice and no URL the planner does not mount', () => {
    expect(new Set(STATIC_ROUTES).size).toBe(STATIC_ROUTES.length)
    const mounted = new Set([
      ...[...plannerHomeRoutes, ...plannerContentRoutes].map((route) => urlOf(route.path)),
      ...[...learnRoutesSource.matchAll(/path="([^"]+)"/g)].map((m) => `/learn/${m[1]}`),
    ])
    expect(STATIC_ROUTES.filter((url) => !mounted.has(url))).toEqual([])
  })
})
