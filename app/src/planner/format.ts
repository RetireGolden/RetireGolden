/** Number formatting for the planner. All engine amounts are nominal dollars. */

const money0 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

export function fmtMoney(v: number): string {
  if (!Number.isFinite(v)) return '—'
  return money0.format(v)
}

/** Compact KPI form: $1.24M, $310k, −$8.2k. */
export function fmtMoneyCompact(v: number): string {
  if (!Number.isFinite(v)) return '—'
  const sign = v < 0 ? '−' : ''
  const a = Math.abs(v)
  if (a >= 1e6) return `${sign}$${(a / 1e6).toFixed(2)}M`
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
