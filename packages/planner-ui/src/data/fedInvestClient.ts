/**
 * FedInvest live TIPS prices — the IO half: the ONLY network touch in the
 * app, and it is strictly opt-in. The pure parsing/date/matching half lives
 * in the engine package (`@retiregolden/engine/ladder/fedInvest`); this
 * module owns the fetch and the per-day cache, keeping the engine free of
 * browser globals.
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
 */

import {
  FEDINVEST_CSV_URL,
  latestPriceDate,
  latestPriceDateIso,
  parseFedInvestCsv,
  type FedInvestSnapshot,
} from '@retiregolden/engine/ladder/fedInvest'

import { STORAGE_KEYS, readLocal, writeLocal } from './localStore'

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
  const priceDateIso = latestPriceDateIso(now)
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
