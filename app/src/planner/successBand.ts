/**
 * Display-only tone banding for the Monte Carlo success rate (UI/UX round 2,
 * Step 3). Red is reserved for genuinely failing plans so a high-60s/70s plan no
 * longer reads as failure; the number and every computed metric are untouched.
 * Bands agree with the "Understanding Monte Carlo success rate" Learning Center
 * article.
 */
export function successBand(rate: number): { color: string; severity: string; verdict: string } {
  const pct = rate * 100
  if (pct >= 90) return { color: 'var(--good)', severity: 'on track', verdict: 'On track in nearly all markets.' }
  if (pct >= 75)
    return {
      color: 'var(--good)',
      severity: 'on track in most markets',
      verdict: 'On track in most markets — some sequence risk remains.',
    }
  if (pct >= 60)
    return { color: 'var(--warn)', severity: 'needs attention', verdict: 'Workable, but sequence risk is real here.' }
  return { color: 'var(--bad)', severity: 'at risk', verdict: 'This plan depletes in many markets.' }
}
