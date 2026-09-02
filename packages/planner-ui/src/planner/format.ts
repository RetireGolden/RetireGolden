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
 * Compact KPI form: $1.24M, $310k, −$8.2k, and past a billion $2.50B / $1.20T,
 * so an absurd balance never renders a six-digit mantissa in millions or a
 * raw JS exponent with a unit behind it (#495, #548). Past 999T there is no
 * readable unit; the value is shown as a bare exponent ($1.18e+37) so it
 * stays short instead of overflowing the cell.
 */
export function fmtMoneyCompact(v: number): string {
  if (!Number.isFinite(v)) return '—'
  const sign = v < 0 ? '−' : ''
  const a = Math.abs(v)
  if (a >= 1e15) return `${sign}$${a.toExponential(2)}`
  if (a >= 1e6) {
    for (const [scale, suffix] of COMPACT_TIERS) {
      const mantissa = Math.round((a / scale) * 100) / 100
      if (mantissa < 1000 || suffix === 'T') return `${sign}$${mantissa.toFixed(2)}${suffix}`
    }
  }
  if (a >= 10_000) return `${sign}$${Math.round(a / 1000)}k`
  return `${sign}$${Math.round(a).toLocaleString('en-US')}`
}

export function fmtPct(v: number, digits = 0): string {
  if (!Number.isFinite(v)) return '—'
  return `${(v * 100).toFixed(digits)}%`
}

/** Parses a user-typed money/number string ("1,200,000", "$45k") to a number, or null. */
export function parseAmount(text: string): number | null {
  const cleaned = text.trim().replace(/[$,\s]/g, '').toLowerCase()
  if (cleaned === '') return null
  const mult = cleaned.endsWith('m') ? 1e6 : cleaned.endsWith('k') ? 1e3 : 1
  const core = mult === 1 ? cleaned : cleaned.slice(0, -1)
  const n = Number(core)
  return Number.isFinite(n) ? n * mult : null
}
