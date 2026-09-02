/** Number formatting for the planner. All engine amounts are nominal dollars. */

const money0 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

export function fmtMoney(v: number): string {
  if (!Number.isFinite(v)) return '—'
  return money0.format(v)
}

/** Magnitude suffixes past a million, smallest first so a mantissa that rounds to 1000 moves up a tier. */
const COMPACT_TIERS = [
  [1e6, 'M'],
  [1e9, 'B'],
  [1e12, 'T'],
] as const

/**
 * Compact KPI form: $1.24M, $310k, −$82k, and past a billion $2.50B / $1.20T,
 * so an absurd balance never renders a six-digit mantissa in millions or a
 * raw JS exponent with a unit behind it (#495, #548). A mantissa never reaches
 * four digits: $999k hands off to $1.00M, and once the T mantissa would round
 * to 1000 there is no readable unit left, so the value is a bare exponent
 * ($1.00e+15, $1.18e+37) that stays short instead of overflowing the cell.
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
    return `${sign}$${a.toExponential(2)}`
  }
  if (a >= 10_000) return `${sign}$${Math.round(a / 1000)}k`
  return `${sign}$${Math.round(a).toLocaleString('en-US')}`
}

export function fmtPct(v: number, digits = 0): string {
  if (!Number.isFinite(v)) return '—'
  return `${(v * 100).toFixed(digits)}%`
}

/** Magnitude suffixes a typed amount may carry: every one `fmtMoneyCompact` emits, so a copied KPI parses back. */
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
