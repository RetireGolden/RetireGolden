/**
 * A short, readable label for a source URL, in place of the bare URL (#418):
 * the host without `www.` plus the path (and query string, so parameterized
 * citations stay distinguishable), or, when that is long, the host and the
 * last path segment plus the query. The full URL stays on the link's `href`
 * and `title`.
 *
 *   https://www.irs.gov/retirement-plans/roth-iras
 *     → irs.gov/retirement-plans/roth-iras
 *   https://www.irs.gov/retirement-plans/plan-participant-employee/rollovers-…
 *     → irs.gov/…/rollovers-of-retirement-plan-and-ira-distributions
 *   https://www.ssa.gov/oact/cola/Benefits.html?year=2026
 *     → ssa.gov/oact/cola/Benefits.html?year=2026
 */
export function sourceLabel(url: string): string {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return url
  }
  const host = parsed.hostname.replace(/^www\./, '')
  const path = parsed.pathname.replace(/\/+$/, '')
  const query = parsed.search
  if (!path) return `${host}${query}`
  if (path.length <= 40) return `${host}${path}${query}`
  const last = path.split('/').filter(Boolean).pop()!
  return `${host}/…/${last}${query}`
}
