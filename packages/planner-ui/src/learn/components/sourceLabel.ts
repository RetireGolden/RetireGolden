/**
 * A short, readable label for a source URL, in place of the bare URL (#418):
 * the host without `www.` plus the path, or, when the path is long, the host
 * and the last path segment. The full URL stays on the link's `href` and
 * `title`.
 *
 *   https://www.irs.gov/retirement-plans/roth-iras
 *     → irs.gov/retirement-plans/roth-iras
 *   https://www.irs.gov/retirement-plans/plan-participant-employee/rollovers-…
 *     → irs.gov/…/rollovers-of-retirement-plan-and-ira-distributions
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
  if (!path) return host
  if (path.length <= 40) return `${host}${path}`
  const last = path.split('/').filter(Boolean).pop()!
  return `${host}/…/${last}`
}
