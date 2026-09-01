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
  type FedInvestTips,
} from '@retiregolden/engine/ladder/fedInvest'

import { STORAGE_KEYS, readLocal, writeLocal } from './localStore'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isIsoCalendarDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false
  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

function isIsoTimestamp(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u.test(value)) return false
  const normalized = value.includes('.') ? value : value.replace('Z', '.000Z')
  const date = new Date(value)
  return Number.isFinite(date.getTime()) && date.toISOString() === normalized
}

function isFedInvestTips(value: unknown): value is FedInvestTips {
  return isRecord(value)
    && typeof value.cusip === 'string'
    && value.cusip.length > 0
    && typeof value.ratePct === 'number'
    && Number.isFinite(value.ratePct)
    && isIsoCalendarDate(value.maturityIso)
    && typeof value.endOfDayPrice === 'number'
    && Number.isFinite(value.endOfDayPrice)
    && value.endOfDayPrice > 0
}

function isFedInvestSnapshot(value: unknown): value is FedInvestSnapshot {
  if (!isRecord(value) || !isIsoTimestamp(value.fetchedAtIso) || !Array.isArray(value.tips) || value.tips.length === 0) return false
  if (value.source === 'fetch') {
    if (!isIsoCalendarDate(value.priceDateIso)) return false
  } else if (value.source === 'import') {
    if (value.priceDateIso !== null) return false
  } else {
    return false
  }
  return value.tips.every(isFedInvestTips)
}

export function readFedInvestCache(): FedInvestSnapshot | null {
  const raw = readLocal(STORAGE_KEYS.fedInvestCache)
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    return isFedInvestSnapshot(parsed) ? parsed : null
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
