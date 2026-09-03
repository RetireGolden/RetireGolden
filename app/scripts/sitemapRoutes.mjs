/**
 * The crawlable top-level routes the sitemap advertises, kept in their own
 * module so a test can read them without executing the generator (which spins
 * up a Vite SSR server at import time).
 *
 * Learn article URLs are not listed here — generate-sitemap.mjs appends one
 * `/learn/<slug>` per entry in learningRegistry.ts. Per-user app views
 * (`/plan/:id/*`, `/compare`, `/import`) are deliberately absent: they render
 * only from local IndexedDB state, so there is nothing for a crawler to fetch.
 *
 * scripts/sitemapRoutes.test.mjs pins this list against the planner's exported
 * route groups, so a new public content route fails the app test suite until
 * it is either listed here or named in that test's exclusion list.
 */
export const STATIC_ROUTES = [
  '/',
  '/examples',
  '/disclaimer',
  '/how-tested',
  '/learn',
  '/learn/glossary',
  '/learn/sources',
]
