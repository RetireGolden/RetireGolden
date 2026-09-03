/**
 * The engine's shared number-to-string formatters for published prose:
 * `InsightCard.evidence[].value`, detector rationales, decision explanations,
 * and projection warnings.
 *
 * Every one of them pins the locale. `Number.prototype.toLocaleString()` with
 * no locale argument resolves the host ICU default, so the same plan would
 * publish `$1,234` on a US runtime and `$1.234` (or `1 234`) elsewhere. That
 * breaks the determinism invariant in `DOCS/standards.md` and the README's
 * "same plan + same options => bit-identical results" promise, because these
 * strings are part of the published card contract rather than a UI-side
 * rendering choice. A `no-restricted-syntax` rule in
 * `packages/engine/eslint.config.js` bans the zero-argument form in `src/**`
 * so a new call site cannot reintroduce the host dependence.
 *
 * This module deliberately imports nothing: it is a leaf that any layer may
 * use without creating a cycle.
 */

/** The one locale every engine-published number is formatted in. */
const EVIDENCE_LOCALE = 'en-US'

/**
 * Format a published dollar amount for evidence. Integral amounts stay whole
 * dollars; any non-integral amount keeps exact cents (e.g. $1.49, not $1).
 */
export function formatEvidenceUsd(amount: number): string {
  const cents = Math.round(amount * 100)
  if (cents % 100 === 0) {
    return `$${(cents / 100).toLocaleString(EVIDENCE_LOCALE)}`
  }
  return `$${(cents / 100).toLocaleString(EVIDENCE_LOCALE, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

/**
 * Format a dollar amount rounded to whole dollars, grouped and `$`-prefixed
 * (e.g. `$1,234`). The rounding is the caller-visible contract: cents are
 * dropped, so use `formatEvidenceUsd` where sub-dollar precision is decisive.
 */
export function formatWholeUsd(amount: number): string {
  return `$${Math.round(amount).toLocaleString(EVIDENCE_LOCALE)}`
}

/**
 * Group-separate a number with no currency symbol and no rounding of its own —
 * for call sites that have already chosen a rounding (`Math.ceil` for an
 * "amount over threshold", an integral step size) or that print a bare count.
 */
export function formatGroupedNumber(value: number): string {
  return value.toLocaleString(EVIDENCE_LOCALE)
}

/**
 * Format a percentage already expressed in percent units (7.5 => `7.5%`).
 * `toFixed` is locale-independent, so this is a naming/duplication helper
 * rather than a locale fix; it keeps the one-decimal evidence convention in
 * one place.
 */
export function formatEvidencePercent(pct: number, fractionDigits = 1): string {
  return `${pct.toFixed(fractionDigits)}%`
}

/**
 * Format a whole-months age as English prose (`67 years 2 months`), with the
 * singular forms spelled out. Used where a claim age carries months.
 */
export function formatEvidenceAge(totalMonths: number): string {
  const years = Math.floor(totalMonths / 12)
  const months = totalMonths % 12
  const yearLabel = years === 1 ? '1 year' : `${years} years`
  const monthLabel = months === 1 ? '1 month' : `${months} months`
  return `${yearLabel} ${monthLabel}`
}
