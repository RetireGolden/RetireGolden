/**
 * FedInvest TIPS price data — the pure half (CSV parsing, price-date math,
 * rung matching). See social-security-bridge-and-tips-ladder, step 5.
 *
 * The engine performs no IO: the actual fetch against the FedInvest service
 * and the per-day localStorage cache live in the consuming app (the web
 * app's `src/data/fedInvestClient.ts`), which hands CSV text to
 * {@link parseFedInvestCsv} and assembles {@link FedInvestSnapshot} values.
 * The embedded real-yield curve always remains the planning source of truth
 * — FedInvest prices are an opt-in, user-triggered reference only.
 *
 * Data: FedInvest publishes end-of-day prices per $100 face for every
 * marketable Treasury, including TIPS, keyed by CUSIP (CSV columns: cusip,
 * security type, rate as a decimal fraction, maturity date, call date, buy,
 * sell, end-of-day). We surface the TIPS rows as a reference against the
 * embedded-curve quote. (Planning note: TIPS trade with a separate inflation
 * index ratio FedInvest does not include, so these prices sanity-check the
 * quote rather than replace it.)
 */

export interface FedInvestTips {
  cusip: string
  /** Coupon rate, percent. */
  ratePct: number
  /** Maturity date, ISO YYYY-MM-DD. */
  maturityIso: string
  /** End-of-day price per $100 face. */
  endOfDayPrice: number
}

export interface FedInvestSnapshot {
  /**
   * Price date the quotes are for (ISO). null for imported files: the
   * FedInvest CSV does not carry its own date, so we never guess one — the
   * prices are "as of whenever the user downloaded the file".
   */
  priceDateIso: string | null
  /** When the fetch/import happened (ISO timestamp). */
  fetchedAtIso: string
  /** 'fetch' = direct FedInvest request; 'import' = user-supplied CSV file. */
  source: 'fetch' | 'import'
  tips: FedInvestTips[]
}

export const FEDINVEST_PAGE_URL = 'https://www.treasurydirect.gov/GA-FI/FedInvest/selectSecurityPriceDate'
export const FEDINVEST_CSV_URL = 'https://www.treasurydirect.gov/GA-FI/FedInvest/securityPriceDetail'

/** Most recent likely-published business day (prices publish evenings, US). */
export function latestPriceDate(now = new Date()): Date {
  const d = new Date(now)
  d.setDate(d.getDate() - 1) // yesterday: today's prices aren't out yet
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() - 1)
  return d
}

/**
 * Local calendar date as YYYY-MM-DD. The business-day walk and the FedInvest
 * form body both use LOCAL date components, so the snapshot/cache key must
 * too — `toISOString()` is UTC and disagrees near timezone boundaries.
 */
function localIsoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Same as {@link latestPriceDate}, as the ISO string used by snapshots and staleness checks. */
export function latestPriceDateIso(now = new Date()): string {
  return localIsoDate(latestPriceDate(now))
}

/**
 * Parse the FedInvest `securityprice.csv` payload: one row per security,
 * `cusip,type,rate,maturity(MM/DD/YYYY),call,buy,sell,endOfDay`, no header.
 * Rates arrive as decimal fractions (0.00125 = 0.125%).
 */
export function parseFedInvestCsv(text: string): FedInvestTips[] {
  const tips: FedInvestTips[] = []
  for (const line of text.split(/\r?\n/)) {
    const cells = line.split(',').map((c) => c.trim().replace(/^"|"$/g, ''))
    if (cells.length < 8) continue
    const [cusip, type, rate, maturity, , , , endOfDay] = cells
    if (!cusip || type !== 'TIPS') continue
    const rateFraction = Number(rate)
    const endOfDayPrice = Number(endOfDay)
    const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(maturity ?? '')
    if (!m || !Number.isFinite(rateFraction) || !Number.isFinite(endOfDayPrice) || endOfDayPrice <= 0) continue
    tips.push({ cusip, ratePct: rateFraction * 100, maturityIso: `${m[3]}-${m[1]}-${m[2]}`, endOfDayPrice })
  }
  return tips.sort((a, b) => a.maturityIso.localeCompare(b.maturityIso))
}

/** The TIPS whose maturity falls nearest a target calendar year (for rung reference rows). */
export function nearestTipsForYear(tips: FedInvestTips[], year: number): FedInvestTips | null {
  let best: FedInvestTips | null = null
  let bestDistance = Number.POSITIVE_INFINITY
  for (const t of tips) {
    const distance = Math.abs(Number(t.maturityIso.slice(0, 4)) - year)
    if (distance < bestDistance) {
      best = t
      bestDistance = distance
    }
  }
  return best && bestDistance <= 1 ? best : null
}
