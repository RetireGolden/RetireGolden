/** Number formatting for the planner. All engine amounts are nominal dollars. */

const money0 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const money2 = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})
const grouped = new Intl.NumberFormat('en-US')

export function fmtMoney(v: number): string {
  if (!Number.isFinite(v)) return '—'
  return money0.format(v)
}

/**
 * Exact-cent money, for the two places whole dollars would lie: a
 * reconciliation remainder (rounding a real 1-cent gap to $0 says the ledger
 * balanced when it did not) and a money field the household types cents into.
 */
export function fmtMoneyCents(v: number): string {
  if (!Number.isFinite(v)) return '—'
  return money2.format(v)
}

/**
 * Exact-cent money from an integer minor-unit amount, formatted through
 * BigInt so a cent count past `Number.MAX_SAFE_INTEGER` still renders its own
 * digits rather than a float's nearest neighbour. The minus is the U+2212 the
 * compact formatter writes, so a copied figure parses back (`parseAmount`).
 */
export function fmtMoneyFromCents(cents: number | bigint): string {
  const minorUnits = BigInt(cents)
  const negative = minorUnits < 0n
  const absolute = negative ? -minorUnits : minorUnits
  return `${negative ? '−' : ''}$${(absolute / 100n).toLocaleString('en-US')}.${(absolute % 100n).toString().padStart(2, '0')}`
}

/**
 * A grouped number with no currency symbol, pinned to `en-US`.
 *
 * The locale is the point: a bare `toLocaleString()` lets the host's ICU
 * default decide, so `96,000` becomes `96.000` on a German runtime and the
 * scenario name a plan stores depends on which machine created it.
 */
export function fmtNumber(v: number): string {
  if (!Number.isFinite(v)) return '—'
  return grouped.format(v)
}

/** Magnitude suffixes past a million, smallest first so a mantissa that rounds to 1000 moves up a tier. */
const COMPACT_TIERS = [
  [1e6, 'M'],
  [1e9, 'B'],
  [1e12, 'T'],
] as const

/**
 * The last readable rung. Once the T mantissa would round to 1000 there is no
 * unit left to name the magnitude, so the reader gets an open-ended bound
 * ("$999T+", "−$999T+") rather than a raw JS exponent. It is a display
 * ceiling on the *label*, not a bound on the value: nothing is clamped, the
 * engine still computes and stores what it computed, and what a plan is
 * allowed to contain stays the schema's decision.
 */
const COMPACT_CEILING = '999T+'

/**
 * Compact KPI form: $1.24M, $310k, −$82k, and past a billion $2.50B / $1.20T,
 * so an absurd balance never renders a six-digit mantissa in millions or a
 * raw JS exponent with a unit behind it (#495, #548). A mantissa never reaches
 * four digits: $999k hands off to $1.00M, and once the T mantissa would round
 * to 1000 the value degrades to the `$999T+` ceiling (#572) — "more than I can
 * name" is honest and short, where `$1.18e+37` is neither readable by this
 * audience nor bounded in width.
 */
export function fmtMoneyCompact(v: number): string {
  if (!Number.isFinite(v)) return '—'
  const sign = v < 0 ? '−' : ''
  const a = Math.abs(v)
  // 999,500 is where the k tier would round to 1000k.
  if (a >= 999_500) {
    for (const [scale, suffix] of COMPACT_TIERS) {
      const mantissa = Math.round((a / scale) * 100) / 100
      if (mantissa < 1000) return `${sign}$${mantissa.toFixed(2)}${suffix}`
    }
    return `${sign}$${COMPACT_CEILING}`
  }
  if (a >= 10_000) return `${sign}$${Math.round(a / 1000)}k`
  return `${sign}$${Math.round(a).toLocaleString('en-US')}`
}

export function fmtPct(v: number, digits = 0): string {
  if (!Number.isFinite(v)) return '—'
  return `${(v * 100).toFixed(digits)}%`
}

/**
 * Magnitude suffixes a typed amount may carry: every one `fmtMoneyCompact`
 * emits as a *number*, so a copied KPI parses back.
 *
 * The `$999T+` ceiling is deliberately NOT among them and must not be added.
 * It names a range, not a value; teaching this table to read it would turn a
 * display ceiling into a silently wrong balance the first time someone pastes
 * a KPI into a money field (#572). `Number('999t+')` is NaN, so it already
 * returns null — the cluster F pin holds that.
 */
const AMOUNT_SUFFIX: Record<string, number> = { k: 1e3, m: 1e6, b: 1e9, t: 1e12 }

/** Parses a user-typed money/number string ("1,200,000", "$45k", "−$2.5B") to a number, or null. */
export function parseAmount(text: string): number | null {
  // A pasted KPI carries the minus the formatter wrote (−, not a hyphen), so
  // a copied −$370.26T parses back the way a typed one does.
  const cleaned = text.trim().replace(/[$,\s]/g, '').replace(/−/g, '-').toLowerCase()
  if (cleaned === '') return null
  const mult = AMOUNT_SUFFIX[cleaned.slice(-1)] ?? 1
  const core = mult === 1 ? cleaned : cleaned.slice(0, -1)
  // A suffix with no number in front of it ("k") is not an amount: `Number('')`
  // is 0, which would read a stray keystroke as a balance of zero.
  if (core === '') return null
  const n = Number(core)
  return Number.isFinite(n) ? n * mult : null
}
