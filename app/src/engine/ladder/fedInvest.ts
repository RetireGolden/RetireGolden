/**
 * Optional FedInvest live TIPS prices (social-security-bridge-and-tips-ladder,
 * step 5) — the ONLY network touch in the app, and it is strictly opt-in.
 *
 * Privacy posture:
 *  - Nothing runs without an explicit button press; there is no background
 *    refresh, no fetch on page load, and the embedded real-yield curve always
 *    remains the planning source of truth (offline-first).
 *  - The request goes directly to the U.S. Treasury's FedInvest service and
 *    carries only a price date — never any plan data.
 *  - Responses are cached per day in localStorage (`retiregolden.fedinvest.v1`),
 *    so repeat looks are served offline; "Clear all data" removes the cache.
 *  - FedInvest does not currently send CORS headers, so the direct fetch can
 *    be blocked by the browser. The UI degrades to a manual import of the
 *    same `securityprice.csv` the FedInvest site downloads — zero network
 *    from the app, same data, same cache.
 *
 * Data: FedInvest publishes end-of-day prices per $100 face for every
 * marketable Treasury, including TIPS, keyed by CUSIP (CSV columns: cusip,
 * security type, rate as a decimal fraction, maturity date, call date, buy,
 * sell, end-of-day). We surface the TIPS rows as a reference against the
 * embedded-curve quote. (Planning note: TIPS trade with a separate inflation
 * index ratio FedInvest does not include, so these prices sanity-check the
 * quote rather than replace it.)
 */

import { STORAGE_KEYS, readLocal, writeLocal } from '../../data/localStore'

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
const FEDINVEST_CSV_URL = 'https://www.treasurydirect.gov/GA-FI/FedInvest/securityPriceDetail'

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

export function readFedInvestCache(): FedInvestSnapshot | null {
  const raw = readLocal(STORAGE_KEYS.fedInvestCache)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as FedInvestSnapshot
    if (!Array.isArray(parsed.tips)) return null
    if (typeof parsed.priceDateIso !== 'string' && parsed.priceDateIso !== null) return null
    return parsed
  } catch {
    return null
  }
}

function cacheSnapshot(snapshot: FedInvestSnapshot): void {
  writeLocal(STORAGE_KEYS.fedInvestCache, JSON.stringify(snapshot))
}

/**
 * Fetch (cache-first) the TIPS price list for the latest business day. Only
 * ever called from an explicit user action. Throws a readable Error when the
 * network, CORS policy, or parse fails — the caller shows it (offering the
 * manual CSV import) and the app carries on with the embedded curve.
 */
export async function fetchFedInvestTips(now = new Date()): Promise<FedInvestSnapshot> {
  const date = latestPriceDate(now)
  const priceDateIso = localIsoDate(date)
  const cached = readFedInvestCache()
  // Only a same-day FETCHED snapshot satisfies a fetch request: an imported
  // file has no known price date, so it must never suppress a real refresh.
  if (cached && cached.source === 'fetch' && cached.priceDateIso === priceDateIso) return cached

  const body = new URLSearchParams({
    priceDateDay: String(date.getDate()),
    priceDateMonth: String(date.getMonth() + 1),
    priceDateYear: String(date.getFullYear()),
    fileType: 'csv',
    csv: 'CSV FORMAT',
  })
  let response: Response
  try {
    response = await fetch(FEDINVEST_CSV_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })
  } catch {
    throw new Error('Could not reach the Treasury FedInvest service (blocked or offline).')
  }
  if (!response.ok) {
    throw new Error(`The Treasury FedInvest service answered ${response.status}; try again later.`)
  }
  const tips = parseFedInvestCsv(await response.text())
  if (tips.length === 0) {
    throw new Error('FedInvest returned no TIPS rows for the latest business day (a holiday, or the format changed).')
  }
  const snapshot: FedInvestSnapshot = { priceDateIso, fetchedAtIso: new Date().toISOString(), source: 'fetch', tips }
  cacheSnapshot(snapshot)
  return snapshot
}

/**
 * Manual fallback with zero network from the app: the user downloads
 * `securityprice.csv` from the FedInvest site themselves and hands the file
 * content here. The CSV carries no date, so the snapshot's priceDateIso stays
 * null (unknown) rather than guessing — and an import never counts as "fresh"
 * for the fetch cache. Throws a readable Error when the file isn't a
 * FedInvest CSV.
 */
export function importFedInvestCsv(text: string): FedInvestSnapshot {
  const tips = parseFedInvestCsv(text)
  if (tips.length === 0) {
    throw new Error("That file doesn't look like a FedInvest securityprice.csv (no TIPS rows found).")
  }
  const snapshot: FedInvestSnapshot = {
    priceDateIso: null,
    fetchedAtIso: new Date().toISOString(),
    source: 'import',
    tips,
  }
  cacheSnapshot(snapshot)
  return snapshot
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
